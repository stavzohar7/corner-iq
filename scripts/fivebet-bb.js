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
window.__bbReadOld = async (ids, first) => { const F = JSON.parse(localStorage.__BB || '{}'), res = []; for (let n = 0; n < ids.length; n++) { if (!(first && n === 0)) await window.__back(); const o = await window.__open(ids[n]); if (o === 'ok') { F[ids[n]] = window.__bb(); localStorage.__BB = JSON.stringify(F); } res.push([ids[n], o]); } return res; };
const trim = (arr, w) => { if (!arr || !arr.length) return arr; let best = arr[0]; for (const r of arr) if (Math.abs(r[1] - r[2]) < Math.abs(best[1] - best[2])) best = r; return arr.filter(r => Math.abs(r[0] - best[0]) <= w); };
window.__bbExport = map => { const F = JSON.parse(localStorage.__BB || '{}'); return JSON.stringify({ games: Object.keys(map).filter(k => F[k]).map(k => ({ id: map[k], ladders: { hc: trim(F[k].hc, 8), tot: trim(F[k].tot, 14), t1: trim(F[k].t1, 7), t2: trim(F[k].t2, 7), r: F[k].r }, ext: F[k].ext || null })) }); };

// ===== הרחבה: רבעים, מחציות, סטטיסטיקות קבוצה (שלשות, ריבאונדים, אסיסטים) ושחקנים =====
const nx = x => parseFloat(String(x).replace(/[^\d.\-+]/g, ''));
const leaf2 = n => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.innerText || '').trim() === n);
window.__clickTab = async n => { const els = leaf2(n); if (!els.length) return false; els[els.length - 1].click(); await new Promise(r => setTimeout(r, 2600)); return true; };
const ladderOf = L => { const rows = L.slice(1).filter(x => x && x !== 'Á'), d = {}, hc = /^Handicap/.test(rows[0] || '');
  for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(Over|Under|Handicap 1|Handicap 2)\s*‎?\s*\(([^)]+)\)/); if (m) d[m[1] + '|' + nx(m[2])] = nx(rows[k + 1]); }
  const o = []; for (const k of Object.keys(d)) { const ln = +k.split('|')[1];
    if (hc) { if (!k.startsWith('Handicap 1|')) continue; const a = d[k], c = d['Handicap 2|' + (-ln)]; if (c != null && ((a >= 1.3 && a <= 3.2) || (c >= 1.3 && c <= 3.2))) o.push([ln, a, c]); }
    else { if (!k.startsWith('Over|')) continue; const a = d[k], c = d['Under|' + ln]; if (c != null && ((a >= 1.3 && a <= 3.2) || (c >= 1.3 && c <= 3.2))) o.push([ln, a, c]); } }
  o.sort((x, y) => x[0] - y[0]); let bi = 0; o.forEach((r, i) => { if (Math.abs(r[1] - r[2]) < Math.abs(o[bi][1] - o[bi][2])) bi = i; }); return o.slice(Math.max(0, bi - 6), bi + 7); };
const playersOf = L => { const rows = L.slice(1).filter(x => x && x !== 'Á'), by = {};
  for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(.+?) - (Over|Under) ([\d.]+)$/); if (!m) continue; const e = by[m[1] + '|' + m[3]] || (by[m[1] + '|' + m[3]] = [m[1], +m[3], null, null]); e[m[2] === 'Over' ? 2 : 3] = nx(rows[k + 1]); }
  return Object.values(by).filter(e => e[2] && e[3]); };
const eqOf = L => { const rows = L.slice(1).filter(x => x && x !== 'Á'), by = {};
  for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(.+?) (\d+)$/); if (!m) continue; const o = nx(rows[k + 1]); if (!(o >= 1.3 && o <= 2.3)) continue; (by[m[1]] = by[m[1]] || []).push([+m[2], o]); }
  const out = []; for (const [n, a] of Object.entries(by)) for (const [N, o] of a) out.push([n, N, o]); return out; };
window.__bbExt = async () => {
  const ext = {}, per = { '1st Half': 'h1', '2nd Half': 'h2', '1st Quarter': 'q1', '2nd Quarter': 'q2', '3rd Quarter': 'q3', '4th Quarter': 'q4' }, kinds = { 'Total': 'tot', 'Handicap': 'hc', 'Total team 1': 't1', 'Total team 2': 't2' };
  for (const b of window.__blocks()) { const L = b.split('\n'), m = L[0].trim().match(/^(1st|2nd|3rd|4th) (Half|Quarter): (Total|Handicap|Total team 1|Total team 2)$/); if (!m) continue; const lad = ladderOf(L); if (lad.length) (ext[per[m[1] + ' ' + m[2]]] = ext[per[m[1] + ' ' + m[2]]] || {})[kinds[m[3]]] = lad; }
  for (const [tab, key] of [['3-Points', 'tp3'], ['Rebounds', 'reb'], ['Assists', 'ast']]) { if (!await window.__clickTab(tab)) continue;
    for (const b of window.__blocks()) { const L = b.split('\n'), t = L[0].trim(), m = t.match(/^[\w-]+: (Total|Total team 1|Total team 2)$/); if (!m) continue; const lad = ladderOf(L); if (lad.length) (ext[key] = ext[key] || {})[kinds[m[1]]] = lad; } }
  if (await window.__clickTab('Players')) { const T = { 'Players: Player Total Points': 'pts', 'Players: Assists': 'ast', 'Players: Player Total Rebounds': 'reb', 'Players: Player Total 3-Points Made': 'tpm', 'Players: Points, Assists and Rebound': 'pra' }, pl = {};
    for (const b of window.__blocks()) { const L = b.split('\n'), k = T[L[0].trim()]; if (k) pl[k] = playersOf(L); }
    const E = { 'Players: Points: Equal or More': 'pts', 'Players: Player Assists: Equal or More': 'ast', 'Players: Player Rebounds: Equal or More': 'reb', 'Players: Player 3-Points: Equal or More': 'tpm', 'Players: Player Points+Assists+Rebounds: Equal or More': 'pra' }, eq = {};
    for (const b of window.__blocks()) { const L = b.split('\n'), k = E[L[0].trim()]; if (k) eq[k] = eqOf(L); } if (Object.keys(eq).length) pl.eq = eq;
    if (Object.keys(pl).length) ext.pl = pl; }
  await window.__clickTab('Main'); return ext; };

window.__bbRead = async (ids, first) => { const F = JSON.parse(localStorage.__BB || '{}'), res = []; for (let n = 0; n < ids.length; n++) { if (!(first && n === 0)) await window.__back(); const o = await window.__open(ids[n]); if (o === 'ok') { F[ids[n]] = window.__bb(); try { F[ids[n]].ext = await window.__bbExt(); } catch (e) { F[ids[n]].ext = null; } localStorage.__BB = JSON.stringify(F); } res.push([ids[n], o]); } return res; };
