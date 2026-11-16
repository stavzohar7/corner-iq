// בדיקה לאחור: כמה המודל מנבא נכון משחקים שכבר קרו, תוך שימוש רק במידע שהיה ידוע לפני כל משחק.
// משמש ללמוד אילו פרמטרים (דעיכה, כיווץ, משקל העונה הקודמת) נותנים את החיזוי הטוב ביותר.
//   node scripts/backtest.mjs            מדפיס את הביצועים עם הפרמטרים הנוכחיים
//   node scripts/backtest.mjs --tune     מחפש פרמטרים טובים יותר (ירידה לפי קואורדינטות)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLeagueModel, strength, nbPmf, TUNE } from './model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const cache = readJson(path.join(ROOT, 'data', 'cache', 'matches.json'));
const hist = readJson(path.join(ROOT, 'data', 'cache', 'history-v2.json'));
const all = [...Object.values(cache.matches).filter(m => String(m.h).includes(':') || (process.env.LG && String(m.lg) === process.env.LG)), ...Object.values(hist).flatMap(d => Object.values(d).flat())].filter(m => m.g && m.g[0] != null);
const bySeasonLg = {};
for (const m of all) (bySeasonLg[m.season + '|' + m.lg] ||= []).push(m);
const seasons = [...new Set(all.map(m => m.season))].sort();
const WEEK = 7 * 86400;
const STATS = ['g', 'c', 'sh', 'sot'];

function priorFor(season, lg, base) {
  const out = [];
  for (const gap of [1, 2]) { const L = bySeasonLg[(season - gap) + '|' + lg]; if (L) for (const m of L) out.push({ ...m, pw: base * (gap === 1 ? 1 : TUNE.PRIOR_GAP2) }); }
  return out;
}

// מנבא את הצפי של שתי הקבוצות לכל מדד, כמו ב-analyzeFixture אבל בלי התאמות נוספות
function predict(model, m) {
  const lg = model.lg, lh = model.teams[m.h] || [], la = model.teams[m.a] || [], ph = model.priors[m.h] || null, pa = model.priors[m.a] || null;
  const memo = new Map();
  const rel = (id, v, st, side) => { const k = id + '|' + v + '|' + st + '|' + side; if (!memo.has(k)) memo.set(k, strength(model.teams[id] || [], v, st, side, lg, null, model.priors[id] || null)); return memo.get(k); };
  // אם הקבוצה בעטה נגד היריבה e.opp, חוזק ההגנה של היריבה (כמה היא נותנת ביחס לממוצע) הוא המשלים
  const adjF = (side, st) => e => rel(e.opp, e.v === 'H' ? 'A' : 'H', st, side === 'F' ? 'A' : 'F');
  const str = (list, v, st, side, pr) => strength(list, v, st, side, lg, null, pr, adjF(side, st));
  const S = {};
  for (const s of ['g', 'c', 'sh', 'sot']) {
    const av = lg.avg[s]; if (!av) continue;
    S[s] = { h: av.h * str(lh, 'H', s, 'F', ph) * str(la, 'A', s, 'A', pa), a: av.a * str(la, 'A', s, 'F', pa) * str(lh, 'H', s, 'A', ph), phi: av.phi, base: av };
  }
  if (S.c && lg.avg.sh && S.sh) { // קרנות: שילוב עם נפח בעיטות
    const av = lg.avg.c, sh = { h: str(lh, 'H', 'sh', 'F', ph) * str(la, 'A', 'sh', 'A', pa), a: str(la, 'A', 'sh', 'F', pa) * str(lh, 'H', 'sh', 'A', ph) };
    S.c.h = TUNE.W_CORNERS * S.c.h + (1 - TUNE.W_CORNERS) * av.h * sh.h; S.c.a = TUNE.W_CORNERS * S.c.a + (1 - TUNE.W_CORNERS) * av.a * sh.a;
  }
  return S;
}
const obs = (m, s, side) => s === 'g' ? m.g[side === 'h' ? 0 : 1] : m.s && m.s[side] ? m.s[side][s] : null;
const ll = (lam, phi, x) => { const p = nbPmf(Math.max(lam, 0.05), phi); return Math.log(Math.max(p[Math.min(Math.round(x), p.length - 1)] || 0, 1e-9)); };

export function evaluate(target, priorBase) {
  const acc = Object.fromEntries(STATS.map(s => [s, { n: 0, ll: 0, llBase: 0, ae: 0, aeBase: 0 }]));
  for (const lg of new Set(all.filter(m => m.season === target).map(m => m.lg)).values()) {
    if (process.env.LG && String(lg) !== process.env.LG) continue;
    const ms = (bySeasonLg[target + '|' + lg] || []).slice().sort((a, b) => a.ts - b.ts);
    if (ms.length < 50) continue;
    const t0 = ms[0].ts, prior = priorBase > 0 ? priorFor(target, lg, priorBase) : [];
    const windows = new Map();
    for (const m of ms) { const k = Math.floor((m.ts - t0) / WEEK); (windows.get(k) || windows.set(k, []).get(k)).push(m); }
    for (const [k, batch] of windows) {
      const before = ms.filter(m => m.ts < t0 + k * WEEK);
      const model = buildLeagueModel(before, prior);
      for (const m of batch) {
        const S = predict(model, m);
        for (const s of STATS) {
          if (!S[s]) continue;
          const xh = obs(m, s, 'h'), xa = obs(m, s, 'a'); if (xh == null || xa == null) continue;
          const A = acc[s]; A.n += 2;
          A.ll += ll(S[s].h, S[s].phi, xh) + ll(S[s].a, S[s].phi, xa);
          A.llBase += ll(S[s].base.h, S[s].phi, xh) + ll(S[s].base.a, S[s].phi, xa);
          A.ae += Math.abs(S[s].h + S[s].a - (xh + xa));
          A.aeBase += Math.abs(S[s].base.h + S[s].base.a - (xh + xa));
        }
      }
    }
  }
  return acc;
}

const fmt = acc => STATS.map(s => { const A = acc[s]; return `${s}: ll ${(A.ll / A.n).toFixed(4)} (בסיס ${(A.llBase / A.n).toFixed(4)}, שיפור ${((A.ll - A.llBase) / A.n).toFixed(4)}) MAE סה״כ ${(A.ae / (A.n / 2)).toFixed(3)}`; }).join('\n   ');
const score = (accs) => accs.reduce((t, acc) => t + STATS.reduce((x, s) => x + (acc[s].n ? acc[s].ll / acc[s].n : 0), 0), 0) / accs.length; // כמה טוב מהבסיס, ממוצע על המדדים והעונות

function runAll(priorBase) {
  const t = seasons.slice(-2);              // שתי העונות האחרונות: מלאה, ועונה נוכחית
  return t.map(s => ({ season: s, acc: evaluate(s, priorBase) }));
}

const TUNE_GRID = process.env.ONLY ? Object.fromEntries(Object.entries({ SHRINK_K: [5, 8, 12], DECAY: [0.95, 0.98, 1], VENUE_MIX: [0.5, 1, 1.5], W_CORNERS: [0.2, 0.4, 0.6], PRIOR_W: [0.3, 0.4, 0.55], PHI_K: [0.2, 0.35, 0.5, 0.7, 0.9, 1.1] }).filter(([k]) => k === process.env.ONLY)) : { SHRINK_K: [5, 8, 12], DECAY: [0.95, 0.98, 1], VENUE_MIX: [0.5, 1, 1.5], W_CORNERS: [0.2, 0.4, 0.6], PRIOR_W: [0.3, 0.4, 0.55], PHI_K: [0.2, 0.35, 0.5, 0.7, 0.9, 1.1] };

if (process.argv[1] && process.argv[1].endsWith('backtest.mjs')) {
  const doTune = process.argv.includes('--tune');
  const evalNow = () => { const r = runAll(TUNE.PRIOR_W); return { r, sc: score(r.map(x => x.acc)) }; };
  let cur = evalNow();
  console.log('פרמטרים:', JSON.stringify(TUNE), 'עונות:', seasons.join(','));
  for (const x of cur.r) console.log(`עונה ${x.season}:\n   ${fmt(x.acc)}`);
  console.log('ציון כולל (גבוה = טוב יותר מהבסיס):', cur.sc.toFixed(5));
  if (process.argv.includes('--report')) {
    const seasonsOut = {};
    for (const x of cur.r) seasonsOut[x.season] = Object.fromEntries(STATS.map(s => { const A = x.acc[s]; return [s, { n: A.n / 2, mae: Math.round(A.ae / (A.n / 2) * 100) / 100, maeNaive: Math.round(A.aeBase / (A.n / 2) * 100) / 100 }]; }));
    fs.writeFileSync(path.join(ROOT, 'data', 'model.json'), JSON.stringify({ updated: new Date().toISOString(), tune: TUNE, seasons: seasonsOut }));
    console.log('נכתב data/model.json');
  }
  if (doTune) {
    for (let round = 1; round <= 2; round++) {
      let improved = false;
      for (const [k, vals] of Object.entries(TUNE_GRID)) {
        const orig = TUNE[k]; let best = { v: orig, sc: cur.sc };
        for (const v of vals) { if (v === orig) continue; TUNE[k] = v; const e = evalNow(); console.log(`  ${k}=${v}: ${e.sc.toFixed(5)}`); if (e.sc > best.sc + 1e-5) best = { v, sc: e.sc }; }
        TUNE[k] = best.v; if (best.v !== orig) { improved = true; cur = evalNow(); console.log(`  ✔ ${k}: ${orig} → ${best.v} (ציון ${cur.sc.toFixed(5)})`); }
      }
      if (!improved) break;
    }
    console.log('\nפרמטרים סופיים:', JSON.stringify(TUNE));
    for (const x of cur.r) console.log(`עונה ${x.season}:\n   ${fmt(x.acc)}`);
  }
}
