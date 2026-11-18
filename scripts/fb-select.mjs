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
import { LEAGUES } from './config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '');
const dir = path.join(ROOT, 'data', 'cache', 'siteodds');
const files = fs.readdirSync(dir).filter(f => f.startsWith(`fb-${date}`) && f.endsWith('.json'));
if (!files.length) { console.error('אין קבצי fb-' + date + '-*.json ב-data/cache/siteodds'); process.exit(1); }
const games = files.flatMap(f => readJson(path.join(dir, f)));
const day = readJson(path.join(ROOT, 'data', 'days', `${date}.json`));
const teams = Object.fromEntries(Object.entries(readJson(path.join(ROOT, 'data', 'cache', 'matches.json')).teams).filter(([k]) => String(k).includes(':')));
const resolve = buildResolver(teams);

// ---------- התפלגויות ----------
const PHI = { g: 1.15, c: 1.45, sh: 1.5, sot: 1.4 };
const nb = (m, phi, n = 70) => { const p = []; if (!(m > 0)) return [1]; if (phi <= 1.01) { let v = Math.exp(-m); p.push(v); for (let k = 1; k < n; k++) { v = v * m / k; p.push(v); } return p; }
  const r = m / (phi - 1), q = (phi - 1) / phi; let v = Math.pow(1 - q, r); p.push(v); for (let k = 1; k < n; k++) { v = v * (k - 1 + r) / k * q; p.push(v); } return p; };
const conv = (a, b) => { const o = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o; };
const fair2 = (a, b) => (1 / a) / (1 / a + 1 / b);
const MARGIN = 1.07;
// מנצחת / מפסידה / החזר (קו שלם)
const wl = (probFn, vals) => { let w = 0, l = 0; for (const [x, p] of vals) { const r = probFn(x); if (r > 0) w += p; else if (r < 0) l += p; } return w / Math.max(1e-9, w + l); };

// ---------- התאמת משחקי fivebet לשלנו ----------
const bySig = new Map();
for (const f of day.fixtures) bySig.set(String(f.home.id) + '|' + String(f.away.id), f);
const unmatched = [], matched = [];
for (const G of games) {
  const hid = resolve(G.h), aid = resolve(G.a), f = bySig.get(hid + '|' + aid);
  if (!f) { unmatched.push(`${G.h} - ${G.a}`); continue; }
  matched.push({ G, f });
}

// ---------- הימורים ----------
const cands = [];
const hn = f => clean(f.home.name), an = f => clean(f.away.name);
const STAT_HE = { g: 'שערים', c: 'קרנות', sh: 'בעיטות', sot: 'בעיטות למסגרת' };
for (const { G, f } of matched) {
  if (f.ts * 1000 < Date.now() + 10 * 60e3 || !f.exp) continue;
  const E = f.exp, dist = {}; for (const st of ['g', 'c', 'sh', 'sot']) if (E[st] && E[st].h != null && E[st].a != null) { const h = nb(E[st].h, PHI[st]), a = nb(E[st].a, PHI[st]); dist[st] = { h, a, t: conv(h, a), e: E[st] }; }
  const add = (stat, key, label, odds, pm, ps, cat, why) => { if (pm == null || !(odds >= 1.45 && odds <= 5)) return; const pb = 0.5 * pm + 0.5 * ps, gap = Math.abs(pm - ps); if (gap > 0.2) return;
    const adj = { 'sh-over': .03, 'sot-over': .02, 'sot-under': .02, 'dc-x2': .03, 'dc-12': .03, 'combo-not-lose-under': .03, 'combo-not-lose-over': .02, 'team-score': .02, 'g-over': .01, 'g-under': -.04, 'c-under': -.06, 'sh-under': -.05, 'hc-g': -.05, 'dc-1x': -.02 }[cat] || 0;
    cands.push({ f, G, stat, key, label, odds, pm: +pm.toFixed(3), ps: +ps.toFixed(3), pb: +pb.toFixed(3), rank: pb + adj, cat, why }); };
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
      add(stat, `${stat}|ah|home|${ln}`, hl(hn(f), ln), o1, pHome, fair2(o1, o2), cat, `לפי החישוב שלנו ל${hn(f)} סיכוי טוב לכסות את ההנדיקאפ (${ln > 0 ? '+' : ''}${ln}).`);
      add(stat, `${stat}|ah|away|${-ln}`, hl(an(f), -ln), o2, pAway, fair2(o2, o1), cat, `לפי החישוב שלנו ל${an(f)} סיכוי טוב לכסות את ההנדיקאפ (${-ln > 0 ? '+' : ''}${-ln}).`); }
  };
  ladders('g', G.main); ladders('c', G.c); ladders('sh', G.sh); ladders('sot', G.sot);
  // ----- שערים: תוצאה, כפולה, שתיהן כובשות, צירופים -----
  const D = dist.g; if (!D) continue;
  const M = G.main || {}, H = D.h, A = D.a;
  const joint = fn => { let p = 0; H.forEach((ph, i) => A.forEach((pa, j) => { if (fn(i, j)) p += ph * pa; })); return p; };
  const DC = { '1X': (i, j) => i >= j, X2: (i, j) => i <= j, '12': (i, j) => i !== j }, DCN = { '1X': () => `${hn(f)} לא מפסידה`, X2: () => `${an(f)} לא מפסידה`, '12': () => 'בלי תיקו (יש מנצחת)' };
  for (const [k, o] of Object.entries(M.dc || {})) { if (!DC[k]) continue; const pm = joint(DC[k]); add('g', `g|dc|${k.toLowerCase()}|`, `${DCN[k]()} (${k})`, o, pm, 1 / o / MARGIN, k === '1X' ? 'dc-1x' : 'dc-' + k.toLowerCase(), `לפי החישוב שלנו הסיכוי לזה גבוה (${DCN[k]()}).`); }
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
function pick3(pool, avoid = new Set(), avoidGames = new Set()) {
  for (const min of [0.58, 0.55, 0.52, 0.5]) {
    const L = pool.filter(c => c.pb >= min && !avoid.has(legSig(c))).sort((a, b) => b.rank - a.rank), out = [], games = new Set();
    for (const c of L) { if (out.length === 3) break; if (games.has(gid(c)) || avoidGames.has(gid(c))) continue; out.push(c); games.add(gid(c)); }
    for (const c of L) { if (out.length === 3) break; if (games.has(gid(c)) && avoidGames.has(gid(c))) continue; if (out.some(x => legSig(x) === legSig(c))) continue; if (out.some(x => gid(x) === gid(c) && famOf(x) === famOf(c))) continue; if (out.filter(x => gid(x) === gid(c)).length >= 2) continue; out.push(c); games.add(gid(c)); }
    if (out.length === 3) return out;
  }
  return [];
}
const toLeg = c => ({ sport: 'f', id: c.f.id, key: c.key, label: c.label, odds: c.odds, score: c.pb >= 0.64 ? 7 : 6, fb: c.G.url, p: c.pb, ev: +(c.pb * c.odds - 1).toFixed(3), why: c.why });
const total = L => Math.round(L.reduce((p, c) => p * c.odds, 1) * 100) / 100;
const spec = { date, strong: {}, second: {}, win: [], fixed: [] }, seen = new Set(), sigOf = L => L.map(legSig).sort().join(',');
const strong = pick3(cands); if (strong.length === 3) { spec.strong.f = strong.map(toLeg); seen.add(sigOf(strong)); }
const second = pick3(cands, new Set(strong.map(legSig)), new Set(strong.map(gid))); if (second.length === 3) { spec.second.f = second.map(toLeg); seen.add(sigOf(second)); }
// טפסי שעות: צברים של עד שעה וחצי בין תחילות המשחקים
{ const fx = [...new Map(matched.map(m => [String(m.f.id), m.f])).values()].filter(f => f.ts * 1000 > Date.now()).sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < fx.length;) { const start = fx[i].ts, ids = new Set(), times = []; while (i < fx.length && fx[i].ts - start <= 90 * 60) { ids.add(String(fx[i].id)); times.push(ilMin(fx[i].ts)); i++; }
    const L = pick3(cands.filter(c => ids.has(gid(c)))); if (L.length !== 3 || seen.has(sigOf(L))) continue; seen.add(sigOf(L));
    const a = Math.min(...times), b = Math.max(...times); spec.win.push({ label: a === b ? 'משחקי ' + hhmm(a) : 'משחקי ' + hhmm(a) + '–' + hhmm(b), legs: L.map(toLeg) }); } }
// טפסים קבועים: בונדסליגה שבת 16:30, פרמייר ליג שבת 17:00
for (const R of [{ lg: 78, dow: 'Sat', from: 16 * 60 + 15, to: 16 * 60 + 45, label: 'בונדסליגה · שבת 16:30' }, { lg: 39, dow: 'Sat', from: 16 * 60 + 45, to: 17 * 60 + 15, label: 'פרמייר ליג · שבת 17:00' }]) {
  const L = pick3(cands.filter(c => Number(c.f.lg) === R.lg && ilDow(c.f.ts) === R.dow && ilMin(c.f.ts) >= R.from && ilMin(c.f.ts) <= R.to)); if (L.length === 3) { spec.fixed.push({ label: R.label, legs: L.map(toLeg) }); seen.add(sigOf(L)); } }
// טופס חזק לכל ליגה (גם אם יש רק שלושה משחקים; בליגה עם פחות משלושה משחקים משלימים מהימור שני באותו משחק)
for (const lg of [...new Set(matched.map(m => Number(m.f.lg)))]) {
  const L = pick3(cands.filter(c => Number(c.f.lg) === lg)); if (L.length !== 3 || seen.has(sigOf(L))) continue; seen.add(sigOf(L));
  const info = LEAGUES.find(l => l.id === lg); spec.fixed.push({ kind: 'league', label: (info ? info.he : 'ליגה ' + lg) + ' · כל משחקי היום', legs: L.map(toLeg) }); }
fs.writeFileSync(path.join(ROOT, 'data', 'cache', `fb-spec-${date}.json`), JSON.stringify(spec, null, 1));

console.log(`משחקים מ-fivebet: ${games.length}, הותאמו: ${matched.length}${unmatched.length ? ', לא הותאמו: ' + unmatched.join('; ') : ''}`);
console.log(`הימורים אפשריים: ${cands.length}`);
const show = (n, L) => console.log(n.padEnd(34), L ? 'x' + (L.legs || L).length : '-');
const row = (n, legs) => console.log(`${n} (${total(legs)}):\n   ` + legs.map(c => `${c.label} [${c.f.home.name}–${c.f.away.name}] @${c.odds} pb${c.pb}`).join('\n   '));
if (strong.length) row('חזק', strong); if (second.length) row('שני', second);
console.log(`טפסי שעות: ${spec.win.length} · קבועים וליגות: ${spec.fixed.length} (${spec.fixed.map(x => x.label).join(' | ')})`);
