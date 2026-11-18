/* קורנר IQ: בונה קופון באתר fivebet מהטפסים של האתר שלנו.
   רץ בדפדפן שלך (סימניה) על sport.fivebet.vip. לא נכנס לחשבון, לא מדביק סכום ולא לוחץ "PLACE BET": רק מוסיף את ההימורים לקופון.
   אתה בודק ומאשר בעצמך. */
(() => {
  if (window.__ciqFill) { window.__ciqFill.open(); return; }
  const BASE = 'https://stavzohar7.github.io/corner-iq/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s || '').replace(/[‎‏\s]+/g, ' ').trim();
  const numIn = s => { const m = String(s).match(/\(([^)]+)\)/); return m ? parseFloat(m[1].replace('+', '')) : NaN; };
  const title = b => b.innerText.split('\n').map(x => x.trim()).filter(x => x && !/^[ÙÃÁ]$/.test(x))[0];
  const blocks = t => [...document.querySelectorAll('.tg__match_item')].filter(b => b.querySelector('a.odCnt') && title(b) === t);
  const cells = t => blocks(t).flatMap(b => [...b.querySelectorAll('a.odCnt')]).map(a => { const x = norm(a.innerText), m = x.match(/^(.*?)\s*([\d.]+)$/); return { a, name: m ? m[1] : x, odds: m ? parseFloat(m[2]) : NaN }; });
  const PREF = { g: '', c: 'Corners: ', sh: 'Shots: ', sot: 'Shots on target: ' }, TAB = { c: 'Corners', sh: 'Shots', sot: 'Shots on target' };

  async function openTab(n) {
    const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && norm(e.innerText) === n);
    const el = els.find(e => e.getBoundingClientRect().top < 600) || els[0]; if (el) { el.click(); await sleep(2200); } return !!el;
  }
  // לפי מפתח ההימור: באיזה בלוק ובאיזו שורה
  function target(key) {
    const [stat, grp, side, line] = key.split('|'), P = PREF[stat] || '', ln = parseFloat(line);
    const ladder = (t, ou, L) => ({ t: P + t, f: c => new RegExp('^' + ou + ' \\(').test(c.name) && numIn(c.name) === L });
    if (grp === 'total') return ladder('Total', side === 'over' ? 'Over' : 'Under', ln);
    if (grp === 'home' || grp === 'away') return ladder('Total team ' + (grp === 'home' ? 1 : 2), side === 'over' ? 'Over' : 'Under', ln);
    if (grp === 'ah') return { t: P + 'Handicap', f: c => new RegExp('^Handicap ' + (side === 'home' ? 1 : 2) + ' \\(').test(c.name) && numIn(c.name) === ln };
    if (grp === 'dc') return { t: 'Double chance', f: c => c.name.toUpperCase() === side.toUpperCase() };
    if (grp === '1x2') return { t: 'Result', f: c => c.name === (side === 'home' ? 'Win1' : 'Win2') };
    if (grp === 'btts') return { t: 'Both teams to score', f: c => new RegExp(side === 'yes' ? '^(yes|1)' : '^(no|2)', 'i').test(c.name) };
    if (grp === 'combo') { const [r, ou] = side.split('_'), O = ou === 'over' ? 'Over' : 'Under';
      if (['1x', 'x2', '12'].includes(r)) return { t: 'Double chance and total', f: c => c.name.toUpperCase().startsWith(r.toUpperCase() + ' AND ' + O.toUpperCase() + ' (') && numIn(c.name) === ln };
      const W = { home: 'Win1', away: 'Win2', draw: 'Draw' }[r]; return { t: 'Result and total', f: c => c.name.startsWith(W + ' and ' + O + ' (') && numIn(c.name) === ln }; }
    return null;
  }
  const couponCount = () => { const t = document.body.innerText, i = t.indexOf('BET SLIP'); const m = t.slice(i, i + 40).match(/BET SLIP\s*\n\s*(\d+)/); return m ? +m[1] : 0; };
  async function clearCoupon() { for (let k = 0; k < 30; k++) { const b = document.querySelector('.dg_bs_stake_remove_btn'); if (!b) break; b.click(); await sleep(350); } }
  const snap = () => { const b = document.querySelector('.tg__match_item'); return b ? b.innerText.slice(0, 200) : ''; };
  async function goGame(leg) {
    const gid = (leg.fb.match(/gameId=(\d+)/) || [])[1], same = location.href.includes('gameId=' + gid), before = snap();
    if (!same) { history.pushState({}, '', leg.fb.replace(/^https?:\/\/[^/]+/, '')); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }
    for (let w = 0; w < 30; w++) { await sleep(1000); if (location.href.includes('gameId=' + gid) && document.querySelectorAll('.tg__match_item').length > 50 && (same || w >= 3 && snap() !== before || w >= 12)) { await sleep(800); return true; } }
    return false;
  }
  async function addLeg(leg) {
    if (!leg.fb) return { ok: false, why: 'אין קישור למשחק באתר fivebet (הטופס נבנה בלי קריאת האתר)' };
    if (!(await goGame(leg))) return { ok: false, why: 'המשחק לא נפתח' };
    const tg = target(leg.key); if (!tg) return { ok: false, why: 'סוג הימור לא מוכר' };
    let c = cells(tg.t).find(tg.f);
    if (!c) { const st = leg.key.split('|')[0]; if (TAB[st] && await openTab(TAB[st])) c = cells(tg.t).find(tg.f); }
    if (!c) return { ok: false, why: 'ההימור לא נמצא באתר (ייתכן שהשוק נסגר או שהקו השתנה)' };
    const before = couponCount(); c.a.click(); await sleep(1500);
    if (couponCount() <= before) return { ok: false, why: 'האתר לא הוסיף את ההימור לקופון (ייתכן שאי אפשר לשלב אותו עם בחירה אחרת מאותו משחק)' };
    return { ok: true, odds: c.odds, was: leg.odds };
  }

  // ---- ממשק ----
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:10px;right:10px;width:min(380px,94vw);max-height:90vh;overflow:auto;background:#10141c;color:#eef;font:14px/1.5 system-ui,Arial;border:2px solid #f5c542;border-radius:12px;padding:12px;direction:rtl;text-align:right;box-shadow:0 8px 30px #000a';
  document.body.appendChild(box);
  const ui = { slips: [], log: [] };
  const html = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function render(busy) {
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#f5c542">קורנר IQ: בניית קופון</b><button id="ciqx" style="background:none;border:0;color:#fff;font-size:20px">×</button></div>' +
      (ui.msg ? '<p>' + html(ui.msg) + '</p>' : '') +
      ui.slips.map((s, i) => '<div style="margin:8px 0;padding:8px;border:1px solid #334;border-radius:8px"><b>' + html(s.name) + '</b> · יחס ' + s.total + '<br>' + s.legs.map(l => '• ' + html(l.label) + ' <small style="opacity:.7">(' + html(l.game) + ', ' + l.odds + ')</small>').join('<br>') +
        '<br><button data-i="' + i + '" ' + (busy ? 'disabled' : '') + ' style="margin-top:6px;padding:8px 12px;border-radius:8px;border:0;background:#f5c542;color:#111;font-weight:700">בנה קופון</button></div>').join('') +
      (ui.log.length ? '<div style="margin-top:8px;font-size:13px">' + ui.log.map(x => html(x)).join('<br>') + '</div>' : '') +
      '<p style="opacity:.7;font-size:12px">הכלי רק מוסיף הימורים לקופון. את הסכום ולחיצה על PLACE BET אתה עושה בעצמך, אחרי שבדקת.</p>';
    box.querySelector('#ciqx').onclick = () => box.remove();
    box.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => build(ui.slips[+b.dataset.i]));
  }
  async function build(s) {
    ui.log = ['מנקה את הקופון...']; render(true); await clearCoupon();
    let ok = 0;
    for (const l of s.legs) {
      ui.log.push('מוסיף: ' + l.label + '...'); render(true);
      const r = await addLeg(l);
      ui.log[ui.log.length - 1] = (r.ok ? '✓ ' : '✗ ') + l.label + (r.ok ? (Math.abs(r.odds - r.was) > 0.005 ? ' (היחס עכשיו ' + r.odds + ', היה ' + r.was + ')' : ' (' + r.odds + ')') : ': ' + r.why);
      if (r.ok) ok++;
    }
    const bad = /cannot be combined/i.test(document.body.innerText); if (bad) ui.log.push('שים לב: fivebet מסמן שחלק מההימורים לא ניתנים לשילוב בקופון אחד. הסר את אחד מהם.');
    ui.log.push(ok === s.legs.length ? 'הקופון מוכן (' + ok + ' הימורים). בדוק אותו בצד הקופון, הכנס סכום ולחץ בעצמך.' : 'נוספו ' + ok + ' מתוך ' + s.legs.length + '. בדוק את הקופון לפני שאתה ממשיך.');
    render(false);
  }
  async function load() {
    ui.msg = 'טוען את הטפסים מהאתר...'; render(false);
    try {
      const sl = await (await fetch(BASE + 'data/slips.json?' + Date.now())).json();
      const d = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jerusalem' }).format(new Date());
      const days = sl.days.filter(x => x.date >= d).sort((a, b) => a.date < b.date ? -1 : 1), out = [];
      const add = (name, w) => { if (w && w.legs && w.legs.length && w.legs.some(l => l.fb)) out.push({ name: name + ' · ' + w.legs[0].date, total: w.total, legs: w.legs }); };
      for (const day of days) { const k = day.k, tag = day.date.slice(5).replace('-', '.');
        const nm = (n, w) => add(tag + ' ' + n, w && { ...w, legs: w.legs.map(l => ({ ...l, date: tag })) });
        nm('הטופס החזק', k.strong && k.strong.f); nm('טופס שני', k.second && k.second.f);
        (k.win || []).forEach(w => nm(w.label || 'טופס שעות', w)); (k.lg || []).forEach(w => nm(w.label || 'טופס ליגה', w)); }
      ui.slips = out.map(o => ({ ...o, name: o.name.replace(/ · \S+$/, '') }));
      ui.msg = ui.slips.length ? 'בחר טופס. הוא ייבנה בקופון של fivebet.' : 'אין כרגע טפסים עם הימורים מוכנים ל-fivebet (הם נבנים אחרי קריאת היחסים באתר).';
    } catch (e) { ui.msg = 'לא הצלחתי לטעון את הטפסים: ' + e; }
    render(false);
  }
  window.__ciqFill = { open() { if (!box.isConnected) document.body.appendChild(box); load(); } };
  load();
})();
