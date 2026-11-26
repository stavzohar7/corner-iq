// בוחר הימורי כדורגל מיחסי fivebet (בלבד, בלי יחס משוער) מול הצפי של המודל, ובונה את כל סוגי הטפסים של היום.
// שימוש: node scripts/fb-select.mjs [DATE]
//   קלט: data/cache/siteodds/fb-DATE-*.json  (מערכי משחקים מ-window.__fbExport() של scripts/fivebet-fb.js, קובץ לכל ליגה)
//   פלט: data/cache/fb-spec-DATE.json (ל-fivebet-write.mjs) + טבלה בטרמינל. אחר כך המנתח (Claude) עובר על ההימורים, מתקן ומשלים "why".
// טפסים: חזק + שני (מכל המשחקים), טפסי שעות (צבר של עד שעה וחצי), טפסים קבועים (בונדסליגה שבת 16:30, פרמייר ליג שבת 17:00), וטופס חזק לכל ליגה.
// כללי בחירה: הסתברות משולבת (חצי מודל, חצי מחיר האתר) 0.58 ומעלה (ובליגות קטנות יורדים עד 0.5 כדי שיהיה טופס), פער מודל/אתר עד 0.2,
// ועדיפות לפי הלקחים: בעיטות "מעל", בעיטות למסגרת, כפולה (X2/12), "לא מפסידה" + סך שערים, שערים "מעל", קבוצה כובשת. פחות: שערים/קרנות "מתחת", הנדיקאפ שערים, בעיטות "מתחת".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResolver } from './context.mjs';
import { profile, styleFit } from './style.mjs';
import { LEAGUES } from './config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '');
const dir = path.join(ROOT, 'data', 'cache', 'siteodds');
// כל קבצי fb-*.json (קובץ לליגה, יכול להכיל כמה ימים). לכל משחק יש date בפורמט DD.MM: לוקחים רק את התאריך המבוקש, ובכפילות (אותו gid בכמה קבצים) הקובץ החדש יותר מנצח
const DDMM = date.slice(8, 10) + '.' + date.slice(5, 7);
const files = fs.readdirSync(dir).filter(f => /^fb-\d{4}-\d{2}-\d{2}.*\.json$/.test(f)).sort((x, y) => fs.statSync(path.join(dir, x)).mtimeMs - fs.statSync(path.join(dir, y)).mtimeMs);
const byGid = new Map(); for (const f of files) for (const g of readJson(path.join(dir, f))) if (!g.date || g.date === DDMM) byGid.set(g.gid || (g.h + g.a), g);
const games = [...byGid.values()];
if (!games.length) { console.error('אין משחקי ' + DDMM + ' בקבצי fb-*.json ב-data/cache/siteodds'); process.exit(1); }
const day = readJson(path.join(ROOT, 'data', 'days', `${date}.json`));
const teams = Object.fromEntries(Object.entries(readJson(path.join(ROOT, 'data', 'cache', 'matches.json')).teams).filter(([k]) => String(k).includes(':')));
const resolve = buildResolver(teams);
const resolveAny = buildResolver(readJson(path.join(ROOT, 'data', 'cache', 'matches.json')).teams);   // גם קבוצות שמזהה שלהן מ-365 (בלי football-data), כדי שמשחק לא ידולג
// כיול מהתוצאות האמיתיות שלנו (data/knowledge/calibration.json): לכל סוג הימור, כמה פעמים עבר מול כמה שהמודל צפה.
// תיקון הסיכוי לפי ההפרש, מוקטן כשיש מעט דוגמאות. סוג שאין עליו היסטוריה מקבל הורדה קטנה ("לא הוכח").
let CAL = {}; try { CAL = readJson(path.join(ROOT, 'data', 'knowledge', 'calibration.json')).sports.f.kinds || {}; } catch (e) {}
// תיקון לפי מה שקרה בפועל להימורים שהמלצנו (data/betlog.json): לכל סוג, שיעור הצלחה בפועל פחות מה שהמחיר של fivebet רומז (0.95/יחס).
// סוג שעבר יותר ממה שהמחיר רומז מקבל תוספת, סוג שנפל מקבל הורדה; מוקטן כשיש מעט דוגמאות. סוג בלי היסטוריה: הורדה קטנה ("לא הוכח").
const REAL = (() => { const by = {}; try { for (const x of readJson(path.join(ROOT, 'data', 'betlog.json')).bets) { if (x.sp !== 'f' || (x.r !== 'w' && x.r !== 'l') || !(x.o > 1)) continue; const k = x.k.split('|').slice(0, 3).join('|'), v = by[k] || (by[k] = { n: 0, w: 0, imp: 0 }); v.n++; if (x.r === 'w') v.w++; v.imp += 0.95 / x.o; } } catch (e) {} return by; })();
const calFix = key => { const K = REAL[key.split('|').slice(0, 3).join('|')]; if (!K || K.n < 3) return -0.03; return Math.max(-0.2, Math.min(0.08, (K.w - K.imp) / K.n * K.n / (K.n + 10))); };

// ---------- התפלגויות ----------
const PHI = { g: 1.15, c: 1.45, c1: 1.4, sh: 1.5, sot: 1.4 };
const nb = (m, phi, n = 70) => { const p = []; if (!(m > 0)) return [1]; if (phi <= 1.01) { let v = Math.exp(-m); p.push(v); for (let k = 1; k < n; k++) { v = v * m / k; p.push(v); } return p; }
  const r = m / (phi - 1), q = (phi - 1) / phi; let v = Math.pow(1 - q, r); p.push(v); for (let k = 1; k < n; k++) { v = v * (k - 1 + r) / k * q; p.push(v); } return p; };
const conv = (a, b) => { const o = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o; };
const fair2 = (a, b) => (1 / a) / (1 / a + 1 / b);
const MARGIN = 1.07;
// משקל המודל מול מחיר השוק בסיכוי הסופי. בדיקה על 181 הימורים שנגמרו: הסיכוי שהמודל טען (בממוצע 0.8) מול מה שעבר בפועל (0.65) הראה ביטחון יתר, והמחיר של fivebet חזה טוב יותר. לכן השוק מקבל את רוב המשקל.
const PM_W = 0.35;
// מנצחת / מפסידה / החזר (קו שלם)
const wl = (probFn, vals) => { let w = 0, l = 0; for (const [x, p] of vals) { const r = probFn(x); if (r > 0) w += p; else if (r < 0) l += p; } return w / Math.max(1e-9, w + l); };

// ---------- התאמת משחקי fivebet לשלנו ----------
// קבוצות שאין להן מזהה football-data (בעיקר קבוצות קטנות באירופה): שם ב-fivebet באנגלית -> מזהה הקבוצה אצלנו. להוסיף כשיש "לא הותאמו"
const EXTRA_IDS = { 'bodo glimt': 1978, 'lask linz': 1743, 'slovan bratislava': 2112 };
const bySig = new Map();
for (const f of day.fixtures) bySig.set(String(f.home.id) + '|' + String(f.away.id), f);
const unmatched = [], matched = [];
for (const G of games) {
  const xid = n => EXTRA_IDS[String(n).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()] || resolveAny(n), hid = resolve(G.h) || xid(G.h), aid = resolve(G.a) || xid(G.a), f = bySig.get(String(hid) + '|' + String(aid));
  if (!f) { unmatched.push(`${G.h} - ${G.a}`); continue; }
  matched.push({ G, f });
}

let EXPERT = {}; try { EXPERT = readJson(path.join(ROOT, 'data', 'expert', date + '.json')); } catch (e) {}   // דעות המנתח על משחקים (take + adj לכל הימור)
// ---------- למידת קבוצות: איך כל קבוצה באמת התנהגה מול הקו המדויק ----------
// לכל קבוצה: המשחקים האחרונים שלה בבית ובחוץ מתוך מאגר המשחקים. לכל הימור (סך / קבוצה, שערים/קרנות/בעיטות) בודקים באיזה שיעור מהמשחקים האלה הקו עבר,
// ומערבבים עם הסיכוי של המודל (משקל עד 0.3, גדל עם מספר המשחקים). כך קבוצה שתמיד חורגת מהצפי (או תמיד נשארת מתחתיו) מתוקנת לפי ההתנהגות האמיתית שלה.
const TEAM_RECS = (() => { const by = new Map(); try { const all = Object.values(readJson(path.join(ROOT, 'data', 'cache', 'matches.json')).matches || {}).filter(r => r.g && r.g[0] != null && r.ts * 1000 < Date.now()).sort((x, y) => y.ts - x.ts);
  for (const r of all) for (const [id, v] of [[r.h, 'h'], [r.a, 'a']]) { const k = String(id) + '|' + v, L = by.get(k) || by.set(k, []).get(k); if (L.length < 14) L.push(r); } } catch (e) {} return by; })();
const statOf = (r, stat, side) => { const i = side === 'h' ? 0 : 1; if (stat === 'g') return r.g[i]; if (stat === 'c1') return r.h1 && r.h1.c ? r.h1.c[i] : null; const v = r.s && r.s[side === 'h' ? 'h' : 'a']; return v ? v[stat] : null; };
const bothOf = (r, stat) => { const x = statOf(r, stat, 'h'), y = statOf(r, stat, 'a'); return x == null || y == null ? null : x + y; };
function empRate(f, stat, grp, side, ln, hid, aid) {
  if (!['g', 'c', 'c1', 'sh', 'sot'].includes(stat) || !['total', 'home', 'away'].includes(grp) || !['over', 'under'].includes(side) || !(ln >= 0)) return null;
  const H = TEAM_RECS.get(String(hid) + '|h') || [], A = TEAM_RECS.get(String(aid) + '|a') || [], xs = [];
  if (grp === 'total') { for (const r of H) xs.push(bothOf(r, stat)); for (const r of A) xs.push(bothOf(r, stat)); }
  else if (grp === 'home') for (const r of H) xs.push(statOf(r, stat, 'h'));
  else for (const r of A) xs.push(statOf(r, stat, 'a'));
  const v = xs.filter(x => x != null && x !== ln); if (v.length < 6) return null;
  const hit = v.filter(x => side === 'over' ? x > ln : x < ln).length; return { p: hit / v.length, n: v.length };
}

// ---------- הימורים ----------
const cands = [];
const hn = f => clean(f.home.name), an = f => clean(f.away.name);
const STAT_HE = { g: 'שערים', c: 'קרנות', c1: 'קרנות במחצית הראשונה', sh: 'בעיטות', sot: 'בעיטות למסגרת' };
const fbAll = {};   // כל יחסי fivebet שנקראו (כל השוקים, בלי סינון), לתצוגה באתר
for (const { G, f } of matched) {
  if ((!process.env.RECS_ALL && f.ts * 1000 < Date.now() + 10 * 60e3) || !f.exp) continue;
  const E = { ...f.exp }, dist = {};
  { const mw = f.character && f.character.mw, fp = mw ? Math.max(mw.h, mw.a) : 0;
    if (fp >= 0.75 && E.c && E.c.h != null) { const homeFav = mw.h >= mw.a, up = 1.5, dn = 1.1; E.c = { ...E.c, h: Math.max(0.5, E.c.h + (homeFav ? up : -dn)), a: Math.max(0.5, E.c.a + (homeFav ? -dn : up)) }; E.c.total = E.c.h + E.c.a; f.__dom = homeFav ? 'h' : 'a'; } } for (const st of ['g', 'c', 'c1', 'sh', 'sot']) if (E[st] && E[st].h != null && E[st].a != null) { const h = nb(E[st].h, PHI[st]), a = nb(E[st].a, PHI[st]); dist[st] = { h, a, t: conv(h, a), e: E[st] }; }
  const LGA = Object.fromEntries(["g", "c", "c1", "sh", "sot"].map(k => [k, E[k] && E[k].lg])), PH = profile(f.home, true, LGA), PA = profile(f.away, false, LGA);
  const add = (stat, key, label, odds, pm, ps, cat, why) => { if (odds > 0) (fbAll[String(f.id)] = fbAll[String(f.id)] || {})[key] = odds; if (pm == null || !(odds >= 1.2 && odds <= 5)) return; const gap = Math.abs(pm - ps); if (gap > 0.2) return; const sf = styleFit(key, hn(f), an(f), PH, PA); if (sf.block) return; let pb = Math.min(0.95, Math.max(0.05, PM_W * pm + (1 - PM_W) * ps + calFix(key) + sf.d)); pb = Math.min(ps + 0.1, Math.max(ps - 0.15, pb)); { const xa = EXPERT[String(f.id)] && EXPERT[String(f.id)].adj && EXPERT[String(f.id)].adj[key]; if (xa && typeof xa.d === 'number') pb = Math.min(0.95, Math.max(0.05, pb + 0.04 * Math.max(-3, Math.min(2, xa.d)))); }   // דעת המנתח (data/expert/DATE.json): כל נקודה = 0.04 בסיכוי
    { const kp = key.split('|'), er = empRate(f, stat, kp[1], kp[2], parseFloat(kp[3]), f.home.id, f.away.id); if (er) { const w = Math.min(0.3, er.n / (er.n + 14)); pb = Math.min(0.95, Math.max(0.05, (1 - w) * pb + w * er.p)); } }   // למידת קבוצות: איך הקבוצה באמת התנהגה מול הקו המדויק
    const adj = { 'sh-over': .03, 'sot-over': .02, 'sot-under': .02, 'dc-x2': .03, 'dc-12': .03, 'combo-not-lose-under': .03, 'combo-not-lose-over': .02, 'team-score': .02, 'g-over': .01, 'g-under': -.04, 'c-under': -.06, 'sh-under': -.05, 'hc-g': -.05, 'dc-1x': -.02 }[cat] || 0;
    cands.push({ f, G, stat, key, label, odds, pm: +pm.toFixed(3), ps: +ps.toFixed(3), pb: +pb.toFixed(3), rank: pb + adj, cat, why, note: sf.note, sd: sf.d, dist: stat === 'g' ? dist.g : null }); };
  const ahWhy = (name, opp, v, nm) => v > 0 ? `${name} מקבלת יתרון התחלתי של ${v} ${nm}, ולכן ההימור מפסיד רק אם ${opp} מנצחת בהפרש של יותר מ-${v} ${nm}.` : v < 0 ? `${name} צריכה לנצח בהפרש של יותר מ-${-v} ${nm} כדי שההימור יעבור.` : `${name} צריכה לנצח ב${nm} (תיקו = החזר).`;
  const ladders = (stat, L) => {
    const D = dist[stat]; if (!D || !L) return; const e = D.e, nm = STAT_HE[stat];
    const sum = (arr, fn) => arr.reduce((s, p, i) => s + fn(i) * p, 0);
    for (const [ln, o, u] of L.tot || []) { const T = D.t.map((p, i) => [i, p]), pov = wl(x => Math.sign(x - ln), T);
      add(stat, `${stat}|total|over|${ln}`, `מעל ${ln} ${nm} במשחק`, o, pov, fair2(o, u), stat + '-over', `הצפי שלנו הוא ${e.total != null ? e.total : (e.h + e.a).toFixed(1)} ${nm} בסך הכל, והליין באתר הוא ${ln}.`);
      add(stat, `${stat}|total|under|${ln}`, `מתחת ל-${ln} ${nm} במשחק`, u, 1 - pov, fair2(u, o), stat + '-under', `הצפי שלנו הוא ${e.total != null ? e.total : (e.h + e.a).toFixed(1)} ${nm} בסך הכל, פחות מהליין באתר (${ln}).`); }
    for (const [side, arr, name, mu] of [['home', L.t1, hn(f), e.h], ['away', L.t2, an(f), e.a]]) for (const [ln, o, u] of arr || []) { const T = D[side === 'home' ? 'h' : 'a'].map((p, i) => [i, p]), pov = wl(x => Math.sign(x - ln), T);
      add(stat, `${stat}|${side}|over|${ln}`, `${name} מעל ${ln} ${nm}`, o, pov, fair2(o, u), ln <= 0.5 && stat === 'g' ? 'team-score' : stat + '-over', `הצפי שלנו ל${name} הוא ${(+mu).toFixed(1)} ${nm}, והליין באתר הוא ${ln}.`);
      add(stat, `${stat}|${side}|under|${ln}`, `${name} מתחת ל-${ln} ${nm}`, u, 1 - pov, fair2(u, o), stat + '-under', `הצפי שלנו ל${name} הוא ${(+mu).toFixed(1)} ${nm}, פחות מהליין באתר (${ln}).`); }
    for (const [ln, o1, o2] of L.hc || []) { const diff = new Map(); D.h.forEach((x, i) => D.a.forEach((y, j) => { diff.set(i - j, (diff.get(i - j) || 0) + x * y); }));
      const pHome = wl(d => Math.sign(d + ln), [...diff.entries()]), pAway = 1 - pHome, cat = stat === 'g' ? 'hc-g' : 'hc-o';
      const hl = (name, v) => v === 0 ? `${name} מנצחת ב${nm} (תיקו = החזר)` : `${name} ${v > 0 ? '+' : ''}${v} הנדיקאפ ${nm}`;
      add(stat, `${stat}|ah|home|${ln}`, hl(hn(f), ln), o1, pHome, fair2(o1, o2), cat, ahWhy(hn(f), an(f), ln, nm));
      add(stat, `${stat}|ah|away|${-ln}`, hl(an(f), -ln), o2, pAway, fair2(o2, o1), cat, ahWhy(an(f), hn(f), -ln, nm)); }
  };
  ladders('g', G.main); ladders('c', G.c); ladders('c1', G.c1); ladders('sh', G.sh); ladders('sot', G.sot);
  // תוצאה בקרנות (מי תקבל יותר קרנות): שלוש אפשרויות
  if (G.cr && dist.c) { const Hc = dist.c.h, Ac = dist.c.a; let ph = 0, pd = 0, pa = 0; Hc.forEach((x, i) => Ac.forEach((y, j) => { if (i > j) ph += x * y; else if (i === j) pd += x * y; else pa += x * y; }));
    const [r1, rx, r2] = G.cr; add('c', 'c|1x2|home|', `${hn(f)} תקבל יותר קרנות`, r1, ph, 1 / r1 / MARGIN, 'c-res', `לפי הממוצעים שלנו ${hn(f)} צפויה לקבל יותר קרנות מ${an(f)}.`); add('c', 'c|1x2|draw|', 'אותו מספר קרנות לשתי הקבוצות', rx, pd, 1 / rx / MARGIN, 'c-res', 'לפי החישוב שלנו הקרנות ייצאו שוות.'); add('c', 'c|1x2|away|', `${an(f)} תקבל יותר קרנות`, r2, pa, 1 / r2 / MARGIN, 'c-res', `לפי הממוצעים שלנו ${an(f)} צפויה לקבל יותר קרנות מ${hn(f)}.`); }
  // ----- שערים: תוצאה, כפולה, שתיהן כובשות, צירופים -----
  const D = dist.g; if (!D) continue;
  const M = G.main || {}, H = D.h, A = D.a;
  const joint = fn => { let p = 0; H.forEach((ph, i) => A.forEach((pa, j) => { if (fn(i, j)) p += ph * pa; })); return p; };
  const DC = { '1X': (i, j) => i >= j, X2: (i, j) => i <= j, '12': (i, j) => i !== j }, DCN = { '1X': () => `${hn(f)} לא מפסידה`, X2: () => `${an(f)} לא מפסידה`, '12': () => 'בלי תיקו (יש מנצחת)' };
  for (const [k, o] of Object.entries(M.dc || {})) { if (!DC[k]) continue; const pm = joint(DC[k]); add('g', `g|dc|${k.toLowerCase()}|`, `${DCN[k]()} (${k})`, o, pm, 1 / o / MARGIN, k === '1X' ? 'dc-1x' : 'dc-' + k.toLowerCase(), (k === '1X' ? `ההימור מפסיד רק אם ${an(f)} מנצחת.` : k === 'X2' ? `ההימור מפסיד רק אם ${hn(f)} מנצחת.` : 'ההימור מפסיד רק אם המשחק נגמר בתיקו.')); }
  if (M.r) { const [w1, , w2] = M.r; add('g', 'g|1x2|home|', `${hn(f)} מנצחת`, w1, joint((i, j) => i > j), 1 / w1 / MARGIN, 'res', `לפי החישוב שלנו ${hn(f)} הפייבוריטית.`); add('g', 'g|1x2|away|', `${an(f)} מנצחת`, w2, joint((i, j) => i < j), 1 / w2 / MARGIN, 'res', `לפי החישוב שלנו ${an(f)} הפייבוריטית.`); }
  if (M.btts) { const py = joint((i, j) => i > 0 && j > 0); add('g', 'g|btts|yes|', 'שתי הקבוצות כובשות', M.btts[0], py, fair2(M.btts[0], M.btts[1]), 'btts', 'לפי החישוב שלנו לשתי הקבוצות יש סיכוי טוב לכבוש.'); add('g', 'g|btts|no|', 'לפחות קבוצה אחת לא כובשת', M.btts[1], 1 - py, fair2(M.btts[1], M.btts[0]), 'btts', 'לפי החישוב שלנו יש סיכוי טוב שלפחות קבוצה אחת לא תכבוש.'); }
  for (const [grp, arr, tag] of [['dct', M.dct, 'dc'], ['rt', M.rt, 'rt']]) for (const [r, ou, ln, o] of arr || []) {
    const res = { '1X': DC['1X'], X2: DC.X2, '12': DC['12'], Win1: (i, j) => i > j, Win2: (i, j) => i < j, Draw: (i, j) => i === j }[r]; if (!res) continue;
    const pm = joint((i, j) => res(i, j) && (ou === 'O' ? i + j > ln : i + j < ln)); const side = ({ '1X': '1x', X2: 'x2', '12': '12', Win1: 'home', Win2: 'away', Draw: 'draw' })[r] + '_' + (ou === 'O' ? 'over' : 'under');
    const who = ({ '1X': `${hn(f)} לא מפסידה`, X2: `${an(f)} לא מפסידה`, '12': 'יש מנצחת', Win1: `${hn(f)} מנצחת`, Win2: `${an(f)} מנצחת`, Draw: 'תיקו' })[r];
    const cat = ['1X', 'X2'].includes(r) && ou === 'U' ? 'combo-not-lose-under' : ['1X', 'X2'].includes(r) ? 'combo-not-lose-over' : 'combo';
    add('g', `g|combo|${side}|${ln}`, `${who} וגם ${ou === 'O' ? 'מעל' : 'מתחת ל-'}${ou === 'O' ? ' ' : ''}${ln} שערים`, o, pm, 1 / o / (MARGIN + 0.02), cat, `צירוף: ${who}, והצפי שלנו הוא ${E.g.total != null ? E.g.total : (E.g.h + E.g.a).toFixed(1)} שערים בסך הכל (הקו ${ln}).`);
  }
}

// ---------- בניית טפסים ----------
const ilMin = ts => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ts * 1000)); return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value; };
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const ilDow = ts => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(new Date(ts * 1000));
const gid = c => String(c.f.id), legSig = c => gid(c) + '|' + c.key;
const famOf = c => c.stat === 'g' ? (c.key.startsWith('g|combo') || c.key.startsWith('g|dc') || c.key.startsWith('g|1x2') || c.key.startsWith('g|btts') ? 'res' : 'goals') : c.stat;
// בוחר 3 הימורים מרשימת מועמדים: קודם ממשחקים שונים, אחר כך (אם צריך) הימור שני מאותו משחק על מדד אחר; מוריד את הרף בהדרגה
function pick3(pool0, avoid = new Set(), avoidGames = new Set()) {
  const pool = pool0.filter(c => c.odds >= 1.4);   // הימור בודד במשחק: יחס 1.4 לפחות
  for (const min of [0.58, 0.55, 0.52, 0.5]) {
    const L = pool.filter(c => c.pb >= min && !avoid.has(legSig(c))).sort((a, b) => b.rank - a.rank), out = [], games = new Set();
    for (const c of L) { if (out.length === 3) break; if (games.has(gid(c)) || avoidGames.has(gid(c))) continue; out.push(c); games.add(gid(c)); }
    for (const c of L) { if (out.length === 3) break; if (games.has(gid(c)) && avoidGames.has(gid(c))) continue; if (out.some(x => legSig(x) === legSig(c))) continue; if (out.some(x => gid(x) === gid(c) && famOf(x) === famOf(c))) continue; if (out.filter(x => gid(x) === gid(c)).length >= 2) continue; out.push(c); games.add(gid(c)); }
    if (out.length === 3) return out;
  }
  return [];
}
// נימוק שמבין את המשחק: איזה משחק זה, מה הנתונים של הקבוצות (תמיד "בממוצע"), חיסורים, ולמה דווקא ההימור הזה
const cl = x => String(x || '').replace(/[⁦-⁩]/g, '').trim(), endDot = x => /[.!?]$/.test(x) ? x : x + '.';
function whyOf(c) {
  const S = (c.f.story || []).map(cl), pick = re => S.find(x => re.test(x)) || '';
  const nature = S[0] || '', goals = pick(/^בשערים/), corners = pick(/קרנות/), shots = pick(/^בבעיטות/), inj = pick(/^חיסורים/), form = pick(/ניצחונות ב-|בלי ניצחון|מרגישה/);
  const parts = c.stat === 'g' ? [nature, goals, c.note, inj, c.why] : c.stat === 'c' ? [nature, corners, c.note, c.why] : [shots, c.note, c.why];
  const seen = new Set(), out = [];
  for (const p of parts) { const t = cl(p); if (!t || seen.has(t)) continue; seen.add(t); out.push(endDot(t)); }
  return out.slice(0, 4).join(' ');
}
const toLeg = c => ({ sport: 'f', id: c.f.id, key: c.key, label: c.label, odds: c.odds, score: (pb => pb >= 0.8 ? 10 : pb >= 0.74 ? 9 : pb >= 0.69 ? 8 : pb >= 0.62 ? 7 : 6)(c.pb), fb: c.G.url, p: c.pb, ev: +(c.pb * c.odds - 1).toFixed(3), why: whyOf(c) });
if (process.env.FB_DUMP) fs.writeFileSync(path.join(ROOT, 'data', 'cache', 'fb-cands-' + date + '.json'), JSON.stringify(cands.filter(c => c.pb >= 0.55).map(c => toLeg(c)), null, 1));
if (process.env.FB_DEBUG) { const m = {}; for (const c of cands) { const k = c.f.home.name + '-' + c.f.away.name; (m[k] = m[k] || []).push(c); } for (const [k, L] of Object.entries(m)) if (new RegExp(process.env.FB_DEBUG === '1' ? 'XXXX' : process.env.FB_DEBUG).test(k)) console.log(k, L.length, 'pb>=.6:', L.filter(c => c.pb >= 0.6).length, L.filter(c => c.pb >= 0.55 && c.odds >= 1.2).sort((x, y) => y.pb - x.pb).slice(0, 14).map(c => c.label + '@' + c.odds + ' pb' + c.pb + ' ev' + (c.pb * c.odds - 1).toFixed(2)).join(' ; ')); }
const total = L => Math.round(L.reduce((p, c) => p * c.odds, 1) * 100) / 100;
console.log('FX', [...new Map(matched.map(m => [String(m.f.id), m.f])).values()].sort((a, b) => a.ts - b.ts).map(f => hhmm(ilMin(f.ts)) + ' ' + f.home.name + '–' + f.away.name).join(' | '));
const spec = { date, strong: {}, second: {}, win: [], fixed: [] }, seen = new Set(), sigOf = L => L.map(legSig).sort().join(',');
// טפסים חזקים: 3 משחקים. בכל משחק נבחר ההימור החזק ביותר, מכל סוג (תוצאה, שערים, קרנות, בעיטות, צירופים).
// הימור שני באותו משחק נוסף רק אם הוא גם חזק (רף גבוה יותר), מסוג שונה (לא שני הימורי תוצאה, ולא שני הימורים על אותו מדד), לא סותר את הראשון, ושניהם יחד עדיין סבירים.
// אם אין הימור שני חזק, המשחק נשאר עם הימור אחד, ובמשחק אחר אפשר שיהיו שניים.
const PAIR_MIN = 0.6, PAIR_JOINT_MIN = 0.36;
const grpOf = c => c.key.split('|')[1], resFam = c => ['dc', '1x2', 'combo'].includes(grpOf(c));
const famKey = c => resFam(c) ? 'res' : c.stat + '|' + grpOf(c);
const predOf = key => { const [st, grp, side, ln] = key.split('|'), L = parseFloat(ln);
  if (st !== 'g') return null;
  if (grp === 'total') return side === 'over' ? (i, j) => i + j > L : (i, j) => i + j < L;
  if (grp === 'home') return side === 'over' ? (i) => i > L : (i) => i < L;
  if (grp === 'away') return side === 'over' ? (i, j) => j > L : (i, j) => j < L;
  if (grp === 'ah') return side === 'home' ? (i, j) => i - j + L > 0 : (i, j) => j - i + L > 0;
  if (grp === 'dc') return { '1x': (i, j) => i >= j, x2: (i, j) => i <= j, '12': (i, j) => i !== j }[side] || null;
  if (grp === '1x2') return side === 'home' ? (i, j) => i > j : (i, j) => i < j;
  if (grp === 'btts') return side === 'yes' ? (i, j) => i > 0 && j > 0 : (i, j) => !(i > 0 && j > 0);
  if (grp === 'combo') { const [r, ou] = side.split('_'), res = { '1x': (i, j) => i >= j, x2: (i, j) => i <= j, '12': (i, j) => i !== j, home: (i, j) => i > j, away: (i, j) => i < j, draw: (i, j) => i === j }[r]; return res ? (i, j) => res(i, j) && (ou === 'over' ? i + j > L : i + j < L) : null; }
  return null; };
// סיכוי שני ההימורים יחד: בשערים לפי חישוב משותף של התוצאה, אחרת כפל (קרנות ובעיטות בלתי תלויות בשערים בקירוב)
function pairProb(x, y) {
  if (x.dist && y.dist) { const px = predOf(x.key), py = predOf(y.key); if (px && py) { let p = 0; x.dist.h.forEach((ph, i) => x.dist.a.forEach((pa, j) => { if (px(i, j) && py(i, j)) p += ph * pa; }));
    const mx = Math.max(0.01, x.pm), my = Math.max(0.01, y.pm); return Math.min(0.95, p * (x.pb / mx) * (y.pb / my)); } }
  return x.pb * y.pb; }
function pickGames(pool, avoidGames = new Set(), nGames = 3) {
  // כללי יחס: הימור בודד במשחק לפחות 1.4. שני הימורים באותו משחק: כל אחד לפחות 1.2 ויחד לפחות 1.8.
  for (const min of [0.6, 0.57, 0.54, 0.5]) {
    const byGame = new Map();
    for (const c of pool.filter(c => c.pb >= min && !avoidGames.has(gid(c)))) (byGame.get(gid(c)) || byGame.set(gid(c), []).get(gid(c))).push(c);
    const opts = [];
    for (const L of byGame.values()) {
      L.sort((x, y) => y.rank - x.rank);
      let pair = null;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j];
        if (x.key === y.key || famKey(x) === famKey(y) || Math.min(x.pb, y.pb) < PAIR_MIN || x.odds * y.odds < 1.8) continue;
        const p = pairProb(x, y); if (p < PAIR_JOINT_MIN) continue; if (!pair || p > pair.p) pair = { p, legs: [x, y] }; }
      const single = L.find(c => c.odds >= 1.4);
      if (pair && (!single || pair.legs.some(c => c === single) || pair.p >= single.pb * 0.62)) opts.push({ sc: Math.max(pair.legs[0].pb, pair.legs[1].pb) + 0.04, legs: pair.legs });
      else if (single) opts.push({ sc: single.pb, legs: [single] });
    }
    opts.sort((x, y) => y.sc - x.sc);
    if (opts.length >= nGames) return opts.slice(0, nGames).flatMap(o => o.legs);
  }
  return [];
}

// טופס עם יחס כולל 3.5 לפחות (יעד 4-5): לכל משחק אפשרות של הימור בודד או זוג, ובוחרים את השילוב החזק ביותר שמגיע לטווח
// אותו כיוון באותו משחק (למשל "מתחת ל-2.5 קרנות במחצית" ו"מתחת ל-4.5 קרנות" של אותה קבוצה) הוא הימור כמעט זהה: לא בשני הימורים של אותו משחק ולא בשני טפסים
const effTok = c => { const [st, p2, p3, p4] = c.key.split('|'), opp = s => s === 'home' ? 'away' : 'home', fam = st === 'c1' ? 'c' : st; if (!['c', 'sot', 'sh', 'g'].includes(fam)) return null; if (p2 === 'ah') { const ln = Number(p4); if (!(Math.abs(ln) >= 1)) return null; return gid(c) + '|' + fam + '|' + (ln < 0 ? p3 : opp(p3)); } if (fam === 'g' || !['home', 'away'].includes(p2)) return null; return gid(c) + '|' + fam + '|' + (p3 === 'over' ? p2 : opp(p2)); };
const EV_MIN = -0.06, sideOf = c => c.key.split('|')[2];
const redundant = (x, y) => (!globalThis.__LOOSE && effTok(x) && effTok(x) === effTok(y)) || (x.stat === 'g' && y.stat === 'g' && (grpOf(x) === 'ah' || grpOf(y) === 'ah')) || x.stat === y.stat && x.stat !== 'g' && sideOf(x) === sideOf(y) || (x.stat === 'g' && y.stat === 'g' && famKey(x) === famKey(y)) || (x.stat === 'g' && grpOf(x) === 'total' && grpOf(y) === 'home' && sideOf(x) === sideOf(y)) || (x.stat === 'g' && grpOf(y) === 'total' && grpOf(x) === 'home' && sideOf(x) === sideOf(y)) || (x.stat === 'g' && ['home','away'].includes(grpOf(x)) && grpOf(y) === 'total' && sideOf(x) === sideOf(y));
const BAND_MIN = 3.5, BAND_MAX = 5.3, BAND_MID = 4.4;
function gameOptions(pool, min) {
  const byGame = new Map();
  for (const c of pool.filter(c => c.pb >= min && c.pb * c.odds - 1 >= EV_MIN)) (byGame.get(gid(c)) || byGame.set(gid(c), []).get(gid(c))).push(c);
  const res = [];
  for (const L of byGame.values()) {
    L.sort((x, y) => y.rank - x.rank);
    const ch = []; const single = L.find(c => c.odds >= 1.4);
    if (single) ch.push({ sc: single.pb, pj: single.pb, legs: [single], o: single.odds });
    let pair = null;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j];
      if (x.key === y.key || ['sh', 'sot'].includes(x.stat) || ['sh', 'sot'].includes(y.stat) || famKey(x) === famKey(y) || redundant(x, y) || Math.min(x.pb, y.pb) < PAIR_MIN || x.odds * y.odds < 1.8) continue;
      const p = pairProb(x, y); if (p < PAIR_JOINT_MIN) continue; if (!pair || p > pair.p) pair = { p, legs: [x, y] }; }
    if (pair && globalThis.__TRIPLE) { let t3 = null; for (const z of L) { if (pair.legs.includes(z) || ['sh', 'sot'].includes(z.stat) || z.pb < PAIR_MIN || pair.legs.some(q => q.key === z.key || famKey(q) === famKey(z) || redundant(q, z))) continue; const pj = pair.p * z.pb * 0.95; if (pj >= 0.3 && (!t3 || pj > t3.pj)) t3 = { z, pj }; } if (t3) ch.push({ sc: Math.max(...pair.legs.map(c => c.pb), t3.z.pb), pj: t3.pj, legs: [...pair.legs, t3.z], o: pair.legs[0].odds * pair.legs[1].odds * t3.z.odds }); }
    if (pair) ch.push({ sc: Math.max(pair.legs[0].pb, pair.legs[1].pb) + 0.04, pj: pair.p, legs: pair.legs, o: pair.legs[0].odds * pair.legs[1].odds });
    if (ch.length) res.push({ best: Math.max(...ch.map(c => c.sc)), ch });
  }
  return res.sort((a, b) => b.best - a.best).slice(0, 8);
}
const riskFam = c => { const p = c.key.split('|'); if (p[2] === 'over' || (p[0] === 'sh' || p[0] === 'sot') && p[2] === 'over') return p[0] + '-over'; if (p[2] === 'under') return p[0] + '-under'; return null; };
// קודם בלי שני הימורים בכיוון זהה באותו משחק; רק אם אי אפשר להגיע ליחס 3.5 (למשל שני משחקים בלבד), מתירים אותם
function bandPick(...a) { let L = bandPick0(...a); if (!L.length) { globalThis.__LOOSE = true; try { L = bandPick0(...a); if (!L.length) { globalThis.__TRIPLE = true; L = bandPick0(...a); } } finally { globalThis.__LOOSE = false; globalThis.__TRIPLE = false; } } return L; }
function bandPick0(pool, avoidGames = new Set(), maxGames = 4, minG = 2) {
  pool = pool.filter(c => !avoidGames.has(gid(c)));
  for (const min of [0.6, 0.57, 0.54, 0.5]) {
    const G = gameOptions(pool, min); if (G.length < minG) continue;
    let best = null;
    const rec = (i, pick, tot, n) => {
      if (i === G.length) { if (n >= minG && tot >= BAND_MIN) { const sc = pick.reduce((s, o) => s + Math.log(o.pj), 0) - 0.01 * Math.max(0, n - 4); if (!best || sc > best.sc) best = { sc, pick: pick.slice(), tot }; } return; }
      rec(i + 1, pick, tot, n);
      if (n < maxGames) for (const o of G[i].ch) { const fam = o.legs.map(riskFam).filter(Boolean), cnt = {}; for (const q of pick) for (const l of q.legs) { const r = riskFam(l); if (r) cnt[r] = (cnt[r] || 0) + 1; }
        if (fam.some(x => (cnt[x] || 0) + fam.filter(y => y === x).length > 1)) continue;   // לא יותר מהימור אחד מאותה משפחה מתואמת בטופס (למשל מעל קרנות)
        pick.push(o); rec(i + 1, pick, tot * o.o, n + 1); pick.pop(); }
    };
    rec(0, [], 1, 0);
    if (best) return best.pick.flatMap(o => o.legs);
  }
  return [];
}
// יום ליגת האלופות: טפסי חזק/שני רק מליגת האלופות של 22:00; טופס 19:45 נפרד (קבוע); שאר הליגות בטפסים נפרדים (שעות + טופס ליגה)
// מפעלי אירופה (ליגת האלופות, הליגה האירופית, קונפרנס ליג): כל מפעל בנפרד, ובכל מפעל טופס חזק לפחות לכל שעת משחקים (19:45 ו-22:00). המפעל הראשי של היום (אלופות, אחרת אירופית, אחרת קונפרנס) בונה את החזק והשני ממשחקי 22:00 שלו.
const CUPS = [{ lg: 2, he: 'ליגת האלופות' }, { lg: 3, he: 'הליגה האירופית' }, { lg: 848, he: 'קונפרנס ליג' }], CUP_LG = new Set(CUPS.map(c => c.lg));
const futureCup = lg => matched.some(m => Number(m.f.lg) === lg && m.f.ts * 1000 > Date.now()), activeCups = CUPS.filter(c => futureCup(c.lg)), cupDay = activeCups.length > 0, MAIN = activeCups[0];
const SLOTS = [{ from: 19 * 60 + 15, to: 20 * 60 + 15, label: '19:45' }, { from: 21 * 60 + 30, to: 22 * 60 + 30, label: '22:00' }];
const isMain = c => MAIN && Number(c.f.lg) === MAIN.lg, lateMain = c => isMain(c) && ilMin(c.f.ts) >= SLOTS[1].from;
const mainPool = !cupDay ? cands : (cands.filter(lateMain).length >= 6 ? cands.filter(lateMain) : cands.filter(isMain));
let strong = bandPick(mainPool);
if (strong.length) { spec.strong.f = strong.map(toLeg); seen.add(sigOf(strong)); }
const strongGames = new Set(strong.map(gid));
let second = bandPick(mainPool, strongGames);
// כלל: אותו הימור (משחק+סוג+קו) לא מופיע בשני טפסים באותו יום. אחרי החזק והשני, כל טופס אחר נבנה בלי ההימורים שכבר נבחרו
// אותו כיוון באותו משחק בשני טפסים נחשב כפילות (למשל "ברצלונה -3 קרנות" ו"סבאח מתחת ל-3.5 קרנות" = שניהם "ברצלונה שולטת בקרנות")
const USED = new Set(), TOK = new Set(), markUsed = L => L.forEach(c => { USED.add(legSig(c)); const k = effTok(c); if (k) TOK.add(k); });
const notUsed = c => { if (USED.has(legSig(c))) return false; const k = effTok(c); return !(k && TOK.has(k)); };
markUsed([...strong, ...second]);
if (second.length) { spec.second.f = second.map(toLeg); seen.add(sigOf(second)); }
// טפסי שעות: צברים של עד שעה וחצי בין תחילות המשחקים
{ const fx = [...new Map(matched.map(m => [String(m.f.id), m.f])).values()].filter(f => f.ts * 1000 > Date.now() && !(cupDay && CUP_LG.has(Number(f.lg)))).sort((a, b) => a.ts - b.ts);   // ביום אלופות: ליגת האלופות רק בטפסים הקבועים (19:45 / 22:00)
  const starts = [...new Set(fx.map(f => f.ts))], usedG = new Set(), tsOf = new Map(fx.map(f => [String(f.id), f.ts]));
  // כל משחק מופיע בטופס שעות אחד בלבד (בלי הימורים או משחקים שחוזרים בין טפסים)
  for (const st of [...starts, ...starts]) { const ids = new Set(fx.filter(f => f.ts >= st && f.ts - st <= 60 * 60).map(f => String(f.id)).filter(x => !usedG.has(x)));
    if (ids.size < 2) continue;
    const L = bandPick(cands.filter(c => ids.has(gid(c)) && notUsed(c))); if (!L.length) continue; markUsed(L);
    const gs = [...new Set(L.map(gid))]; gs.forEach(x => usedG.add(x)); seen.add(sigOf(L));
    const tm = gs.map(x => ilMin(tsOf.get(x))), a = Math.min(...tm), b = Math.max(...tm);
    spec.win.push({ label: (cupDay ? 'ליגות אחרות · ' : '') + (a === b ? 'משחקי ' + hhmm(a) : 'משחקי ' + hhmm(a) + '–' + hhmm(b)), legs: L.map(toLeg) }); } }
{ const cnt = {}; for (const w of spec.win) { cnt[w.label] = (cnt[w.label] || 0) + 1; if (cnt[w.label] > 1) w.label += ' (' + cnt[w.label] + ')'; } }
spec.win.sort((x, y) => x.label.localeCompare(y.label));
// טפסים קבועים: בונדסליגה שבת 16:30, פרמייר ליג שבת 17:00
for (const R of [{ lg: 78, dow: 'Sat', from: 16 * 60 + 15, to: 16 * 60 + 45, label: 'בונדסליגה · שבת 16:30' }, { lg: 39, dow: 'Sat', from: 16 * 60 + 45, to: 17 * 60 + 15, label: 'פרמייר ליג · שבת 17:00' }]) {
  const poolR = cands.filter(c => notUsed(c) && Number(c.f.lg) === R.lg && (!R.dow || ilDow(c.f.ts) === R.dow) && ilMin(c.f.ts) >= R.from && ilMin(c.f.ts) <= R.to); let L = bandPick(poolR); if (!L.length && poolR.length) { globalThis.__TRIPLE = true; L = bandPick(poolR); globalThis.__TRIPLE = false; } if (L.length && !seen.has(sigOf(L))) { spec.fixed.push({ label: R.label, legs: L.map(toLeg) }); seen.add(sigOf(L)); markUsed(L); } }
// מפעלי אירופה: טופס חזק לכל מפעל בכל שעה (19:45 ו-22:00), כל מפעל בנפרד. במפעל הראשי טפסי 22:00 הם החזק והשני (בלי העתק נוסף)
if (cupDay) spec.labels = { strong: MAIN.he + ' · משחקי 22:00', second: MAIN.he + ' · משחקי 22:00' };
// כמה טפסים בכל שעה: לא מתקמצנים. לפי מספר המשחקים בשעה: 5+ משחקים עד 3 טפסים, 2-4 משחקים עד 2, משחק אחד טופס אחד. כל טופס נוסף בנוי מהימורים שעוד לא נבחרו (בלי כפילויות), ובעדיפות למשחקים שעוד לא הופיעו בטופס של אותה שעה.
for (const C of activeCups) for (const S of SLOTS) {
  const inSlot = c => Number(c.f.lg) === C.lg && ilMin(c.f.ts) >= S.from && ilMin(c.f.ts) <= S.to, nGames = new Set(cands.filter(inSlot).map(gid)).size;
  if (!nGames) continue;
  const mainLate = C === MAIN && S.label === '22:00' && cands.filter(lateMain).length >= 6;   // שם החזק והשני כבר שני טפסים
  const target = nGames >= 5 ? 3 : nGames >= 2 ? 2 : 1; let have = mainLate ? 2 : 0, slotGames = new Set(mainLate ? [...strong, ...second].map(gid) : []);
  for (let n = have; n < target; n++) {
    const pool = cands.filter(c => notUsed(c) && inSlot(c)); if (!pool.length) break;
    const pick = avoid => { let L = bandPick(pool, avoid); if (!L.length) { globalThis.__TRIPLE = true; L = bandPick(pool, avoid); globalThis.__TRIPLE = false; } if (!L.length && !avoid.size) { globalThis.__TRIPLE = true; L = bandPick(pool, new Set(), 4, 1); globalThis.__TRIPLE = false; } return L; };
    let L = slotGames.size ? pick(slotGames) : []; if (!L.length) L = pick(new Set());
    if (!L.length || seen.has(sigOf(L))) break;
    spec.fixed.push({ label: C.he + ' · משחקי ' + S.label + (n > 0 ? ' (' + (n + 1) + ')' : ''), legs: L.map(toLeg) }); seen.add(sigOf(L)); markUsed(L); L.forEach(c => slotGames.add(gid(c))); }
}
// טופס חזק לכל ליגה (גם אם יש רק שלושה משחקים; בליגה עם פחות משלושה משחקים משלימים מהימור שני באותו משחק)
for (const lg of [...new Set(matched.map(m => Number(m.f.lg)))]) {
  if (cupDay && CUP_LG.has(lg)) continue;
  const L = bandPick(cands.filter(c => Number(c.f.lg) === lg && notUsed(c))); if (!L.length || seen.has(sigOf(L))) continue; seen.add(sigOf(L)); markUsed(L);
  const info = LEAGUES.find(l => l.id === lg); spec.fixed.push({ kind: 'league', label: (info ? info.he : 'ליגה ' + lg) + ' · כל משחקי היום', legs: L.map(toLeg) }); }
fs.writeFileSync(path.join(ROOT, 'data', 'cache', `fb-spec-${date}.json`), JSON.stringify(spec, null, 1));
// יחסי fivebet האמיתיים לכל הימור (לפי משחק ומפתח הימור): האתר מציג רק אותם, בלי יחס משוער
{ const dir = path.join(ROOT, 'data', 'fbodds'), file = path.join(dir, date + '.json'); fs.mkdirSync(dir, { recursive: true });
  let old = {}; try { old = readJson(file).odds || {}; } catch (e) {}
  for (const [id, O] of Object.entries(fbAll)) old[id] = { ...(old[id] || {}), ...O };
  let oldRecs = []; try { oldRecs = readJson(file).recs || []; } catch (e) {}
  const startedIds = new Set(matched.filter(m => m.f.ts * 1000 <= Date.now()).map(m => String(m.f.id))), freshIds = new Set(cands.map(gid));
  const seenR = new Set(), recs = cands.filter(c => c.pb >= 0.6 && c.odds >= 1.4 && c.pb * c.odds - 1 >= EV_MIN).sort((x, y) => y.pb - x.pb).filter(c => { const k = gid(c) + '|' + c.key; if (seenR.has(k)) return false; seenR.add(k); return true; })
    .filter((c, i, arr) => arr.slice(0, i).filter(y => gid(y) === gid(c)).length < 2).map(c => ({ id: c.f.id, key: c.key, label: c.label, odds: c.odds, p: c.pb, ev: +(c.pb * c.odds - 1).toFixed(3), sc: (pb => pb >= 0.84 ? 10 : pb >= 0.78 ? 9 : pb >= 0.72 ? 8 : pb >= 0.64 ? 7 : 6)(c.pb), why: whyOf(c) }));
  { let up = 0; for (let i = 0; i < recs.length; i++) { if (startedIds.has(String(recs[i].id))) continue; if (++up > 60) { recs.splice(i, 1); i--; } } }
  // המלצות של משחקים שכבר התחילו או נגמרו נשארות כמו שהיו, לא נמחקות
  for (const r of oldRecs) if (!freshIds.has(String(r.id)) || startedIds.has(String(r.id))) { const k = r.id + '|' + r.key; if (!seenR.has(k)) { seenR.add(k); recs.push(r); } }
  fs.writeFileSync(file, JSON.stringify({ updated: new Date().toISOString(), odds: old, recs })); }

console.log(`משחקים מ-fivebet: ${games.length}, הותאמו: ${matched.length}${unmatched.length ? ', לא הותאמו: ' + unmatched.join('; ') : ''}`);
console.log(`הימורים אפשריים: ${cands.length}`);
const show = (n, L) => console.log(n.padEnd(34), L ? 'x' + (L.legs || L).length : '-');
const row = (n, legs) => console.log(`${n} (${total(legs)}):\n   ` + legs.map(c => `${c.label} [${c.f.home.name}–${c.f.away.name}] @${c.odds} pb${c.pb}`).join('\n   '));
if (strong.length) row('חזק', strong); if (second.length) row('שני', second);
console.log(`טפסי שעות: ${spec.win.length} · קבועים וליגות: ${spec.fixed.length} (${spec.fixed.map(x => x.label).join(' | ')})`);
