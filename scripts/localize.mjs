// ממיר קבצי נתונים ישנים (שנוצרו כשהשמות היו באנגלית) לעברית: שמות קבוצות ושחקנים. מריצים פעם אחת על קבצים קיימים.
//   node scripts/localize.mjs <קובץ> [<קובץ>...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNames, heTeam } from './names-he.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const HE = loadNames(ROOT), cache = readJson(path.join(ROOT, 'data', 'cache', 'matches.json'), { teams: {} }), bb = readJson(path.join(ROOT, 'data', 'cache', 'bball.json'), { games: {} }), PL = readJson(path.join(ROOT, 'data', 'cache', 'bball-players.json'), { names: {} });
const teams = new Map(), players = new Map();
for (const [k, v] of Object.entries(cache.teams || {})) { const he = heTeam(HE, k); if (he && v.n) teams.set(v.n, he); }
for (const g of Object.values(bb.games)) { if (HE.teams[g.h]) teams.set(g.hn, HE.teams[g.h]); if (HE.teams[g.a]) teams.set(g.an, HE.teams[g.a]); }
for (const [id, n] of Object.entries(PL.names || {})) if (HE.players[id]) players.set(n, HE.players[id]);
const FSI = '⁨', PDI = '⁩';

function conv(s) {
  if (teams.has(s)) return teams.get(s);
  if (players.has(s)) return players.get(s);
  let out = s;
  if (out.includes(FSI)) for (const [en, he] of [...teams, ...players]) out = out.split(FSI + en + PDI).join(FSI + he + PDI);
  for (const [en, he] of players) if (en.includes(' ') && en.length >= 9 && out.includes(en)) out = out.split(en).join(he);   // שמות מלאים של שחקנים בתוך טקסט
  return out;
}
function walk(x) {
  if (typeof x === 'string') return conv(x);
  if (Array.isArray(x)) return x.map(walk);
  if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) o[k] = walk(v); return o; }
  return x;
}
for (const f of process.argv.slice(2)) {
  const j = readJson(f, null); if (!j) continue;
  const out = walk(j);
  if (Array.isArray(out && out.fixtures)) for (const fx of out.fixtures) if (fx.result && fx.news && fx.news.items) fx.news = null;   // חדשות לפני משחק שכבר הסתיים: מיותרות
  fs.writeFileSync(f, JSON.stringify(out));
  console.log('הומר:', path.basename(f));
}
