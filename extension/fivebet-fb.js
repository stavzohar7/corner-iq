// קוד לדפדפן (sport.fivebet.vip) לקריאת שווקי כדורגל של ליגה שלמה: שערים, קרנות, בעיטות, בעיטות למסגרת, תוצאה, כפולה, וצירופים.
// שימוש: בעמוד של ליגה (רשימת משחקים עם "+NNNN") מדביקים את הקוד, ואז: window.__fbRun()  (רץ ברקע, בלי הגבלת 45 שניות)
//   ובודקים כל כמה שניות: window.__fbStatus()   -> { done, total, err }.  בסיום: window.__fbExport() מחזיר JSON קצר לכתיבה ל-data/cache/siteodds/fb-DATE-<ליגה>.json
// team1 = המארחת. הכל נשמר ב-localStorage.__FB (מפתח = gameId של fivebet).
window.__blocks = () => { const t = document.body.innerText; const i = t.indexOf('\nMain\n'); const j = t.indexOf('LIVE INFO'); return t.slice(i, j).split('\nÙ\nÃ\n'); };
window.__rowSel = () => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^\+\d{3,4}$/.test((e.innerText || '').trim()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = s => parseFloat(String(s).replace(/[^\d.\-+]/g, ''));
const rowsOf = b => b.split('\n').slice(1).filter(x => x && x.trim() && x !== 'Á');
// סולמות (סך / סך קבוצה 1,2 / הנדיקאפ), עם קידומת לטאבים (Corners: ...)
window.__fbLadders = pref => {
  const D = {}, map = { 'Total': 'tot', 'Total team 1': 't1', 'Total team 2': 't2', 'Handicap': 'hc' };
  for (const b of window.__blocks()) { let title = b.split('\n')[0].trim(); if (pref) { if (!title.startsWith(pref)) continue; title = title.slice(pref.length).trim(); } else if (/^(Corners|Shots)/.test(title)) continue; if (!(title in map)) continue;
    const d = D[map[title]] || (D[map[title]] = {}), rows = rowsOf(b);
    for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(Over|Under|Handicap 1|Handicap 2)\s*‎?\s*\(([^)]+)\)/); if (m) d[m[1] + '|' + num(m[2])] = num(rows[k + 1]); } }
  const out = {};
  for (const key of Object.keys(D)) { const d = D[key], o = [];
    for (const k of Object.keys(d)) { const ln = +k.split('|')[1];
      if (key === 'hc') { if (!k.startsWith('Handicap 1|')) continue; const a = d[k], c = d['Handicap 2|' + (-ln)]; if (c != null && ((a >= 1.25 && a <= 3.6) || (c >= 1.25 && c <= 3.6))) o.push([ln, a, c]); }
      else { if (!k.startsWith('Over|')) continue; const a = d[k], c = d['Under|' + ln]; if (c != null && ((a >= 1.25 && a <= 3.6) || (c >= 1.25 && c <= 3.6))) o.push([ln, a, c]); } }
    out[key] = o.sort((x, y) => x[0] - y[0]); }
  return out;
};
// שוקים בכרטיס הראשי: תוצאה, כפולה, שתיהן כובשות, כל קבוצה כובשת, וצירופים (כפולה+סך, תוצאה+סך)
window.__fbMain = () => {
  const bl = window.__blocks(), get = t => { const b = bl.find(b => b.split('\n')[0].trim() === t); return b ? rowsOf(b) : null; }, out = {};
  const pairs = (rows, re, fn) => { const o = []; for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(re); if (m) o.push(fn(m, num(rows[k + 1]))); } return o; };
  const r = get('Result'); if (r) { const x = r.filter(v => /^[\d.]+$/.test(v)).map(Number); if (x.length >= 3) out.r = x.slice(0, 3); }
  const dc = get('Double chance'); if (dc) { out.dc = {}; for (let k = 0; k + 1 < dc.length; k += 2) out.dc[dc[k].trim()] = num(dc[k + 1]); }
  const bt = get('Both teams to score'); if (bt) out.btts = [num(bt[1]), num(bt[3])];
  const t1 = get('Team 1 to score'); if (t1) out.t1s = [num(t1[1]), num(t1[3])];
  const t2 = get('Team 2 to score'); if (t2) out.t2s = [num(t2[1]), num(t2[3])];
  const dct = get('Double chance and total'); if (dct) out.dct = pairs(dct, /^(1X|12|X2) and (Over|Under)\s*‎?\s*\(([\d.]+)\)$/, (m, o) => [m[1], m[2][0], +m[3], o]).filter(x => x[2] >= 1.5 && x[2] <= 4.5 && x[3] <= 5);
  const rt = get('Result and total'); if (rt) out.rt = pairs(rt, /^(Win1|Win2|Draw) and (Over|Under)\s*‎?\s*\(([\d.]+)\)$/, (m, o) => [m[1], m[2][0], +m[3], o]).filter(x => x[2] >= 1.5 && x[2] <= 4.5 && x[3] <= 5);
  Object.assign(out, window.__fbLadders(''));
  return out;
};
window.__tab = async n => { const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.innerText || '').trim() === n); const el = els.find(e => e.getBoundingClientRect().top < 600) || els[0]; if (el) { el.click(); await sleep(2500); } return !!el; };
window.__fbHead = () => { const t = document.body.innerText, i = t.indexOf('\nMain\n'); return t.slice(Math.max(0, i - 260), i).split('\n').map(x => x.trim()).filter(x => x && x.length < 60).slice(-7); };
// רשימת משחקי הליגה מעמוד הרשימה: [{h, a, date:'DD.MM', time:'H:MM'}] באותו סדר של שורות ה-"+NNNN"
window.__fbList = () => { const t = document.body.innerText, out = [], re = /\n([^\n]+)\n([^\n]+)\n#\d+\n(\d\d\.\d\d)\n([\d:]+)\n[^\n]*\n\+\d+/g; let m; while ((m = re.exec(t))) out.push({ h: m[1].trim(), a: m[2].trim(), date: m[3], time: m[4] }); return out; };
// קוראת את המשחק הפתוח
window.__fbGame = async () => {
  const head = window.__fbHead(), slug = (location.href.match(/game=([^&]+)/) || [])[1] || '', gid = (location.href.match(/gameId=(\d+)/) || [])[1] || slug;
  const g = { gid, slug, url: location.pathname + location.search, head, main: window.__fbMain() };
  if (await window.__tab('Corners')) g.c = window.__fbLadders('Corners:');
  if (await window.__tab('Shots on target')) g.sot = window.__fbLadders('Shots on target:');
  if (await window.__tab('Shots')) g.sh = window.__fbLadders('Shots:');
  return g;
};
// רץ ברקע על כל משחקי הרשימה (העמוד חייב להיות עמוד הליגה). מתקדם משחק אחרי משחק ושומר ב-localStorage.__FB
window.__fbRun = async dd => {   // dd = 'DD.MM' (רק משחקי התאריך הזה), או בלי פרמטר לכל הרשימה
  const list = window.__fbList(), idx = window.__rowSel().map((_, k) => k).filter(k => !dd || (list[k] && list[k].date === dd)), meta = {};
  window.__lastSig = null; const st = { done: 0, total: idx.length, err: [], running: true }; localStorage.__FBS = JSON.stringify(st); localStorage.__FB = '{}';
  (async () => {
    for (let n = 0; n < st.total; n++) {
      const k = idx[n];
      try {
        let rows = window.__rowSel(); for (let w = 0; w < 20 && !rows.length; w++) { await sleep(1000); rows = window.__rowSel(); }
        if (!rows[k]) { st.err.push([k, 'norow']); continue; }
        rows[k].click(); for (let w = 0; w < 25; w++) { await sleep(1000); if (location.href.includes('GameDetails') && window.__blocks().length > 50) break; }
        await sleep(2500);   // נותנים לעמוד להתחלף (העמוד הקודם עלול להישאר רגע על המסך)
        let g = await window.__fbGame(); const sig = x => JSON.stringify(x.main && x.main.r), prev = window.__lastSig;
        for (let w = 0; w < 3 && prev && sig(g) === prev; w++) { await sleep(6000); g = await window.__fbGame(); }   // אותם יחסי תוצאה כמו המשחק הקודם = נקרא עמוד ישן, קוראים שוב
        if (prev && sig(g) === prev) { st.err.push([k, 'stale']); history.back(); await sleep(3500); if (!window.__rowSel().length) { history.back(); await sleep(3000); } st.done = n + 1; localStorage.__FBS = JSON.stringify(st); continue; }
        window.__lastSig = sig(g);
        g.h = list[k] && list[k].h; g.a = list[k] && list[k].a; g.date = list[k] && list[k].date; g.time = list[k] && list[k].time; const F = JSON.parse(localStorage.__FB || '{}'); F[g.gid] = g; localStorage.__FB = JSON.stringify(F);
        history.back(); await sleep(3500); if (!window.__rowSel().length) { history.back(); await sleep(3000); }
      } catch (e) { st.err.push([k, String(e)]); }
      st.done = n + 1; localStorage.__FBS = JSON.stringify(st);
    }
    st.running = false; localStorage.__FBS = JSON.stringify(st);
  })();
  return 'started ' + st.total;
};
window.__fbStatus = () => JSON.parse(localStorage.__FBS || '{}');
// ייצוא קצר: בכל סולם משאירים את השורות סביב הקו המאוזן (פחות טקסט להעברה)
const trim = (arr, w) => { if (!arr || !arr.length) return arr; let best = arr[0]; for (const r of arr) if (Math.abs(r[1] - r[2]) < Math.abs(best[1] - best[2])) best = r; return arr.filter(r => Math.abs(r[0] - best[0]) <= w); };
const trimL = (L, w) => { if (!L) return L; const o = {}; for (const k of ['tot', 't1', 't2', 'hc']) if (L[k]) o[k] = trim(L[k], w); return o; };
window.__fbExport = () => { const F = JSON.parse(localStorage.__FB || '{}'); return JSON.stringify(Object.values(F).map(g => ({ gid: g.gid, url: g.url, h: g.h, a: g.a, date: g.date, time: g.time, main: Object.assign({}, g.main, trimL(g.main, 2.6)), c: trimL(g.c, 3.6), sot: trimL(g.sot, 2.6), sh: trimL(g.sh, 6) }))); };
