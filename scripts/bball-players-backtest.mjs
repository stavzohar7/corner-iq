// בדיקה לאחור לתחזית שחקנים: האם "דקות × קצב" עם דעיכה מנצח את ממוצע העונה, מבלי להסתכל על המשחק עצמו.
//   node scripts/bball-players-backtest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLogs } from './bball-players.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache', 'bball-players.json'), 'utf8'));
const logs = buildLogs(PL);
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const wmean = (xs, d) => { let s = 0, w = 0; xs.forEach((x, i) => { const wt = d ** i; s += wt * x; w += wt; }); return w ? s / w : 0; };
const variants = {
  'ממוצע כל המשחקים': G => mean(G.map(g => g.pts)),
  'ממוצע 10 אחרונים': G => mean(G.slice(0, 10).map(g => g.pts)),
  'דקות × קצב (דעיכה .93)': G => { const m = wmean(G.slice(0, 10).map(g => g.min), 0.85), r = wmean(G.slice(0, 20).map(g => g.pts), 0.93) / wmean(G.slice(0, 20).map(g => g.min), 0.93); return m * r; },
  'שילוב: חצי ממוצע כללי וחצי דקות × קצב': G => 0.5 * mean(G.map(g => g.pts)) + 0.5 * (() => { const m = wmean(G.slice(0, 10).map(g => g.min), 0.85), r = wmean(G.slice(0, 20).map(g => g.pts), 0.93) / wmean(G.slice(0, 20).map(g => g.min), 0.93); return m * r; })(),
};
const res = Object.fromEntries(Object.keys(variants).map(k => [k, { ae: 0, n: 0, bias: 0 }]));
for (const L of logs.values()) {
  const gs = L.games; // חדש לישן
  for (let i = 0; i < gs.length - 10; i++) {
    const g = gs[i]; if (g.min < 10) continue;
    const prev = gs.slice(i + 1, i + 26); if (prev.length < 10) continue;
    if (mean(prev.slice(0, 10).map(x => x.min)) < 15) continue;
    for (const [k, f] of Object.entries(variants)) { const p = f(prev), r = res[k]; r.ae += Math.abs(p - g.pts); r.bias += g.pts - p; r.n++; }
  }
}
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(42), 'MAE', (r.ae / r.n).toFixed(3), 'הטיה', (r.bias / r.n).toFixed(2), 'n', r.n);
