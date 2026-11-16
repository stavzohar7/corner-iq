// בדיקה לאחור לכדורסל: מנבא כל משחק רק מהמידע שהיה לפניו, ומכוון את הפרמטרים.
//   node scripts/bball-backtest.mjs          מדפיס ביצועים
//   node scripts/bball-backtest.mjs --tune   מחפש פרמטרים טובים יותר ואומד סטיות תקן
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBB, predictBB, TB } from './bball.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache', 'bball.json'), 'utf8'));
const seasonOf = ts => { const d = new Date(ts * 1000); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const games = Object.values(cache.games).filter(g => (g.comp === 103 || g.comp === 569) && g.g[0] > 0).sort((a, b) => a.ts - b.ts);
const sd = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

export function evaluate() {
  const res = { 103: { m: [], t: [], tm: [], tt: [], th: [] }, 569: { m: [], t: [], tm: [], tt: [], th: [] } };
  for (const comp of [103, 569]) {
    const all = games.filter(g => g.comp === comp);
    for (const season of [...new Set(all.map(g => seasonOf(g.ts)))]) {
      const S = all.filter(g => seasonOf(g.ts) === season); if (S.length < 80) continue;
      const priorG = [1, 2].flatMap(k => all.filter(g => seasonOf(g.ts) === season - k).map(g => ({ ...g, pw: TB.PRIOR_W * (k === 1 ? 1 : 0.5) })));
      const byDay = new Map(); for (const g of S) { const k = Math.floor(g.ts / 86400); (byDay.get(k) || byDay.set(k, []).get(k)).push(g); }
      for (const [k, batch] of byDay) {
        const before = S.filter(g => g.ts < k * 86400);
        if (before.length < 60) continue;
        const model = buildBB(before, priorG);
        for (const g of batch) {
          const P = predictBB(model, g.h, g.a, g.ts);
          const R = res[comp];
          R.m.push((g.g[0] - g.g[1]) - (P.muH - P.muA)); R.t.push((g.g[0] + g.g[1]) - (P.muH + P.muA));
          R.tm.push((g.g[0] - g.g[1]) - (model.lg.h - model.lg.a)); R.tt.push((g.g[0] + g.g[1]) - (model.lg.h + model.lg.a)); // ניחוש נאיבי: ממוצע הליגה
          R.th.push(g.g[0] - P.muH); R.th.push(g.g[1] - P.muA);
        }
      }
    }
  }
  return res;
}
const rmse = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const score = r => -[103, 569].reduce((t, c) => t + rmse(r[c].m) / 12 + rmse(r[c].t) / 17, 0);

if (process.argv[1] && process.argv[1].endsWith('bball-backtest.mjs')) {
  const show = r => { for (const c of [103, 569]) console.log(`  ${c}: n=${r[c].m.length} | הפרש RMSE מודל ${rmse(r[c].m).toFixed(2)} (נאיבי ${rmse(r[c].tm).toFixed(2)}) | סכום RMSE מודל ${rmse(r[c].t).toFixed(2)} (נאיבי ${rmse(r[c].tt).toFixed(2)}) | קבוצה RMSE ${rmse(r[c].th).toFixed(2)}`); };
  let cur = evaluate(); console.log('פרמטרים:', JSON.stringify({ ...TB, SD_M: undefined, SD_T: undefined, SD_TEAM: undefined })); show(cur); console.log('ציון', score(cur).toFixed(4));
  if (process.argv.includes('--tune')) {
    const GRID = { SHRINK_K: [2, 4, 6, 10, 16], DECAY: [0.93, 0.95, 0.97, 0.985, 1], VENUE_MIX: [0.5, 1, 2], PRIOR_W: [0, 0.2, 0.4, 0.7, 1], B2B: [0, 0.01, 0.02, 0.03] };
    for (let round = 1; round <= 2; round++) {
      let improved = false;
      for (const [k, vals] of Object.entries(GRID)) {
        const orig = TB[k]; let best = { v: orig, sc: score(cur) };
        for (const v of vals) { if (v === orig) continue; TB[k] = v; const sc = score(evaluate()); console.log(`  ${k}=${v}: ${sc.toFixed(4)}`); if (sc > best.sc + 1e-4) best = { v, sc }; }
        TB[k] = best.v; if (best.v !== orig) { improved = true; console.log(`  ✔ ${k}: ${orig} → ${best.v}`); }
      }
      if (!improved) break;
    }
    cur = evaluate(); console.log('סופי:', JSON.stringify({ DECAY: TB.DECAY, SHRINK_K: TB.SHRINK_K, PRIOR_W: TB.PRIOR_W, VENUE_MIX: TB.VENUE_MIX, B2B: TB.B2B })); show(cur);
    console.log('סטיות תקן: SD_M', JSON.stringify({ 103: +sd(cur[103].m).toFixed(1), 569: +sd(cur[569].m).toFixed(1) }), 'SD_T', JSON.stringify({ 103: +sd(cur[103].t).toFixed(1), 569: +sd(cur[569].t).toFixed(1) }), 'SD_TEAM', JSON.stringify({ 103: +sd(cur[103].th).toFixed(1), 569: +sd(cur[569].th).toFixed(1) }));
  }
}
