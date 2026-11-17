// קוד לדפדפן (sport.fivebet.vip) לקריאת קווי כדורסל: סך נקודות, סך קבוצה מארחת/אורחת והנדיקאפ. מדביקים ב-javascript_tool.
// NBA: https://sport.fivebet.vip/SportsBook/Upcoming?championshipId=998&championship=NBA   (קבוצה 1 = האורחת)
// יורוליג: https://sport.fivebet.vip/SportsBook/Upcoming?championshipId=1379&championship=Euroleague   (קבוצה 1 = המארחת)
// בעמוד הליגה כל משחק מסומן ב-"+NNNN" (שורה בלי ילדים). לחיצה עליו פותחת את המשחק (כ-5 שניות), history.back() חוזר לרשימה.
// קריאה אחת של javascript_tool נחתכת אחרי 45 שניות: 2 עד 3 משחקים בקריאה. התוצאות נצברות ב-localStorage.__BB (מפתח = ה-+NNNN).
// בסוף: window.__bbExport({ '+2440': 4812439, ... }) מחזיר JSON מקוצר (מזהה משחק שלנו → קווים) שכותבים ל-data/cache/siteodds/bb-DATE.json
window.__blocks = () => { const t = document.body.innerText; const i = t.indexOf('\nMain\n'); const j = t.indexOf('LIVE INFO'); return t.slice(i, j).split('\nÙ\nÃ\n'); };
window.__bb = () => {
  const bl = window.__blocks(), num = s => parseFloat(String(s).replace(/[^\d.\-+]/g, '')), D = {}, map = { 'Total': 'tot', 'Total team 1': 't1', 'Total team 2': 't2', 'Handicap': 'hc' };
  for (const b of bl) { const L = b.split('\n'); const title = L[0].trim(); if (!(title in map)) continue; const d = D[map[title]] || (D[map[title]] = {}), rows = L.slice(1).filter(x => x && x !== 'Á');
    for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(Over|Under|Handicap 1|Handicap 2)\s*‎?\s*\(([^)]+)\)/); if (!m) continue; d[m[1] + '|' + num(m[2])] = num(rows[k + 1]); } }
  const out = {};
  for (const key of Object.keys(D)) { const d = D[key], o = [];
    for (const k of Object.keys(d)) { const ln = +k.split('|')[1];
      if (key === 'hc') { if (!k.startsWith('Handicap 1|')) continue; const a = d[k], c = d['Handicap 2|' + (-ln)]; if (c != null && ((a >= 1.3 && a <= 3.2) || (c >= 1.3 && c <= 3.2))) o.push([ln, a, c]); }
      else { if (!k.startsWith('Over|')) continue; const a = d[k], c = d['Under|' + ln]; if (c != null && ((a >= 1.3 && a <= 3.2) || (c >= 1.3 && c <= 3.2))) o.push([ln, a, c]); } }
    out[key] = o.sort((x, y) => x[0] - y[0]); }
  const r = bl.find(b => b.startsWith('Result\n')); if (r) out.r = r.split('\n').filter(x => /^[\d.]+$/.test(x)).map(Number);
  return out;
};
window.__rowSel = () => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^\+\d{3,4}$/.test((e.innerText || '').trim()));
window.__back = async () => { history.back(); for (let w = 0; w < 20; w++) { await new Promise(r => setTimeout(r, 1000)); if (window.__rowSel().length) return 'ok'; } return 'timeout'; };
window.__open = async id => { const el = window.__rowSel().find(e => (e.innerText || '').trim() === id); if (!el) return 'norow'; el.click(); for (let w = 0; w < 20; w++) { await new Promise(r => setTimeout(r, 1000)); if (window.__blocks().length > 50) return 'ok'; } return 'timeout'; };
// קורא משחקים לפי רשימת מזהים ("+2440"). מהקריאה הראשונה לעמוד הרשימה: first=true (בלי history.back לפני הפתיחה)
window.__bbRead = async (ids, first) => { const F = JSON.parse(localStorage.__BB || '{}'), res = []; for (let n = 0; n < ids.length; n++) { if (!(first && n === 0)) await window.__back(); const o = await window.__open(ids[n]); if (o === 'ok') { F[ids[n]] = window.__bb(); localStorage.__BB = JSON.stringify(F); } res.push([ids[n], o]); } return res; };
const trim = (arr, w) => { if (!arr || !arr.length) return arr; let best = arr[0]; for (const r of arr) if (Math.abs(r[1] - r[2]) < Math.abs(best[1] - best[2])) best = r; return arr.filter(r => Math.abs(r[0] - best[0]) <= w); };
window.__bbExport = map => { const F = JSON.parse(localStorage.__BB || '{}'); return JSON.stringify({ games: Object.keys(map).filter(k => F[k]).map(k => ({ id: map[k], ladders: { hc: trim(F[k].hc, 8), tot: trim(F[k].tot, 14), t1: trim(F[k].t1, 7), t2: trim(F[k].t2, 7), r: F[k].r } })) }); };
