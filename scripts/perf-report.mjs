// דוח ביצועים ללמידה: איך ההימורים שלנו עברו, לפי סוג הימור, ליגה, יום, טווח יחס, ובנפרד 7 הימים האחרונים. כולל רשימת ההימורים שנפלו לאחרונה.
// שימוש: node scripts/perf-report.mjs [ספורט: f|b]   (קורא data/betlog.json, שנבנה בכל ריצה של day-summary)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sport = process.argv[2] || 'f';
const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'betlog.json'), 'utf8')).bets.filter(x => x.sp === sport && (x.r === 'w' || x.r === 'l'));
const last = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
const kindOf = k => k.split('|').slice(0, 3).join('|');
const table = (rows, fn, min = 1) => { const a = {}; for (const x of rows) { const k = fn(x), v = a[k] || (a[k] = { n: 0, w: 0 }); v.n++; if (x.r === 'w') v.w++; }
  return Object.entries(a).filter(([, v]) => v.n >= min).sort((p, q) => q[1].n - p[1].n).map(([k, v]) => `  ${k}: ${v.w}/${v.n} (${Math.round(100 * v.w / v.n)}%)`).join('\n'); };
const sec = (title, rows) => { console.log(`\n=== ${title}: ${rows.filter(x => x.r === 'w').length}/${rows.length}`);
  console.log('לפי סוג הימור (מ-4 ומעלה):\n' + table(rows, x => kindOf(x.k), 4)); console.log('לפי ליגה:\n' + table(rows, x => x.lg)); console.log('לפי יום:\n' + table(rows, x => x.d));
  console.log('לפי טווח יחס:\n' + table(rows, x => x.o < 1.3 ? '<1.3' : x.o < 1.5 ? '1.3-1.5' : x.o < 1.8 ? '1.5-1.8' : '1.8+')); console.log('בטופס (1) מול בודד (0):\n' + table(rows, x => x.s)); };
sec('כל התקופה', all); sec('7 ימים אחרונים', all.filter(x => x.d >= last));
console.log('\nהימורים שנפלו ב-7 הימים האחרונים (ליגה | משחק | סוג | יחס):');
for (const x of all.filter(x => x.d >= last && x.r === 'l').slice(-60)) console.log(`  ${x.d} ${x.lg} | ${x.g} | ${x.k} | ${x.o}`);
console.log('\nכלל אצבע: סוגים עם 6+ דוגמאות ופחות מ-50% נחשבים חלשים (להימנע או להוריד ציון); סוגים עם 15+ דוגמאות ומעל 75% נחשבים חזקים.');
