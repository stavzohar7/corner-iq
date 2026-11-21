// בדיקת כיול לאחור: האם ההסתברות שהמודל נותן ל"מעל/מתחת" (שחקנים, סטטיסטיקות קבוצה, רבע ראשון) תואמת את התדירות בפועל.  node scripts/bb-audit.mjs
import fs from 'node:fs';
const PL = JSON.parse(fs.readFileSync('data/cache/bball-players.json', 'utf8'));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
const poisCdf = (k, lam) => { let s = 0, t = Math.exp(-lam); for (let i = 0; i <= k; i++) { s += t; t *= lam / (i + 1); } return s; };
const games = Object.values(PL.games).filter(g => g.p && g.p.length).sort((a, b) => a.ts - b.ts);
// ---- שחקנים: ממוצע 12 אחרונים (עם 25+ דקות), סטיית תקן, קו = עיגול ל-.5 ----
const hist = new Map(), buckets = {};
const add = (name, pPred, hit) => { const b = Math.min(9, Math.floor(pPred * 10)); const B = (buckets[name] = buckets[name] || Array.from({ length: 10 }, () => [0, 0, 0])); B[b][0]++; B[b][1] += hit; B[b][2] += pPred; };
for (const g of games) {
  for (const r of g.p) {
    const [pid, , min, pts, reb, ast, tpm] = r, H = hist.get(pid) || [];
    if (H.length >= 12 && min >= 20) {
      const L = H.slice(-12).filter(x => x.min >= 18); if (L.length >= 8) for (const [st, col, v] of [['pts', 'pts', pts], ['reb', 'reb', reb], ['ast', 'ast', ast], ['tpm', 'tpm', tpm]]) {
        const xs = L.map(x => x[col]), m = mean(xs), s = sd(xs) * 1.05; if (!(s > 0)) continue;
        for (const dl of [-1, -0.5, 0, 0.5, 1]) { const ln = Math.round((m + dl * s) * 2 - 0.5) / 2 + 0.5 - 0.5; const line = Math.floor(m + dl * s) + 0.5;
          const pOver = st === 'tpm' ? 1 - poisCdf(Math.floor(line), m) : 1 - cdf((line - m) / s);
          add(st + ' over', pOver, v > line ? 1 : 0); add(st + ' under', 1 - pOver, v < line ? 1 : 0); }
      }
    }
    H.push({ min, pts, reb, ast, tpm }); hist.set(pid, H);
  }
}
for (const [k, B] of Object.entries(buckets)) {
  console.log('\n' + k);
  B.forEach((b, i) => { if (b[0] >= 40) console.log(`  מודל ${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}: n=${b[0]} צפוי ${(b[2] / b[0]).toFixed(2)} בפועל ${(b[1] / b[0]).toFixed(2)}`); });
}
