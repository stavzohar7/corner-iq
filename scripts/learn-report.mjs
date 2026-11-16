// "הלקחים היומיים": משווה את מה שהמודל צפה למה שקרה בפועל, לפי סוג הימור וציון, וכותב קובץ שהמנתח קורא בכל בוקר.
//   node scripts/learn-report.mjs        (נקרא גם בסוף scripts/update.mjs)
// כותב data/knowledge/calibration.json ו-data/knowledge/lessons.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const r2 = x => Math.round(x * 100) / 100;
const MIN_N = 15, MIN_DAYS = 3, GAP = 0.12;   // לא מסיקים לקח מיום אחד: משחקים באותו יום קשורים זה לזה

export function runLearnReport({ root = ROOT, log = () => {} } = {}) {
  const sports = { f: { name: 'כדורגל', dir: 'days', rows: [] }, b: { name: 'כדורסל', dir: 'bball', rows: [] }, n: { name: 'כדורגל נבחרות (ליגת האומות וכו׳)', dir: 'days', rows: [], nat: true } };
  for (const sp of Object.values(sports)) {
    const dir = path.join(root, 'data', sp.dir);
    let files = []; try { files = fs.readdirSync(dir).filter(x => /^\d{4}-\d\d-\d\d\.json$/.test(x)); } catch { /* */ }
    for (const f of files) {
      const d = readJson(path.join(dir, f), null); if (!d || !d.fixtures) continue;
      for (const g of d.fixtures) for (const m of g.markets || []) {
        if (sp.nat && g.lg !== 5) continue;
        if (!m.res || /push/.test(m.res) || !(m.score >= 6) || !(m.pFinal > 0)) continue;
        const kind = sp.dir === 'days' ? [m.stat, m.group, m.side].join('|') : [m.group, m.side].join('|');
        sp.rows.push({ d: f, kind, label: m.group === 'prop' ? 'נקודות שחקן' : m.label, score: m.score, p: m.pFinal, win: /win/.test(m.res) ? 1 : 0, odds: m.odds || null });
      }
    }
  }
  const agg = rows => { const n = rows.length; if (!n) return null; const w = rows.reduce((s, r) => s + r.win, 0), p = rows.reduce((s, r) => s + r.p, 0) / n; return { n, hit: r2(w / n), expected: r2(p) }; };
  const out = { updated: new Date().toISOString(), sports: {} }, md = ['# לקחים מהתוצאות (מתעדכן אוטומטית כל הרצה)', ''];
  for (const [k, sp] of Object.entries(sports)) {
    const total = agg(sp.rows), bins = {}, kinds = {};
    for (const r of sp.rows) { (bins[r.score] ||= []).push(r); (kinds[r.kind] ||= []).push(r); }
    const binOut = Object.fromEntries(Object.entries(bins).map(([s, rows]) => [s, agg(rows)]));
    const kindOut = Object.fromEntries(Object.entries(kinds).map(([s, rows]) => [s, { ...agg(rows), example: rows[0].label }]));
    out.sports[k] = { total, bins: binOut, kinds: kindOut };
    md.push(`## ${sp.name}`, total ? `סה״כ ${total.n} הימורים שנגמרו (ציון 6+): עברו ${Math.round(total.hit * 100)}%, והמודל צפה ${Math.round(total.expected * 100)}%.` : 'עוד אין הימורים שנגמרו.');
    const nDays = k2 => new Set(kinds[k2].map(r => r.d)).size;
    const flags = Object.entries(kindOut).filter(([k2, v]) => v.n >= (sp.nat ? 6 : MIN_N) && nDays(k2) >= (sp.nat ? 2 : MIN_DAYS) && Math.abs(v.hit - v.expected) >= GAP).sort((a, b) => b[1].n - a[1].n);
    for (const [key, v] of flags) md.push(`- סוג הימור ${key} (למשל "${v.example}"): ${v.n} הימורים, עברו ${Math.round(v.hit * 100)}% מול ${Math.round(v.expected * 100)}% צפוי. ${v.hit < v.expected ? 'המודל אופטימי מדי כאן: להוריד ציון (d -1 עד -2) אלא אם יש סיבה חזקה.' : 'המודל שמרן כאן: אפשר להיות בטוחים יותר.'}`);
    if (!flags.length && total) md.push(total.n < MIN_N || new Set(sp.rows.map(r => r.d)).size < MIN_DAYS ? '- עדיין מעט ימים כדי להסיק לקחים לפי סוג הימור (צריך לפחות ' + MIN_DAYS + ' ימים).' : '- אין סוג הימור שחורג משמעותית מהצפי. ממשיכים כרגיל.');
    {  // במה אנחנו טובים ובמה פחות: סוגי הימור עם לפחות 6 הימורים שנגמרו, לפי ההפרש בין מה שעבר למה שהמודל צפה (מספרים, בלי אחוזים)
      const ranked = Object.entries(kindOut).filter(([, v]) => v.n >= 6).map(([k2, v]) => ({ k2, v, d: v.hit - v.expected })).sort((x, y) => y.d - x.d);
      const fmt = r => r.k2 + ' (למשל "' + r.v.example + '"): עברו ' + Math.round(r.v.hit * r.v.n) + ' מתוך ' + r.v.n + ', והמודל צפה כ-' + Math.round(r.v.expected * r.v.n);
      const good = ranked.filter(r => r.d >= 0.08).slice(0, 4), bad = ranked.filter(r => r.d <= -0.08).slice(-4).reverse();
      if (good.length) md.push('- במה אנחנו טובים: ' + good.map(fmt).join(' · '));
      if (bad.length) md.push('- במה אנחנו פחות טובים: ' + bad.map(fmt).join(' · '));
    }
    const binLine = Object.keys(binOut).sort().map(s => `ציון ${s}: ${binOut[s].n} הימורים, עברו ${Math.round(binOut[s].hit * 100)}%`).join(' · ');
    if (binLine) md.push(binLine);
    md.push('');
  }
  // הטיות של הצפי עצמו (לא רק של ההימורים): ממוצע (בפועל פחות צפי). הטיה קבועה אומרת שהמודל מערער מערכתית
  const bias = [];
  {
    const rowsBB = {}, rowsF = {};
    const listDir = d => { try { return fs.readdirSync(path.join(root, 'data', d)).filter(x => /^\d{4}-\d\d-\d\d\.json$/.test(x)).map(x => readJson(path.join(root, 'data', d, x), null)).filter(Boolean); } catch { return []; } };
    for (const d of listDir('bball')) for (const g of d.fixtures || []) {
      if (!g.result || !g.result.g || !g.exp || g.exp.h == null) continue;
      const k = g.comp === 569 ? 'יורוליג' : 'NBA';
      (rowsBB[k] ||= []).push({ h: g.result.g[0] - g.exp.h, a: g.result.g[1] - g.exp.a, t: g.result.g[0] + g.result.g[1] - g.exp.h - g.exp.a, m: (g.result.g[0] - g.result.g[1]) - (g.exp.h - g.exp.a) });
    }
    for (const d of listDir('days')) for (const g of d.fixtures || []) {
      const S = g.result && g.result.stats; if (!S || !g.exp || !g.exp.g) continue;
      const k = g.lg === 5 ? 'נבחרות' : 'מועדונים', r = (rowsF[k] ||= { n: 0, g: 0, c: 0, sh: 0, sot: 0 }); r.n++;
      for (const st of ['g', 'c', 'sh', 'sot']) { const e = g.exp[st], v = st === 'g' ? g.result.g : S[st]; if (e && v && v[0] != null && v[1] != null) r[st] += v[0] + v[1] - e.total; }
    }
    const avg = (L, fn) => r2(L.reduce((t, x) => t + fn(x), 0) / L.length), sg = x => (x >= 0 ? '+' : '') + x;
    for (const [k, L] of Object.entries(rowsBB)) if (L.length >= 6) {
      const h = avg(L, x => x.h), a = avg(L, x => x.a), m = avg(L, x => x.m), t = avg(L, x => x.t);
      bias.push('כדורסל ' + k + ' (' + L.length + ' משחקים): המארחת קלעה ' + sg(h) + ' נקודות מול הצפי, האורחת ' + sg(a) + ', סך הנקודות ' + sg(t) + ', הפער לטובת המארחת ' + sg(m) + '.' + (m >= 3 ? ' הצפי מזלזל ביתרון הבית: להיזהר מ"מתחת" על מארחת פייבוריטית ומהימור על האורחת.' : ''));
    }
    for (const [k, r] of Object.entries(rowsF)) if (r.n >= 6) bias.push('כדורגל ' + k + ' (' + r.n + ' משחקים): בפועל פחות צפי לסך המשחק: שערים ' + sg(r2(r.g / r.n)) + ', קרנות ' + sg(r2(r.c / r.n)) + ', בעיטות ' + sg(r2(r.sh / r.n)) + ', בעיטות למסגרת ' + sg(r2(r.sot / r.n)) + ' (קרוב לאפס = הצפי מדויק).');
  }
  if (bias.length) { md.push('## הטיות של הצפי (בפועל פחות צפי)', ...bias.map(x => '- ' + x), ''); out.bias = bias; }
  fs.mkdirSync(path.join(root, 'data', 'knowledge'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'knowledge', 'calibration.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(root, 'data', 'knowledge', 'lessons.md'), md.join('\n'));
  // גרסה לאתר: חלקים לפי כותרת, בלי תווי כיוון נסתרים
  { const sections = []; let cur = null;
    for (const line of md.join('\n').split('\n')) {
      const h = line.match(/^## (.+)/); if (h) { cur = { title: h[1], lines: [] }; sections.push(cur); continue; }
      if (cur && line.trim()) cur.lines.push(line.replace(/^- /, '').replace(/[\u2066-\u2069\u200e\u200f]/g, ''));
    }
    fs.writeFileSync(path.join(root, 'data', 'lessons.json'), JSON.stringify({ updated: new Date().toISOString(), sections })); }
  log(`לקחים: כדורגל ${out.sports.f.total ? out.sports.f.total.n : 0} הימורים (נבחרות ${out.sports.n.total ? out.sports.n.total.n : 0}), כדורסל ${out.sports.b.total ? out.sports.b.total.n : 0}`);
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { runLearnReport({ log: console.log }); console.log(fs.readFileSync(path.join(ROOT, 'data', 'knowledge', 'lessons.md'), 'utf8')); }
