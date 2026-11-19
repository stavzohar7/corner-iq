// בוחר הימורי כדורסל (NBA / יורוליג) מקווי fivebet מול הצפי של המודל, לפי הלקחים שלנו, ומכין טיוטת spec לטפסים.
// שימוש: node scripts/bb-select.mjs [DATE]   (קורא data/cache/siteodds/bb-DATE.json, כותב data/cache/bb-spec-DATE.json ומדפיס טבלה)
// bb-DATE.json = { "games": [ { "id": 4812440, "ladders": { hc:[[קו,יחס1,יחס2]...], tot:[[קו,over,under]...], t1:[...], t2:[...], r:[יחס1,יחס2] } } ] }
// כיוון fivebet: NBA = קבוצה 1 היא האורחת. יורוליג = קבוצה 1 היא המארחת.
// כללים (analyst-lessons.md): "מתחת" על סך נקודות; "מעל" על נקודות של מארחת; הנדיקאפ של מארחת. לא: "מעל" על סך נקודות, הנדיקאפ של אורחת, הימורי שחקנים.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const site = readJson(path.join(ROOT, 'data', 'cache', 'siteodds', `bb-${date}.json`)), day = readJson(path.join(ROOT, 'data', 'bball', `${date}.json`));
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '');

// התפלגות נורמלית
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
const SD = { 103: { m: 12.5, t: 17.5, team: 11.5 }, 569: { m: 10.5, t: 14, team: 8.5 } };
const fair = (a, b) => (1 / a) / (1 / a + 1 / b);

const cands = [];
for (const G of site.games) {
  const g = day.fixtures.find(f => String(f.id) === String(G.id)); if (!g || g.ts * 1000 < Date.now() + 10 * 60e3 || !g.exp) continue;
  const sd = SD[g.comp] || SD[103], e = g.exp, L = G.ladders, nba = g.comp === 103;
  const name = clean(g.home.name) + '–' + clean(g.away.name), game = { id: g.id, name, comp: g.comp, e };
  const add = (key, label, odds, pm, ps, kind) => { if (!(odds >= 1.3) || pm == null) return; const pb = 0.5 * pm + 0.5 * ps; cands.push({ game, key, label: `${label} (${name})`, odds, pm: +pm.toFixed(3), ps: +ps.toFixed(3), pb: +pb.toFixed(3), gap: +Math.abs(pm - ps).toFixed(3), ev: +(pb * odds - 1).toFixed(3), kind }); };
  const half = ln => Math.abs(ln * 2 - Math.round(ln * 2)) < 1e-9 && Math.round(ln * 2) % 2 === 1;   // רק קווים עם .5 (בלי החזר)
  // סך נקודות: רק "מתחת", ורק כשהקו גבוה מהצפי
  for (const [ln, o, u] of L.tot || []) if (half(ln) && ln >= e.total + 6) add(`total|under|${ln}`, `מתחת ל-${ln} נקודות במשחק`, u, cdf((ln - e.total) / sd.t), fair(u, o), 'total-under');
  // נקודות של קבוצה מארחת: "מעל"
  const homeT = nba ? L.t2 : L.t1;
  for (const [ln, o, u] of homeT || []) if (half(ln) && ln <= e.h - 3) add(`th|over|${ln}`, `${clean(g.home.name)} מעל ${ln} נקודות`, o, 1 - cdf((ln - e.h) / sd.team), fair(o, u), 'home-over');
  // הנדיקאפ של מארחת: קו המארחת
  for (const [ln, o1, o2] of L.hc || []) {
    const homeLine = nba ? -ln : ln, homeOdds = nba ? o2 : o1; if (!half(homeLine)) continue;
    if (homeLine <= -e.margin + 0 && true) { /* מארחת מכסה אם הפער > -קו */ }
    const pm = 1 - cdf((-homeLine - e.margin) / sd.m), ps = fair(homeOdds, nba ? o1 : o2);
    if (-homeLine <= e.margin - 2) add(`spread|home|${homeLine}`, `${clean(g.home.name)} ${homeLine > 0 ? '+' : ''}${homeLine} הנדיקאפ`, homeOdds, pm, ps, 'home-spread');
  }
}
const ok = c => c.pb >= 0.58 && c.gap <= 0.25 && c.odds >= 1.45;
const pool = cands.filter(ok).sort((a, b) => b.pb - a.pb);
const pickN = (excl, n = 3) => { const out = [], used = new Set(); for (const c of pool) { if (excl.has(c.key + c.game.id)) continue; if (used.has(c.game.id)) continue; used.add(c.game.id); out.push(c); if (out.length === n) break; } return out; };
const strong = pickN(new Set()), second = pickN(new Set(strong.map(c => c.key + c.game.id)));
const leg = (c, sp) => ({ sport: sp, id: c.game.id, key: c.key, label: c.label, odds: c.odds, score: c.pb >= 0.64 ? 7 : 6, p: c.pb, ev: c.ev, why: '' });
const bySport = c => c.game.comp === 103 ? 'n' : 'e';
const spec = { date, strong: {}, second: {} };
// טפסים חזקים: עד 3 משחקים. הימור שני באותו משחק נוסף רק אם הוא באמת חזק (רף גבוה) ולא סותר את הראשון.
// זוגות מותרים: סך נקודות "מתחת" + הנדיקאפ מארחת, או נקודות מארחת "מעל" + הנדיקאפ מארחת.
const PAIR_MIN = 0.62, kindOf = c => c.key.split('|')[0];
const okPair = (x, y) => { const k = [kindOf(x), kindOf(y)].sort().join('+'); return k === 'spread+total' || k === 'spread+th'; };
function pickBB(T, exclGames) {
  const byGame = new Map(); for (const c of T) { if (exclGames.has(c.game.id)) continue; (byGame.get(c.game.id) || byGame.set(c.game.id, []).get(c.game.id)).push(c); }
  const opts = [];
  for (const L of byGame.values()) { L.sort((x, y) => y.pb - x.pb); const first = L[0], partner = L.slice(1).find(y => y.pb >= PAIR_MIN && okPair(first, y));
    opts.push({ sc: first.pb + (partner ? 0.04 : 0), id: first.game.id, legs: partner ? [first, partner] : [first] }); }
  return opts.sort((x, y) => y.sc - x.sc);
}
for (const sp of ['n', 'e']) {
  const T = pool.filter(c => bySport(c) === sp);
  const A = pickBB(T, new Set()).slice(0, 3);
  if (A.length === 3 || (sp === 'e' && A.length >= 1)) {
    spec.strong[sp] = A.flatMap(o => o.legs).map(c => leg(c, sp));
    if (sp !== 'e') { const used = new Set(A.map(o => o.id)), B = pickBB(T, used).slice(0, 3); if (B.length === 3) spec.second[sp] = B.flatMap(o => o.legs).map(c => leg(c, sp)); }
  }
}
fs.writeFileSync(path.join(ROOT, 'data', 'cache', `bb-spec-${date}.json`), JSON.stringify(spec, null, 1));
console.log(`מועמדים: ${cands.length}, עוברים: ${pool.length}`);
for (const c of pool.slice(0, 14)) console.log(`${c.pb.toFixed(2)} @${c.odds} (מודל ${c.pm}, אתר ${c.ps}) ${c.label}`);
console.log('טיוטת טפסים:', Object.entries(spec.strong).map(([k, v]) => 'חזק ' + k + ' x' + v.length).join(' · '), Object.entries(spec.second).map(([k, v]) => 'שני ' + k + ' x' + v.length).join(' · '));
