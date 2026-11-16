// האם כדאי ללמוד מהטעות של כל שחקן במשחקים הקודמים (שארית ממוצעת נעה) ולתקן בה את תחזית הנקודות?
//   node scripts/bball-players-learn-backtest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLogs } from './bball-players.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache', 'bball-players.json'), 'utf8'));
const logs = buildLogs(PL);
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const wmean = (xs, d) => { let s = 0, w = 0; xs.forEach((x, i) => { const wt = d ** i; s += wt * x; w += wt; }); return w ? s / w : 0; };
const base = prev => { const minW = wmean(prev.slice(0, 10).map(x => x.min), 0.85), rate = wmean(prev.slice(0, 20).map(x => x.pts), 0.93) / wmean(prev.slice(0, 20).map(x => x.min), 0.93); return 0.5 * minW * rate + 0.5 * mean(prev.map(x => x.pts)); };
const res = {};
const add = (k, e) => { const r = res[k] ||= { ae: 0, n: 0 }; r.ae += Math.abs(e); r.n++; };
for (const L of logs.values()) {
  const gs = L.games;   // חדש לישן
  // שארית לכל משחק לפי התחזית שהייתה לפניו
  const resid = [];
  for (let i = gs.length - 16; i >= 0; i--) { const prev = gs.slice(i + 1, i + 26); if (prev.length < 12) continue; resid[i] = gs[i].pts - base(prev); }
  for (let i = 0; i < gs.length - 20; i++) {
    const g = gs[i]; if (!(g.min >= 10)) continue;
    const prev = gs.slice(i + 1, i + 26); if (prev.length < 12 || wmean(prev.slice(0, 10).map(x => x.min), 0.85) < 20) continue;
    const b = base(prev), rs = [];
    for (let j = i + 1; j < Math.min(gs.length, i + 11); j++) if (resid[j] != null) rs.push(resid[j]);
    if (rs.length < 5) continue;
    const r5 = mean(rs.slice(0, 5)), r10 = mean(rs);
    add('בסיס', g.pts - b);
    for (const w of [0.2, 0.35, 0.5]) { add('+' + w + '·שארית 5', g.pts - (b + w * r5)); add('+' + w + '·שארית 10', g.pts - (b + w * r10)); }
  }
}
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(18), 'MAE', (r.ae / r.n).toFixed(3), 'n', r.n);
