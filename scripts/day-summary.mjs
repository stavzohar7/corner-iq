// סיכום לכל יום: טפסים (נתפסו/נפלו/ממתינים, רווח או הפסד אם כל טופס נשלח ב-100 ₪) והימורים בודדים שלא נכנסו לאף טופס. כדורגל וכדורסל בנפרד.
// פלט: data/daysummary.json. רץ אוטומטית לפני כל פרסום (publish-git.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rj = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return d; } };
const clean = x => String(x || '').replace(/[⁦-⁩]/g, '').trim();
function gradeRec(key, R) {
  if (!R) return null;
  const [stat, group, side, ln] = String(key).split('|'), line = ln === '' || ln == null ? null : Number(ln);
  const v = stat === 'g' ? R.g : R.stats && R.stats[stat]; if (!v || v[0] == null || v[1] == null) return null;
  const h = v[0], a = v[1], cmp = (x, over) => x === line ? 'push' : ((over ? x > line : x < line) ? 'win' : 'lose'), tf = b => b ? 'win' : 'lose';
  if (group === 'total') return cmp(h + a, side === 'over'); if (group === 'home') return cmp(h, side === 'over'); if (group === 'away') return cmp(a, side === 'over');
  if (group === 'ah') { const d = (side === 'home' ? h - a : a - h) + line; return d === 0 ? 'push' : tf(d > 0); }
  if (group === 'dc') return tf(side === '1x' ? h >= a : side === 'x2' ? h <= a : h !== a);
  if (group === '1x2') { if (h === a) return side === 'draw' ? 'win' : (stat === 'g' ? 'lose' : 'push'); return tf((h > a) === (side === 'home')); }
  if (group === 'btts') return tf((h > 0 && a > 0) === (side === 'yes'));
  if (group === 'combo') { const [rs, ou] = side.split('_'), d = h - a, t = h + a, ok = rs === '1x' ? d >= 0 : rs === 'x2' ? d <= 0 : rs === '12' ? d !== 0 : rs === 'home' ? d > 0 : rs === 'away' ? d < 0 : d === 0; return tf(ok && (ou === 'over' ? t > line : t < line)); }
  return null;
}
const money = S => S.res === 'win' ? (S.total - 1) * 100 : S.res === 'lose' ? -100 : 0;
const slipStats = list => { const o = { n: list.length, w: 0, l: 0, p: 0, profit: 0 }; for (const S of list) { if (S.res === 'win') o.w++; else if (S.res === 'lose') o.l++; else o.p++; o.profit += money(S); } o.profit = Math.round(o.profit); return o; };
const slips = rj('data/slips.json', { days: [] }), I = rj('data/days/index.json', { days: [], picksLog: [] });
const dates = [...new Set([...slips.days.map(d => d.date), ...(I.days || []).map(d => d.date)])].sort().reverse();
const out = [];
for (const date of dates) {
  const sd = slips.days.find(x => x.date === date), k = sd && sd.k || {};
  const fS = [k.strong && k.strong.f, k.second && k.second.f, ...(k.win || []), ...(k.lg || [])].filter(S => S && S.legs && S.legs.length);
  const bS = ['n', 'e'].flatMap(sp => [k.strong && k.strong[sp], k.second && k.second[sp]]).filter(S => S && S.legs && S.legs.length);
  // הימורים בודדים בכדורגל שלא נכנסו לאף טופס באותו יום
  const inSlip = new Set(fS.flatMap(S => S.legs.map(l => String(l.id) + '|' + l.key))), inSlipLbl = new Set(fS.flatMap(S => S.legs.map(l => String(l.id) + '|' + clean(l.label))));
  const sg = { n: 0, w: 0, l: 0, p: 0, pend: 0, src: null };
  const fb = rj('data/fbodds/' + date + '.json'), day = rj('data/days/' + date + '.json');
  if (fb && fb.recs && fb.recs.length && day) {
    sg.src = 'recs';
    for (const r of fb.recs) { if (r.odds < 1.4 || (r.sc || 6) < 7 || inSlip.has(String(r.id) + '|' + r.key)) continue; const f = (day.fixtures || []).find(x => String(x.id) === String(r.id)); if (!f) continue; sg.n++;
      const g = f.result ? gradeRec(r.key, f.result) : null; if (g === 'win') sg.w++; else if (g === 'lose') sg.l++; else if (g === 'push') sg.p++; else sg.pend++; }
  } else {
    const L = (I.picksLog || []).filter(e => e.d === date); if (L.length) sg.src = 'old';
    for (const e of L) { if (inSlipLbl.has(String(e.id) + '|' + clean(e.label))) continue; sg.n++; if (e.res && e.res.includes('win')) sg.w++; else if (e.res && e.res.includes('lose')) sg.l++; else if (e.res) sg.p++; else sg.pend++; }
  }
  if (!fS.length && !bS.length && !sg.n) continue;
  out.push({ date, f: { slips: slipStats(fS), singles: sg }, b: { slips: slipStats(bS) } });
}
fs.writeFileSync(path.join(ROOT, 'data', 'daysummary.json'), JSON.stringify({ updated: new Date().toISOString(), days: out }));
console.log('סיכום ימים:', out.length, 'ימים');
