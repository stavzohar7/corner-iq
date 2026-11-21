// בוחר הימורי כדורסל (NBA / יורוליג) מקווי fivebet מול הצפי של המודל, ומכין טיוטת spec לטפסים.
// שימוש: node scripts/bb-select.mjs [DATE]   (קורא data/cache/siteodds/bb-DATE.json, כותב data/cache/bb-spec-DATE.json ומדפיס טבלה)
// bb-DATE.json = { "games": [ { "id": 4812440, "ladders": { hc:[[קו,יחס1,יחס2]...], tot:[[קו,over,under]...], t1:[...], t2:[...], r:[יחס1,יחס2] } } ] }
// כיוון fivebet: NBA = קבוצה 1 היא האורחת. יורוליג = קבוצה 1 היא המארחת.
// שיטה (כמו בכדורגל): הימור בכל סוג שנראה חזק (סך נקודות "מתחת", נקודות מארחת "מעל", הנדיקאפ מארחת, ניצחון מארחת), הסיכוי מתוקן לפי התוצאות האמיתיות שלנו לאותו סוג,
// נבדק מול הממוצעים בפועל של שתי הקבוצות (בבית ובחוץ), ובכל הימור נימוק שמבין את המשחק.
// כללי יחס: הימור בודד במשחק לפחות 1.4. שני הימורים באותו משחק: כל אחד לפחות 1.2 ויחד לפחות 1.8. הימור שני נוסף רק אם הוא גם חזק ולא סותר.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extCands, buildLogs, loadBox } from './bb-ext.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const site = readJson(path.join(ROOT, 'data', 'cache', 'siteodds', `bb-${date}.json`)), day = readJson(path.join(ROOT, 'data', 'bball', `${date}.json`));
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '').trim();
let CAL = {}; try { CAL = readJson(path.join(ROOT, 'data', 'knowledge', 'calibration.json')).sports.b.kinds || {}; } catch (e) {}
const calKey = key => { const p = key.split('|'); return p[0] === 'pst' ? 'pst|' + p[2] : p[0] === 'ts' ? 'ts|' + p[1] : p.slice(0, 2).join('|'); };
const calFix = key => { const K = CAL[calKey(key)]; if (!K || !K.n) return -0.03; return Math.max(-0.25, Math.min(0.12, (K.hit - K.expected) * K.n / (K.n + 15))); };

// התפלגות נורמלית
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
const SD = { 103: { m: 12.5, t: 17.5, team: 11.5 }, 569: { m: 10.5, t: 14, team: 8.5 } };
const fair = (a, b) => (1 / a) / (1 / a + 1 / b);
const r1 = x => Math.round(x * 10) / 10;

// ממוצעים בפועל של שתי הקבוצות: מארחת בבית מול אורחת בחוץ (הצפי ממוצע ההתקפה של האחת וההגנה של השנייה)
function avgs(g) {
  const H = g.home, A = g.away, hh = H && H.home && H.home.n >= 3 ? H.home : H, aa = A && A.away && A.away.n >= 3 ? A.away : A;
  if (!hh || !aa || !(hh.ppg > 0) || !(aa.ppg > 0)) return null;
  const hp = (hh.ppg + aa.opp) / 2, ap = (aa.ppg + hh.opp) / 2;
  return { hp, ap, total: hp + ap, margin: hp - ap, hh, aa };
}
// נימוק שמבין את המשחק
const endDot = x => /[.!?]$/.test(x) ? x : x + '.';
function whyOf(g, kind, av, logic) {
  const S = (g.story || []).map(clean), pick = re => S.find(x => re.test(x)) || '';
  const nature = S[0] || '', pace = pick(/^בנקודות/), teams = pick(/: .*\(\d+-\d+/), inj = pick(/^חיסורים/), hth = pick(/בבית \d+-\d+/);
  const base = av || teams, parts = kind === 'prop' ? [logic, nature, inj] : kind === 'th' ? [base, inj, logic] : [nature, base, inj, logic];
  const seen = new Set(), out = [];
  for (const p of parts) { const t = clean(p); if (!t || seen.has(t)) continue; seen.add(t); out.push(endDot(t)); }
  return out.slice(0, 4).join(' ');
}

const PLB = loadBox(ROOT), LOGS = buildLogs(PLB, Date.now() / 1000);
const cands = [];
for (const G of site.games) {
  const g = day.fixtures.find(f => String(f.id) === String(G.id)); if (!g || (!process.env.BB_ALL && g.ts * 1000 < Date.now() + 10 * 60e3) || !g.exp) continue;
  const sd = SD[g.comp] || SD[103], e = g.exp, L = G.ladders, nba = g.comp === 103, AV = avgs(g);
  const hN = clean(g.home.name), aN = clean(g.away.name), name = hN + '–' + aN, game = { id: g.id, name, comp: g.comp, e, g };
  const half = ln => Math.abs(ln * 2 - Math.round(ln * 2)) < 1e-9 && Math.round(ln * 2) % 2 === 1;   // רק קווים עם .5 (בלי החזר)
  const avLine = AV ? `${hN} קולעת בממוצע ${r1(AV.hh.ppg)} נקודות בבית וסופגת ${r1(AV.hh.opp)}. ${aN} קולעת בממוצע ${r1(AV.aa.ppg)} נקודות בחוץ וסופגת ${r1(AV.aa.opp)}.` : '';
  const add = (key, label, odds, pm, ps, kind, logic, block, dStyle, tier) => {
    if (!(odds >= 1.2) || pm == null || block) return;
    if (tier === 'prop') pm = 0.7 * pm + 0.3 * ps;   // שווקים חדשים שעוד לא נבדקו מול תוצאות: נותנים משקל גדול יותר ליחס של האתר
    const pb = Math.min(0.95, Math.max(0.05, 0.5 * pm + 0.5 * ps + calFix(key) + (dStyle || 0)));
    cands.push({ game, key, label: `${label} (${name})`, odds, pm: +pm.toFixed(3), ps: +ps.toFixed(3), pb: +pb.toFixed(3), gap: +Math.abs(pm - ps).toFixed(3), ev: +(pb * odds - 1).toFixed(3), kind, tier: tier || null, why: whyOf(g, tier === 'prop' ? 'prop' : key.split('|')[0], avLine, logic) });
  };
  // סך נקודות: רק "מתחת", ורק כשהקו גבוה מהצפי. נבדק מול הממוצע בפועל של שתי הקבוצות: הקו חייב להיות גבוה ממנו ב-4 נקודות לפחות
  for (const [ln, o, u] of L.tot || []) if (half(ln) && ln >= e.total + 6) {
    const gapAvg = AV ? ln - AV.total : null;
    add(`total|under|${ln}`, `מתחת ל-${ln} נקודות במשחק`, u, cdf((ln - e.total) / sd.t), fair(u, o), 'total-under',
      `הצפי שלנו לסך הנקודות הוא ${r1(e.total)}${AV ? ` (הממוצעים של שתי הקבוצות יחד מביאים בערך ${r1(AV.total)})` : ''}, והקו באתר הוא ${ln}, גבוה בערך ב-${r1(ln - e.total)} נקודות מהצפי.`,
      gapAvg != null && gapAvg < 4, gapAvg != null ? Math.max(-0.08, Math.min(0.05, (gapAvg - 6) * 0.004)) : 0);
  }
  // נקודות של קבוצה מארחת: "מעל"
  const homeT = nba ? L.t2 : L.t1;
  for (const [ln, o, u] of homeT || []) if (half(ln) && ln <= e.h - 3) {
    const gapAvg = AV ? AV.hp - ln : null;
    add(`th|over|${ln}`, `${hN} מעל ${ln} נקודות`, o, 1 - cdf((ln - e.h) / sd.team), fair(o, u), 'home-over',
      `הצפי שלנו ל${hN} הוא ${r1(e.h)} נקודות${AV ? ` (לפי הממוצעים של שתי הקבוצות: בערך ${r1(AV.hp)})` : ''}, והקו באתר הוא ${ln}.`,
      gapAvg != null && gapAvg < 2, gapAvg != null ? Math.max(-0.08, Math.min(0.05, (gapAvg - 3) * 0.006)) : 0);
  }
  // הנדיקאפ ושורת ניצחון של מארחת
  for (const [ln, o1, o2] of L.hc || []) {
    const homeLine = nba ? -ln : ln, homeOdds = nba ? o2 : o1; if (!half(homeLine)) continue;
    const pm = 1 - cdf((-homeLine - e.margin) / sd.m), ps = fair(homeOdds, nba ? o1 : o2);
    if (-homeLine <= e.margin - 2) {
      const cov = AV ? AV.margin + homeLine : null;
      add(`spread|home|${homeLine}`, `${hN} ${homeLine > 0 ? '+' : ''}${homeLine} הנדיקאפ`, homeOdds, pm, ps, 'home-spread',
        homeLine > 0 ? `${hN} מקבלת יתרון של ${homeLine} נקודות, ולכן ההימור מפסיד רק אם ${aN} מנצחת בהפרש של יותר מ-${homeLine}. הצפי שלנו הוא ${e.margin >= 0 ? `ניצחון של ${hN} בכ-${r1(e.margin)} נקודות` : `${aN} מנצחת בכ-${r1(-e.margin)} נקודות בלבד`}.` : `${hN} צריכה לנצח בהפרש של יותר מ-${-homeLine} נקודות, והצפי שלנו הוא ניצחון בכ-${r1(e.margin)}.`,
        cov != null && cov < 1, cov != null ? Math.max(-0.08, Math.min(0.05, (cov - 2) * 0.006)) : 0);
    }
  }
  if (L.r && L.r.length >= 2 && e.margin >= 3) {
    const homeOdds = nba ? L.r[1] : L.r[0], awayOdds = nba ? L.r[0] : L.r[1];
    add('ml|home|', `${hN} מנצחת`, homeOdds, cdf(e.margin / sd.m), fair(homeOdds, awayOdds), 'home-win',
      `${hN} הפייבוריטית: הצפי שלנו הוא ניצחון בכ-${r1(e.margin)} נקודות.`, AV && AV.margin < 1, AV ? Math.max(-0.08, Math.min(0.05, (AV.margin - 3) * 0.006)) : 0);
  }
  try { extCands({ g, G, e, nba, hN, aN, PL: PLB, add, logs: LOGS }); } catch (err) { console.error('ext', name, err.message); }
}
const ok = c => c.tier === 'prop' ? (c.pb >= 0.64 && c.gap <= 0.18) : (c.pb >= 0.58 && c.gap <= 0.25);
for (const c of cands) c.rk = c.pb - (c.tier === 'prop' ? 0.04 : 0);   // שווקים חדשים שעוד לא נבדקו: מדורגים נמוך יותר, כך שהימור מאומת בשווי דומה קודם
const pool = cands.filter(ok).sort((a, b) => b.rk - a.rk);
if (process.env.BB_DEBUG) for (const c of cands.filter(c => c.tier === 'prop').sort((a, b) => b.pb - a.pb)) console.log((ok(c) ? 'OK ' : '-- ') + c.pb.toFixed(2) + ' @' + c.odds + ' (מודל ' + c.pm + ', אתר ' + c.ps + ') ' + c.label + ' [' + c.key + ']');
const leg = (c, sp) => ({ sport: sp, id: c.game.id, key: c.key, label: c.label, odds: c.odds, score: c.pb >= 0.64 ? 7 : 6, p: c.pb, ev: c.ev, why: c.why });
const bySport = c => c.game.comp === 103 ? 'n' : 'e';
const spec = { date, strong: {}, second: {} };
// טפסים חזקים: עד 3 משחקים. הימור שני באותו משחק רק אם הוא חזק (רף גבוה), מסוג שונה ולא סותר, ושני ההימורים יחד ביחס 1.8 לפחות.
const PAIR_MIN = 0.62, kindOf = c => c.key.split('|')[0];
// ב-fivebet אפשר לשלב ב-Bet Builder כל שני שווקים מאותו משחק. כאן: כל שני סוגים שונים, חוץ מכפילות (ניצחון+הנדיקאפ) וסתירה (סך נקודות מתחת עם קבוצה מעל, או להפך)
const mktId = c => { const p = c.key.split('|'); return p[0] === 'pst' || p[0] === 'ts' ? p.slice(0, 3).join('|') : p.slice(0, 2).join('|'); };
const totSide = c => { const p = c.key.split('|'); if (p[0] === 'total' || p[0] === 'th') return p[1]; if (/^(q[1-4]|h[12])$/.test(p[0]) && p[1] === 'total') return p[2]; if (p[0] === 'ts') return p[3]; return null; };
const isPer = c => /^(q[1-4]|h[12])$/.test(c.key.split('|')[0]);
const okPair = (x, y) => { if (mktId(x) === mktId(y)) return false; if (isPer(x) && isPer(y)) return false; const kx = kindOf(x), ky = kindOf(y); if ([kx, ky].sort().join('+') === 'ml+spread') return false; const sx = totSide(x), sy = totSide(y); if (sx && sy && sx !== sy && kx !== 'pst' && ky !== 'pst') return false; if (kx === 'ts' && ky === 'ts' && x.key.split('|')[1] === y.key.split('|')[1]) return false; if ((kx === 'pst') && (ky === 'pst') && x.key.split('|')[1] === y.key.split('|')[1]) return false; return true; };
function pickBB(T, exclGames) {
  const byGame = new Map(); for (const c of T) { if (exclGames.has(c.game.id)) continue; (byGame.get(c.game.id) || byGame.set(c.game.id, []).get(c.game.id)).push(c); }
  const opts = [];
  for (const L of byGame.values()) {
    L.sort((x, y) => y.rk - x.rk);
    let pair = null;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j]; if (!okPair(x, y) || Math.min(x.pb, y.pb) < PAIR_MIN || x.odds * y.odds < 1.8) continue; const p = x.pb * y.pb; if (!pair || p > pair.p) pair = { p, legs: [x, y] }; }
    const single = L.find(c => c.odds >= 1.4);
    if (pair && (!single || pair.p >= single.pb * 0.62)) opts.push({ sc: Math.max(pair.legs[0].rk, pair.legs[1].rk) + 0.04, id: L[0].game.id, legs: pair.legs });
    else if (single) opts.push({ sc: single.rk, id: single.game.id, legs: [single] });
  }
  return opts.sort((x, y) => y.sc - x.sc);
}
// יחס כולל לפחות 3.5 (יעד 4-5): מוסיפים משחקים חזקים נוספים עד שמגיעים, ואם עדיין לא מגיעים לא מציגים טופס
const prodO = os => os.reduce((p, o) => p * o.legs.reduce((q, c) => q * c.odds, 1), 1);
function bandBB(opts, min = 3) { const A = opts.slice(0, min); let i = min; while (prodO(A) < 3.5 && i < opts.length && A.length < 5) A.push(opts[i++]); return prodO(A) >= 3.5 ? A : []; }
for (const sp of ['n', 'e']) {
  const T = pool.filter(c => bySport(c) === sp);
  const A = bandBB(pickBB(T, new Set()), sp === 'e' ? 1 : 3);
  if (A.length >= 1) {
    spec.strong[sp] = A.flatMap(o => o.legs).map(c => leg(c, sp));
    if (sp !== 'e') { const used = new Set(A.map(o => o.id)), B = bandBB(pickBB(T, used)); if (B.length >= 3) spec.second[sp] = B.flatMap(o => o.legs).map(c => leg(c, sp)); }
  }
}
fs.writeFileSync(path.join(ROOT, 'data', 'cache', `bb-spec-${date}.json`), JSON.stringify(spec, null, 1));
console.log(`מועמדים: ${cands.length}, עוברים: ${pool.length}`);
for (const c of pool.slice(0, 14)) console.log(`${c.pb.toFixed(2)} @${c.odds} (מודל ${c.pm}, אתר ${c.ps}) ${c.label}`);
console.log('טיוטת טפסים:', Object.entries(spec.strong).map(([k, v]) => 'חזק ' + k + ' x' + v.length).join(' · '), Object.entries(spec.second).map(([k, v]) => 'שני ' + k + ' x' + v.length).join(' · '));
