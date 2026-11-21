// משלים תוצאות רבעים (q) לכל משחקי הכדורסל ב-data/cache/bball-players.json. שימוש: node scripts/bb-quarters-backfill.mjs [מקסימום קריאות]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBox } from './bball-players.mjs';
import { pool } from './source-365.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), F = path.join(ROOT, 'data', 'cache', 'bball-players.json');
const PL = JSON.parse(fs.readFileSync(F, 'utf8')), max = +process.argv[2] || 600;
const need = Object.entries(PL.games).filter(([, g]) => g.p && g.p.length && g.q === undefined).sort((a, b) => b[1].ts - a[1].ts).slice(0, max);
let n = 0, ok = 0;
await pool(need, async ([id, g]) => { const b = await fetchBox(id); g.q = b && b.q ? b.q : null; if (g.q) ok++; if (++n % 50 === 0) console.log(n + '/' + need.length); }, 4);
fs.writeFileSync(F, JSON.stringify(PL));
console.log('סיום', n, 'משחקים, עם רבעים:', ok);
