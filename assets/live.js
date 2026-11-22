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
  const minOf = e => { const m = String(e.minute || '').match(/(\d+)(?:\+(\d+))?/); return m ? +m[1] + (m[2] ? +m[2] : 0) : 0; };
  // מצב ההימור לפי מה שקורה במשחק: state = won | lost | on (נתפס כרגע) | near (בדרך) | danger (בסכנה) | na
  function status(key, e) {
    const [stat, group, side, ln] = String(key).split('|'), line = ln === '' || ln == null ? null : Number(ln), min = minOf(e), left = Math.max(0, 90 - min);
    const v = stat === 'g' ? [e.h, e.a] : e[stat];
    if (!v || v[0] == null || v[1] == null) return { txt: 'אין עדיין נתוני לייב לסטטיסטיקה הזו', cls: 'na', state: 'na' };
    const cur = group === 'total' ? v[0] + v[1] : group === 'home' ? v[0] : group === 'away' ? v[1] : null;
    const R = { g: [e.h, e.a], stats: { c: e.c, sh: e.sh, sot: e.sot } }, now = typeof gradeRec === 'function' ? gradeRec(key, { result: R }) : null;
    if (cur != null && line != null) {
      const need = Math.floor(line) + 1 - cur, slack = Math.floor(line) - cur, pace = min >= 15 ? Math.round(cur * 90 / min * 10) / 10 : null;
      const pc = pace != null ? ' · בקצב ל-' + pace : '';
      if (side === 'over') {
        if (need <= 0) return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · נתפס ✅', cls: 'ok', state: 'won' };
        const hard = left <= 12 && need >= 2 || left <= 5;
        return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · חסרות עוד ' + need + pc, cls: hard ? 'bad2' : (pace != null && pace > line ? 'ok2' : 'wait'), state: hard ? 'danger' : (pace != null && pace > line ? 'near' : 'near') };
      }
      if (slack < 0) return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · נפל ❌', cls: 'bad', state: 'lost' };
      const risk = slack <= 1 && left >= 12 || (pace != null && pace > line && left >= 15);
      return { txt: 'כרגע ' + cur + ' מתוך ' + line + ' · נשאר מרווח ' + slack + pc, cls: risk ? 'bad2' : 'ok2', state: risk ? 'danger' : 'on' };
    }
    const st = now === 'win' ? 'on' : now === 'lose' ? (left <= 10 ? 'danger' : 'near') : 'near';
    const un = { g: '', c: 'קרנות ', sh: 'בעיטות ', sot: 'בעיטות למסגרת ' }[stat] || '';
    return { txt: 'כרגע ' + un + v[0] + ':' + v[1] + (now === 'win' ? ' · נתפס כרגע' : now === 'lose' ? ' · לא נתפס כרגע' : ''), cls: now === 'win' ? 'ok2' : now === 'lose' ? 'bad2' : 'wait', state: st };
  }
  const chip = (key, f) => { const e = L.map.get(String(f.id)); if (!e) return ''; const s = status(key, e); return '<div class="liveChip ' + s.cls + '"><span class="ldot"></span>' + (e.minute ? e.minute + ' · ' : '') + s.txt + '</div>'; };
  window.liveChip = (r, f) => chip(r.key, f);
  window.liveLegChip = l => { if (!l || l.sport !== 'f' || l.res) return ''; const f = typeof findFx === 'function' ? findFx(l.id) : null; return f ? chip(l.key, f) : ''; };
  window.liveMid = f => { const e = L.map.get(String(f.id)); return e ? '<b class="gmScore">' + e.h + ' : ' + e.a + '</b><small class="liveMin"><span class="ldot"></span>' + (e.minute || 'בלייב') + '</small>' : ''; };
  const SIC = { won: '✅', on: '🟢', near: '🟡', danger: '🔴', lost: '❌' };
  // סיכום לייב: כמה הימורים (ציון 7 ומעלה, וגם בתוך הטפסים) נתפסים כרגע, בדרך, בסכנה או שנפלו
  window.liveSummary = () => { const S = ST(); if (!S || !S.day) return ''; const cnt = { won: 0, on: 0, near: 0, danger: 0, lost: 0 }; let games = 0, n = 0;
    for (const f of S.day.fixtures || []) { const e = L.map.get(String(f.id)); if (e) games++; }
    for (const r of (S.recs || [])) { if (r.odds < 1.4 || (r.sc || 6) < 7) continue; const f = typeof findFx === 'function' ? findFx(r.id) : null; const e = f && L.map.get(String(f.id)); if (!e) continue; const st = status(r.key, e).state; if (cnt[st] != null) { cnt[st]++; n++; } }
    if (!games) return '<div class="liveSum empty">אין כרגע משחקים בלייב.</div>';
    return '<div class="liveSum"><div class="lsT"><span class="ldot"></span> בלייב עכשיו: ' + games + ' משחקים · ' + n + ' הימורים שלנו</div><div class="lsRow"><span>✅ נתפסו <b>' + cnt.won + '</b></span><span>🟢 נתפסים כרגע <b>' + cnt.on + '</b></span><span>🟡 בדרך <b>' + cnt.near + '</b></span><span>🔴 בסכנה <b>' + cnt.danger + '</b></span><span>❌ נפלו <b>' + cnt.lost + '</b></span></div></div>'; };
  window.liveSlipLine = S => { if (!S || !S.legs || S.res) return ''; let live = 0, ok = 0, bad = 0; for (const l of S.legs) { if (l.sport !== 'f' || l.res) continue; const f = typeof findFx === 'function' ? findFx(l.id) : null; const e = f && L.map.get(String(f.id)); if (!e) continue; live++; const st = status(l.key, e).state; if (st === 'won' || st === 'on') ok++; else if (st === 'lost') bad++; }
    if (!live) return ''; return '<div class="liveSlip' + (bad ? ' bad' : '') + '"><span class="ldot"></span> בלייב: ' + (bad ? bad + ' הימורים נפלו בטופס' : ok + ' מתוך ' + live + ' הימורים נתפסים כרגע') + '</div>'; };
  window.liveCount = () => { const d = ST() && ST().day; return d && d.fixtures ? d.fixtures.filter(L.isLive).length : 0; };
  const tick = async () => { if (document.hidden) return; const ch = await L.refresh(); if (ch && ST() && ST().tab === 'today' && ST().tstat === 'now' && typeof fillToday === 'function') fillToday(ST().day.date); };
  setInterval(tick, 40000); setTimeout(tick, 5000);
})();
