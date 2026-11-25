// בודק כפילויות בין טפסים של אותו יום: אותו הימור, או אותו כיוון באותו משחק (למשל "א' -3 קרנות" ו"ב' מתחת ל-3.5 קרנות")
import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync(new URL('../data/slips.json', import.meta.url), 'utf8'));
const opp = s => s === 'home' ? 'away' : 'home';
const tok = l => { const [st, p2, p3, p4] = l.key.split('|'), fam = st === 'c1' ? 'c' : st; if (!['c', 'sot', 'sh', 'g'].includes(fam)) return null; if (p2 === 'ah') { const ln = Number(p4); if (!(Math.abs(ln) >= 1)) return null; return l.id + '|' + fam + '|' + (ln < 0 ? p3 : opp(p3)); } if (fam === 'g' || !['home', 'away'].includes(p2)) return null; return l.id + '|' + fam + '|' + (p3 === 'over' ? p2 : opp(p2)); };
let bad = 0;
for (const d of S.days) {
  const sl = []; for (const lv of ['strong', 'second']) { const x = d.k[lv].f; if (x.legs.length) sl.push([lv, x]); }
  for (const w of d.k.win || []) sl.push(['שעות ' + w.label, w]); for (const w of d.k.lg || []) sl.push(['קבוע ' + w.label, w]);
  const seenS = new Map(), seenT = new Map();
  for (const [n, x] of sl) for (const l of x.legs) {
    const s = l.id + '|' + l.key, t = tok(l);
    if (seenS.has(s) && seenS.get(s) !== n) { bad++; console.log(d.date, 'הימור כפול:', l.label, '|', seenS.get(s), '+', n); } else seenS.set(s, n);
    if (t) { if (seenT.has(t) && seenT.get(t)[0] !== n) { bad++; console.log(d.date, 'אותו כיוון:', l.label, '=', seenT.get(t)[1], '|', seenT.get(t)[0], '+', n); } else seenT.set(t, [n, l.label]); }
  }
}
console.log(bad ? 'נמצאו ' + bad : 'אין כפילויות');
