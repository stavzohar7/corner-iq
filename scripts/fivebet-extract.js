// קוד לדפדפן (sport.fivebet.vip). מדביקים בקונסולה/javascript_tool. ראו fivebet-howto.md
// שימוש: window.__grab(k) פותח את המשחק ה-k ברשימה, קורא את הסולמות (שערים + קרנות) ושומר ב-localStorage.__F
window.__blocks = () => { const t = document.body.innerText; const i = t.indexOf('\nMain\n'); const j = t.indexOf('LIVE INFO'); return t.slice(i, j).split('\nÙ\nÃ\n'); };
window.__tab = async n => { const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.innerText || '').trim() === n); const el = els.find(e => e.getBoundingClientRect().top < 500) || els[0]; if (el) { el.click(); await new Promise(r => setTimeout(r, 2500)); } return !!el; };
window.__nopen = async k => { const isRow = e => e.children.length === 0 && /^\+\d{3,4}$/.test((e.innerText || '').trim()); for (let w = 0; w < 25; w++) { if ([...document.querySelectorAll('*')].some(isRow)) break; await new Promise(r => setTimeout(r, 1000)); } const els = [...document.querySelectorAll('*')].filter(isRow); if (!els[k]) return 'no row'; els[k].scrollIntoView(); els[k].click(); for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 1000)); if (location.pathname.includes('GameDetails') && window.__blocks().length > 40) break; } await new Promise(r => setTimeout(r, 1500)); return 'ok'; };
window.__back = async () => { history.back(); await new Promise(r => setTimeout(r, 3500)); if (!location.pathname.includes('Upcoming')) { history.back(); await new Promise(r => setTimeout(r, 3500)); } };
window.__ladders = (pref) => {
  const bl = window.__blocks(), num = s => parseFloat(String(s).replace(/[^\d.\-+]/g, '')), out = {}, D = {};
  const map = { 'Total': 'tot', 'Total team 1': 't1', 'Total team 2': 't2', 'Handicap': 'hc' };
  for (const b of bl) {
    const L = b.split('\n'); let title = L[0];
    if (pref) { if (!title.startsWith(pref)) continue; title = title.slice(pref.length); } else if (title.startsWith('Corners')) continue;
    title = title.trim(); if (!(title in map)) continue;
    const d = D[map[title]] || (D[map[title]] = {}), rows = L.slice(1).filter(x => x && x !== 'Á');
    for (let k = 0; k + 1 < rows.length; k += 2) { const m = rows[k].match(/^(Over|Under|Handicap 1|Handicap 2)\s*‎?\s*\(([^)]+)\)/); if (!m) continue; d[m[1] + '|' + num(m[2])] = num(rows[k + 1]); }
  }
  for (const key of Object.keys(D)) {
    const d = D[key], o = [];
    for (const k of Object.keys(d)) {
      const ln = +k.split('|')[1];
      if (key === 'hc') { if (!k.startsWith('Handicap 1|')) continue; const a = d[k], c = d['Handicap 2|' + (-ln)]; if (c != null && ((a >= 1.3 && a <= 3.5) || (c >= 1.3 && c <= 3.5))) o.push([ln, a, c]); }
      else { if (!k.startsWith('Over|')) continue; const a = d[k], c = d['Under|' + ln]; if (c != null && ((a >= 1.3 && a <= 3.5) || (c >= 1.3 && c <= 3.5))) o.push([ln, a, c]); }
    }
    out[key] = o;
  }
  const get = t => { const b = bl.find(b => b.startsWith(t + '\n')); return b ? b.split('\n').filter(x => x && x !== 'Á') : null; };
  if (!pref) { const bt = get('Both teams to score'); if (bt) out.btts = [num(bt[2]), num(bt[4])]; const r = get('Result'); if (r) out.r = [num(r[2]), num(r[4]), num(r[6])]; }
  return out;   // [[קו, יחס ראשון, יחס שני], ...] — הנדיקאפ: הקו של קבוצה 1
};
window.__grab = async k => { const o = await window.__nopen(k); if (o !== 'ok') return o; const g = location.href.split('game=')[1]; const m = window.__ladders(''); await window.__tab('Corners'); const c = window.__ladders('Corners: '); const F = JSON.parse(localStorage.__F || '{}'); F[g] = { g: m, c }; localStorage.__F = JSON.stringify(F); return g; };
// גרסה מורחבת (כדורגל): גם בעיטות ובעיטות למסגרת. בלוקים: "Shots: Total/Handicap/Total team 1/2", "Shots on target: ..."
window.__grab2 = async k => { const o = await window.__nopen(k); if (o !== 'ok') return o; const g = location.href.split('game=')[1]; const m = window.__ladders(''); await window.__tab('Corners'); const c = window.__ladders('Corners: '); await window.__tab('Shots on target'); const sot = window.__ladders('Shots on target: '); await window.__tab('Shots'); const sh = window.__ladders('Shots: '); const F = JSON.parse(localStorage.__F2 || '{}'); F[g] = { g: m, c, sot, sh }; localStorage.__F2 = JSON.stringify(F); return g; };
