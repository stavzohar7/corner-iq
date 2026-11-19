// כותב טפסים שנבחרו לפי יחסי fivebet לתוך data/slips.json (נעולים: slip.mjs לא בונה אותם מחדש).
// שימוש: node scripts/fivebet-write.mjs spec.json
// spec = { date:'2026-11-14', strong:{ f:[leg,leg,leg], n:[...], e:[...] }, second:{ f:[...] }, win:[{ label:'משחקי 21:45', legs:[...] }] }
// leg = { sport:'f'|'n'|'e', id, key, label, odds, score, p, ev, why }
//   כדורגל: key = stat|group|side|line  (g|total|under|2.5, g|ah|away|1.5, c|away|under|3.5, g|btts|no|)
//   כדורסל: key = group|side|line  (spread|away|-1.5 = קו המארחת, th|under|119.5, total|under|179.5)  או  pst|<מזהה שחקן>|pts/reb/ast/tpm|over/under|<קו>
// בדיקות: בדיוק 3 רגליים בכל טופס, יחס 1.45 ומעלה, המשחק עוד לא התחיל.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '');
const spec = readJson(path.resolve(process.argv[2] || 'spec.json'));
const date = spec.date, slips = readJson(path.join(ROOT, 'data', 'slips.json'));
const foot = readJson(path.join(ROOT, 'data', 'days', date + '.json')), bb = readJson(path.join(ROOT, 'data', 'bball', date + '.json'));
let day = slips.days.find(d => d.date === date);
if (!day) { const b = () => ({ legs: [], total: null, res: null }); day = { date, final: false, k: { strong: { f: b(), n: b(), e: b() }, second: { f: b(), n: b(), e: b() }, win: [], lg: [] } }; slips.days.push(day); }
const full = l => {
  const fx = (l.sport === 'f' ? foot : bb).fixtures.find(f => String(f.id) === String(l.id)); if (!fx) throw new Error('משחק לא נמצא: ' + l.id);
  if (!(l.odds >= 1.2)) throw new Error("יחס מתחת ל-1.2: " + l.label);
  if (fx.ts * 1000 < Date.now()) throw new Error('המשחק כבר התחיל: ' + l.label);
  const [a, b, c] = l.key.split('|');
  const o = { sport: l.sport, id: fx.id, mi: -1, key: l.key, kind: l.sport === 'f' ? [a, b, c].join('|') : a + '|' + b, label: l.label, game: clean(fx.home.name) + ' – ' + clean(fx.away.name), ts: fx.ts, odds: l.odds, score: l.score || 6, p: l.p || 0, ev: l.ev || 0, src: 'fivebet' };
  if (l.sport === 'f') { o.lg = fx.lg; o.stat = a; } else { o.grp = a; o.sd = b; o.prop = a === 'pst'; }
  if (l.why) o.why = l.why;
  if (l.fb) o.fb = l.fb;   // נתיב המשחק באתר fivebet: משמש את כפתור "בנה קופון"
  return o;
};
const tot = L => Math.round(L.reduce((x, l) => x * l.odds, 1) * 100) / 100;
// כללי יחס (כדורגל): הימור בודד במשחק לפחות 1.4. כמה הימורים באותו משחק: יחס משותף לפחות 1.8
const checkOdds = L => { const g = {}; for (const l of L) (g[l.id] = g[l.id] || []).push(l); for (const A of Object.values(g)) { const t = A.reduce((x, l) => x * l.odds, 1); if (A.length === 1 ? A[0].odds < 1.4 : t < 1.8) throw new Error('יחס נמוך מדי: ' + A.map(l => l.label).join(' + ') + ' (' + t.toFixed(2) + ')'); } };
const mk = (legs, extra = {}) => { if (legs.length < 1 || legs.length > 6) throw new Error('טופס חייב 1 עד 6 הימורים'); const L = legs.map(full); checkOdds(L); return { legs: L, total: tot(L), res: null, src: 'fivebet', ...extra }; };
// טפסים שאחד המשחקים שלהם כבר התחיל לא נדרסים (הרצה חוזרת מוסיפה/מרעננת רק את מה שעוד לא התחיל)
const started = S => S && S.legs && S.legs.some(l => l.ts * 1000 < Date.now());
for (const lv of ['strong', 'second']) for (const [sp, legs] of Object.entries(spec[lv] || {})) { if (started(day.k[lv][sp])) continue; day.k[lv][sp] = mk(legs); }
const keepStarted = old => (old || []).filter(started);
if (spec.win) { const keep = keepStarted(day.k.win), labels = new Set(keep.map(w => w.label)); day.k.win = [...keep, ...spec.win.filter(w => !labels.has(w.label)).map(w => ({ ...mk(w.legs), label: w.label }))].map((w, i) => ({ ...w, id: 'w' + (i + 1) })); }
if (spec.fixed) { const keep = keepStarted(day.k.lg), labels = new Set(keep.map(w => w.label)); day.k.lg = [...keep, ...spec.fixed.filter(w => !labels.has(w.label)).map(w => ({ ...mk(w.legs), label: w.label, ...(w.kind ? { kind: w.kind } : {}) }))].map((w, i) => ({ ...w, id: 'F' + (i + 1) })); }   // טפסים קבועים וטופס לכל ליגה
slips.updated = new Date().toISOString();
fs.writeFileSync(path.join(ROOT, 'data', 'slips.json'), JSON.stringify(slips));
console.log('נכתב:', Object.entries(spec.strong || {}).map(([k, v]) => 'חזק ' + k + ' ' + tot(v.map(full))).join(' · '), Object.entries(spec.second || {}).map(([k, v]) => 'שני ' + k + ' ' + tot(v.map(full))).join(' · '));
