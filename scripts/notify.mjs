// התראות דחיפה לטלפון דרך ntfy.sh (חינמי, בלי חשבון): מתקינים את אפליקציית ntfy ומנויים לערוץ שבקובץ data/cache/notify-topic.txt.
// נשלח רק מידע ספורטיבי ציבורי: הרכבים רשמיים למשחק שנמצא בטופס, ותוצאת טופס שנגמר. כל התראה נשלחת פעם אחת.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export const topicFile = root => path.join(root, 'data', 'cache', 'notify-topic.txt');
export function getTopic(root) {
  const f = topicFile(root);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const t = 'corneriq-' + crypto.randomBytes(8).toString('hex');   // ערוץ לא ניתן לניחוש: מי שמכיר אותו יכול לקרוא את ההתראות
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); return t;
}
async function send(topic, title, message, tags) {
  try {
    const r = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, title, message, tags: tags || [], priority: 3 }), signal: AbortSignal.timeout(15000) });
    return r.ok;
  } catch { return false; }
}

export async function runNotify({ root, today, log = () => {} }) {
  if (process.env.NO_NOTIFY) return 0;
  const topic = getTopic(root), stFile = path.join(root, 'data', 'cache', 'notify-state.json');
  const first = !fs.existsSync(stFile), st = readJson(stFile, { sent: {} });
  const slips = readJson(path.join(root, 'data', 'slips.json'), { days: [] }).days;
  const day = readJson(path.join(root, 'data', 'days', `${today}.json`), null);
  const yest = new Date(new Date(today + 'T12:00:00Z').getTime() - 86400e3).toISOString().slice(0, 10);
  const todo = [];   // [key, title, message, tags]
  const lvName = { strong: 'הטופס החזק', second: 'הטופס השני' }, spName = { f: 'כדורגל', n: 'NBA', e: 'יורוליג' };
  for (const d of slips.filter(x => x.date === today || x.date === yest)) {
    for (const lv of ['strong', 'second']) for (const sp of ['f', 'n', 'e']) {
      const S = d.k && d.k[lv] && d.k[lv][sp]; if (!S || !S.legs || !S.legs.length) continue;
      if (S.res === 'win' || S.res === 'lose') todo.push([`res|${d.date}|${lv}|${sp}|${S.legs.map(l => l.id).join(',')}`, `${S.res === 'win' ? '✅ נתפס' : '❌ נפל'}: ${lvName[lv]} · ${spName[sp]}`, S.legs.map(l => (l.res === 'win' ? '✅ ' : l.res === 'lose' ? '❌ ' : '') + l.label).join('\n') + `\nיחס כולל ${S.total}`, [S.res === 'win' ? 'white_check_mark' : 'x']]);
      if (sp === 'f' && d.date === today && day) for (const l of S.legs) {
        const f = day.fixtures.find(x => String(x.id) === String(l.id)); if (!f || l.res) continue;
        const mins = (f.ts * 1000 - Date.now()) / 60e3, lu = f.news && f.news.lineups;
        if (mins > 0 && mins < 150 && lu && lu.h && lu.a && lu.h.confirmed && lu.a.confirmed)
          todo.push([`lu|${today}|${f.id}`, `👥 הרכבים רשמיים: ${f.home.name} – ${f.away.name}`, `${lvName[lv]} כולל את ההימור: ${l.label}\nהמשחק מתחיל בעוד ${Math.round(mins)} דקות. כדאי לבדוק שאין הפתעה.`, ['busts_in_silhouette']]);
      }
    }
  }
  let n = 0;
  if (first) {   // הפעם הראשונה: לא מציפים בהתראות ישנות, רק מסמנים הכול כנשלח ושולחים הודעת בדיקה
    for (const [k] of todo) st.sent[k] = Date.now();
    await send(topic, '🚩 קורנר IQ: ההתראות פעילות', 'מעכשיו תקבל כאן הרכבים רשמיים למשחקים בטופס, ותוצאות של טפסים.', ['tada']);
  } else {
    for (const [k, title, msg, tags] of todo) { if (st.sent[k]) continue; if (await send(topic, title, msg, tags)) { st.sent[k] = Date.now(); n++; } }
  }
  fs.writeFileSync(stFile, JSON.stringify(st));
  log(`התראות: ${n} נשלחו`);
  return n;
}
