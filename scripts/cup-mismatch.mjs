// משחקי גביע של קבוצה מקצועית מול קבוצה קטנה שאין עליה נתונים: אין מודל קבוצתי, אבל יש היסטוריה של גביעים.
// מחקר (scripts/cup-research.mjs): תוצאות כל משחקי הגביע שבהם קבוצה מליגת-על/ליגה שנייה פגשה קבוצה מהליגות הנמוכות.
// מזה בונים התפלגות שערים לכל צד, ומחשבים כל שוק שיש עליו יחס אמיתי של Bet365 (מעל/מתחת, סך שערים של קבוצה, הנדיקאפ, שתיים כובשות...).
import fs from 'node:fs';
import path from 'node:path';
import { settle, nbPmf, parseRealOdds } from './model.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = x => Math.round(x * 100) / 100;
const TOP = [7, 11, 17, 25, 35, 57, 73, 98, 78, 84, 61, 42];   // ליגות-על (מזהי 365Scores)
const SECOND = [1, 26, 43, 12];                                  // ליגות שנייה
export const CUP_COMPS = [13, 8, 9, 20, 28, 49];
const MAXG = 12;

export function loadCupRows(root) {
  const rows = [];
  for (const c of CUP_COMPS) {
    let g; try { g = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cache', `cup-${c}.json`), 'utf8')); } catch { continue; }
    for (const x of g) {
      const hT = TOP.includes(x.hm), aT = TOP.includes(x.am), hP = hT || SECOND.includes(x.hm), aP = aT || SECOND.includes(x.am);
      if (hP === aP) continue;
      const ph = hP;
      rows.push({ tier: (ph ? hT : aT) ? 'A' : 'B', proHome: ph, pg: ph ? x.g[0] : x.g[1], ag: ph ? x.g[1] : x.g[0] });
    }
  }
  return rows;
}
export const tierOf = m => TOP.includes(m) ? 'A' : SECOND.includes(m) ? 'B' : null;

// התפלגות שערים: שילוב של השכיחות בפועל (אותו דרג ואותו מגרש במשקל מלא, מגרש הפוך במשקל חלקי) עם התפלגות פרמטרית באותו ממוצע
function marginal(sample, key) {
  const W = sample.reduce((s, r) => s + r.w, 0), mean = sample.reduce((s, r) => s + r.w * r[key], 0) / W;
  const par = nbPmf(mean, 1.12), wE = W / (W + 25);   // phi>1: קצת פיזור יתר מעל פואסון
  const emp = Array(par.length).fill(0); for (const r of sample) emp[Math.min(par.length - 1, r[key])] += r.w / W;
  const out = emp.map((p, i) => wE * p + (1 - wE) * (par[i] || 0)), s = out.reduce((a, b) => a + b, 0);
  return { pmf: out.map(p => p / s), mean };
}

// fx: מקטע המשחק (נתוני היום). proSide: 'h' או 'a'. bets: יחסי Bet365 גולמיים.
export function cupMarkets(fx, tier, proSide, bets, rows, names) {
  const wOf = r => (r.tier === tier ? 1 : 0.35) * (r.proHome === (proSide === 'h') ? 1 : 0.6);
  const sample = rows.map(r => ({ ...r, w: wOf(r) })).filter(r => r.w > 0);
  const nEff = sample.reduce((s, r) => s + r.w, 0);
  if (nEff < 20) return null;
  const P = marginal(sample, 'pg'), A = marginal(sample, 'ag');
  const dh = proSide === 'h' ? P.pmf : A.pmf, da = proSide === 'h' ? A.pmf : P.pmf;
  // רשימת שווקים עם יחס אמיתי: מהקיים במודל + הנדיקאפ שערים
  const list = parseRealOdds(bets).filter(o => o.stat === 'g');
  const ah = (bets || []).find(b => /^asian handicap$/i.test(b.name));
  if (ah) for (const v of ah.values) { const m = String(v.value).match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)$/i); if (m) { const side = m[1].toLowerCase(), hl = parseFloat(m[2]); list.push({ stat: 'g', group: 'ah', side, line: side === 'home' ? hl : -hl, hl, odds: parseFloat(v.odd) }); } }
  for (const o of list) if (o.group === 'ah') { const q = list.find(x => x.group === 'ah' && x.hl === o.hl && x.side !== o.side); if (q) o.pMarket = (1 / o.odds) / (1 / o.odds + 1 / q.odds); }
  const [H, Aw] = [names.h, names.a];
  const label = m => {
    if (m.group === 'total') return `${m.side === 'over' ? 'מעל' : 'מתחת ל-'}${m.side === 'over' ? ' ' : ''}${m.line} שערים במשחק`;
    if (m.group === 'home') return `${H} – ${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} שערים`;
    if (m.group === 'away') return `${Aw} – ${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} שערים`;
    if (m.group === 'btts') return m.side === 'yes' ? 'שתי הקבוצות כובשות' : 'לפחות קבוצה אחת לא כובשת';
    if (m.group === 'dc') return m.side === '1x' ? `${H} לא מפסידה (1X)` : m.side === 'x2' ? `${Aw} לא מפסידה (X2)` : 'לא תיקו (12)';
    if (m.group === '1x2') return m.side === 'home' ? `${H} מנצחת` : m.side === 'away' ? `${Aw} מנצחת` : 'תיקו';
    if (m.group === 'ah') return `${m.side === 'home' ? H : Aw} ${m.line > 0 ? '+' : ''}${m.line} הנדיקאפ`;
    return '?';
  };
  const conf = clamp(nEff / 60, 0.3, 1) * 0.9;
  // התאמה לשוק: מכוונים את ממוצעי השערים של שתי הקבוצות כך שהמודל יתאים לסיכוי הניצחון ולקו השערים המרכזי של Bet365.
  // ההיסטוריה מייצגת קבוצה קטנה "ממוצעת", והשוק יודע עד כמה היריבה הספציפית חלשה. ההמלצה צריכה להיות מקובלת על שניהם.
  let fit = null, proWin = null;
  {
    const ox = k => list.find(o => o.group === '1x2' && o.side === k);
    const h1 = ox('home'), d1 = ox('draw'), a1 = ox('away');
    const cen = list.filter(o => o.group === 'total' && o.side === 'over' && o.pMarket != null).sort((x, y) => Math.abs(x.pMarket - 0.5) - Math.abs(y.pMarket - 0.5))[0];
    if (h1 && d1 && a1 && cen) {
      const t = 1 / h1.odds + 1 / d1.odds + 1 / a1.odds, pw = (proSide === 'h' ? 1 / h1.odds : 1 / a1.odds) / t, pOv = cen.pMarket; proWin = pw;
      const wk = { stat: 'g', group: '1x2', side: proSide === 'h' ? 'home' : 'away', line: null }, ok = { stat: 'g', group: 'total', side: 'over', line: cen.line };
      for (let kp = 0.5; kp <= 3.3; kp += 0.1) for (let ka = 0.1; ka <= 2.1; ka += 0.1) {
        const pp = nbPmf(P.mean * kp, 1.12), oo = nbPmf(A.mean * ka, 1.12), dh2 = proSide === 'h' ? pp : oo, da2 = proSide === 'h' ? oo : pp;
        const err = (settle(wk, dh2, da2).win - pw) ** 2 + (settle(ok, dh2, da2).win - pOv) ** 2;
        if (!fit || err < fit.err) fit = { err, dh: dh2, da: da2, kp, ka };
      }
    }
  }
  const out = [];
  for (const o of list) {
    if (!(o.odds >= 1.45 && o.odds <= 3.2) || !['total', 'home', 'away', 'btts', 'dc', '1x2', 'ah'].includes(o.group)) continue;
    const mk = { stat: 'g', group: o.group, side: o.side, line: o.line ?? null };
    const s = settle(mk, dh, da), den = s.win + s.lose; if (den <= 0) continue;
    const pHist = s.win / den, pMarket = o.pMarket ?? null;
    let pFit = pHist; if (fit) { const sf = settle(mk, fit.dh, fit.da); if (sf.win + sf.lose > 0) pFit = sf.win / (sf.win + sf.lose); }
    const pFinal = pMarket != null ? 0.45 * pFit + 0.25 * pHist + 0.3 * pMarket : 0.6 * pFit + 0.4 * pHist;
    if (Math.min(pFit, pHist) < 0.6) continue;     // חייבים להסכים גם ההיסטוריה וגם ההתאמה לשוק
    // לקח מהתוצאות (אלאבס 6:1 על קבוצה קטנה): כשהשוק נותן למקצועית 90% ומעלה, הזנב של "ניצחון ענק" כבד.
    // לכן לא ממליצים בכלל על הימורים שמפסידים בניצחון ענק: מתחת לשערים, מתחת לשערי המקצועית, והנדיקאפ לטובת הקטנה
    if (proWin != null && proWin >= 0.9) {
      const proKey = proSide === 'h' ? 'home' : 'away', oppKey = proSide === 'h' ? 'away' : 'home';
      if ((o.group === 'total' || o.group === proKey) && o.side === 'under') continue;
      if (o.group === 'ah' && o.side === oppKey) continue;
    }
    const diff = Math.abs(pHist - pFit);
    let S = (pFinal - 0.45) / 0.35;
    if (diff > 0.15) S -= (diff - 0.15) * 2;        // פער בין ההיסטוריה להתאמה לשוק: מפחיתים ביטחון
    let sc = 1 + 9 * clamp(S, 0, 1);
    sc *= 0.55 + 0.45 * conf;
    sc = Math.min(sc, 8);                           // בלי מודל קבוצתי, לא מעל 8
    if (o.odds < 1.5) sc = Math.min(sc, 7);
    const checks = [{ k: 'ok', t: `בהיסטוריית הגביעים: ${pHist >= 0.85 ? 'כמעט תמיד' : pHist >= 0.7 ? 'ברוב המשחקים' : 'ברוב המשחקים, אבל לא בביטחון'} ההימור הזה עבר במשחקים דומים` }];
    if (fit) checks.push({ k: pFit >= 0.65 ? 'ok' : 'bad', t: `אחרי התאמה ליחסי Bet365 של המשחק (עד כמה היריבה חלשה) ${pFit >= 0.65 ? 'ההימור עדיין חזק' : 'ההימור פחות חזק'}` });
    const anomaly = pMarket != null && pHist - pMarket > 0.3;
    if (anomaly) { sc = Math.min(sc, 5); checks.push({ k: 'bad', t: 'הקו של Bet365 רחוק מאוד מההיסטוריה: כדאי לוודא את היחס באתר לפני שמהמרים' }); }
    const score = clamp(Math.round(sc), 1, 10);
    out.push({ ...mk, odds: o.odds, pMarket: pMarket != null ? r2(pMarket) : null, label: label(mk), pModel: r2(pFit), pHist: r2(pHist), pFinal: r2(pFinal), push: r2(s.push), fair: r2(1 / pFinal), minOdds: r2(1 / pFinal), ev: r2(pFinal * (o.odds - 1) - (1 - pFinal)), hist: {}, score, checks, anomaly: anomaly || undefined, why: `לפי ${Math.round(nEff)} משחקי גביע קודמים של קבוצות מקצועיות מול קבוצות מהליגות הנמוכות, ואחרי התאמה ליחסי המשחק עצמו (יחס ${o.odds}).` });
  }
  out.sort((a, b) => b.score - a.score || b.ev - a.ev);
  const seen = new Set(), best = [];
  for (const m of out) { const k = m.group + '|' + m.side; if (seen.has(k) && m.score < 7) continue; seen.add(k); best.push(m); }
  return { markets: best.slice(0, 12), summary: { n: Math.round(nEff), proMean: r2(P.mean), oppMean: r2(A.mean), tier, conf: r2(conf) } };
}

// ---------- משיכת היסטוריית גביעים ומיון הקבוצות של היום ----------
import { http, dayGames } from './source-365.mjs';
const Q = 'langId=1&timezoneId=15&userCountryId=6&apptype=5';
async function fetchCup(root, comp, pages = 10) {
  const seen = new Map();
  const first = await http(`https://webws.365scores.com/web/games/current/?${Q}&competitions=${comp}&games=100`);
  for (const g of (first && first.games) || []) seen.set(g.id, g);
  for (let i = 0; i < pages; i++) {
    const oldest = [...seen.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))[0]; if (!oldest) break;
    const back = await http(`https://webws.365scores.com/web/games/?${Q}&competitions=${comp}&games=100&aftergame=${oldest.id}&direction=-1`);
    const gs = (back && back.games) || []; let added = 0;
    for (const g of gs) if (!seen.has(g.id)) { seen.set(g.id, g); added++; }
    if (!added) break;
  }
  const out = [...seen.values()].filter(g => g.statusGroup === 4 && g.homeCompetitor && g.awayCompetitor && g.homeCompetitor.score >= 0 && g.awayCompetitor.score >= 0)
    .map(g => ({ id: g.id, t: g.startTime, stage: g.stageName, h: g.homeCompetitor.name, a: g.awayCompetitor.name, hm: g.homeCompetitor.mainCompetitionId, am: g.awayCompetitor.mainCompetitionId, g: [g.homeCompetitor.score, g.awayCompetitor.score] }));
  fs.mkdirSync(path.join(root, 'data', 'cache'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'cache', `cup-${comp}.json`), JSON.stringify(out));
  return out.length;
}
// מרענן את היסטוריית הגביעים אם היא ישנה מ-20 שעות
export async function refreshCups(root, log = () => {}) {
  for (const c of CUP_COMPS) {
    const f = path.join(root, 'data', 'cache', `cup-${c}.json`);
    let age = Infinity; try { age = Date.now() - fs.statSync(f).mtimeMs; } catch { /* אין */ }
    if (age < 20 * 3600e3) continue;
    try { const n = await fetchCup(root, c); log(`גביע ${c}: ${n} משחקים בהיסטוריה`); } catch (e) { log(`גביע ${c} נכשל: ${e.message}`); }
  }
}
// ליגת האם של כל קבוצה במשחקי היום (לזיהוי קבוצה מקצועית מול קבוצה קטנה)
export async function cupClass(root, today) {
  const f = path.join(root, 'data', 'cache', `cupcls-${today}.json`);
  try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return new Map(Object.entries(c)); } catch { /* אין */ }
  const games = await dayGames(today), obj = {};
  for (const g of games) if (g.homeCompetitor && g.awayCompetitor) obj[String(g.id)] = { hm: g.homeCompetitor.mainCompetitionId, am: g.awayCompetitor.mainCompetitionId };
  fs.writeFileSync(f, JSON.stringify(obj));
  return new Map(Object.entries(obj));
}
