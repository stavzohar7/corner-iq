// נתוני לייב של המשחקים: תוצאה, דקה, קרנות, בעיטות ובעיטות למסגרת מ-365Scores (מהדפדפן עצמו), והשוואה להימורים שלנו.
// עובד רק על משחקים שהתחילו ועוד לא נגמרו. מתעדכן כל 40 שניות כשהכרטיסייה פתוחה.
(function () {
  const ST = () => (typeof state !== 'undefined' ? state : null);
  const nm = s => String(s || '').replace(/[⁦-⁩]/g, '').replace(/["'׳״`’.\-–]/g, '').replace(/\s+/g, ' ').trim();
  const L = window.LIVE = { map: new Map(), at: 0, busy: false };
  const Q = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6', B = 'https://webws.365scores.com/web/';
  const dmy = iso => iso.split('-').reverse().join('/'), SID = { 8: 'c', 3: 'sh', 4: 'sot' };
  const j = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); };
  L.isLive = f => !!f && f.ts * 1000 <= Date.now() && !f.result && f.ts * 1000 + 135 * 60e3 > Date.now();
  L.refresh = async () => {
    const d = ST() && ST().day; if (!d || L.busy) return false;
    const fx = (d.fixtures || []).filter(L.isLive); if (!fx.length) { const had = L.map.size > 0; L.map = new Map(); return had; }
    L.busy = true;
    try {
      const data = await j(B + 'games/allscores/?' + Q + '&sports=1&startDate=' + dmy(d.date) + '&endDate=' + dmy(d.date)), games = data.games || [];
      const idx = new Map(games.map(g => [nm(g.homeCompetitor.name) + '|' + nm(g.awayCompetitor.name), g])), out = new Map();
      await Promise.all(fx.map(async f => {
        let g = idx.get(nm(f.home.name) + '|' + nm(f.away.name));
        if (!g) g = games.find(x => Math.abs((Date.parse(x.startTime) / 1000) - f.ts) < 600 && (nm(x.homeCompetitor.name).includes(nm(f.home.name)) || nm(f.home.name).includes(nm(x.homeCompetitor.name))));
        if (!g || g.statusGroup === 2) return;
        const e = { id: g.id, minute: g.gameTimeDisplay || '', st: g.statusGroup, h: g.homeCompetitor.score, a: g.awayCompetitor.score, c: null, sh: null, sot: null };
        if (g.hasStats) { try { const s = await j(B + 'game/stats/?' + Q + '&games=' + g.id), hid = g.homeCompetitor.id;
          for (const x of (s.statistics || [])) { const k = SID[x.id]; if (!k) continue; const v = parseFloat(x.value); if (!(v >= 0)) continue; (e[k] = e[k] || [null, null])[x.competitorId === hid ? 0 : 1] = v; } } catch (er) { /* בלי סטטיסטיקה */ } }
        out.set(String(f.id), e);
      }));
      L.map = out; L.at = Date.now(); return true;
    } catch (e) { return false; } finally { L.busy = false; }
  };
  // תיאור "כרגע" להימור לפי המצב במשחק
  function status(key, e) {
    const [stat, group, side, ln] = String(key).split('|'), line = ln === '' || ln == null ? null : Number(ln);
    const v = stat === 'g' ? [e.h, e.a] : e[stat];
    if (!v || v[0] == null || v[1] == null) return { txt: 'אין עדיין נתוני לייב לסטטיסטיקה הזו', cls: 'na' };
    const cur = group === 'total' ? v[0] + v[1] : group === 'home' ? v[0] : group === 'away' ? v[1] : null;
    const R = { g: [e.h, e.a], stats: { c: e.c, sh: e.sh, sot: e.sot } }, now = typeof gradeRec === 'function' ? gradeRec(key, { result: R }) : null;
    if (cur != null && line != null) {
      if (side === 'over' && cur > line) return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · נתפס ✅', cls: 'ok' };
      if (side === 'under' && cur > line) return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · נפל ❌', cls: 'bad' };
      return { txt: 'כרגע ' + cur + ' מתוך ' + line + (now === 'win' ? ' · נתפס כרגע' : ' · עוד לא נתפס'), cls: now === 'win' ? 'ok2' : 'wait' };
    }
    return { txt: 'כרגע ' + e.h + ':' + e.a + (now === 'win' ? ' · נתפס כרגע' : now === 'lose' ? ' · לא נתפס כרגע' : ''), cls: now === 'win' ? 'ok2' : now === 'lose' ? 'bad2' : 'wait' };
  }
  const chip = (key, f) => { const e = L.map.get(String(f.id)); if (!e) return ''; const s = status(key, e); return '<div class="liveChip ' + s.cls + '"><span class="ldot"></span>' + (e.minute ? e.minute + ' · ' : '') + s.txt + '</div>'; };
  window.liveChip = (r, f) => chip(r.key, f);
  window.liveLegChip = l => { if (!l || l.sport !== 'f' || l.res) return ''; const f = typeof findFx === 'function' ? findFx(l.id) : null; return f ? chip(l.key, f) : ''; };
  window.liveMid = f => { const e = L.map.get(String(f.id)); return e ? '<b class="gmScore">' + e.h + ' : ' + e.a + '</b><small class="liveMin"><span class="ldot"></span>' + (e.minute || 'בלייב') + '</small>' : ''; };
  window.liveCount = () => { const d = ST() && ST().day; return d && d.fixtures ? d.fixtures.filter(L.isLive).length : 0; };
  const tick = async () => { if (document.hidden) return; const ch = await L.refresh(); if (ch && ST() && ST().tab === 'today' && ST().tstat === 'now' && typeof fillToday === 'function') fillToday(ST().day.date); };
  setInterval(tick, 40000); setTimeout(tick, 5000);
})();
