// קורנר IQ — צד לקוח
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = p => p == null ? '—' : Math.round(p * 100) + '%';
const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
const fmtDate = ts => new Date(ts * 1000).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' });
const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
const scoreCls = s => s >= 7 ? 's-hi' : s >= 5 ? 's-mid' : 's-lo';
const RES = { win: 'זכייה ✓', halfwin: 'חצי זכייה', lose: 'הפסד ✗', halflose: 'חצי הפסד', push: 'החזר' };
const GROUP_TYPE = { total: 'total', total3: 'total', home: 'team', away: 'team', '1x2': '1x2', ah: '1x2' };

const state = { index: null, day: null, leagues: new Set(), minScore: 6, oddsOnly: false, type: '', tab: 'picks' };

async function getJson(url) {
  const r = await fetch(url + '?v=' + Date.now());
  if (!r.ok) throw new Error(url);
  return r.json();
}

async function init() {
  try {
    state.index = await getJson('data/days/index.json');
  } catch {
    $('#tab-picks').innerHTML = '<div class="empty">עדיין אין נתונים. ההרצה היומית הראשונה תיצור אותם.</div>';
    return;
  }
  const sel = $('#daySel');
  sel.innerHTML = state.index.days.map(d => `<option value="${d.date}">${fmtDay(d.date)}</option>`).join('');
  sel.onchange = () => loadDay(sel.value);
  bindUI();
  const fromHash = location.hash.match(/day=(\d{4}-\d{2}-\d{2})/);
  const first = fromHash && state.index.days.find(d => d.date === fromHash[1]) ? fromHash[1] : state.index.days[0]?.date;
  if (first) { sel.value = first; await loadDay(first); }
  renderAbout();
}

async function loadDay(date) {
  state.day = await getJson(`data/days/${date}.json`);
  const d = state.day;
  $('#demoBanner').hidden = d.mode !== 'demo';
  $('#updated').textContent = 'עודכן: ' + new Date(d.updated).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
  $('#notes').hidden = !d.notes?.length;
  $('#notes').textContent = (d.notes || []).join(' ');
  renderChips();
  renderAll();
}

function bindUI() {
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'tab-' + state.tab);
    $('#filters').hidden = !['picks', 'games'].includes(state.tab);
    renderAll();
  });
  $('#minScore').oninput = e => { state.minScore = +e.target.value; $('#minScoreVal').textContent = state.minScore; renderAll(); };
  $('#oddsOnly').onchange = e => { state.oddsOnly = e.target.checked; renderAll(); };
  $('#marketType').onchange = e => { state.type = e.target.value; renderAll(); };
  $('#matchDlg').addEventListener('click', e => { if (e.target.id === 'matchDlg') $('#matchDlg').close(); });
}

const leagueOf = id => state.day.leagues.find(l => l.id === id) || { he: String(id), flag: '' };

function renderChips() {
  const counts = {};
  for (const f of state.day.fixtures) counts[f.lg] = (counts[f.lg] || 0) + 1;
  const lgs = state.day.leagues.filter(l => counts[l.id]);
  const box = $('#leagueChips');
  box.innerHTML = `<button class="chip ${state.leagues.size ? '' : 'on'}" data-lg="">כל הליגות</button>` +
    lgs.map(l => `<button class="chip ${state.leagues.has(l.id) ? 'on' : ''}" data-lg="${l.id}">${esc(l.he)}<span class="n">${counts[l.id]}</span></button>`).join('');
  box.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const id = Number(c.dataset.lg);
    if (!id) state.leagues.clear();
    else state.leagues.has(id) ? state.leagues.delete(id) : state.leagues.add(id);
    renderChips(); renderAll();
  });
}

function renderAll() {
  if (!state.day) return;
  if (state.tab === 'picks') renderPicks();
  if (state.tab === 'games') renderGames();
  if (state.tab === 'track') renderTrack();
}

const fixtureVisible = f => !state.leagues.size || state.leagues.has(f.lg);
const marketVisible = m => m.score >= state.minScore && (!state.oddsOnly || m.odds) && (!state.type || GROUP_TYPE[m.group] === state.type);

function logo(t, side) {
  if (t.logo) return `<img class="tlogo" src="${esc(t.logo)}" alt="" loading="lazy">`;
  const init = t.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="tlogo" style="color:var(--${side === 'h' ? 'home' : 'away'})">${esc(init)}</span>`;
}

function probBars(m) {
  return `<div class="pbar">
    <div class="lane"><span>המודל שלנו</span><div class="track"><div class="fill" style="width:${pct(m.pModel)}"></div></div><b>${pct(m.pModel)}</b></div>
    ${m.pMarket != null ? `<div class="lane"><span>לפי Bet365</span><div class="track"><div class="fill mkt" style="width:${pct(m.pMarket)}"></div></div><b>${pct(m.pMarket)}</b></div>` : ''}
  </div>`;
}

function scoreBox(s, sm = false) {
  return `<div class="score ${scoreCls(s)} ${sm ? 'sm' : ''}" title="דירוג ${s} מתוך 10">${s}${sm ? '' : '<small>/10</small>'}</div>`;
}

function renderPicks() {
  const items = [];
  for (const f of state.day.fixtures) {
    if (!fixtureVisible(f)) continue;
    for (const i of f.picks) { const m = f.markets[i]; if (m && marketVisible(m)) items.push({ f, m }); }
  }
  items.sort((a, b) => b.m.score - a.m.score || (b.m.ev ?? 0) - (a.m.ev ?? 0) || a.f.ts - b.f.ts);
  const el = $('#tab-picks');
  if (!items.length) { el.innerHTML = `<div class="empty">אין בחירות שעוברות את הסינון (דירוג ${state.minScore}+). נסו להוריד את הדירוג המינימלי.</div>`; return; }
  el.innerHTML = `<h2>${items.length} בחירות · ממוינות מהחזקה לחלשה</h2><div class="picks">` + items.map(({ f, m }) => {
    const lg = leagueOf(f.lg);
    return `<article class="pick" data-fid="${f.id}">
      <div class="row">
        <div>
          <div class="market">${esc(m.label)}</div>
          <div class="match">${logo(f.home, 'h')} <bdi>${esc(f.home.name)}</bdi> – <bdi>${esc(f.away.name)}</bdi> ${logo(f.away, 'a')}</div>
          <div class="muted">${esc(lg.he)} · ${fmtTime(f.ts)}</div>
        </div>
        ${scoreBox(m.score)}
      </div>
      <div class="row">
        ${m.odds ? `<span class="oddsTag">Bet365: ${m.odds.toFixed(2)}</span>` : `<span class="oddsTag none">אין יחס Bet365 · יחס הוגן ${m.fair}</span>`}
        ${m.ev != null ? `<span class="${m.ev >= 0 ? 'pos' : 'neg'}">ערך צפוי: ${m.ev >= 0 ? '+' : ''}${Math.round(m.ev * 100)}%</span>` : ''}
        ${m.res ? `<span class="res ${m.res}">${RES[m.res]}</span>` : ''}
      </div>
      ${probBars(m)}
      ${m.reason ? `<div class="reason">${esc(m.reason)}</div>` : ''}
    </article>`;
  }).join('') + '</div>';
  el.querySelectorAll('.pick').forEach(c => c.onclick = () => openMatch(+c.dataset.fid));
}

function renderGames() {
  const el = $('#tab-games');
  const groups = new Map();
  for (const f of state.day.fixtures) if (fixtureVisible(f)) { if (!groups.has(f.lg)) groups.set(f.lg, []); groups.get(f.lg).push(f); }
  if (!groups.size) { el.innerHTML = '<div class="empty">אין משחקים היום בליגות שנבחרו.</div>'; return; }
  const order = state.day.leagues.map(l => l.id).filter(id => groups.has(id));
  el.innerHTML = order.map(id => {
    const lg = leagueOf(id);
    return `<div class="lgGroup"><h3>${esc(lg.he)} · ${esc(lg.country || '')}</h3>` + groups.get(id).map(f => {
      const best = f.markets[f.picks[0]];
      return `<div class="game" data-fid="${f.id}">
        <span class="time">${fmtTime(f.ts)}</span>
        <span class="teams">${logo(f.home, 'h')} <b><bdi>${esc(f.home.name)}</bdi></b> – <b><bdi>${esc(f.away.name)}</bdi></b> ${logo(f.away, 'a')}
          ${f.result ? `<span class="muted">(קרנות בפועל: ${f.result.h}–${f.result.a})</span>` : ''}</span>
        <span class="exp">צפי קרנות: ${f.exp.h.toFixed(1)} – ${f.exp.a.toFixed(1)} · <b>${f.exp.total.toFixed(1)}</b></span>
        <span class="best">${best ? scoreBox(best.score, true) : ''}</span>
      </div>`;
    }).join('') + '</div>';
  }).join('');
  el.querySelectorAll('.game').forEach(c => c.onclick = () => openMatch(+c.dataset.fid));
}

function teamTable(f) {
  const H = f.home, A = f.away;
  const row = (label, h, a, lgv) => `<tr><td>${label}</td><td class="num">${h ?? '—'}</td><td class="num">${a ?? '—'}</td><td class="num muted">${lgv ?? ''}</td></tr>`;
  return `<table>
    <thead><tr><th></th><th class="num"><span class="dot h"></span><bdi>${esc(H.name)}</bdi> (בבית)</th><th class="num"><span class="dot a"></span><bdi>${esc(A.name)}</bdi> (בחוץ)</th><th class="num">ממוצע ליגה</th></tr></thead>
    <tbody>
      ${row('משחקים במאגר (בית / חוץ)', `${H.home.n || 0} / ${H.away.n || 0}`, `${A.home.n || 0} / ${A.away.n || 0}`)}
      ${row('קרנות בעד — לפי המיקום', H.home.cf, A.away.cf, `${f.lgAvg.h} / ${f.lgAvg.a}`)}
      ${row('קרנות נגד — לפי המיקום', H.home.ca, A.away.ca, `${f.lgAvg.a} / ${f.lgAvg.h}`)}
      ${row('קרנות בעד — כל המשחקים', H.all.cf, A.all.cf)}
      ${row('קרנות נגד — כל המשחקים', H.all.ca, A.all.ca)}
      ${row('סה״כ קרנות במשחקים שלה', H.all.tot, A.all.tot, f.lgAvg.total)}
      ${row('בעיטות בעד / נגד (לפי המיקום)', H.home.n ? `${H.home.sf} / ${H.home.sa}` : null, A.away.n ? `${A.away.sf} / ${A.away.sa}` : null)}
      ${row('החזקת כדור', H.all.pos != null ? H.all.pos + '%' : null, A.all.pos != null ? A.all.pos + '%' : null, '50%')}
      ${row('כוח ייצור קרנות (1 = ממוצע)', H.att, A.att, '1.00')}
      ${row('ספיגת קרנות (1 = ממוצע)', H.def, A.def, '1.00')}
    </tbody></table>`;
}

function last5(t) {
  if (!t.last5.length) return '<p class="muted">אין משחקים במאגר.</p>';
  return `<table><thead><tr><th>תאריך</th><th>יריבה</th><th class="num">ב/ח</th><th class="num">קרנות בעד</th><th class="num">נגד</th><th class="num">תוצאה</th></tr></thead><tbody>` +
    t.last5.map(e => `<tr><td>${fmtDate(e.ts)}</td><td><bdi>${esc(e.opp)}</bdi></td><td class="num">${e.v === 'H' ? 'בית' : 'חוץ'}</td><td class="num"><b>${e.cf}</b></td><td class="num">${e.ca}</td><td class="num">${e.g?.[0] ?? '-'}:${e.g?.[1] ?? '-'}</td></tr>`).join('') + '</tbody></table>';
}

function histogram(f) {
  const d = f.totalDist, max = Math.max(...d);
  const expK = Math.round(f.exp.total);
  return `<div class="hist">${d.map((p, k) => `<div class="b ${k === expK ? 'exp' : ''}" style="height:${(p / max * 100).toFixed(1)}%" data-tip="${k} קרנות: ${(p * 100).toFixed(1)}% (מעל ${k - 0.5}: ${(d.slice(k).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%)"></div>`).join('')}</div>
    <div class="histAx">${d.map((_, k) => `<span>${k % 2 === 0 ? k : ''}</span>`).join('')}</div>
    <p class="muted">התפלגות סה״כ הקרנות הצפויה לפי המודל (העמודה הבהירה = הצפי). העבירו את העכבר על עמודה לפרטים.</p>`;
}

function marketsTable(f) {
  const ms = f.markets;
  return `<table><thead><tr><th>הימור</th><th class="num">Bet365</th><th class="num">סיכוי (מודל)</th><th class="num">סיכוי (Bet365)</th><th class="num">יחס הוגן</th><th class="num">ערך</th><th class="num">דירוג</th>${f.graded ? '<th class="num">תוצאה</th>' : ''}</tr></thead><tbody>` +
    ms.map((m, i) => `<tr class="${f.picks.includes(i) ? 'isPick' : ''}"><td>${f.picks.includes(i) ? '⭐ ' : ''}${esc(m.label)}</td>
      <td class="num"><b>${m.odds ? m.odds.toFixed(2) : '—'}</b></td><td class="num">${pct(m.pModel)}</td><td class="num">${pct(m.pMarket)}</td>
      <td class="num">${m.fair}</td><td class="num ${m.ev > 0 ? 'pos' : m.ev < 0 ? 'neg' : ''}">${m.ev != null ? (m.ev > 0 ? '+' : '') + Math.round(m.ev * 100) + '%' : '—'}</td>
      <td class="num">${scoreBox(m.score, true)}</td>${f.graded ? `<td class="num">${m.res ? `<span class="res ${m.res}">${RES[m.res]}</span>` : ''}</td>` : ''}</tr>`).join('') + '</tbody></table>';
}

function openMatch(fid) {
  const f = state.day.fixtures.find(x => x.id === fid);
  if (!f) return;
  const lg = leagueOf(f.lg), H = f.home, A = f.away;
  const tags = t => t.tags.length ? `<div class="tags">${t.tags.map(x => `<span class="tag ${x.k}">${esc(x.t)}</span>`).join('')}</div>` : '<p class="muted">אין מספיק משחקים לזיהוי סגנון.</p>';
  $('#matchBody').innerHTML = `
    <div class="dlgHead">
      <h2>${logo(H, 'h')} <bdi>${esc(H.name)}</bdi> – <bdi>${esc(A.name)}</bdi> ${logo(A, 'a')}</h2>
      <button class="close" onclick="matchDlg.close()">סגור ✕</button>
    </div>
    <div class="dlgBody">
      <div class="muted">${esc(lg.he)} · ${esc(f.round || '')} · ${fmtDate(f.ts)} ${fmtTime(f.ts)} ${f.venue ? '· ' + esc(f.venue) : ''} · רמת ביטחון בנתונים: <b>${Math.round(f.conf * 100)}%</b>${f.hasOdds ? '' : ' · <b>אין יחסי Bet365 למשחק הזה</b>'}</div>
      ${f.result ? `<div class="card"><b>תוצאה בפועל:</b> קרנות ${f.result.h} – ${f.result.a} (סה״כ ${f.result.h + f.result.a}) · שערים ${f.result.g[0]}:${f.result.g[1]}</div>` : ''}
      <div class="card">
        <h4>צפי קרנות</h4>
        <div class="expBig">
          <div><div class="num">${f.exp.h.toFixed(1)}</div><div class="lbl"><span class="dot h"></span><bdi>${esc(H.name)}</bdi></div></div>
          <div><div class="num">${f.exp.total.toFixed(1)}</div><div class="lbl">סה״כ במשחק<br><span class="muted">ממוצע ליגה ${f.lgAvg.total}</span></div></div>
          <div><div class="num">${f.exp.a.toFixed(1)}</div><div class="lbl"><span class="dot a"></span><bdi>${esc(A.name)}</bdi></div></div>
        </div>
        <p class="muted" style="text-align:center;margin:8px 0 0">לפי קרנות בלבד: ${f.exp.hc} – ${f.exp.ac} · לפי נפח בעיטות: ${f.exp.hs} – ${f.exp.as}</p>
      </div>
      <div class="card"><h4>ניתוח</h4><ul class="notes">${f.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <div class="card"><h4>הימורי קרנות — מהחזק לחלש</h4>${marketsTable(f)}</div>
      <div class="grid2">
        <div class="card"><h4><span class="dot h"></span>סגנון משחק — <bdi>${esc(H.name)}</bdi></h4>${tags(H)}</div>
        <div class="card"><h4><span class="dot a"></span>סגנון משחק — <bdi>${esc(A.name)}</bdi></h4>${tags(A)}</div>
      </div>
      <div class="card"><h4>השוואת קבוצות (בית מול חוץ)</h4>${teamTable(f)}</div>
      <div class="card"><h4>התפלגות סה״כ קרנות</h4>${histogram(f)}</div>
      <div class="grid2">
        <div class="card"><h4><span class="dot h"></span>5 משחקים אחרונים — <bdi>${esc(H.name)}</bdi></h4>${last5(H)}</div>
        <div class="card"><h4><span class="dot a"></span>5 משחקים אחרונים — <bdi>${esc(A.name)}</bdi></h4>${last5(A)}</div>
      </div>
      ${f.h2h?.length ? `<div class="card"><h4>מפגשים העונה</h4>${f.h2h.map(e => `${fmtDate(e.ts)}: <bdi>${esc(H.name)}</bdi> ${e.cf} – ${e.ca} <bdi>${esc(A.name)}</bdi> (${e.v === 'H' ? 'בבית של ' + esc(H.name) : 'בבית של ' + esc(A.name)})`).join('<br>')}</div>` : ''}
    </div>`;
  $('#matchDlg').showModal();
  $('#matchDlg').scrollTop = 0;
}

// טולטיפ להיסטוגרמה
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]'), tip = $('#tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (e.clientY - 36) + 'px';
});

function renderTrack() {
  const el = $('#tab-track');
  const tr = state.index.track || {};
  const rows = [];
  let tot = { n: 0, win: 0, lose: 0, staked: 0, profit: 0 };
  for (let s = 10; s >= 1; s--) {
    const b = tr[s]; if (!b || !b.n) continue;
    rows.push({ s, ...b });
    if (s >= 7) { tot.n += b.n; tot.win += b.win; tot.lose += b.lose; tot.staked += b.staked; tot.profit += b.profit; }
  }
  if (!rows.length) { el.innerHTML = '<div class="empty">עדיין אין תוצאות. אחרי שהמשחקים של היום יסתיימו, ההרצה של מחר תבדוק כל בחירה ותעדכן כאן את אחוזי ההצלחה לפי דירוג.</div>'; return; }
  const hit = b => b.win + b.lose ? b.win / (b.win + b.lose) : 0;
  const roi = b => b.staked ? b.profit / b.staked : null;
  el.innerHTML = `
    <h2>כמה הדירוג באמת עובד?</h2>
    <p class="muted">כל בחירה (⭐) נבדקת אוטומטית אחרי המשחק. כאן רואים לכל דירוג כמה פעמים הוא פגע ומה היה הרווח אם היו מהמרים יחידה אחת (למשל 10 ₪) בכל בחירה עם יחס Bet365. ככה תדעו מאיזה דירוג כדאי להתחיל לסמוך.</p>
    ${tot.n ? `<div class="card" style="margin-bottom:12px">בחירות בדירוג 7 ומעלה: <b>${tot.n}</b> · אחוז פגיעה <b>${pct(hit(tot))}</b> · תשואה <b class="${tot.profit >= 0 ? 'pos' : 'neg'}">${tot.staked ? (tot.profit >= 0 ? '+' : '') + Math.round(tot.profit / tot.staked * 100) + '%' : '—'}</b> (${tot.profit >= 0 ? '+' : ''}${tot.profit.toFixed(1)} יחידות)</div>` : ''}
    <div class="card">
      <h4>אחוז פגיעה לפי דירוג (הקו המקווקו = 50%)</h4>
      <div class="trackBars">${rows.map(b => `<div class="tb" data-tip="דירוג ${b.s}: ${b.win} זכיות, ${b.lose} הפסדים${b.push ? ', ' + b.push + ' החזרים' : ''}">
        ${scoreBox(b.s, true)}<div class="track"><div class="fill" style="width:${pct(hit(b))}"></div><div class="half"></div></div>
        <span><b>${pct(hit(b))}</b> · ${b.n} בחירות · תשואה <span class="${(roi(b) ?? 0) >= 0 ? 'pos' : 'neg'}">${roi(b) == null ? '—' : (roi(b) >= 0 ? '+' : '') + Math.round(roi(b) * 100) + '%'}</span></span></div>`).join('')}</div>
    </div>
    <div class="card" style="margin-top:12px"><h4>טבלה</h4><table><thead><tr><th class="num">דירוג</th><th class="num">בחירות</th><th class="num">זכיות</th><th class="num">הפסדים</th><th class="num">החזרים</th><th class="num">% פגיעה</th><th class="num">רווח (יחידות)</th><th class="num">תשואה</th></tr></thead><tbody>
      ${rows.map(b => `<tr><td class="num">${b.s}</td><td class="num">${b.n}</td><td class="num">${b.win}</td><td class="num">${b.lose}</td><td class="num">${b.push}</td><td class="num">${pct(hit(b))}</td><td class="num ${b.profit >= 0 ? 'pos' : 'neg'}">${b.profit.toFixed(2)}</td><td class="num">${roi(b) == null ? '—' : Math.round(roi(b) * 100) + '%'}</td></tr>`).join('')}
    </tbody></table></div>
    <h2 style="margin-top:20px">ימים קודמים</h2>
    <table><thead><tr><th>יום</th><th class="num">משחקים</th><th class="num">בחירות</th><th class="num">נבדקו</th></tr></thead><tbody>
      ${state.index.days.map(d => `<tr><td><a href="#day=${d.date}" onclick="pickDay('${d.date}')" style="color:var(--accent)">${fmtDay(d.date)}</a></td><td class="num">${d.games ?? ''}</td><td class="num">${d.picks ?? ''}</td><td class="num">${d.graded ?? 0}/${d.games ?? ''}</td></tr>`).join('')}
    </tbody></table>`;
}

window.pickDay = async date => {
  $('#daySel').value = date;
  await loadDay(date);
  document.querySelector('.tab[data-tab="picks"]').click();
};

function renderAbout() {
  const sc = Array.from({ length: 10 }, (_, i) => i + 1).map(s => `<div class="${scoreCls(s)}" style="background:var(--${s >= 7 ? 'good' : s >= 5 ? 'warn' : 'bad'})">${s}</div>`).join('');
  $('#tab-about').innerHTML = `<div class="about">
    <div class="card"><h4>מה האתר עושה?</h4>
      <p>כל יום, אוטומטית, המערכת אוספת את כל המשחקים ב-11 ליגות (אנגליה, צ׳מפיונשיפ, ספרד, איטליה, גרמניה 1+2, ליגת העל, ליגה לאומית, צרפת, הולנד ופורטוגל), מנתחת את הקרנות של כל קבוצה ומשווה ליחסים של Bet365.</p></div>
    <div class="card"><h4>איך מחושב הצפי?</h4><ul>
      <li><b>בית/חוץ:</b> לכל קבוצה נמדד כמה קרנות היא לוקחת וכמה היא נותנת — בנפרד בבית ובחוץ, ביחס לממוצע הליגה.</li>
      <li><b>היריבה:</b> הצפי של המארחת = ממוצע הליגה × כמה המארחת מייצרת בבית × כמה האורחת סופגת בחוץ (ולהפך).</li>
      <li><b>סגנון משחק:</b> נפח בעיטות והחזקת כדור — קבוצה שבועטת הרבה ושולטת בכדור מייצרת יותר קרנות. מודל שני מבוסס בעיטות משוקלל עם מודל הקרנות.</li>
      <li><b>כושר עדכני:</b> משחקים אחרונים מקבלים משקל גבוה יותר.</li>
      <li><b>זהירות:</b> קבוצה עם מעט משחקים "נמשכת" לממוצע הליגה כדי לא להגזים.</li>
    </ul></div>
    <div class="card"><h4>מה אומר הדירוג?</h4>
      <div class="scale">${sc}</div>
      <ul>
        <li><b>7–10 (ירוק):</b> המודל רואה ערך אמיתי — הסיכוי שלנו גבוה ממה שהיחס של Bet365 משקף, עם נתונים יציבים.</li>
        <li><b>5–6 (צהוב):</b> יש יתרון קטן או שהנתונים פחות יציבים.</li>
        <li><b>1–4 (אדום):</b> אין ערך — היחס של Bet365 נמוך מדי ביחס לסיכוי.</li>
      </ul>
      <p>הדירוג משקלל: <b>ערך צפוי</b> (סיכוי המודל × יחס Bet365), <b>גובה הסיכוי</b> (הימורים "רחוקים" מקבלים פחות), <b>רמת הביטחון</b> בנתונים, ו<b>פער חשוד</b> מול השוק (אם המודל רחוק מאוד מ-Bet365 — כנראה שחסר לו מידע, כמו פציעות).</p>
      <p>משחק בלי יחס Bet365 מקבל לכל היותר 7, כי אי אפשר למדוד ערך — מוצג "יחס הוגן" שאפשר להשוות מול האתר.</p>
    </div>
    <div class="card"><h4>חשוב לדעת</h4><ul>
      <li>המודל לא יודע על פציעות, הרכבים ומוטיבציה — שווה לבדוק לפני הימור.</li>
      <li>בתחילת עונה יש מעט נתונים, והדירוגים זהירים יותר.</li>
      <li>בלשונית "מעקב הצלחה" רואים כמה כל דירוג פגע בפועל — זה הכלי הכי טוב להבין במה לסמוך.</li>
    </ul></div>
  </div>`;
}

init();
