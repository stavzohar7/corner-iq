// כיול הימורי "X נקודות ומעלה": האם ההסתברות של המודל תואמת את מה שקרה בפועל?   node scripts/bball-props-backtest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLogs } from './bball-players.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache', 'bball-players.json'), 'utf8'));
const logs = buildLogs(PL);
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const wmean = (xs, d) => { let s = 0, w = 0; xs.forEach((x, i) => { const wt = d ** i; s += wt * x; w += wt; }); return w ? s / w : 0; };
const sdOf = xs => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
const SD_MULT = Number(process.env.SDM || 1), SHRINK = Number(process.env.SHRINK || 0);
const bins = {};
for (const L of logs.values()) {
  const gs = L.games;
  for (let i = 0; i < gs.length - 15; i++) {
    const g = gs[i]; if (!(g.min > 0)) continue;       // שחקן שלא שיחק: ההימור מוחזר
    const prev = gs.slice(i + 1, i + 26); if (prev.length < 12) continue;
    const minW = wmean(prev.slice(0, 10).map(x => x.min), 0.85); if (minW < 20) continue;
    const rate = wmean(prev.slice(0, 20).map(x => x.pts), 0.93) / wmean(prev.slice(0, 20).map(x => x.min), 0.93);
    const proj = 0.5 * minW * rate + 0.5 * mean(prev.map(x => x.pts)) * 1;
    const last = prev.slice(0, 15).map(x => x.pts), sd = Math.min(9.5, Math.max(3.5, sdOf(last))) * SD_MULT;
    for (const X of [5, 10, 15, 20, 25, 30, 35]) {
      const pm = 1 - Phi((X - 0.5 - proj) / sd), pf = (1 - SHRINK) * pm + SHRINK * 0.5;
      if (pm < 0.3 || pm > 0.97) continue;
      const hit = last.filter(v => v >= X).length / last.length, b = Math.min(9, Math.floor(pm * 10));
      const o = bins[b] ||= { n: 0, p: 0, w: 0, hp: 0, hw: 0 };
      o.n++; o.p += pf; o.w += g.pts >= X ? 1 : 0;
    }
  }
}
for (const b of Object.keys(bins).sort()) { const o = bins[b]; console.log(`${b}0%`.padEnd(5), 'n', String(o.n).padEnd(6), 'מודל', (o.p / o.n).toFixed(3), 'בפועל', (o.w / o.n).toFixed(3)); }
