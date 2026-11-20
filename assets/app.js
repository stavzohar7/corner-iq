// קורנר IQ — צד לקוח (גרסה פשוטה וממוקדת)
const $ = s => document.querySelector(s);
// ---- ליטוש טקסט: ניסוחים רובוטיים → עברית פשוטה וברורה. עובד על כל הטקסטים שמוצגים, גם של ימים ישנים ----
const POLISH = [
  [/לפי הניתוח היחס גבוה ממה שההימור שווה/g, 'היחס משתלם: לפי החישוב שלנו הסיכוי טוב יותר ממה שהיחס מרמז'],
  [/מעט משחקים בהיסטוריה/g, 'יש מעט משחקים קודמים להסתמך עליהם'],
  [/ההרכבים עדיין לא סופיים/g, 'ההרכבים עוד לא רשמיים'],
  [/ההרכבים לא סופיים\. כדאי לבדוק לפני הימור\./g, 'ההרכבים עוד לא רשמיים. כדאי לבדוק אותם לפני שמהמרים.'],
  [/היחס משוער/g, 'היחס הוא הערכה שלנו (אין יחס אמיתי)'],
  [/הערכת המנתח: /g, 'לפי הבדיקה שלנו: '],
  [/ \(3 אפשרויות\)/g, ' (שוק 3 תוצאות: "בדיוק" מפסיד)'],
  [/הזווית שהכי מתאימה למשחק הזה:/g, 'ההימור שהכי מתאים למשחק הזה:'],
  [/הזווית שהכי מתאימה:/g, 'ההימור שהכי מתאים:'],
  [/אנחנו מצפים לכ-([\d.]+) (קרנות|שערים|בעיטות|בעיטות למסגרת) בסך הכל, מול קו ([\d.]+)/g, 'לפי החישוב שלנו יהיו בערך $1 $2 במשחק. הליין באתר הוא $3'],
  [/אנחנו מצפים ל-([\d.]+) ל-(\S+), מול קו ([\d.]+)/g, 'לפי החישוב שלנו $2 תשיג בערך $1. הליין באתר הוא $3'],
  [/ (בבית|בחוץ): ([\d.]+) בעד ו-([\d.]+) נגד/g, ' $1 היא משיגה בממוצע $2 ומאפשרת $3'],
  [/ ממוצע הליגה: [\d.]+ ו-[\d.]+\./g, ''],
  [/בממוצע 1 (שערים|קרנות|בעיטות)/g, (m, w) => 'בממוצע ' + ({ שערים: 'שער אחד', קרנות: 'קרן אחת', בעיטות: 'בעיטה אחת' })[w]],
  [/: (\d+)%/g, (m, n) => ': ' + (n < 20 ? 'סיכוי נמוך' : n < 35 ? 'פחות מהרגיל' : n < 46 ? 'קצת פחות ממחצית' : n < 56 ? 'בערך חצי' : n < 70 ? 'סיכוי טוב' : n < 85 ? 'סביר מאוד' : 'כמעט בטוח')],
  [/: צפי ([\d.]+)–([\d.]+) \(סה״כ ([\d.]+)\)/g, ': נצפה לבערך $1 לבית ו-$2 לחוץ (סה״כ $3)'],
  [/: צפי ([\d.]+), (נמוך|גבוה) מהממוצע בליגה \(([\d.]+)\)/g, (m, n, w, l) => ': נצפה לבערך ' + n + ', ' + (w === 'נמוך' ? 'פחות' : 'יותר') + ' מהרגיל בליגה (' + l + ')'],
  [/מול מתבצרות/g, 'מול קבוצות שסוגרות הגנה'],
  [/כושר אחרון \(מהחדש לישן\): ([^.]*)\./g, (m, f) => 'תוצאות אחרונות (מהחדשה לישנה, 🟢 ניצחון ⚪ תיקו 🔴 הפסד): ' + f.replace(/(^|\s)([נתה])(?=\s|$|·)/g, (mm, sp, c) => sp + ({ נ: '🟢', ת: '⚪', ה: '🔴' })[c]) + '.'],
  [/(?<![א-ת])([הלב]?)רגליים(?![א-ת])/g, (m, p) => p + 'הימורים'],
  [/(?<![א-ת])([הלב]?)רגלי(?![א-ת])/g, (m, p) => p + 'הימורי'],
  [/(?<![א-ת])([הלב]?)רגל(?![א-ת])/g, (m, p) => p + 'הימור'],
  [/הימור אחת/g, 'הימור אחד'],
  [/הימור הכי חזקה/g, 'הימור הכי חזק'],
  [/הימור חזקה/g, 'הימור חזק'],
  [/ביטחון בנתונים/g, 'כמה נתונים יש לנו'],
  [/\bEV\b/g, 'כדאיות'],
];
function polish(t) { let x = String(t); for (const [re, to] of POLISH) x = x.replace(re, to); return x; }
const esc = s => polish(String(s ?? '')).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = p => p == null ? '—' : Math.round(p * 100) + '%';
const fx1 = x => x == null ? '—' : Number(x).toFixed(1);
const tzOpt = { timeZone: 'Asia/Jerusalem' };
const heRound = r => { const m = String(r || '').match(/(\d+)\s*$/); return m ? 'מחזור ' + m[1] : ''; };
const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', ...tzOpt });
const fmtDate = ts => new Date(ts * 1000).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', ...tzOpt });
const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const scoreCls = s => s >= 7 ? 's-hi' : s >= 5 ? 's-mid' : 's-lo';
const scoreWord = s => s >= 8 ? 'חזקה מאוד' : s >= 7 ? 'חזקה' : s >= 5 ? 'בינונית' : 'חלשה';
const RES = { win: ['נתפס ✅', 'win'], halfwin: ['חצי נתפס ✅', 'win'], lose: ['נפל ❌', 'lose'], halflose: ['חצי נפל ❌', 'lose'], push: ['החזר ↩', 'push'] };
const STAT = { g: { he: 'שערים', icon: '⚽' }, c: { he: 'קרנות', icon: '🚩' }, c1: { he: 'קרנות במחצית ראשונה', icon: '⏱🚩' }, sh: { he: 'בעיטות', icon: '🎯' }, sot: { he: 'בעיטות למסגרת', icon: '🥅' } };
const FOCUS = ['g', 'c', 'c1', 'sh', 'sot'];
const TIER = { top: 'גדולה', mid: 'בינונית', bot: 'קטנה' };
const isResult = m => m.stat === 'g' && (m.group === '1x2' || m.group === 'dc');
const mType = m => isResult(m) ? 'res' : m.stat;
const mIcon = m => isResult(m) ? '🏁' : (STAT[m.stat] || {}).icon || '';
const TYPE_NAME = { res: '🏁 תוצאה', g: '⚽ שערים', c: '🚩 קרנות', c1: '⏱🚩 קרנות במחצית', sh: '🎯 בעיטות', sot: '🥅 בעיטות למסגרת' };
const SITE_URL = 'https://stavzohar7.github.io/corner-iq/';

const state = { index: null, day: null, tab: 'today', q: '', sf: 'all', tday: 'all' };

// ---- אחסון מקומי (עם גיבוי בזיכרון אם הדפדפן חוסם) ----
const mem = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? (mem[k] ?? null) : v; } catch (e) { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

async function getJson(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url); return r.json(); }

// ================= אתחול וניווט =================
// ---- נגישות: גודל טקסט ומצב כהה/בהיר, נשמרים בין ביקורים ----
function applyA11y() {
  const fs = Number(store.get('ciq-fs') || 0), th = store.get('ciq-th') || 'dark';
  const phone = matchMedia('(max-width: 760px)').matches;   // בטלפון הכל קטן יותר, באותו יחס (הכפתור "א+" מגדיל משם)
  document.body.style.zoom = ([1, 1.12, 1.25][fs] || 1) * (phone ? 0.86 : 1);
  document.documentElement.dataset.theme = th;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'light' ? '#f6f5f1' : '#101112';
}
function initA11y() {
  applyA11y();
  $('#fsBtn').onclick = () => { store.set('ciq-fs', String((Number(store.get('ciq-fs') || 0) + 1) % 3)); applyA11y(); };
  $('#thBtn').onclick = () => { store.set('ciq-th', (store.get('ciq-th') || 'dark') === 'dark' ? 'light' : 'dark'); applyA11y(); };
}
const GUIDE = '<details class="card guide"><summary>❓ איך קוראים את האתר (30 שניות)</summary><ul class="notes">' +
  '<li><b>הציון (1 עד 10)</b> = כמה ההימור חזק לפי הניתוח שלנו. <span class="score s-hi">7</span> ומעלה חזק, <span class="score s-mid">5-6</span> בינוני, מתחת לזה חלש.</li>' +
  '<li><b>הטופס החזק</b> = שלושת ההימורים הכי בטוחים של היום, בשלושה משחקים שונים. הוא נפסל אם הימור אחד נופל. <b>הטופס השני</b> = חזק פחות, אבל יחס גבוה יותר.</li>' +
  '<li><b>המלצה בודדת</b> = הימור אחד על משחק אחד, לא קשור לטפסים.</li>' +
  '<li><b>הסימנים:</b> ✅ נתפס · ❌ נפל · ⏳ עדיין לא נגמר · ↩ הוחזר.</li>' +
  '<li><b>"x מתוך y"</b> = כמה נתפסו מתוך אלה שכבר נגמרו.</li>' +
  '<li><b>יחס</b> = כמה משלמים על כל שקל. יחס Bet365 הוא לעיון, תבדוק תמיד את היחס באתר שלך.</li></ul>' +
  '<h5 class="gloss">📖 מילון קצר</h5><ul class="notes">' +
  '<li><b>מעל / מתחת</b> = יהיו יותר או פחות מהמספר (למשל מעל 2.5 שערים = שלושה שערים ומעלה).</li>' +
  '<li><b>1X</b> = הבית לא מפסידה (ניצחון או תיקו). <b>X2</b> = החוץ לא מפסידה. <b>12</b> = לא תיקו.</li>' +
  '<li><b>הנדיקאפ (+2)</b> = נותנים לקבוצה יתרון של שתי יחידות לפני המשחק.</li>' +
  '<li><b>3 אפשרויות</b> = שוק של שלוש תשובות: מעל, מתחת, או בדיוק המספר.</li>' +
  '<li><b>בעיטות למסגרת</b> = בעיטות שהיו בדרך לשער (נעצרו בידי השוער או נכנסו).</li>' +
  '<li><b>קרנות במחצית</b> = קרנות במחצית הראשונה בלבד.</li></ul></details>';
async function init() {
  initA11y();
  try { state.index = await getJson('data/days/index.json'); }
  catch (e) { $('#view-today').innerHTML = '<div class="empty">עדיין אין נתונים. העדכון היומי הראשון ייצור אותם.</div>'; return; }
  const sel = $('#daySel');
  sel.innerHTML = state.index.days.map(d => '<option value="' + d.date + '">' + fmtDay(d.date) + '</option>').join('');
  sel.onchange = () => loadDay(sel.value);
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));
  window.addEventListener('hashchange', route);
  // יום ברירת מחדל: היום החדש ביותר שיש בו המלצות (כדורגל או כדורסל). יום חדש שעוד אין לו יחסים לא מחליף את היום הקודם
  try { bb.idx = await getJson('data/bball/index.json'); } catch (e) { bb.idx = { days: [], picksLog: [] }; }
  await loadSlips();
  const hasRecs = date => { const a = state.index.days.find(d => d.date === date), b = bb.idx.days.find(d => d.date === date); return (a && a.picks > 0) || (b && b.picks > 0); };
  const dates = [...new Set([...state.index.days.map(d => d.date), ...bb.idx.days.map(d => d.date)])].sort().reverse();
  const todayIl = ilToday(); state.defDate = (hasRecs(todayIl) && todayIl) || dates.slice().reverse().find(d => d > todayIl && hasRecs(d)) || dates.find(d => d <= todayIl && hasRecs(d)) || dates[0];
  const first = state.index.days.find(d => d.date === state.defDate) ? state.defDate : (state.index.days[0] && state.index.days[0].date);
  if (first) { sel.value = first; await loadDay(first); }
}
async function loadDay(date) {
  state.day = await getJson('data/days/' + date + '.json');
  { let FB = null; try { FB = (await getJson('data/fbodds/' + date + '.json')).odds || {}; } catch (e) {}
    // יום שיש לו יחסי fivebet: מציגים רק הימורים שקיימים ב-fivebet עם יחס אמיתי. הימור בלי שוק שם לא מוצג בכלל (לא יחס משוער ולא Bet365)
    if (FB) {
      const idMap = new Map();
      for (const f of state.day.fixtures || []) {
        const O = FB[String(f.id)] || {}, oldM = f.markets || [], map = {}, keep = [];
        oldM.forEach((m, i) => { const o = O[[m.stat, m.group, m.side, m.line].join('|')]; if (o) { m.odds = o; m.src = 'fivebet'; m.estOdds = null; map[i] = keep.length; keep.push(m); } });
        f.markets = keep; f.picks = (f.picks || []).map(i => map[i]).filter(i => i != null);
        if (!f.picks.length) f.picks = keep.map((m, i) => [m, i]).filter(([m]) => m.score >= 6).sort((x, y) => y[0].score - x[0].score || (y[0].ev || 0) - (x[0].ev || 0)).slice(0, 2).map(([, i]) => i);
        if (Array.isArray(f.near)) f.near = [];
        idMap.set(f.id, map);
      }
      if (Array.isArray(state.day.dayPicks)) state.day.dayPicks = state.day.dayPicks.map(p => { const mp = idMap.get(p.fid); return mp && mp[p.mi] != null ? { ...p, mi: mp[p.mi] } : null; }).filter(Boolean);
    }
  }
  if (typeof bb !== 'undefined' && bb.idx && bb.idx.days.some(x => x.date === date && x.games) && bb.date !== date) { bb.date = null; }
  const d = state.day;
  $('#updated').textContent = 'עודכן: ' + new Date(d.updated).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short', ...tzOpt });
  { const ageH = (Date.now() - new Date(d.updated).getTime()) / 3600e3, isToday = date >= ilToday(), stale = isToday && ageH > 3 ? '<div class="banner warnB">⚠️ הנתונים עודכנו לפני ' + (ageH < 24 ? Math.round(ageH) + ' שעות' : Math.round(ageH / 24) + ' ימים') + '. ייתכן שחלק מהתוצאות וההרכבים לא מעודכנים. העדכון האוטומטי רץ כל שעה, ואם הוא נתקע זה יתוקן בהרצה הבאה.</div>' : '';
    $('#banners').innerHTML = stale + (d.notes || []).map(n => String(n).length > 90 ? '<details class="banner"><summary>' + (String(n).includes('מושעה') ? '⚠️ יחסי Bet365 לא מתעדכנים כרגע' : esc(String(n).slice(0, 48)) + '…') + ' <b>לפרטים</b></summary><p>' + esc(n) + '</p></details>' : '<div class="banner">' + esc(n) + '</div>').join(''); }
  const mt = d.meta || {};
  $('#srcLine').textContent = mt.fd ? 'מקורות: football-data.co.uk (' + mt.fd + ' משחקי עונה) · 365Scores (' + mt.s365 + ' משחקים, מהם ' + mt.h1 + ' עם נתוני מחצית) · התאמה בין המקורות בקרנות: ' + mt.same + ' מתוך ' + mt.checked : '';
  { const sl = $('#srcLine'); sl.textContent = '🕒 עודכן: ' + new Date(d.updated).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short', ...tzOpt }) + (sl.textContent ? ' · ' + sl.textContent : ''); }
  route();
}
function goTab(t) { state.tab = t; if (location.hash) location.hash = ''; else route(); }
function showView(name, tab) {
  document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + name);
  document.querySelectorAll('.tab').forEach(b => { const on = name !== 'match' && b.dataset.tab === (tab || name); b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
const subNav = (items, cur, attr) => '<div class="chips subnav">' + items.map(([k, l]) => '<button class="chip' + (cur === k ? ' on' : '') + '" data-' + attr + '="' + k + '">' + l + '</button>').join('') + '</div>';
const lnav = cur => subNav([['teams', '🧠 קבוצות'], ['tables', '📋 טבלאות']], cur, 'lsub');
const mnav = cur => subNav([['guess', '🎯 ניחושים עם חברים'], ['about', 'ℹ️ הסבר']], cur, 'msub');
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lsub],[data-msub]'); if (!b) return; if (b.dataset.lsub) { state.lsub = b.dataset.lsub; tmState.id = null; } else state.msub = b.dataset.msub; route(); });
function route() {
  if (!state.day) return;
  const bm = location.hash.match(/^#bb-(\d+)$/);
  if (bm) { renderBBGame(+bm[1]).then(() => { showView('match'); window.scrollTo(0, 0); }); return; }
  const m = location.hash.match(/^#match-(\d+)$/);
  if (m && state.day.fixtures[+m[1]]) { renderMatch(+m[1]); showView('match'); window.scrollTo(0, 0); return; }
  const t = state.tab;
  if (t === 'leagues') { const sub = state.lsub || 'teams'; (sub === 'tables' ? renderTables : renderTeams)(); showView(sub, 'leagues'); return; }
  if (t === 'more') { const sub = state.msub || 'guess'; (sub === 'about' ? renderAbout : renderGuess)(); showView(sub, 'more'); return; }
  ({ today: renderToday, games: renderGames, tables: renderTables, teams: renderTeams, bball: renderBB, guess: renderGuess, track: renderTrack, about: () => {} }[t] || renderToday)();
  showView(t);
}
const openMatch = i => { location.hash = 'match-' + i; };
window.openMatch = openMatch; window.goTab = goTab;
const findFx = id => state.day.fixtures.find(x => String(x.id) === String(id));
const idxOf = id => state.day.fixtures.findIndex(x => String(x.id) === String(id));
const leagueOf = id => state.day.leagues.find(l => l.id === id) || { he: String(id), country: '' };

// ================= רכיבים =================
const bd = t => '<bdi>' + esc(t) + '</bdi>';
function logo(t, side) {
  if (t.logo) return '<img class="tlogo" src="' + esc(t.logo) + '" alt="" loading="lazy">';
  const ini = t.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return '<span class="tlogo" style="color:var(--' + (side === 'h' ? 'home' : 'away') + ')">' + esc(ini) + '</span>';
}
const teamsRow = f => logo(f.home, 'h') + ' ' + bd(f.home.name) + ' <span class="muted">–</span> ' + bd(f.away.name) + ' ' + logo(f.away, 'a');
const hits = x => x ? Math.round(x[0] * x[1]) + '/' + x[1] : null;
const oddsTag = m => m.odds && m.src === 'fivebet' ? '<span class="oddsTag">fivebet <bdi dir="ltr">' + m.odds.toFixed(2) + '</bdi></span>' : '<span class="oddsTag est" title="היחסים באתר נלקחים רק מ-fivebet. להימור הזה עוד לא נקרא יחס משם">אין יחס מ-fivebet</span>';
const conf = c => c >= 0.8 ? 'גבוה' : c >= 0.55 ? 'בינוני' : 'נמוך';
const ofN = x => x ? Math.round(x[0] * x[1]) + ' מתוך ' + x[1] : null;
function evidence(m, f) {
  if (m.why) return esc(Array.isArray(m.why) ? m.why.join(' ') : m.why);
  const h = m.hist || {}, parts = [];
  if (h.hv) parts.push(bd(f.home.name) + ' בבית: ' + ofN(h.hv));
  if (h.av) parts.push(bd(f.away.name) + ' בחוץ: ' + ofN(h.av));
  if (h.x && h.x[1] >= 2) parts.push('ראש בראש: ' + ofN(h.x));
  return parts.length ? 'ההימור "עבר" העונה — ' + parts.join(' · ') : 'אין מספיק היסטוריה העונה';
}
function resStrip(f, m) {
  if (!m || !m.res) return '';
  const r = RES[m.res], act = m.actT || actualOf(f, m);
  return '<div class="resStrip ' + r[1] + '"><b>' + r[0] + '</b>' + (act ? ' · ' + esc(act) : '') + '</div>';
}
function slipDayStat(date) {
  const s = state.slips && state.slips.days.find(x => x.date === date); if (!s || !s.k) return null;
  const all = []; for (const [lv] of SLIP_LV) for (const [sp] of SLIP_SP) all.push(slipAt(s, lv, sp));
  (s.k.win || []).forEach(x => all.push(x)); (s.k.lg || []).forEach(x => all.push(x));
  const L = all.filter(S => S.legs && S.legs.length); if (!L.length) return null;
  return { n: L.length, w: L.filter(S => S.res === 'win').length, l: L.filter(S => S.res === 'lose').length };
}
const dayName = d => { const t = ilToday(); return d === t ? 'היום' : d === addDays(t, 1) ? 'מחר' : d === addDays(t, -1) ? 'אתמול' : new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long' }); };
function dayChips() {
  const t = ilToday(), days = state.index.days.filter(d => (d.picks || slipDayStat(d.date)) && d.date >= addDays(t, -4) && d.date <= addDays(t, 2)).sort((x, y) => x.date.localeCompare(y.date)).reverse();
  if (days.length < 2) return '';
  return '<div class="dayStrip"><div class="chips">' + days.map(d => {
    const st = slipDayStat(d.date), future = d.date > t;
    const sub = st ? (st.w + st.l ? st.w + ' מתוך ' + (st.w + st.l) + ' טפסים נתפסו' : st.n + ' טפסים · ' + (future ? 'ממתינים' : 'ממתינים לתוצאה')) : (d.picks ? d.picks + ' המלצות' : '');
    return '<button class="chip dchip' + (d.date === state.day.date ? ' on' : '') + '" data-day="' + d.date + '"><b>' + dayName(d.date) + '</b><small>' + fmtShort(d.date) + (sub ? '<br>' + sub : '') + '</small></button>';
  }).join('') + '</div><span class="muted dayHint">ימים ישנים יותר: בתפריט שבראש העמוד</span></div>';
}
// סיכום של היום שנבחר, על אותו יום בלבד: טפסים והמלצות בודדות
const DOT = r => r && r.includes('win') ? '🟢' : r && r.includes('lose') ? '🔴' : '⚪';
function streakLine() {
  const L = (state.index.matchLog || []).filter(e => e.res && (e.res.includes('win') || e.res.includes('lose'))).sort((a, b) => b.ts - a.ts).slice(0, 12);
  if (L.length < 4) return '';
  const w = L.filter(e => e.res.includes('win')).length;
  return '<p class="dots"><span class="muted">12 ההמלצות האחרונות (מהחדשה):</span> ' + L.map(e => DOT(e.res)).join('') + ' <b>' + w + ' מתוך ' + L.length + '</b></p>';
}
function heroPick() {
  const d = state.day; if (!d || d.date !== ilToday()) return '';
  const c = (d.matchPicks || []).map(p => { const f = findFx(p.fid); return f && f.markets[p.mi] && !f.result && f.ts > nowS() ? { f, m: f.markets[p.mi], i: idxOf(p.fid) } : null; }).filter(Boolean)
    .sort((a, b) => b.m.score - a.m.score || ((b.m.odds ? 1 : 0) - (a.m.odds ? 1 : 0)) || (b.m.ev || 0) - (a.m.ev || 0))[0];
  if (!c || c.m.score < 6) return '';
  const oks = (c.m.checks || []).filter(x => x.k === 'ok').slice(0, 2).map(x => esc(x.t));
  return '<div class="card heroPick" onclick="openMatch(' + c.i + ')"><div class="hpTop">🌟 ההימור הכי חזק שעוד לא התחיל</div><div class="hpMain"><span class="score ' + scoreCls(c.m.score) + '">' + c.m.score + '</span><div><div class="plabel">' + mIcon(c.m) + ' ' + esc(c.m.label) + '</div><div class="pmeta">' + bd(c.f.home.name) + ' – ' + bd(c.f.away.name) + ' · ' + fmtTime(c.f.ts) + '</div></div>' + oddsTag(c.m) + '</div>' + (oks.length ? '<ul class="hpWhy">' + oks.map(t => '<li>✓ ' + t + '</li>').join('') + '</ul>' : '') + '</div>';
}
function nextKickoff(date) {
  if (!state.day || state.day.date !== date) return '';
  const up = state.day.fixtures.filter(f => !f.result && f.ts > nowS()).sort((a, b) => a.ts - b.ts)[0];
  if (!up) return '';
  const m = Math.round((up.ts - nowS()) / 60), when = m < 60 ? 'בעוד ' + m + ' דקות' : m < 1440 ? 'בעוד ' + Math.floor(m / 60) + ' שעות ו-' + (m % 60) + ' דקות' : fmtDate(up.ts);
  return '<p class="nextKo">⏱ <b>המשחק הבא:</b> ' + bd(up.home.name) + ' – ' + bd(up.away.name) + ' · ' + fmtTime(up.ts) + ' (' + when + ')</p>';
}
function daySummary(date) {
  const st = slipDayStat(date), L = (state.index.matchLog || []).filter(e => e.d === date), done = L.filter(e => e.res), w = done.filter(e => e.res.includes('win')).length, l = done.filter(e => e.res.includes('lose')).length;
  if (!st && !L.length) return '';
  const cell = (t, a, b) => '<div class="kpi"><b>' + a + '</b><span>' + t + (b ? '<br><small>' + b + '</small>' : '') + '</span></div>';
  return heroPick() + '<div class="card daySum"><h4>📌 סיכום ' + dayName(date) + ' <span class="muted">' + fmtShort(date) + '</span></h4><div class="kpis">' +
    (st ? cell('טפסים', st.w + ' מתוך ' + st.n, st.w + st.l < st.n ? (st.n - st.w - st.l) + ' עוד ממתינים' : 'כולם נגמרו') : '') +
    (L.length ? cell('המלצות בודדות', w + ' מתוך ' + (w + l), L.length - done.length ? (L.length - done.length) + ' עוד ממתינות' : 'כולן נגמרו') : '') + '</div>' + streakLine() + nextKickoff(date) + '</div>';
}
// סיכום "מה קרה ביום האחרון שנגמר": כל טופס ואיך הוא יצא
function recapHtml(date) {
  const S = state.slips; if (!S) return '';
  const d = S.days.filter(x => x.date < date && x.k && slipDayStat(x.date)).sort((x, y) => y.date.localeCompare(x.date))[0]; if (!d) return '';
  const rows = [];
  for (const [lv, nm] of SLIP_LV) for (const [sp, spn] of SLIP_SP) { const X = slipAt(d, lv, sp); if (X.legs.length) rows.push([nm.replace('הטופס ', '') + ' · ' + spn, X]); }
  for (const w of d.k.win || []) if (w.legs.length) rows.push(['שעות · ' + w.label, w]);
  for (const w of d.k.lg || []) if (w.legs.length) rows.push(['קבוע · ' + w.label, w]);
  const done = rows.filter(r => r[1].res), win = done.filter(r => r[1].res === 'win').length, money = done.reduce((a, r) => a + slipMoney(r[1]), 0);
  return '<details class="card recap"><summary><b>📊 מה קרה ' + (d.date === addDays(ilToday(), -1) ? 'אתמול' : 'ב' + fmtDay(d.date)) + '</b> <span class="muted">· ' + (done.length ? win + ' מתוך ' + done.length + ' טפסים נתפסו' + (rows.length > done.length ? ' · ' + (rows.length - done.length) + ' עוד ממתינים' : '') + ' · <b class="' + moneyCls(money) + '">' + fmtMoney(money) + '</b>' : 'עדיין ממתינים לתוצאות') + '</span></summary>' +
    '<div class="recapRows">' + rows.map(([n, X]) => '<div class="recapRow ' + (X.res ? 'fin-' + X.res : '') + '"><div class="rhead"><span>' + (X.res === 'win' ? '✅' : X.res === 'lose' ? '❌' : '⏳') + ' <b>' + esc(n) + '</b></span><span class="muted">יחס ' + X.total.toFixed(2) + '</span></div><div class="rlegs">' + X.legs.map(l => (l.res === 'win' ? '✅ ' : l.res === 'lose' ? '❌ ' : l.res === 'push' ? '↩ ' : '⏳ ') + esc(l.label) + (l.act ? ' <span class="muted">(' + esc(l.act) + ')</span>' : '')).join('<br>') + '</div></div>').join('') + '</div></details>';
}
function bindDayChips() { document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { $('#daySel').value = b.dataset.day; loadDay(b.dataset.day); }); }
async function openMatchOf(date, id) {
  if (state.day.date !== date) { $('#daySel').value = date; await loadDay(date); }
  const i = idxOf(id); if (i >= 0) openMatch(i);
}
window.openMatchOf = openMatchOf;
const actSmall = m => m.actT ? '<div class="muted actT">' + esc(m.actT) + '</div>' : '';
function resChip(m) { if (!m || !m.res) return ''; const r = RES[m.res]; return '<span class="res ' + r[1] + '">' + r[0] + '</span>'; }
function checksFold(m) { return m.checks && m.checks.length ? '<details class="chkFold"><summary>למה ההימור הזה? (' + m.checks.length + ')</summary>' + checksHtml(m) + '</details>' : ''; }
function checksHtml(m) { return m.checks && m.checks.length ? '<div class="checks">' + m.checks.map(c => '<span class="chk ' + c.k + '">' + (c.k === 'ok' ? '✓ ' : '⚠ ') + esc(c.t) + '</span>').join('') + '</div>' : ''; }
function recRow(m, f) {
  return '<div class="rec' + (m.res ? ' fin-' + RES[m.res][1] : '') + '"><span class="score ' + scoreCls(m.score) + '" title="דירוג ' + m.score + ' מתוך 10">' + m.score + '</span>' +
    '<div><div class="rtitle">' + mIcon(m) + ' ' + esc(m.label) + '</div><div class="rwhy">' + evidence(m, f) + '</div>' + resStrip(f, m) + checksFold(m) + '</div>' +
    '<div class="rside"><span class="pill ' + scoreCls(m.score) + '">' + scoreWord(m.score) + '</span>' + oddsTag(m) + resChip(m) + '</div></div>';
}
const matchupLine = (f, side) => {
  const T = side === 'h' ? f.home : f.away, u = f.matchup && f.matchup[side];
  return bd(T.name) + (T.rank ? ' (מקום ' + T.rank + ' מתוך ' + T.nTeams + ')' : '') + ' משחקת ' + (side === 'h' ? 'בבית' : 'בחוץ') + ' מול ' + (u ? bd(u.opp) + (u.rank ? ' (מקום ' + u.rank + ', קבוצה ' + TIER[u.tier] + ')' : '') : '');
};

// ================= המלצות היום =================
// ---- סינון לפי מצב המשחק: כל היום / עוד לא התחילו / בתהליך / הסתיימו ----
const nowS = () => Date.now() / 1000;
const statusOfFx = f => f.result ? 'finished' : f.ts > nowS() ? 'upcoming' : 'live';
const statusOfLog = e => e.res ? 'finished' : e.ts > nowS() ? 'upcoming' : 'live';
const SF = [['all', 'כל היום'], ['upcoming', '🕒 עוד לא התחילו'], ['live', '⏳ בתהליך'], ['finished', '✅ הסתיימו']];
function sfBar(items, statusFn) {
  const c = { all: items.length, upcoming: 0, live: 0, finished: 0 }; items.forEach(x => c[statusFn(x)]++);
  return '<div class="chips sfbar">' + SF.map(([k, l]) => '<button class="chip' + (state.sf === k ? ' on' : '') + '" data-sf="' + k + '">' + l + ' (' + c[k] + ')</button>').join('') + '</div>';
}
const bindSf = rerender => document.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { state.sf = b.dataset.sf; rerender(); });
const stBadge = st => st === 'upcoming' ? '<span class="tag">🕒 עוד לא התחיל</span>' : st === 'live' ? '<span class="tag">⏳ בתהליך / ממתין לתוצאה</span>' : '';

const SPORT_ICON = { f: '⚽', b: '🏀', n: '🏀', e: '🏀' };
async function openBB(date, id) { await bbLoad(date); location.hash = 'bb-' + id; }
window.openBB = openBB;
// בדיקת לפני משחק: האם ההרכבים כבר רשמיים, וכמה חיסורים ידועים (כדורגל, ליום שמוצג)
function lineupInfo(d, l) {
  if (l.sport !== 'f' || !state.day || state.day.date !== d.date || l.res) return null;
  const f = findFx(l.id); if (!f || f.result || f.ts < nowS() - 300) return null;
  const n = f.news; if (!n) return { ok: false, txt: '👥 עוד אין הרכבים. כדאי לבדוק שעה לפני' };
  const conf = n.lineups && n.lineups.h && n.lineups.a && n.lineups.h.confirmed && n.lineups.a.confirmed;
  const out = (n.items || []).filter(i => i.impact === 'high' || i.impact === 'medium').length;
  return { ok: !!conf, txt: (conf ? '👥 הרכבים רשמיים ✅' : '👥 הרכב צפוי, לא סופי. כדאי לבדוק שעה לפני') + (out ? ' · 🚑 ' + out + ' חיסורים חשובים' : '') };
}
function slipLegHtml(d, l, n, best) {
  const click = l.sport === 'f' ? "openMatchOf('" + d.date + "','" + String(l.id).replace(/'/g, '') + "')" : "openBB('" + d.date + "'," + l.id + ")";
  return '<div class="slipLeg' + (l.res ? ' fin-' + l.res : '') + '" onclick="' + click + '"><span class="rank">' + n + '</span><div class="slipMain"><div class="plabel">' + esc(l.label) + '</div><div class="pmeta">' + SPORT_ICON[l.sport] + ' ' + esc(l.game) + ' · ' + fmtTime(l.ts) + (new Date(l.ts * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) > d.date ? ' 🌙 (בלילה, נספר ליום הזה)' : '') + (l.res ? ' · ' + RES[l.res][0] + (l.act ? ' (' + l.act + ')' : '') : '') + (best ? ' · <span class="bestTag">⭐ הכי בטוחה בטופס</span>' : '') + (() => { const u = lineupInfo(d, l); return u ? '<div class="luTag ' + (u.ok ? 'ok' : 'wait') + '">' + u.txt + '</div>' : ''; })() + '</div>' + '</div><span class="oddsTag">' + l.odds.toFixed(2) + '</span>' + (l.res || l.src === 'fivebet' ? '' : '<input class="siteOdds" type="number" step="0.01" min="1.01" inputmode="decimal" placeholder="יחס באתר שלך" value="' + esc(store.get('ciq-so-' + d.date + '|' + l.sport + '|' + l.id + '|' + (l.key || l.mi)) || '') + '" data-k="' + esc(d.date + '|' + l.sport + '|' + l.id + '|' + (l.key || l.mi)) + '" data-o="' + l.odds + '" onclick="event.stopPropagation()">') + '</div>';
}
function recalcSite(card) {
  const ins = [...card.querySelectorAll('.siteOdds')], el = card.querySelector('.siteTotal'); if (!el || !ins.length) return;
  const vals = ins.map(i => parseFloat(i.value)), any = vals.some(v => v > 1);
  if (!any) { el.innerHTML = ''; return; }
  let t = 1, miss = 0, low = 0; ins.forEach((i, k) => { const v = vals[k]; if (v > 1) { t *= v; if (v < 1.45) low++; } else { t *= parseFloat(i.dataset.o); miss++; } });
  el.innerHTML = 'לפי האתר שלך: <b>' + t.toFixed(2) + '</b> · 100 ₪ משלמים ' + Math.round(100 * t) + ' ₪' + (miss ? ' <span class="muted">(' + miss + ' רגליים לפי Bet365)</span>' : '') + (low ? ' <span class="neg">· ' + low + ' מתחת ל-1.45</span>' : '');
}
function bindSiteOdds(root) {
  root.querySelectorAll('.slipCard').forEach(c => { recalcSite(c); });
  root.querySelectorAll('.siteOdds').forEach(i => { i.oninput = () => { store.set('ciq-so-' + i.dataset.k, i.value); recalcSite(i.closest('.slipCard')); }; });
}
async function loadSlips() { if (!state.slips) { try { state.slips = await getJson('data/slips.json'); } catch (e) { state.slips = { days: [] }; } } return state.slips; }
const SLIP_LV = [['strong', 'הטופס החזק', ''], ['second', 'הטופס השני', 'slip2']], SLIP_SP = [['f', '⚽ כדורגל'], ['n', '🏀 NBA'], ['e', '🏀 יורוליג']];
const slipAt = (s, lv, sp) => (s.k[lv] && s.k[lv][sp]) || { legs: [] };
function slipShareText(d, S, title) {
  const L = S.legs.map((l, i) => (i + 1) + '. ' + l.label + ' (' + l.game + ', ' + fmtTime(l.ts) + ') יחס ' + l.odds.toFixed(2)).join('\n');
  return '🚩 קורנר IQ · ' + title + ' · ' + fmtShort(d.date) + '\n' + L + '\nיחס כולל ' + S.total.toFixed(2) + '\n' + SITE_URL;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.shareBtn'); if (!b) return;
  const t = b.dataset.t;
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
});
const slipKey = (d, S) => 'ciq-pl-' + d.date + '|' + S.legs.map(l => l.id + ':' + (l.kind || l.key || l.label)).join(',');
const getPlay = k => { try { return JSON.parse(store.get(k) || 'null'); } catch (e) { return null; } };
document.addEventListener('change', e => {
  const c = e.target.closest && e.target.closest('[data-sk]'); if (!c || !(e.target.matches('.playChk, .playStake'))) return;
  const k = c.dataset.sk, chk = c.querySelector('.playChk'), st = c.querySelector('.playStake');
  if (e.target === chk && chk.checked && !(parseFloat(st.value) > 0)) st.value = store.get('ciq-lastStake') || '100';
  if (chk.checked) { const s = parseFloat(st.value) || 0; store.set('ciq-lastStake', String(s)); store.set(k, JSON.stringify({ s })); } else store.set(k, 'null');
  c.classList.toggle('played', chk.checked);
});
// כמה הימורים מאותו משחק מוצגים כשורה אחת משולבת (יחס משולב), ולא כל הימור בנפרד
function slipComboHtml(d, legs, n) {
  const l0 = legs[0], click = l0.sport === 'f' ? "openMatchOf('" + d.date + "','" + String(l0.id).replace(/'/g, '') + "')" : "openBB('" + d.date + "'," + l0.id + ")";
  const odds = legs.reduce((x, l) => x * l.odds, 1), res = legs.some(l => l.res === 'lose') ? 'lose' : legs.every(l => l.res === 'win') ? 'win' : legs.every(l => l.res) ? 'push' : '';
  const mark = l => l.res ? (l.res === 'win' ? '✅ ' : l.res === 'lose' ? '❌ ' : '↩️ ') : '• ';
  return '<div class="slipLeg slipCombo' + (res ? ' fin-' + res : '') + '" onclick="' + click + '"><span class="rank">' + n + '</span><div class="slipMain"><div class="plabel">🔗 שילוב באותו משחק</div><div class="comboLines">' + legs.map(l => '<div>' + mark(l) + esc(l.label.replace(/\s*\([^)]*[–-][^)]*\)\s*$/, '')) + ' <small class="muted">' + l.odds.toFixed(2) + '</small></div>').join('') + '</div><div class="pmeta">' + SPORT_ICON[l0.sport] + ' ' + esc(l0.game) + ' · ' + fmtTime(l0.ts) + '</div></div><span class="oddsTag">' + odds.toFixed(2) + '</span></div>';
}
function slipLegsHtml(d, S, bestLeg) {
  const groups = [], idx = new Map();
  for (const l of S.legs) { const k = l.sport + '|' + l.id; if (idx.has(k)) groups[idx.get(k)].push(l); else { idx.set(k, groups.length); groups.push([l]); } }
  return groups.map((g, i) => g.length > 1 ? slipComboHtml(d, g, i + 1) : slipLegHtml(d, g[0], i + 1, bestLeg === g[0])).join('');
}
function slipCardHtml(d, S, title, sub, cls) {
  const prob = S.legs.reduce((a, l) => a * (l.p > 0 ? l.p : 0.6), 1), once = Math.max(2, Math.round(1 / prob)), whys = S.legs.filter(l => l.why), bestLeg = S.legs.some(l => l.p > 0) ? S.legs.reduce((a, l) => (l.p || 0) > (a.p || 0) ? l : a, S.legs[0]) : null;
  const sk = slipKey(d, S), pl = getPlay(sk);
  return '<div class="card slipCard ' + cls + (S.res ? ' fin-' + S.res : '') + (pl ? ' played' : '') + '" data-sk="' + esc(sk) + '"><h3>' + title + ' <span class="muted">' + sub + '</span></h3>' + slipLegsHtml(d, S, bestLeg) +
    (whys.length ? '<details class="legWhyBox"><summary>💡 למה בחרנו (' + whys.length + ')</summary><ul>' + whys.map(l => '<li><b>' + esc(l.label) + '</b> — ' + esc(l.why) + '</li>').join('') + '</ul></details>' : '') +
    '<div class="slipTotal"><span>יחס כולל (' + (S.src === 'fivebet' ? 'fivebet' : S.legs.every(l => l.est) ? 'משוער' : 'Bet365') + ')</span><b>' + S.total.toFixed(2) + '</b></div><button class="btn shareBtn" type="button" data-t="' + esc(slipShareText(d, S, title.replace(/^[^ ]+ /, ''))) + '">📤 שתף בוואטסאפ</button><div class="playRow"><label><input type="checkbox" class="playChk"' + (pl ? ' checked' : '') + '> שיחקתי את הטופס הזה</label><input class="playStake" type="number" min="1" inputmode="decimal" placeholder="סכום ב-₪" value="' + (pl ? pl.s : '') + '"></div><div class="siteTotal"></div><p class="muted slipFoot">100 ₪ משלמים ' + Math.round(100 * S.total) + ' ₪ · נתפס בערך פעם ב-' + once + ' טפסים' + (S.res === 'win' ? ' · <b class="pos">נתפס ✅</b>' : S.res === 'lose' ? ' · <b class="neg">נפל ❌</b>' : '') + '</p></div>';
}
function ciqSlipTab(btn, id) { const box = btn.closest('.slipGroups'); if (!box) return; box.querySelectorAll('.segBtn').forEach(b => b.classList.toggle('on', b === btn)); box.querySelectorAll('.slipPane').forEach(p => { p.hidden = p.dataset.pane !== id; }); }
window.ciqSlipTab = ciqSlipTab;
function slipsHtml(s, sp) {
  if (!s || !s.k) return '';
  let cards = '', bet365 = false;
  for (const [lv, name, cls] of SLIP_LV) { const X = slipAt(s, lv, sp); if (X.legs.length) { cards += slipCardHtml(s, X, '📋 ' + name, lv === 'strong' ? 'שלושת ההימורים הכי חזקים' : 'חזק, אבל פחות מהחזק', cls); if (X.legs.some(l => l.src !== 'fivebet')) bet365 = true; } }
  const wins = sp === 'f' ? (s.k.win || []).filter(w => w.legs.length) : [], fixedAll = sp === 'f' ? (s.k.lg || []).filter(w => w.legs.length) : [], fixed = fixedAll.filter(w => w.kind !== 'league'), leagueSl = fixedAll.filter(w => w.kind === 'league');
  const grid = list => '<div class="slipGrid">' + list + '</div>';
  const panes = [];   // [מזהה, כפתור, הסבר קצר, תוכן]
  if (cards) panes.push(['top', '⭐ הכי חזקים', 'הטופס החזק והטופס השני של היום', grid(cards)]);
  if (fixed.length) panes.push(['fixed', '📌 קבועים', 'טפסים קבועים של שבת: משחקי אותה שעה באותה ליגה', grid(fixed.map(w => slipCardHtml(s, w, '📌 ' + w.label, 'ההימורים הכי חזקים משם', 'slip2')).join(''))]);
  if (wins.length) panes.push(['win', '⏱ לפי שעות', 'משחקים שמתחילים בטווח של עד שעה וחצי זה מזה', grid(wins.map(w => slipCardHtml(s, w, '⏱ ' + w.label, 'ההימורים הכי חזקים בטווח הזה', 'slip2')).join(''))]);
  if (leagueSl.length) panes.push(['lg', '🏟 לפי ליגה', 'טופס חזק לכל ליגה, מכל שעות המשחקים שלה באותו יום', grid(leagueSl.map(w => slipCardHtml(s, w, '🏟 ' + w.label, 'ההימורים הכי חזקים בליגה', '')).join(''))]);
  if (!panes.length) return '';
  if ([...wins, ...fixed, ...leagueSl].some(w => w.legs.some(l => l.src !== 'fivebet'))) bet365 = true;
  let html;
  if (panes.length === 1) html = panes[0][3];
  else html = '<div class="slipGroups"><div class="segBar" role="tablist">' + panes.map((p, i) => '<button class="segBtn' + (i === 0 ? ' on' : '') + '" type="button" role="tab" onclick="ciqSlipTab(this,\'' + p[0] + '\')">' + p[1] + ' <span class="segN">' + (p[0] === 'top' ? '' : (p[0] === 'win' ? wins : p[0] === 'lg' ? leagueSl : fixed).length) + '</span></button>').join('') + '</div>' +
    panes.map((p, i) => '<div class="slipPane" data-pane="' + p[0] + '"' + (i === 0 ? '' : ' hidden') + '><p class="sub2 paneHint">' + p[2] + '</p>' + p[3] + '</div>').join('') + '</div>';
  return html + '<p class="muted note1">' + (bet365 ? 'טופס שמסומן Bet365 מחושב לפי יחסי Bet365: אפשר להקליד ליד כל הימור את היחס שרשום באתר שלך, והיחס הכולל יתעדכן. ' : '') + (s.final ? 'הטפסים נעולים ולא ישתנו היום.' : 'הטפסים עדיין לא נעולים.') + '</p>';
}
async function getBBDay(date) {
  state.bbDays = state.bbDays || {};
  if (!(date in state.bbDays)) { try { state.bbDays[date] = await getJson('data/bball/' + date + '.json'); } catch (e) { state.bbDays[date] = null; } }
  return state.bbDays[date];
}
function bbSingleRow(date, g, m) {
  return '<div class="srow' + (m.res ? ' fin-' + BB_RES[m.res][1] : '') + '" onclick="openBB(\'' + date + '\',' + g.id + ')"><span class="score ' + scoreCls(m.score) + '" title="דירוג ' + m.score + ' מתוך 10">' + m.score + '</span><div class="smain"><div class="plabel">' + esc(m.label) + '</div><div class="pmeta">🏀 ' + bd(bbNm(g, 'h')) + ' – ' + bd(bbNm(g, 'a')) + ' · ' + bbComp(g.comp) + ' · ' + fmtTime(g.ts) + '</div>' + bbResStrip(g, m) + '</div><div class="sside">' + (m.odds ? bbOdds(m) : '') + '</div></div>';
}
const SP_IN = { f: 'בכדורגל', n: 'ב-NBA', e: 'ביורוליג' };
// גוף דף "היום": כפתורי ענף אחד (כדורגל / NBA / יורוליג), ומתחתיו הטפסים וההמלצות הבודדות של אותו ענף בלבד
async function fillToday(date) {
  if (!$('#todayBody')) return;
  const S = await loadSlips(), s = S.days.find(x => x.date === date), bday = await getBBDay(date);
  const box = $('#todayBody'); if (!box || !state.day || state.day.date !== date) return;
  const d = state.day;
  const fP = (d.dayPicks || []).map(p => { const f = findFx(p.fid); return f && f.markets[p.mi] ? { f, m: f.markets[p.mi], i: idxOf(p.fid) } : null; }).filter(Boolean);
  const bP = bday ? (bday.dayPicks || []).map(p => { const g = bday.fixtures.find(x => x.id === p.fid); return g && g.markets[p.mi] ? { g, m: g.markets[p.mi] } : null; }).filter(Boolean) : [];
  const singles = { f: fP, n: bP.filter(x => x.g.comp === 103), e: bP.filter(x => x.g.comp !== 103) };
  const hasSlip = sp => !!(s && s.k) && (SLIP_LV.some(([lv]) => slipAt(s, lv, sp).legs.length) || (sp === 'f' && ((s.k.win || []).some(w => w.legs.length) || (s.k.lg || []).some(w => w.legs.length))));
  const sports = SLIP_SP.filter(([sp]) => hasSlip(sp) || singles[sp].length);
  if (!sports.length) { box.innerHTML = '<div class="empty">אין עדיין טפסים או המלצות ליום הזה. הם נבנים בבוקר, ברגע שהיחסים מתפרסמים.</div>'; return; }
  if (!sports.some(x => x[0] === state.slipSp)) state.slipSp = sports[0][0];
  const sp = state.slipSp, spName = SLIP_SP.find(x => x[0] === sp)[1];
  let html = sports.length > 1 ? '<div class="chips segBar">' + sports.map(([k, l]) => '<button class="chip' + (k === sp ? ' on' : '') + '" data-slipsp="' + k + '">' + l + '</button>').join('') + '</div>' : '';
  html += '<h3 class="secTitle">📋 הטפסים · ' + spName + '</h3>' + (slipsHtml(s, sp) || '<div class="empty">אין היום טופס ' + SP_IN[sp] + '. טופס נבנה רק כשיש 3 הימורים חזקים.</div>');
  if (sp === 'f') {
    const MP = (d.matchPicks || []).map(p => { const f = findFx(p.fid); return f && f.markets[p.mi] ? { f, m: f.markets[p.mi], i: idxOf(p.fid) } : null; }).filter(Boolean).sort((a, b) => a.f.ts - b.f.ts);
    const lgIds = [...new Set(d.fixtures.map(f => f.lg))], glg = lgIds.includes(Number(state.glg)) ? Number(state.glg) : 'all';
    const lgBar = lgIds.length > 1 ? '<div class="chips lgBar"><button class="chip' + (glg === 'all' ? ' on' : '') + '" data-glg="all">כל הליגות</button>' + lgIds.map(id => '<button class="chip' + (glg === id ? ' on' : '') + '" data-glg="' + id + '">' + esc(leagueOf(id).he) + '</button>').join('') + '</div>' : '';
    if (glg !== 'all') { for (let k = MP.length - 1; k >= 0; k--) if (MP[k].f.lg !== glg) MP.splice(k, 1); }
    const noMk = d.fixtures.filter(f => !MP.some(x => x.f === f) && (glg === 'all' || f.lg === glg)).sort((a, b) => a.ts - b.ts);
    if (MP.length || noMk.length) {
      const gw = MP.filter(x => x.m.res && x.m.res.includes('win')).length, gl = MP.filter(x => x.m.res && x.m.res.includes('lose')).length;
      html += '<h3 class="secTitle">🗂 כל משחקי היום: ההמלצה הטובה ביותר לכל משחק' + (gw + gl ? ' <span class="muted">· נתפסו ' + gw + ' · נפלו ' + gl + '</span>' : '') + '</h3><p class="srcNote">לכל משחק בליגות שלנו יש כאן המלצה אחת, גם אם היא לא נכנסה לטפסים. ציון 6 ומעלה = המלצה טובה, מתחת ל-6 = חלשה, לעיון בלבד. לחיצה פותחת את המשחק.</p>' + lgBar + '<div class="srows">' + MP.map(x => singleRow(x.f, x.m, x.i)).join('') + noMk.map(f => '<div class="srow" onclick="openMatch(' + idxOf(f.id) + ')"><span class="score s-lo">–</span><div class="smain"><div class="plabel">אין עדיין המלצה</div><div class="pmeta">' + bd(f.home.name) + ' – ' + bd(f.away.name) + ' · ' + esc(leagueOf(f.lg).he) + ' · ' + fmtTime(f.ts) + '</div><div class="muted">חסרים נתונים או יחסים. מתעדכן אוטומטית כל שעה.</div></div></div>').join('') + '</div>';
    }
  }
  const L = singles[sp], LIM = state.allPicks === sp ? 999 : 8, isW = r => r && r.includes('win'), isL = r => r && r.includes('lose');
  const w = L.filter(x => isW(x.m.res)).length, l = L.filter(x => isL(x.m.res)).length;
  html += '<h3 class="secTitle">🎯 המלצות בודדות · ' + spName + (w + l ? ' <span class="muted">· נתפסו ' + w + ' · נפלו ' + l + '</span>' : '') + '</h3><p class="srcNote">כל המלצה כאן עומדת לבד ואינה חלק מטופס. היחסים כאן של Bet365, לעיון.</p>';
  html += L.length ? '<div class="srows">' + L.slice(0, LIM).map(x => sp === 'f' ? singleRow(x.f, x.m, x.i) : bbSingleRow(date, x.g, x.m)).join('') + '</div>' + (L.length > LIM ? '<div class="more"><button class="btn" id="showAllPicks">הצג את כל ' + L.length + ' ההמלצות</button></div>' : '') : '<div class="empty">אין היום המלצות בודדות ' + SP_IN[sp] + ' שעוברות את הרף.</div>';
  box.innerHTML = html;
  box.querySelectorAll('[data-glg]').forEach(b => b.onclick = () => { state.glg = b.dataset.glg; fillToday(date); });
  box.querySelectorAll('[data-slipsp]').forEach(b => b.onclick = () => { state.slipSp = b.dataset.slipsp; fillToday(date); });
  const sa = $('#showAllPicks'); if (sa) sa.onclick = () => { state.allPicks = sp; fillToday(date); };
  bindSiteOdds(box);
}
// מאזן הטפסים: כל הטפסים יחד (חזק ושני, כדורגל וכדורסל), לפי סוג טופס, לפי יום, ופירוט כל טופס. מאזן כספי על 100 ₪ לכל טופס
const slipMoney = S => S.res === 'win' ? (S.total - 1) * 100 : S.res === 'lose' ? -100 : 0;
const fmtMoney = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + ' ₪';
const moneyCls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
async function fillSlipHist() {
  const box = $('#slipHist'); if (!box) return;
  const days = (await loadSlips()).days.filter(d => d.k); if (!days.length) return;
  const rows = [];
  const mine = [];
  for (const d of days) { const all = []; for (const [lv, nm] of SLIP_LV) for (const [sp, spn] of SLIP_SP) { const X = slipAt(d, lv, sp); if (X.legs.length) all.push([nm.replace('הטופס ', '') + ' · ' + spn, X]); } for (const w of d.k.win || []) if (w.legs.length) all.push(['שעות · ' + w.label, w]); for (const w of d.k.lg || []) if (w.legs.length) all.push(['קבוע · ' + w.label, w]);
    for (const [nm, X] of all) { const p = getPlay(slipKey(d, X)); if (p && p.s > 0) mine.push({ d, nm, X, s: p.s, profit: X.res === 'win' ? p.s * (X.total - 1) : X.res === 'lose' ? -p.s : 0 }); } }
  const myHtml = '<div class="card"><h4>💼 מה ששיחקתי בפועל</h4>' + (mine.length ? (() => { const done = mine.filter(m => m.X.res), prof = done.reduce((a, m) => a + m.profit, 0), inv = mine.reduce((a, m) => a + m.s, 0);
    return '<p class="sub2">רק טפסים שסימנת "שיחקתי", עם הסכום שהימרת. הסימון נשמר רק בטלפון / במחשב הזה.</p><div class="kpis"><div class="kpi"><b class="' + moneyCls(prof) + '">' + fmtMoney(prof) + '</b><span>רווח / הפסד (על מה שנגמר)</span></div><div class="kpi"><b>' + Math.round(inv) + ' ₪</b><span>סך מה שהימרת</span></div><div class="kpi"><b>' + done.filter(m => m.X.res === 'win').length + ' מתוך ' + done.length + '</b><span>טפסים שנתפסו</span></div><div class="kpi"><b>' + (mine.length - done.length) + '</b><span>ממתינים ⏳</span></div></div><div class="tblWrap"><table><thead><tr><th>יום</th><th>טופס</th><th class="num">סכום</th><th class="num">מצב</th><th class="num">רווח</th></tr></thead><tbody>' + mine.map(m => '<tr><td>' + fmtShort(m.d.date) + '</td><td>' + m.nm + '</td><td class="num">' + Math.round(m.s) + ' ₪</td><td class="num">' + (m.X.res === 'win' ? '✅' : m.X.res === 'lose' ? '❌' : '⏳') + '</td><td class="num"><b class="' + moneyCls(m.profit) + '">' + (m.X.res ? fmtMoney(m.profit) : '—') + '</b></td></tr>').join('') + '</tbody></table></div>'; })() : '<p class="muted" style="margin:0">עוד לא סימנת שום טופס. בלשונית "היום", מתחת לכל טופס, סמן "שיחקתי את הטופס הזה" והזן סכום, וכאן יופיע המאזן האמיתי שלך.</p>') + '</div>';
  for (const d of days) { for (const [lv, name] of SLIP_LV) for (const [sp, spName] of SLIP_SP) { const X = slipAt(d, lv, sp); if (X.legs.length) rows.push({ d, lv, sp, name: name.replace('הטופס ', '') + ' · ' + spName, S: X }); } for (const w of (d.k.win || [])) if (w.legs.length) rows.push({ d, lv: 'win', sp: 'f', name: 'שעות · ⚽ ' + w.label, S: w }); for (const w of (d.k.lg || [])) if (w.legs.length) rows.push({ d, lv: 'lg', sp: 'f', name: 'קבוע · ⚽ ' + w.label, S: w }); }
  if (!rows.length) return;
  const agg = list => { const done = list.filter(r => r.S.res), w = done.filter(r => r.S.res === 'win').length, l = done.length - w; return { n: list.length, done: done.length, w, l, pend: list.length - done.length, money: done.reduce((s, r) => s + slipMoney(r.S), 0) }; };
  const T = agg(rows), legs = rows.flatMap(r => r.S.legs), legDone = legs.filter(x => x.res && x.res !== 'push'), legW = legDone.filter(x => x.res === 'win').length;
  let html = '<div class="card"><h4>💰 מאזן כל הטפסים</h4><p class="sub2">חזק ושני, כדורגל וכדורסל, יחד. המאזן מחושב על 100 ₪ לכל טופס: טופס שנתפס מזכה ביחס הכולל, טופס שנפל מפסיד 100 ₪.</p>' +
    '<div class="kpis"><div class="kpi"><b class="' + moneyCls(T.money) + '">' + fmtMoney(T.money) + '</b><span>מאזן כולל</span></div><div class="kpi"><b class="pos">' + T.w + '</b><span>טפסים שנתפסו ✅</span></div><div class="kpi"><b class="neg">' + T.l + '</b><span>טפסים שנפלו ❌</span></div><div class="kpi"><b>' + T.pend + '</b><span>ממתינים ⏳</span></div><div class="kpi"><b>' + (legDone.length ? legW + ' מתוך ' + legDone.length : '—') + '</b><span>הימורים שעברו (כל הרגליים)</span></div></div>';
  const th = '<thead><tr><th></th><th class="num">טפסים</th><th class="num">נתפסו</th><th class="num">נפלו</th><th class="num">ממתינים</th><th class="num">מאזן</th></tr></thead>';
  const tr = (name, a, bold) => '<tr' + (bold ? ' class="avgRow"' : '') + '><td>' + name + '</td><td class="num">' + a.n + '</td><td class="num">' + a.w + '</td><td class="num">' + a.l + '</td><td class="num">' + a.pend + '</td><td class="num"><b class="' + moneyCls(a.money) + '">' + (a.done ? fmtMoney(a.money) : '—') + '</b></td></tr>';
  const types = []; for (const [lv, name] of SLIP_LV) for (const [sp, spName] of SLIP_SP) { const L = rows.filter(r => r.lv === lv && r.sp === sp); if (L.length) types.push(tr(name.replace('הטופס ', '') + ' · ' + spName, agg(L))); } { const L = rows.filter(r => r.lv === 'win'); if (L.length) types.push(tr('טפסי שעות · ⚽ כדורגל', agg(L))); } { const L = rows.filter(r => r.lv === 'lg'); if (L.length) types.push(tr('טפסים קבועים · ⚽ כדורגל', agg(L))); }
  html += '<div class="tblWrap"><table>' + th.replace('<th></th>', '<th>לפי סוג טופס</th>') + '<tbody>' + types.join('') + tr('סה״כ', T, true) + '</tbody></table></div>';
  const dayList = [...new Set(rows.map(r => r.d.date))].sort().reverse();
  html += '<div class="tblWrap" style="margin-top:10px"><table>' + th.replace('<th></th>', '<th>לפי יום</th>') + '<tbody>' + dayList.map(dt => tr(fmtDay(dt), agg(rows.filter(r => r.d.date === dt)))).join('') + '</tbody></table></div></div>';
  html += '<div class="card"><h4>📋 כל הטפסים בפירוט</h4><div class="tblWrap"><table><thead><tr><th>יום</th><th>טופס</th><th>ההימורים</th><th class="num">יחס כולל</th><th class="num">מצב</th><th class="num">מאזן</th></tr></thead><tbody>' + rows.map(({ d, name, S }) => '<tr><td>' + fmtShort(d.date) + '</td><td>' + name + '</td><td>' + S.legs.map(l => (l.res === 'win' ? '✅ ' : l.res === 'lose' ? '❌ ' : l.res === 'push' ? '↩ ' : '') + esc(l.label) + (l.act ? ' <span class="muted">(' + esc(l.act) + ')</span>' : '')).join('<br>') + '</td><td class="num">' + S.total.toFixed(2) + '</td><td class="num">' + (S.res ? '<span class="res ' + S.res + '">' + (S.res === 'win' ? 'נתפס ✅' : 'נפל ❌') + '</span>' : '⏳') + '</td><td class="num"><b class="' + moneyCls(slipMoney(S)) + '">' + (S.res ? fmtMoney(slipMoney(S)) : '—') + '</b></td></tr>').join('') + '</tbody></table></div></div>';
  box.innerHTML = myHtml + html;
}
function singleRow(f, m, i) {
  return '<div class="srow' + (m.res ? ' fin-' + RES[m.res][1] : '') + '" onclick="openMatch(' + i + ')"><span class="score ' + scoreCls(m.score) + '" title="דירוג ' + m.score + ' מתוך 10">' + m.score + '</span><div class="smain"><div class="plabel">' + mIcon(m) + ' ' + esc(m.label) + '</div><div class="pmeta">' + bd(f.home.name) + ' – ' + bd(f.away.name) + ' · ' + esc(leagueOf(f.lg).he) + ' · ' + fmtTime(f.ts) + '</div>' + (m.res ? resStrip(f, m) : '') + '</div><div class="sside">' + oddsTag(m) + '</div></div>';
}
function renderToday() {
  const el = $('#view-today'), d = state.day;
  const isLatest = state.day.date === state.index.days[0].date, sunday = isLatest && new Date(ilToday() + 'T00:00:00Z').getUTCDay() === 0;
  el.innerHTML = '<h2>🏆 ' + dayName(state.day.date) + ' <span class="muted h2d">' + fmtDay(state.day.date) + '</span></h2>' + dayChips() + daySummary(state.day.date) + recapHtml(state.day.date) + (sunday ? weekHtml(addDays(weekStartOf(ilToday()), -7), true) : '') + '<div id="todayBody"><div class="empty">טוען...</div></div>' + GUIDE;
  bindDayChips(); fillToday(d.date);
}
function keyMatchesHtml(d) {
  const km = (d.keyMatches || []).map(k => { const f = findFx(k.fid); return f ? { f, i: idxOf(k.fid) } : null; }).filter(Boolean);
  if (!km.length) return '';
  return '<h3 class="secTitle">🔥 המשחקים המרכזיים היום</h3><div class="kgrid">' + km.map(({ f, i }) => {
    const mw = f.character && f.character.mw, e = f.exp || {}, st = statusOfFx(f);
    return '<div class="kcard" onclick="openMatch(' + i + ')"><div class="kt">' + teamsRow(f) + '</div><div class="muted">' + esc(leagueOf(f.lg).he) + ' · ' + fmtTime(f.ts) + ' ' + (f.result ? '· <b>' + f.result.g[0] + ':' + f.result.g[1] + '</b>' : stBadge(st)) + '</div>' +
      (f.character && f.character.mwOdds ? '<div class="oddsRow mini"><div class="oddsBox h"><span>בית</span><b>' + f.character.mwOdds.h + '</b></div><div class="oddsBox d"><span>תיקו</span><b>' + f.character.mwOdds.d + '</b></div><div class="oddsBox a"><span>חוץ</span><b>' + f.character.mwOdds.a + '</b></div></div>' : (mw ? '<div class="muted">פייבוריטית: ' + bd(mw.h >= mw.a ? f.home.name : f.away.name) + '</div>' : '')) +
      '<div class="muted">צפי: ⚽ ' + (e.g ? fx1(e.g.total) : '—') + ' · 🚩 ' + (e.c ? fx1(e.c.total) : '—') + ' · 🎯 ' + (e.sh ? fx1(e.sh.total) : '—') + '</div></div>';
  }).join('') + '</div>';
}

function actualOf(f, m) {
  const r = f.result; if (!r) return '';
  const S = r.stats || {}, val = (st, i) => st === 'g' ? r.g[i] : st === 'c' ? (i === 0 ? r.h : r.a) : (S[st] ? S[st][i] : null);
  if (['1x2', 'dc', 'btts'].includes(m.group)) return 'תוצאה ' + r.g[0] + ':' + r.g[1];
  const h = val(m.stat, 0), a = val(m.stat, 1); if (h == null || a == null) return '';
  return m.group === 'total' ? 'בפועל: ' + (h + a) : m.group === 'home' ? 'בפועל (מארחת): ' + h : m.group === 'away' ? 'בפועל (אורחת): ' + a : 'בפועל: ' + h + ':' + a;
}

// ================= כל המשחקים =================
function renderGames() {
  const el = $('#view-games'), d = state.day, q = state.q.trim().toLowerCase();
  const items = d.fixtures.map((f, i) => ({ f, i })).filter(({ f }) => (!q || (f.home.name + ' ' + f.away.name).toLowerCase().includes(q)) && (state.sf === 'all' || statusOfFx(f) === state.sf));
  const groups = new Map(); items.forEach(x => { if (!groups.has(x.f.lg)) groups.set(x.f.lg, []); groups.get(x.f.lg).push(x); });
  let html = '<h2>⚽ כל המשחקים של היום (' + d.fixtures.length + ')</h2><p class="lead">לחצו על משחק לפרטים. ההמלצה בכל שורה מחושבת לפי יחסי Bet365, ולכן ייתכנו הבדלים מהטפסים (שלפי האתר שלך).</p>' +
    sfBar(d.fixtures, statusOfFx) + '<div class="filters"><input class="search" id="gSearch" placeholder="חיפוש קבוצה..." value="' + esc(state.q) + '"></div>';
  if (!items.length) html += '<div class="empty">לא נמצאו משחקים.</div>';
  d.leagues.filter(l => groups.has(l.id)).forEach(l => {
    html += '<div class="lgGroup"><h3>' + esc(l.he) + ' · ' + esc(l.country || '') + '</h3>' + groups.get(l.id).map(({ f, i }) => {
      const best = f.markets[f.picks[0]], st = statusOfFx(f);
      return '<div class="grow" onclick="openMatch(' + i + ')"><span class="time">' + fmtTime(f.ts) + '</span><span class="gt">' + teamsRow(f) + (f.result ? ' <b>' + f.result.g[0] + ':' + f.result.g[1] + '</b> <span class="muted">· קרנות ' + (f.result.h + f.result.a) + '</span>' : '') + (st === 'live' ? ' <span class="tag">⏳</span>' : '') + '</span>' +
        '<span class="best">' + (best && (f.enough || f.cup) ? mIcon(best) + ' ' + esc(best.label) + ' ' + resChip(best) : (f.mread && f.mread.odds ? '<span class="muted">פייבוריטית: ' + bd((f.mread.p.h >= f.mread.p.a ? f.home : f.away).name) + ' (' + (f.mread.p.h >= f.mread.p.a ? f.mread.odds.h : f.mread.odds.a) + ')</span>' : '<span class="muted">אין המלצה</span>')) + '</span>' + (best && (f.enough || f.cup) ? '<span class="score ' + scoreCls(best.score) + '">' + best.score + '</span>' : '<span></span>') + '</div>';
    }).join('') + '</div>';
  });
  el.innerHTML = html;
  bindSf(renderGames);
  const s2 = $('#gSearch'); s2.oninput = e => { state.q = e.target.value; const pos = e.target.selectionStart; renderGames(); const s3 = $('#gSearch'); s3.focus(); s3.setSelectionRange(pos, pos); };
}

// ================= עמוד משחק (פשוט, בגלילה אחת) =================
const heat = x => {
  if (!x) return '<span class="muted">—</span>';
  const r = x[0], c = r >= 0.75 ? 'h3' : r >= 0.6 ? 'h2' : r <= 0.25 ? 'l3' : r <= 0.4 ? 'l2' : 'h1';
  return '<span class="heat ' + c + '">' + Math.round(r * x[1]) + ' מתוך ' + x[1] + '</span>';
};
const pair = x => x && x[0] != null && x[1] != null ? '<bdi dir="ltr">' + x[0] + '–' + x[1] + '</bdi>' : '—';
function mainRow(f, s) {
  const rows = f.trends && f.trends.stats && f.trends.stats[s]; if (!rows || !rows.length) return null;
  const P = f.probs || {}, target = s === 'g' ? 2.5 : P[s + 'Line'];
  return rows.find(r => r.line === target) || rows[Math.floor(rows.length / 2)];
}
function winnerCard(f) {
  const c = f.character || {};
  if (!c.mw) return '';
  const od = c.mwOdds, fav = c.mw.h >= c.mw.a ? f.home.name : f.away.name;
  const box = (lab, v, cls) => '<div class="oddsBox ' + cls + '"><span>' + lab + '</span><b>' + (v != null ? v : '—') + '</b></div>';
  return '<div class="card"><h4>🏁 מי תנצח?</h4>' + (od ? '<div class="oddsRow">' + box(bd(f.home.name), od.h, 'h') + box('תיקו', od.d, 'd') + box(bd(f.away.name), od.a, 'a') + '</div><p class="muted" style="margin:6px 0 0">יחסי Bet365 לתוצאה' + (c.ouOdds ? ' · מעל 2.5 שערים: <b>' + c.ouOdds.over + '</b> · מתחת ל-2.5: <b>' + c.ouOdds.under + '</b>' : '') + '. יחס נמוך = הפייבוריטית.</p>' : '<p style="margin:0">הפייבוריטית לפי הניתוח: <b>' + bd(fav) + '</b>. אין יחסי Bet365 למשחק הזה.</p>') + '</div>';
}
function expectCard(f) {
  const rows = FOCUS.filter(s => f.exp[s]).map(s => {
    const e = f.exp[s], d = (e.total - e.lg.total) / (e.lg.total || 1);
    return '<tr><td>' + STAT[s].icon + ' ' + STAT[s].he + '</td><td class="num"><b>' + fx1(e.h) + '</b></td><td class="num"><b>' + fx1(e.a) + '</b></td><td class="num"><b>' + fx1(e.total) + '</b></td><td class="num muted">' + e.lg.total + (Math.abs(d) >= 0.08 ? ' <span class="' + (d > 0 ? 'pos' : 'neg') + '">' + (d > 0 ? 'יותר מהרגיל' : 'פחות מהרגיל') + '</span>' : '') + '</td></tr>';
  }).join('');
  return '<div class="card"><h4>📊 מה אנחנו מצפים</h4><div class="tblWrap"><table><thead><tr><th></th><th class="num">' + bd(f.home.name) + ' (בית)</th><th class="num">' + bd(f.away.name) + ' (חוץ)</th><th class="num">סה״כ</th><th class="num">ממוצע ליגה</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}
const oddsCell = (o, real) => o != null ? '<span class="oddsTag' + (real ? '' : ' est') + '"><bdi dir="ltr">' + Number(o).toFixed(2) + '</bdi></span>' : '—';
function historyCard(f) {
  const lines = [['g'], ['c'], ['c1'], ['sh'], ['sot']].map(([s]) => ({ s, r: mainRow(f, s) })).filter(x => x.r);
  if (!lines.length) return '';
  return '<div class="card"><h4>📈 מה קרה העונה</h4><p class="sub2">לכל קו: בכמה ממשחקי הבית של ' + bd(f.home.name) + ', בכמה ממשחקי החוץ של ' + bd(f.away.name) + ' ובכמה מהמפגשים ביניהן הסכום עבר את הקו ("מעל"). ירוק = קורה הרבה. היחס הוא של "מעל" (מסגרת מקווקווה = משוער).</p><div class="tblWrap"><table><thead><tr><th>הימור (מעל)</th><th class="num">יחס</th><th class="num">' + bd(f.home.name) + ' בבית</th><th class="num">' + bd(f.away.name) + ' בחוץ</th><th class="num">ראש בראש</th></tr></thead><tbody>' +
    lines.map(({ s, r }) => '<tr><td>' + STAT[s].icon + ' מעל ' + r.line + ' ' + STAT[s].he + '</td><td class="num">' + oddsCell(r.odds, r.real) + '</td><td class="num">' + heat(r.hv) + '</td><td class="num">' + heat(r.av) + '</td><td class="num">' + heat(r.x) + '</td></tr>').join('') + '</tbody></table></div></div>';
}
function relevantTable(f, side) {
  const T = side === 'h' ? f.home : f.away, sp = T.splits, u = f.matchup && f.matchup[side], venue = side === 'h' ? 'בבית' : 'בחוץ';
  if (!sp) return '';
  const rows = [['all', 'כל משחקי העונה', false], ['role', 'רק משחקי ' + (side === 'h' ? 'בית' : 'חוץ'), true]];
  if (u && u.tier) rows.push(['rel', venue + ' מול קבוצות ' + TIER[u.tier] + ' (כמו המשחק הקרוב)', true]);
  const head1 = '<tr><th rowspan="2"></th><th rowspan="2" class="num">משחקים</th>' + FOCUS.map(s => '<th colspan="2" class="num">' + STAT[s].icon + ' ' + STAT[s].he + '</th>').join('') + '</tr>';
  const head2 = '<tr>' + FOCUS.map(() => '<th class="num" title="מה הקבוצה עושה">בעד</th><th class="num" title="מה היריבות עושות נגדה">נגד</th>').join('') + '</tr>';
  const body = rows.map(([k, label, rel]) => { const x = sp[k]; if (!x) return ''; return '<tr class="' + (rel ? 'isPick' : '') + '"><td>' + esc(label) + '</td><td class="num">' + x.n + '</td>' + FOCUS.map(s => x.n && x.st[s] ? '<td class="num"><b>' + x.st[s][0] + '</b></td><td class="num">' + x.st[s][1] + '</td>' : '<td class="num muted">—</td><td class="num muted">—</td>').join('') + '</tr>'; }).join('');
  const log = (T.log || []).filter(e => e.v === (side === 'h' ? 'H' : 'A'));
  const logTbl = log.length ? '<details class="more" open><summary>כל משחקי ' + (side === 'h' ? 'הבית' : 'החוץ') + ' שלה העונה (' + log.length + ')</summary><div class="tblWrap"><table><thead><tr><th>תאריך</th><th>יריבה</th><th class="num">מקום</th><th class="num">תוצאה</th><th class="num">🚩 קרנות</th><th class="num">🎯 בעיטות</th><th class="num">🥅 למסגרת</th></tr></thead><tbody>' +
    log.map(e => '<tr><td>' + fmtDate(e.ts) + '</td><td>' + bd(e.opp) + '</td><td class="num">' + (e.rank ? e.rank + ' · ' + TIER[e.tier] : '—') + '</td><td class="num"><b>' + e.g[0] + ':' + e.g[1] + '</b></td><td class="num">' + pair(e.c) + '</td><td class="num">' + pair(e.sh) + '</td><td class="num">' + pair(e.sot) + '</td></tr>').join('') + '</tbody></table></div><p class="muted" style="margin:4px 0 0">בכל עמודה: של הקבוצה – של היריבה.</p></details>' : '';
  return '<div class="card"><div class="teamHead"><h4><span class="dot ' + side + '"></span>' + bd(T.name) + ' <span class="muted">(' + venue + ')</span></h4>' + (T.form ? '<div class="formRow" title="תוצאות אחרונות, מהחדשה לישנה. נ = ניצחון, ת = תיקו, ה = הפסד">' + T.form.split('').map(c => '<span class="fc ' + c + '">' + ({ W: 'נ', D: 'ת', L: 'ה' })[c] + '</span>').join('') + '</div>' : '') + '</div>' +
    '<p class="muted" style="margin:0 0 8px">' + (T.rank ? 'מקום ' + T.rank + ' מתוך ' + T.nTeams + ' · ' : '') + (T.role && T.role.n ? venue + ': ' + T.role.w + ' ניצחונות, ' + T.role.d + ' תיקו, ' + T.role.l + ' הפסדים' : '') + '</p>' +
    '<div class="tblWrap"><table><thead>' + head1 + head2 + '</thead><tbody>' + body + '</tbody></table></div>' + logTbl + '</div>';
}
function h2hCard(f) {
  const rv = f.character && f.character.rivalry; if (!rv || !(rv.meetings && rv.meetings.length)) return '';
  const v = (x, i) => (x && x[i] != null) ? x[i] : '-';
  return '<div class="card"><h4>⚔️ מפגשים אחרונים בין הקבוצות' + (rv.derby ? ' — <b>' + esc(rv.derby) + '</b>' : '') + (rv.bogey ? ' — <b>כבשה שחורה</b>' : '') + '</h4><div class="tblWrap"><table><thead><tr><th>תאריך</th><th>אצל</th><th class="num">תוצאה</th><th class="num">🚩 קרנות</th><th class="num">🎯 בעיטות</th><th class="num">🥅 למסגרת</th></tr></thead><tbody>' +
    rv.meetings.slice(0, 5).map(m => '<tr><td>' + fmtDate(m.ts) + '</td><td>' + bd(m.h === 'H' ? f.home.name : f.away.name) + '</td><td class="num"><b>' + v(m.g, 0) + ':' + v(m.g, 1) + '</b></td><td class="num">' + pair(m.c) + '</td><td class="num">' + pair(m.sh) + '</td><td class="num">' + pair(m.sot) + '</td></tr>').join('') +
    '</tbody></table></div><p class="muted" style="margin:6px 0 0">בעמודות: של ' + bd(f.home.name) + ' – של ' + bd(f.away.name) + '. ' + (rv.rec ? bd(f.home.name) + ' מול ' + bd(f.away.name) + ' (' + rv.n + ' מפגשים ב-3 עונות): ' + rv.rec.w + ' ניצחונות, ' + rv.rec.d + ' תיקו, ' + rv.rec.l + ' הפסדים.' : '') + '</p></div>';
}
const NEWS_ICON = { injury: '🤕', suspension: '🟥', lineup: '📋', form: '📈', context: '💬', manager: '👔', other: '•' };
const IMPACT = { high: ['🔴', 'משמעותי'], medium: ['🟠', 'בינוני'], low: ['⚪', 'קל'] };
const srcLink = u => u ? ' <a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" class="src">מקור</a>' : '';
function newsCard(f) {
  const n = f.news, H = f.home, A = f.away;
  if (!n) return '<div class="card newsCard"><h4>📰 פציעות והרכבים</h4><p class="muted" style="margin:0">עוד לא נבדק למשחק הזה. המודל לא מניח היעדרויות, ולכן כדאי לבדוק פציעות והרכבים לפני הימור.</p></div>';
  const who = sd => sd === 'h' ? bd(H.name) : sd === 'a' ? bd(A.name) : 'שתי הקבוצות';
  const order = { high: 0, medium: 1, low: 2 };
  const items = (n.items || []).slice().sort((x, y) => (order[x.impact] != null ? order[x.impact] : 3) - (order[y.impact] != null ? order[y.impact] : 3)).map(i => { const im = IMPACT[i.impact]; return '<li>' + (NEWS_ICON[i.type] || '•') + ' <b>' + who(i.side) + ':</b> ' + esc(i.text) + (im ? ' <span class="imp imp-' + i.impact + '">' + im[0] + ' ' + im[1] + '</span>' : '') + srcLink(i.src) + '</li>'; }).join('');
  const C = n.coach, coach = C ? ['h', 'a'].map(sd => { const x = C[sd], T = sd === 'h' ? H : A; if (!x || !x.name || !x.isNew) return ''; return '<li>👔 <b>' + bd(T.name) + ':</b> מאמן חדש, ' + bd(x.name) + (x.since ? ' (מאז ' + esc(String(x.since)) + ')' : '') + (x.note ? ' — ' + esc(x.note) : '') + srcLink(x.src) + '</li>'; }).join('') : '';
  const L = n.lineups, one = (sd, T) => { const x = L && L[sd]; if (!x || !(x.xi && x.xi.length)) return ''; return '<div class="lineup"><b>' + (x.confirmed ? '✅ הרכב סופי' : '📋 הרכב צפוי') + ' · ' + bd(T.name) + (x.formation ? ' · ' + esc(x.formation) : '') + '</b><div>' + x.xi.map(p => bd(p)).join(' · ') + '</div>' + srcLink(x.src) + '</div>'; };
  const when = n.updated ? ' <span class="muted">· עודכן ' + new Date(n.updated).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short', ...tzOpt }) + '</span>' : '';
  return '<div class="card newsCard"><h4>📰 פציעות והרכבים' + when + '</h4>' + (n.source ? '<p class="muted" style="margin:-4px 0 8px">מקור: ' + esc(n.source) + (n.checked ? ' · נבדק' : '') + '</p>' : '') + (coach ? '<ul class="notes" style="margin-bottom:8px">' + coach + '</ul>' : '') + (items ? '<ul class="notes">' + items + '</ul>' : '<p class="muted" style="margin:0">נבדק ולא נמצאו היעדרויות מהותיות.</p>') + (L ? '<div class="lineups">' + one('h', H) + one('a', A) + '</div>' : '') + (n.uncertain ? '<p class="muted" style="margin:8px 0 0">⚠️ ההרכבים לא סופיים, והדירוג נזהר יותר.</p>' : (n.lineups ? '<p class="muted" style="margin:8px 0 0">✅ ההרכבים סופיים.</p>' : '')) + '</div>';
}
function marketsTable(f) {
  const ms = f.markets.map((m, i) => ({ m, i })).filter(x => x.m.score >= 6);
  return '<div class="tblWrap"><table><thead><tr><th>הימור</th><th class="num">יחס</th><th class="num">בית</th><th class="num">חוץ</th><th class="num">דירוג</th><th class="num">תוצאה</th><th class="num">היחס שלך</th></tr></thead><tbody>' +
    ms.map(({ m, i }) => { const h = m.hist || {}; return '<tr class="' + (f.picks.includes(i) ? 'isPick' : '') + '"><td>' + (f.picks.includes(i) ? '⭐ ' : '') + mIcon(m) + ' ' + esc(m.label) + '</td><td class="num">' + oddsTag(m) + '</td><td class="num">' + heat(h.hv) + '</td><td class="num">' + heat(h.av) + '</td><td class="num"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span></td><td class="num">' + (m.res ? resChip(m) + actSmall(m) : '<span class="muted">—</span>') + '</td>' +
      '<td class="num"><div class="myOdds inline" data-fid="' + esc(f.id) + '" data-mi="' + i + '"><input type="number" step="0.01" min="1.01" inputmode="decimal" placeholder="יחס"><span class="myRes"></span></div></td></tr>'; }).join('') + '</tbody></table></div>';
}
function stakesCard(f) {
  const c = f.ctx; if (!c) return '';
  const rows = [];
  for (const [side, T] of [['h', f.home], ['a', f.away]]) {
    const s = c.stakes && c.stakes[side], r = c.rest && c.rest[side];
    if (!s && !r) continue;
    rows.push('<li><b>' + bd(T.name) + ':</b> ' + (s ? esc(s.text) + ' <span class="muted">(' + s.pts + ' נקודות אחרי ' + s.played + ' משחקים)</span>' : '') + (r ? (s ? ' · ' : '') + (r.days <= 3 ? '⚠️ ' : '') + r.days + ' ימי מנוחה' + (r.last14 >= 3 ? ', ' + r.last14 + ' משחקים ב-14 ימים' : '') : '') + '</li>');
  }
  if (!rows.length) return '';
  const tn = c.tension === 'high' ? 'שתי הקבוצות עם הרבה על הכף: משחק רציני משני הצדדים.' : c.tension === 'low' ? 'לשתי הקבוצות אין הרבה על הכף: סיכוי לרוטציה ולמשחק פחות לוחץ.' : '';
  return '<div class="card"><h4>🎯 מה על הכף ואיך הן מגיעות</h4><ul class="notes">' + rows.join('') + '</ul>' + (tn ? '<p class="muted" style="margin:6px 0 0">' + tn + '</p>' : '') + '</div>';
}
function renderMatch(i) {
  const f = state.day.fixtures[i], lg = leagueOf(f.lg), ch = f.character || {};
  let html = '<div class="mbar"><button class="btn" onclick="goTab(state.tab)">← חזרה</button><span class="muted">' + esc(lg.he) + (heRound(f.round) ? ' · ' + heRound(f.round) : '') + '</span></div>' +
    '<div class="mhero"><div class="teamsRow">' + teamsRow(f) + '</div><div class="meta"><span>' + fmtDate(f.ts) + ' · ' + fmtTime(f.ts) + '</span>' + (ch.label ? '<span class="tag">' + esc(ch.label) + '</span>' : '') + '<span>ביטחון בנתונים: ' + conf(f.conf) + '</span></div>' +
    (f.result ? '<div class="finalLine"><b>תוצאת סיום:</b> ' + bd(f.home.name) + ' ' + f.result.g[0] + ':' + f.result.g[1] + ' ' + bd(f.away.name) + ' · <b>בפועל:</b> ' + f.result.g[0] + ':' + f.result.g[1] + ' · קרנות ' + f.result.h + '–' + f.result.a + (f.result.stats && f.result.stats.sh && f.result.stats.sh[0] != null ? ' · בעיטות ' + f.result.stats.sh.join('–') : '') + (f.result.stats && f.result.stats.sot && f.result.stats.sot[0] != null ? ' · למסגרת ' + f.result.stats.sot.join('–') : '') + '</div>' : '') + '</div>';
  if (!f.enough) {
    if (f.cup) { const pk = f.picks.map(k => f.markets[k]), C = f.cup;
      html += '<div class="card" style="border-color:var(--warn)"><b>🏆 משחק גביע: קבוצה מקצועית מול קבוצה קטנה</b><p class="muted" style="margin:4px 0 0">אין לנו נתונים על ' + (f.missing || []).map(bd).join(', ') + ', ולכן אין מודל קבוצתי. הניתוח כאן מבוסס על ' + C.n + ' משחקי גביע קודמים של קבוצות מקצועיות מול קבוצות מהליגות הנמוכות (בממוצע הקבוצה המקצועית כובשת ' + C.proMean + ' והקטנה ' + C.oppMean + '), ומותאם ליחסי Bet365 של המשחק עצמו. הביטחון נמוך יותר מבמשחק ליגה.</p></div>' +
        '<div class="card"><h4>⭐ ההמלצות למשחק</h4>' + (pk.length ? '<div class="recs">' + pk.map(m => recRow(m, f)).join('') + '</div>' : '<p class="muted" style="margin:0">אין המלצה חזקה במשחק הזה.</p>') + '</div>' +
        (f.markets.length > pk.length ? '<div class="card more"><h4>📋 עוד הימורים שנבדקו</h4><div class="tblWrap"><table><thead><tr><th>הימור</th><th class="num">יחס</th><th class="num">דירוג</th></tr></thead><tbody>' + f.markets.map((m, i) => f.picks.includes(i) ? '' : '<tr><td>' + esc(m.label) + '</td><td class="num">' + oddsTag(m) + '</td><td class="num"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span></td></tr>').join('') + '</tbody></table></div></div>' : '');
    }
    else html += '<div class="card"><p style="margin:0">' + ((f.missing && f.missing.length) ? 'אין לנו נתוני סטטיסטיקה על ' + f.missing.map(bd).join(', ') + ' (הקבוצה לא משחקת באחת הליגות שבמעקב), ולכן אין המלצות למשחק הזה.' : 'אין עדיין מספיק משחקים במאגר לקבוצות האלה, ולכן אין המלצות. המאגר מתמלא יום אחרי יום.') + '</p></div>' + newsCard(f);
    if (f.mread) { const M = f.mread, o = M.odds, p = M.p, fav = o ? (p.h >= p.a ? 'h' : 'a') : null, rows = [];
      const row = (ic, q, ans, sub) => '<div class="mrow"><span class="mq">' + ic + ' ' + q + '</span><span class="ma">' + ans + (sub ? ' <small class="muted">' + sub + '</small>' : '') + '</span></div>';
      if (o) rows.push(row('🏁', 'מי תנצח?', bd(fav === 'h' ? f.home.name : f.away.name), 'יחס ' + (fav === 'h' ? o.h : o.a)));
      if (M.goals) rows.push(row('⚽', 'כמה שערים?', 'כ-' + (M.goals.line + (M.goals.pOver - 0.5) * 2).toFixed(1), 'קו ' + M.goals.line));
      if (M.corners) rows.push(row('🚩', 'כמה קרנות?', 'כ-' + (M.corners.line + (M.corners.pOver - 0.5) * 2).toFixed(1), 'קו ' + M.corners.line));
      html += '<div class="card"><h4>📊 מה השוק (Bet365) מצפה</h4>' + rows.join('') + '<p class="muted" style="margin:8px 0 0">זו ההערכה של Bet365, לא שלנו.</p></div>'; }
    $('#view-match').innerHTML = html; return;
  }
  const picks = f.picks.map(k => f.markets[k]), exStart = html.length;
  if (f.expert) html += '<div class="card expertCard"><h4>🧠 הדעה שלנו על המשחק' + (f.expert.head ? ' — ' + esc(f.expert.head) : '') + '</h4>' + f.expert.take.map(p => '<p>' + esc(p) + '</p>').join('') + '<p class="muted" style="margin:8px 0 0;font-size:12px">נכתב אחרי קריאה של כל משחקי העונה של שתי הקבוצות: בית וחוץ, מול גדולות וקטנות ומול קבוצות שמתבצרות.</p></div>';
  html += f.story && f.story.length ? '<div class="card storyCard"><h4>📖 איך המשחק הזה נראה</h4>' + f.story.map(p => '<p>' + esc(p) + '</p>').join('') + '</div>' + (!f.expert && f.opinion && f.opinion.length ? '<div class="card opinionCard"><h4>🧠 המחשבה שלנו</h4>' + f.opinion.map(p => '<p>' + esc(p) + '</p>').join('') + '</div>' : '') : '<div class="card"><h4>🔎 מי נגד מי</h4><ul class="notes"><li>' + matchupLine(f, 'h') + '</li><li>' + matchupLine(f, 'a') + '</li></ul></div>';
  const exEnd = html.length;
  html += '<div class="card"><h4>⭐ ההמלצות למשחק</h4>' + (picks.length ? '<div class="recs">' + picks.map(m => recRow(m, f)).join('') + '</div>' : '<p class="muted" style="margin:0">אין המלצה חזקה במשחק הזה.</p>') + '</div>';
  html = html.slice(0, exStart) + html.slice(exEnd) + html.slice(exStart, exEnd);   // ההמלצות קודם, ואחריהן הדעה והסיפור
  html += stakesCard(f) + winnerCard(f) + newsCard(f);
  html += '<div class="card more"><h4>📋 ההימורים החזקים במשחק (ציון 6 ומעלה)</h4><p class="sub2">"בית" ו"חוץ" = בכמה ממשחקי הבית של המארחת ובכמה ממשחקי החוץ של האורחת ההימור עבר. אפשר להקליד יחס מאתר ההימורים ולקבל דירוג מיידי.</p>' + marketsTable(f) + '</div>';
  const scout = f.scout && f.scout.lines && f.scout.lines.length ? '<div class="card scoutCard"><h4>🧭 איך הן משחקות בבית, בחוץ ומול סוג כזה של יריבה</h4><ul class="notes">' + f.scout.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul></div>' : '';
  html += '<details class="more bigMore"><summary><b>עוד נתונים על המשחק</b> (צפי, היסטוריה, בית וחוץ, ראש בראש)</summary>' + scout + expectCard(f) + historyCard(f) + '<div class="grid2">' + relevantTable(f, 'h') + relevantTable(f, 'a') + '</div>' + h2hCard(f) + '</details>';
  $('#view-match').innerHTML = html;
  bindMyOdds($('#view-match'));
}

// ---- מחשבון יחס ----
function scoreWith(m, odds, conf) {
  const p = m.pFinal, push = m.push || 0, ev = p * (1 - push) * (odds - 1) - (1 - p) * (1 - push);
  let base = 3.5 + 35 * Math.min(ev, 0.15);
  if (p >= 0.55) base += 1; if (p >= 0.65) base += 0.5; if (p < 0.4) base -= 1; if (p < 0.3) base -= 1.5;
  if (m.pMarket != null) { const d = Math.abs(m.pModel - m.pMarket); if (d > 0.15) base -= (d - 0.15) * 15; }
  return { ev, score: Math.min(10, Math.max(1, Math.round(1 + (base - 1) * (0.55 + 0.45 * conf)))) };
}
const oddsMemo = {};
function bindMyOdds(root) {
  root.querySelectorAll('.myOdds').forEach(box => {
    const inp = box.querySelector('input'), out = box.querySelector('.myRes'), key = box.dataset.fid + ':' + box.dataset.mi;
    const calc = () => {
      const o = parseFloat(inp.value); oddsMemo[key] = inp.value;
      if (!(o > 1)) { out.innerHTML = ''; return; }
      const f = findFx(box.dataset.fid), m = f.markets[+box.dataset.mi], r = scoreWith(m, o, f.conf);
      out.innerHTML = '<span class="score ' + scoreCls(r.score) + '">' + r.score + '</span> <span class="' + (r.ev >= 0.03 ? 'pos' : 'neg') + '">' + (r.ev >= 0.03 ? '✅ שווה' : '❌ לא שווה') + '</span>';
    };
    if (oddsMemo[key]) { inp.value = oddsMemo[key]; calc(); }
    inp.oninput = calc;
  });
}

// ================= טבלאות ליגה =================
const tState = { lg: null };
async function renderTables() {
  const el = $('#view-tables');
  if (!state.stats) {
    el.innerHTML = '<div class="empty">טוען...</div>';
    try { state.stats = await getJson('data/stats.json'); } catch (e) { el.innerHTML = '<div class="empty">אין עדיין טבלאות.</div>'; return; }
  }
  const tabs = state.stats.tables || {};
  const lgs = state.day.leagues.filter(l => tabs[l.id] && tabs[l.id].length);
  if (!lgs.length) { el.innerHTML = '<h2>📋 טבלאות</h2><div class="empty">אין עדיין טבלאות.</div>'; return; }
  if (!tState.lg || !tabs[tState.lg]) tState.lg = String((lgs.find(l => l.id === 39) || lgs[0]).id);
  const rows = tabs[tState.lg], n = rows.length, k = Math.ceil(n / 3);
  const teamStats = {}; ((state.stats.leagues[tState.lg] || {}).teams || []).forEach(t => teamStats[t.name] = t);
  const avg = (name, st) => { const t = teamStats[name]; return t && t.all && t.all.st && t.all.st[st] ? t.all.st[st][0] : '—'; };
  const sel = lgs.map(l => '<option value="' + l.id + '"' + (String(l.id) === tState.lg ? ' selected' : '') + '>' + esc(l.he) + '</option>').join('');
  el.innerHTML = lnav('tables') + '<h2>📋 טבלאות ליגה</h2><p class="lead">מקום, מאזן וכושר אחרון. שליש עליון = גדולות, שליש תחתון = קטנות.</p>' +
    '<div class="filters"><select id="tLg">' + sel + '</select></div><div class="card"><div class="tblWrap"><table class="stTable"><thead><tr><th class="num">#</th><th>קבוצה</th><th class="num">מש׳</th><th class="num">נ</th><th class="num">ת</th><th class="num">ה</th><th class="num">שערים</th><th class="num">נק׳</th><th class="num">כושר</th><th class="num" title="קרנות למשחק (של הקבוצה)">🚩</th><th class="num" title="בעיטות למשחק (של הקבוצה)">🎯</th><th class="num" title="בעיטות למסגרת למשחק (של הקבוצה)">🥅</th></tr></thead><tbody>' +
    rows.map(r => '<tr class="' + (r.rank <= k ? 'tTop' : r.rank > n - k ? 'tBot' : '') + '"><td class="num"><b>' + r.rank + '</b></td><td><bdi>' + esc(r.name) + '</bdi>' + (r.grp ? ' <span class="muted">' + esc(r.grp) + '</span>' : '') + '</td><td class="num">' + r.p + '</td><td class="num">' + r.w + '</td><td class="num">' + r.d + '</td><td class="num">' + r.l + '</td><td class="num"><bdi dir="ltr">' + r.gf + '-' + r.ga + '</bdi></td><td class="num"><b>' + r.pts + '</b></td><td class="num"><div class="formRow" style="justify-content:center">' + String(r.form || '').split('').map(c => '<span class="fc ' + c + '">' + ({ W: 'נ', D: 'ת', L: 'ה' })[c] + '</span>').join('') + '</div></td><td class="num">' + avg(r.name, 'c') + '</td><td class="num">' + avg(r.name, 'sh') + '</td><td class="num">' + avg(r.name, 'sot') + '</td></tr>').join('') + '</tbody></table></div><p class="muted" style="margin:8px 0 0">כושר: 5 המשחקים האחרונים, מהישן לחדש (הימני = הישן). נ = ניצחון, ת = תיקו, ה = הפסד. הטבלה מחושבת ממשחקי העונה שבמאגר.</p></div>';
  $('#tLg').onchange = e => { tState.lg = e.target.value; renderTables(); };
}


// ================= כדורסל =================
const bb = { idx: null, day: null, date: null, sub: 'today', teams: null, comp: '103', tid: null, tday: 'all' };
const BB_RES = { win: ['נתפס ✅', 'win'], lose: ['נפל ❌', 'lose'], push: ['החזר ↩', 'push'] };
const bbNm = (g, side) => (side === 'h' ? g.home : g.away).name;
const bbResStrip = (g, m) => !m || !m.res ? '' : '<div class="resStrip ' + BB_RES[m.res][1] + '"><b>' + BB_RES[m.res][0] + '</b>' + (m.actT ? ' · ' + esc(m.actT) : '') + '</div>';
const bbFold = m => m.checks && m.checks.length ? '<details class="chkFold"><summary>למה ההימור הזה? (' + m.checks.length + ')</summary>' + bbChecks(m) + '</details>' : '';
const bbChecks = m => m.checks && m.checks.length ? '<div class="checks">' + m.checks.map(c => '<span class="chk ' + c.k + '">' + (c.k === 'ok' ? '✓ ' : '⚠ ') + esc(c.t) + '</span>').join('') + '</div>' : '';
const bbOdds = m => '<span class="oddsTag">Bet365 ' + m.odds.toFixed(2) + '</span>';
const bbComp = c => c === 103 ? 'NBA' : 'יורוליג';
async function bbLoad(date) {
  if (!bb.idx) { try { bb.idx = await getJson('data/bball/index.json'); } catch (e) { bb.idx = { days: [], picksLog: [] }; } }
  const days = bb.idx.days.filter(d => d.games);
  if (!date) date = (state.day && days.find(d => d.date === state.day.date) ? state.day.date : null) || bb.date || (state.defDate && days.find(d => d.date === state.defDate) ? state.defDate : (days[0] && days[0].date));
  if (date && bb.date !== date) { bb.date = date; try { bb.day = await getJson('data/bball/' + date + '.json'); } catch (e) { bb.day = null; } }
  return bb.day;
}
function bbDayChips() {
  const days = bb.idx.days.filter(d => d.games), log = bb.idx.picksLog || [];
  if (days.length < 2) return '';
  return '<div class="dayStrip"><span class="muted">בחרו יום:</span><div class="chips">' + days.map(d => { const L = log.filter(e => e.d === d.date), w = L.filter(e => e.res === 'win').length, n = L.filter(e => e.res).length; return '<button class="chip dchip' + (d.date === bb.date ? ' on' : '') + '" data-bbday="' + d.date + '"><b>' + fmtShort(d.date) + '</b>' + (n ? '<small>המלצות ' + w + ' מתוך ' + n + '</small>' : '') + '</button>'; }).join('') + '</div></div>';
}
function bbSlipFallback(date, S) {
  const d = S && S.days.find(x => x.date === date), out = [];
  if (d && d.k) for (const [sp, nm] of [['n', 'NBA'], ['e', 'יורוליג']]) for (const [t, tt] of [['strong', 'הטופס החזק'], ['second', 'טופס שני']]) { const x = d.k[t] && d.k[t][sp]; if (x && x.legs && x.legs.length) out.push(slipCardHtml(d, x, nm + ': ' + tt, 'יחס ' + x.total, 'k')); }
  return out.length ? '<p class="sub2">ההימורים של היום, לפי היחסים והקווים באתר ההימורים:</p><div class="cards">' + out.join('') + '</div>' : '<div class="empty">אין היום המלצות כדורסל שעוברות את הרף. אפשר לראות את כל המשחקים.</div>';
}
async function renderBB() {
  const el = $('#view-bball'); el.innerHTML = '<div class="empty">טוען...</div>';
  const day = await bbLoad();
  const subs = [['today', '🏆 המלצות'], ['games', '🏀 כל המשחקים'], ['teams', '🧠 קבוצות'], ['track', '📊 מעקב']];
  let html = '<h2>🏀 כדורסל: NBA ויורוליג</h2><p class="lead">צפי נקודות, המלצות ויחסי Bet365 אמיתיים לכל משחק. הצפי משלב את המודל שלנו עם קווי Bet365.</p>' +
    '<div class="chips subnav">' + subs.map(([k, l]) => '<button class="chip' + (bb.sub === k ? ' on' : '') + '" data-bbsub="' + k + '">' + l + '</button>').join('') + '</div>';
  if (bb.sub === 'teams') html += await bbTeamsHtml();
  else if (bb.sub === 'track') html += bbTrackHtml();
  else if (!day) html += '<div class="empty">אין עדיין משחקי כדורסל להיום.</div>';
  else {
    html += bbDayChips();
    if (bb.sub === 'today') {
      const hlStart = html.length, hl = [];
      for (const g of day.fixtures) if (g.players && !g.result) for (const sd of ['h', 'a']) for (const p of g.players[sd] || []) if (!p.ques && p.min >= 22 && Math.abs(p.z) >= 0.4 && p.pts.sd) hl.push({ g, p, sd, w: Math.abs(p.z) * Math.sqrt(p.min / 30) });
      hl.sort((x, y) => y.w - x.w);
      html += hl.length ? '<div class="card plCard"><h4>👤 שחקנים בולטים: צפי נקודות שונה מהממוצע</h4><p class="sub2">שחקנים שההקשר של המשחק (קצב, חיסורי חברים, בית/חוץ, כושר) מזיז אותם משמעותית מהממוצע העונתי. אין קווי Bet365 לשחקנים: אובר משתלם בכל קו עד הקו המצוין. בדקו את הקו באתר ההימורים.</p><div class="recs">' + hl.slice(0, 8).map(({ g, p, sd }) => '<div class="rec" style="cursor:pointer" onclick="location.hash=\'bb-' + g.id + '\'"><span class="score ' + (p.z > 0 ? 's-hi' : 's-mid') + '">' + (p.z > 0 ? '⬆' : '⬇') + '</span><div><div class="rtitle">' + bd(p.name) + ' · ' + bd(sd === 'h' ? g.home.name : g.away.name) + '</div><div class="rwhy">צפי ' + p.pts.p + ' נקודות (ממוצע ' + p.pts.season + ') · ' + (p.z > 0 ? 'אובר משתלם עד קו ' + (p.pts.over != null ? p.pts.over : '—') : 'אנדר משתלם מקו ' + p.pts.under) + ' · ' + fmtTime(g.ts) + '</div>' + (p.why && p.why.length ? '<div class="plWhy">' + esc(p.why[0]) + '</div>' : '') + '</div></div>').join('') + '</div></div>' : '';
      const hlEnd = html.length;
      const picks = (day.dayPicks || []).map(p => { const g = day.fixtures.find(x => x.id === p.fid); return g && g.markets[p.mi] ? { g, m: g.markets[p.mi] } : null; }).filter(Boolean);
      html += picks.length ? '<div class="cards">' + picks.map(({ g, m }, i) => '<article class="pcard ' + scoreCls(m.score) + (m.res ? ' fin-' + BB_RES[m.res][1] : '') + '" onclick="location.hash=\'bb-' + g.id + '\'"><div class="ptop"><span class="rank">' + (i + 1) + '</span><div class="pmain"><div class="plabel">' + esc(m.label) + '</div><div class="pmeta">' + bd(bbNm(g, 'h')) + ' – ' + bd(bbNm(g, 'a')) + ' · ' + bbComp(g.comp) + ' · ' + fmtTime(g.ts) + '</div></div><div class="pside"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span><span class="pill ' + scoreCls(m.score) + '">' + scoreWord(m.score) + '</span></div></div>' + bbResStrip(g, m) + (g.expert && g.expert.head ? '<div class="pexp">🧠 ' + esc(g.expert.head) + '</div>' : '') + bbFold(m) + '<div class="pfoot">' + bbOdds(m) + '<span class="go">כל ההמלצות והניתוח של המשחק ←</span></div></article>').join('') + '</div>' : bbSlipFallback(day.date, (await loadSlips()));
      html = html.slice(0, hlStart) + html.slice(hlEnd) + html.slice(hlStart, hlEnd);   // קודם ההמלצות, ואחריהן השחקנים הבולטים
    } else {
      html += '<div class="kgrid">' + day.fixtures.map(g => { const e = g.exp, o = g.odds || {}; return '<div class="kcard" onclick="location.hash=\'bb-' + g.id + '\'"><div class="kt">' + bd(bbNm(g, 'h')) + ' <span class="muted">–</span> ' + bd(bbNm(g, 'a')) + '</div><div class="muted">' + bbComp(g.comp) + ' · ' + fmtTime(g.ts) + (g.result ? ' · <b>' + g.result.g[0] + ':' + g.result.g[1] + '</b>' : '') + '</div>' + (o.ml ? '<div class="oddsRow mini"><div class="oddsBox h"><span>בית</span><b>' + o.ml.h + '</b></div><div class="oddsBox a"><span>חוץ</span><b>' + o.ml.a + '</b></div></div>' : '') + (g.enough ? '<div class="muted">צפי: ' + Math.round(e.h) + '–' + Math.round(e.a) + ' · סה״כ ' + Math.round(e.total) + (o.total ? ' (קו ' + o.total.line + ')' : '') + '</div>' : '') + '</div>'; }).join('') + '</div>';
    }
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-bbsub]').forEach(b => b.onclick = () => { bb.sub = b.dataset.bbsub; renderBB(); });
  el.querySelectorAll('[data-bbday]').forEach(b => b.onclick = async () => { await bbLoad(b.dataset.bbday); renderBB(); });
  el.querySelectorAll('[data-bbcomp]').forEach(b => b.onclick = () => { bb.comp = b.dataset.bbcomp; bb.tid = null; renderBB(); });
  el.querySelectorAll('[data-bbtid]').forEach(b => b.onclick = () => { bb.tid = b.dataset.bbtid; renderBB(); window.scrollTo(0, 0); });
  el.querySelectorAll('[data-bbback]').forEach(b => b.onclick = () => { bb.tid = null; renderBB(); });
  el.querySelectorAll('[data-bbtd]').forEach(b => b.onclick = () => { bb.tday = b.dataset.bbtd; renderBB(); });
}
async function bbTeamsHtml() {
  if (!bb.teams) { try { bb.teams = await getJson('data/bball/teams.json'); } catch (e) { return '<div class="empty">אין עדיין פרופילי קבוצות.</div>'; } }
  const C = bb.teams.comps, comps = Object.keys(C);
  if (!C[bb.comp]) bb.comp = comps[0];
  const chips = '<div class="chips" style="margin-bottom:10px">' + comps.map(c => '<button class="chip' + (c === bb.comp ? ' on' : '') + '" data-bbcomp="' + c + '">' + esc(C[c].he) + '</button>').join('') + '</div>';
  const P = C[bb.comp].profile, prof = !bb.tid && P ? '<div class="card lgCard"><h4>🌍 אופי הליגה</h4><div class="lgGrid"><div class="lgCell"><b>' + P.total + '</b><span>נקודות במשחק</span></div><div class="lgCell"><b>' + P.adv + '</b><span>יתרון בית (נק׳)</span></div><div class="lgCell"><b>' + (P.homeW / 10).toFixed(1) + '</b><span>ניצחונות בית מכל 10</span></div></div><ul class="notes">' + P.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul><p class="muted" style="margin:6px 0 0">מבוסס על ' + P.n + ' משחקי העונה.</p></div>' : '';
  const list = C[bb.comp].teams;
  if (bb.tid) {
    const T = list.find(t => String(t.id) === String(bb.tid));
    if (T) {
      const row = (l, b) => b && b.n ? '<tr><td>' + l + '</td><td class="num">' + b.n + '</td><td class="num">' + b.w + '-' + (b.n - b.w) + '</td><td class="num"><bdi dir="ltr">' + b.ppg + ':' + b.opp + '</bdi></td></tr>' : '';
      return chips + '<button class="btn" data-bbback="1">← כל הקבוצות</button><div class="mhero" style="margin-top:10px"><div class="teamsRow"><b>' + bd(T.name) + '</b></div><div class="meta"><span>מקום ' + (T.rank || '–') + ' מתוך ' + (T.nTeams || '–') + '</span><span>' + T.w + '-' + T.l + '</span><span class="archChip a-' + (T.arch === 'elite' ? 'strong' : T.arch === 'offense' ? 'open' : T.arch === 'defense' ? 'compact' : T.arch === 'weak' ? 'weak' : 'dominant') + '">' + esc(T.archHe) + '</span></div><div>' + esc(T.archShort) + '. ' + T.ppg + ' נקודות קלועות ו-' + T.opp + ' סופגות למשחק (הפרש ' + (T.net > 0 ? '+' : '') + T.net + ').</div></div>' +
        '<div class="card"><h4>📌 מה אנחנו יודעים עליה</h4>' + (T.lines.length ? '<ul class="notes">' + T.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '<p class="muted" style="margin:0">אין עדיין מספיק משחקים.</p>') + '</div>' +
        '' +
        '<div class="card"><h4>⭐ שחקני הליבה' + (T.coach ? ' <span class="muted">· מאמן: ' + esc(T.coach.name) + (T.coach.isNew ? ' (חדש)' : '') + '</span>' : '') + '</h4>' + ((T.core || []).length ? '<div class="tblWrap"><table><thead><tr><th>שחקן</th><th class="num">דק׳</th><th class="num">נק׳</th><th class="num">ריב׳</th><th class="num">אס׳</th></tr></thead><tbody>' + T.core.map(p => '<tr><td><b>' + bd(p.name) + '</b></td><td class="num">' + p.min + '</td><td class="num">' + p.pts + '</td><td class="num">' + p.reb + '</td><td class="num">' + p.ast + '</td></tr>').join('') + '</tbody></table></div><p class="muted" style="margin:6px 0 0">ממוצעים ב-15 המשחקים האחרונים.</p>' : '<p class="muted" style="margin:0">אין עדיין מספיק נתוני שחקנים.</p>') + '</div>' + '<div class="card"><h4>🔀 איך היא משחקת בכל מצב</h4><div class="tblWrap"><table><thead><tr><th></th><th class="num">מש׳</th><th class="num">נ-ה</th><th class="num">נקודות (בעד:נגד)</th></tr></thead><tbody>' + row('בבית', T.home) + row('בחוץ', T.away) + row('מול קבוצות גדולות', T.top) + row('מול בינוניות', T.mid) + row('מול קטנות', T.bot) + '</tbody></table></div></div>' +
        '<div class="card"><h4>🗓 המשחקים האחרונים</h4><div class="tblWrap"><table><thead><tr><th>תאריך</th><th>יריבה</th><th class="num">תוצאה</th></tr></thead><tbody>' + T.last.map(e => '<tr><td>' + fmtShort(new Date(e.ts * 1000).toISOString().slice(0, 10)) + '</td><td>' + (e.v === 'H' ? '🏠 ' : '✈️ ') + bd(e.opp) + '</td><td class="num"><bdi dir="ltr">' + e.pf + ':' + e.pa + '</bdi> ' + (e.pf > e.pa ? '<span class="pos">נ</span>' : '<span class="neg">ה</span>') + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
  }
  return chips + prof + '<div class="tmGrid">' + list.map(t => '<div class="tmCard" data-bbtid="' + t.id + '"><div class="tmTop"><span class="rank">' + (t.rank || '–') + '</span><b>' + bd(t.name) + '</b></div><div class="archChip a-' + (t.arch === 'elite' ? 'strong' : t.arch === 'offense' ? 'open' : t.arch === 'defense' ? 'compact' : t.arch === 'weak' ? 'weak' : 'dominant') + '">' + esc(t.archHe) + '</div><div class="muted">' + t.w + '-' + t.l + ' · ' + t.ppg + ':' + t.opp + '</div><div class="formRow">' + String(t.form || '').split('').map(c => '<span class="fc ' + (c === 'W' ? 'W' : 'L') + '">' + (c === 'W' ? 'נ' : 'ה') + '</span>').join('') + '</div></div>').join('') + '</div>';
}
function bbTrackHtml() {
  const log = (bb.idx.picksLog || []).slice().sort((a, b) => b.ts - a.ts), done = log.filter(e => e.res), w = done.filter(e => e.res === 'win').length, l = done.filter(e => e.res === 'lose').length;
  const pa = bb.idx.playerAcc, paHtml = pa ? '<div class="card"><b>👤 דיוק תחזיות השחקנים:</b> על ' + pa.n + ' הופעות, הטעות הממוצעת בנקודות היא ' + pa.mae + ' (לעומת ' + pa.maeNaive + ' אם מנחשים את הממוצע העונתי), בריבאונדים ' + pa.maeReb + ' (מול ' + pa.maeRebNaive + ') ובאסיסטים ' + pa.maeAst + ' (מול ' + pa.maeAstNaive + ').</div>' : '';
  if (!log.length) return paHtml + '<div class="empty">עדיין אין המלצות כדורסל במעקב.</div>';
  const days = [...new Set(log.map(e => e.d))].sort().reverse(), base = log.filter(e => bb.tday === 'all' || e.d === bb.tday);
  return paHtml + '<div class="kpis"><div class="kpi"><b>' + log.length + '</b><span>המלצות</span></div><div class="kpi"><b class="pos">' + w + '</b><span>נתפסו ✅</span></div><div class="kpi"><b class="neg">' + l + '</b><span>נפלו ❌</span></div><div class="kpi"><b>' + (w + l ? w + ' מתוך ' + (w + l) : '—') + '</b><span>נתפסו</span></div></div>' +
    '<div class="card"><div class="chips" style="margin-bottom:8px"><button class="chip' + (bb.tday === 'all' ? ' on' : '') + '" data-bbtd="all">כל הימים</button>' + days.map(d => '<button class="chip' + (bb.tday === d ? ' on' : '') + '" data-bbtd="' + d + '">' + fmtShort(d) + '</button>').join('') + '</div><div class="tblWrap"><table><thead><tr><th>יום</th><th>משחק</th><th>המלצה</th><th class="num">דירוג</th><th class="num">יחס</th><th class="num">מצב</th><th>מה קרה</th></tr></thead><tbody>' +
    base.map(e => '<tr class="clk" onclick="location.hash=\'bb-' + e.id + '\'"><td>' + fmtShort(e.d) + '</td><td>' + bd(e.h) + ' – ' + bd(e.a) + '</td><td>' + esc(e.label) + '</td><td class="num"><span class="score ' + scoreCls(e.score) + '">' + e.score + '</span></td><td class="num">' + e.price.toFixed(2) + '</td><td class="num">' + (e.res ? '<span class="res ' + BB_RES[e.res][1] + '">' + BB_RES[e.res][0] + '</span>' : '⏳') + '</td><td>' + esc(e.act || '') + '</td></tr>').join('') + '</tbody></table></div></div>';
}
function bbPlayersHtml(g) {
  if (!g.players || (!g.players.h.length && !g.players.a.length)) return '';
  const one = (T, list) => '<div class="card"><h4>👤 ' + bd(T.name) + '</h4><div class="tblWrap"><table class="plTable"><thead><tr><th>שחקן</th><th class="num">דק׳</th><th class="num">נקודות: צפי</th><th class="num">ממוצע · 5 אחרונים</th><th class="num">אובר עד קו</th><th class="num">אנדר מקו</th><th class="num">ריבאונדים</th><th class="num">אסיסטים</th></tr></thead><tbody>' +
    list.map(p => '<tr><td><b>' + bd(p.name) + '</b>' + (p.ques ? ' <span class="chk bad">בספק</span>' : '') + (p.act && p.act.min ? ' <span class="muted">(בפועל ' + p.act.pts + ')</span>' : '') + (p.why && p.why.length ? '<div class="plWhy">' + p.why.map(w => esc(w)).join(' · ') + '</div>' : '') + '</td><td class="num">' + p.min + '</td><td class="num"><b>' + p.pts.p + '</b></td><td class="num">' + p.pts.season + ' · ' + p.pts.l5 + '</td><td class="num">' + (p.pts.over != null ? p.pts.over : '—') + '</td><td class="num">' + p.pts.under + '</td><td class="num">' + p.reb.p + ' <span class="muted">(' + (p.reb.over != null ? p.reb.over : '—') + '/' + p.reb.under + ')</span></td><td class="num">' + p.ast.p + ' <span class="muted">(' + (p.ast.over != null ? p.ast.over : '—') + '/' + p.ast.under + ')</span></td></tr>').join('') + '</tbody></table></div></div>';
  return '<div class="card plCard"><h4>👤 שחקנים: צפי וקווי איזון</h4><p class="sub2">הצפי לכל שחקן מתחשב בסוג המשחק (קצב וסך נקודות צפוי), בפער הצפוי (סיכון לפחות דקות), ביום שני ברצף, ובחיסורי חברים לקבוצה (שימוש גבוה יותר). <b>אין קווי Bet365 לשחקנים באף מקור חינמי</b>, ולכן מוצגים קווי איזון: <b>אובר משתלם בכל קו עד "אובר עד קו"</b>, ו<b>אנדר משתלם בכל קו מ"אנדר מקו"</b>. בדקו את הקו האמיתי באתר ההימורים. <b>זהירות:</b> נקודות של שחקן רועשות מאוד (בבדיקה על משחקי עבר הטעות הממוצעת היא כ-4.8 נקודות, ושיטת התחזית שלנו רק מעט טובה יותר מממוצע העונה), ולכן אלה כיוונים לפי ההקשר ולא ודאות. בסוגריים: קווי איזון לריבאונדים ולאסיסטים (אובר עד / אנדר מ).</p></div><div class="grid2">' + one(g.home, g.players.h) + one(g.away, g.players.a) + '</div>';
}
async function renderBBGame(id) {
  await bbLoad();
  let g = bb.day && bb.day.fixtures.find(x => x.id === id);
  if (!g) { // משחק מיום אחר: מחפשים ביומן ההמלצות
    const e = (bb.idx.picksLog || []).find(x => x.id === id); if (e) { await bbLoad(e.d); g = bb.day && bb.day.fixtures.find(x => x.id === id); }
  }
  const el = $('#view-match');
  if (!g) { el.innerHTML = '<div class="mbar"><button class="btn" onclick="goTab(\'bball\')">← חזרה</button></div><div class="empty">המשחק לא נמצא.</div>'; return; }
  const H = g.home, A = g.away, e = g.exp, o = g.odds || {};
  const prof = (T, side) => T.lines ? '<div class="card"><h4>' + (side === 'h' ? '🏠' : '✈️') + ' ' + bd(T.name) + ': ' + esc(T.archHe) + '</h4><p class="muted" style="margin:0 0 6px">' + T.w + '-' + T.l + ' · ' + T.ppg + ' קלועות, ' + T.opp + ' סופגות למשחק</p><ul class="notes">' + T.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul></div>' : '';
  let html = '<div class="mbar"><button class="btn" onclick="goTab(\'bball\')">← חזרה</button><span class="muted">' + bbComp(g.comp) + '</span></div><div class="mhero"><div class="teamsRow"><b>' + bd(H.name) + '</b> <span class="muted">–</span> <b>' + bd(A.name) + '</b></div><div class="meta"><span>' + fmtDate(g.ts) + ' · ' + fmtTime(g.ts) + '</span><span>ביטחון בנתונים: ' + conf(g.conf) + '</span></div>' + (g.result ? '<div class="finalLine"><b>תוצאת סיום:</b> ' + bd(H.name) + ' ' + g.result.g[0] + ':' + g.result.g[1] + ' ' + bd(A.name) + ' · סה״כ ' + (g.result.g[0] + g.result.g[1]) + '</div>' : '') + '</div>';
  const exStart = html.length;
  if (g.expert) html += '<div class="card expertCard"><h4>🧠 הדעה שלנו על המשחק' + (g.expert.head ? ' — ' + esc(g.expert.head) : '') + '</h4>' + g.expert.take.map(p => '<p>' + esc(p) + '</p>').join('') + '<p class="muted" style="margin:8px 0 0;font-size:12px">נכתב אחרי קריאה של משחקי העונה של שתי הקבוצות: בית וחוץ, מול גדולות וקטנות, מנוחה וחיסורים.</p></div>';
  if (g.story && g.story.length) html += '<div class="card storyCard"><h4>📖 איך המשחק הזה נראה</h4>' + g.story.map(p => '<p>' + esc(p) + '</p>').join('') + '</div>';
  const exEnd = html.length;
  const picks = (g.picks || []).map(i => g.markets[i]);
  html += '<div class="card"><h4>⭐ ההמלצות למשחק</h4>' + (picks.length ? '<div class="recs">' + picks.map(m => '<div class="rec' + (m.res ? ' fin-' + BB_RES[m.res][1] : '') + '"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span><div><div class="rtitle">' + esc(m.label) + '</div>' + bbResStrip(g, m) + bbFold(m) + '</div><div class="rside"><span class="pill ' + scoreCls(m.score) + '">' + scoreWord(m.score) + '</span>' + bbOdds(m) + '</div></div>').join('') + '</div>' : '<p class="muted" style="margin:0">אין המלצה חזקה במשחק הזה' + (o.ml ? '' : ' (אין עדיין יחסי Bet365)') + '.</p>') + '</div>';
  html = html.slice(0, exStart) + html.slice(exEnd) + html.slice(exStart, exEnd);   // ההמלצות קודם, ואחריהן הדעה והסיפור (מי שרוצה לקרוא לעומק ממשיך למטה)
  if (g.enough) html += '<div class="card"><h4>📊 הצפי</h4><div class="tblWrap"><table><thead><tr><th></th><th class="num">' + bd(H.name) + '</th><th class="num">' + bd(A.name) + '</th><th class="num">סה״כ</th></tr></thead><tbody><tr><td>צפי נקודות (משולב)</td><td class="num"><b>' + e.h + '</b></td><td class="num"><b>' + e.a + '</b></td><td class="num"><b>' + e.total + '</b></td></tr>' + (e.market ? '<tr><td>לפי קווי Bet365</td><td class="num" colspan="2">הפרש ' + (e.market.margin != null ? e.market.margin : '—') + '</td><td class="num">' + (e.market.total != null ? e.market.total : '—') + '</td></tr>' : '') + '<tr><td>לפי המודל שלנו בלבד</td><td class="num" colspan="2">הפרש ' + e.model.margin + '</td><td class="num">' + e.model.total + '</td></tr><tr><td>ממוצע הליגה</td><td class="num" colspan="2"></td><td class="num">' + e.lg + '</td></tr></tbody></table></div>' + (o.ml ? '<div class="oddsRow" style="margin-top:8px"><div class="oddsBox h"><span>' + bd(H.name) + ' מנצחת</span><b>' + o.ml.h + '</b></div><div class="oddsBox a"><span>' + bd(A.name) + ' מנצחת</span><b>' + o.ml.a + '</b></div></div>' + (o.spread ? '<p class="muted" style="margin:6px 0 0">הנדיקאפ ראשי: ' + bd(H.name) + ' ' + (o.spread.line > 0 ? '+' : '') + o.spread.line + ' · סך נקודות ראשי: ' + (o.total ? o.total.line : '—') + '</p>' : '') : '') + '</div>';
  if (g.news && g.news.items.length) html += '<div class="card newsCard"><h4>📰 חיסורים</h4><ul class="notes">' + g.news.items.map(i => '<li>' + (i.side === 'h' ? '🏠 ' : '✈️ ') + esc(i.text) + (i.src ? ' <span class="muted">· ' + esc(i.src) + '</span>' : '') + '</li>').join('') + (g.news.source ? '<li class="muted">מקורות: ' + esc(g.news.source) + '</li>' : '') + '</ul></div>';
  if (g.meta && (g.meta.h || g.meta.a)) html += '<div class="card"><h4>🎙 הקבוצות במבט</h4><div class="grid2">' + [[H, g.meta.h], [A, g.meta.a]].map(([T, m]) => m ? '<div><b>' + bd(T.name) + '</b>' + (m.coach ? '<div class="muted">מאמן: ' + bd(m.coach.name) + (m.coach.isNew ? ' (חדש)' : '') + ' · ' + m.coach.w + '-' + m.coach.l + ' איתו</div>' : '') + '<div>' + (m.core || []).slice(0, 5).map(p => bd(p.name) + ' <span class="muted">' + p.pts + ' נק׳</span>').join(' · ') + '</div></div>' : '').join('') + '</div>' + ((g.h2h || []).length ? '<p class="muted" style="margin:8px 0 0">ראש בראש: ' + g.h2h.slice(0, 3).map(x => (x.homeId === H.id ? bd(H.name) : bd(A.name)) + ' ' + x.hs + ':' + x.as).join(' · ') + '</p>' : '') + '</div>';
  if (g.lineup) html += '<div class="card"><h4>🧩 החמישייה הצפויה <span class="muted">· RotoWire, מתעדכן עד שעה לפני המשחק</span></h4><div class="grid2"><div><b>' + bd(H.name) + '</b><div>' + (g.lineup.h || []).map(n => bd(n)).join(' · ') + '</div></div><div><b>' + bd(A.name) + '</b><div>' + (g.lineup.a || []).map(n => bd(n)).join(' · ') + '</div></div></div></div>';
  html += bbPlayersHtml(g);
  html += '<div class="grid2">' + prof(H, 'h') + prof(A, 'a') + '</div>';
  { const pr = g.markets.map((m, i) => ({ m, i })).filter(x => x.m.group === 'prop'), pls = [...((g.players && g.players.h) || []), ...((g.players && g.players.a) || [])];
    if (pr.length) html += '<div class="card"><h4>🎯 הימורי שחקנים (Bet365 — נקודות)</h4><p class="sub2">רק הימורים בציון 6 ומעלה. ב-Bet365 קיימים בפיד שלנו רק הימורי "מספר נקודות ומעלה" לשחקן (ריבאונדים, אסיסטים ושלשות לא זמינים לנו). שחקנים בספק לא נכללים.</p><div class="tblWrap"><table><thead><tr><th>הימור</th><th class="num">יחס</th><th class="num">צפי · ממוצע</th><th class="num">עמד בקו (15 אחרונים)</th><th class="num">דירוג</th><th class="num">תוצאה</th></tr></thead><tbody>' +
      pr.map(({ m, i }) => { const p = pls.find(x => x.id === m.pid), hh = m.hist || {}; return '<tr class="' + (g.picks.includes(i) ? 'isPick' : '') + '"><td>' + (g.picks.includes(i) ? '⭐ ' : '') + esc(m.label) + '</td><td class="num">' + bbOdds(m) + '</td><td class="num">' + (p ? p.pts.p + ' · ' + p.pts.season : '—') + '</td><td class="num">' + (hh.hv ? Math.round(hh.hv[0] * hh.hv[1]) + ' מתוך ' + hh.hv[1] : '—') + '</td><td class="num"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span></td><td class="num">' + (m.res ? '<span class="res ' + BB_RES[m.res][1] + '">' + BB_RES[m.res][0] + '</span>' + actSmall(m) : '<span class="muted">—</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>'; }
  html += '<div class="card more"><h4>📋 ההימורים החזקים במשחק (ציון 6 ומעלה)</h4><div class="tblWrap"><table><thead><tr><th>הימור</th><th class="num">יחס</th><th class="num">בית</th><th class="num">חוץ</th><th class="num">דירוג</th><th class="num">תוצאה</th></tr></thead><tbody>' + g.markets.map((m, i) => { if (m.group === 'prop') return ''; const hh = m.hist || {}, f = x => x ? Math.round(x[0] * x[1]) + ' מתוך ' + x[1] : '—'; return '<tr class="' + (g.picks.includes(i) ? 'isPick' : '') + '"><td>' + (g.picks.includes(i) ? '⭐ ' : '') + esc(m.label) + '</td><td class="num">' + bbOdds(m) + '</td><td class="num">' + f(hh.hv) + '</td><td class="num">' + f(hh.av) + '</td><td class="num"><span class="score ' + scoreCls(m.score) + '">' + m.score + '</span></td><td class="num">' + (m.res ? '<span class="res ' + BB_RES[m.res][1] + '">' + BB_RES[m.res][0] + '</span>' + actSmall(m) : '<span class="muted">—</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  el.innerHTML = html;
}

// ================= ידע על קבוצות =================
const tmState = { lg: null, id: null, q: '' };
const ARCH_ICON = { dominant: '🎯', strong: '💪', compact: '🧱', counter: '⚡', open: '🔥', weak: '🪫', balanced: '⚖️' };
async function renderTeams() {
  const el = $('#view-teams');
  if (!state.teams) {
    el.innerHTML = '<div class="empty">טוען...</div>';
    try { state.teams = await getJson('data/teams.json'); } catch (e) { el.innerHTML = '<div class="empty">אין עדיין פרופילי קבוצות.</div>'; return; }
  }
  const T = state.teams, lgs = Object.entries(T.leagues);
  if (!tmState.lg || !T.leagues[tmState.lg]) tmState.lg = T.leagues['39'] ? '39' : lgs[0][0];
  const L = T.leagues[tmState.lg];
  if (tmState.id) { const K = L.teams.find(x => String(x.id) === String(tmState.id)); if (K) { teamDetail(el, K, L); return; } tmState.id = null; }
  const q = tmState.q.trim().toLowerCase();
  const list = L.teams.filter(k => !q || k.name.toLowerCase().includes(q));
  const ppg = x => x == null ? '—' : x.toFixed(1);
  el.innerHTML = lnav('teams') + '<h2>🧠 קבוצות: מה למדנו על כל אחת</h2><p class="lead">אופי, סגנון, בית וחוץ, ומול גדולות וקטנות. הידע מתעדכן אחרי כל משחק' + (T.learned ? ', והמערכת כבר למדה מ-' + T.learned + ' משחקים שנבדקו ומתקנת את החיזוי בהתאם' : '') + '.</p>' +
    '<div class="filters"><select id="tmLg">' + lgs.map(([id, l]) => '<option value="' + id + '"' + (id === tmState.lg ? ' selected' : '') + '>' + esc(l.he) + '</option>').join('') + '</select><input id="tmQ" type="search" placeholder="חיפוש קבוצה" value="' + esc(tmState.q) + '"></div>' +
    lgProfileHtml(L.profile) + '<div class="tmGrid">' + list.map(k => '<div class="tmCard" data-tid="' + esc(k.id) + '"><div class="tmTop"><span class="rank">' + (k.rank || '–') + '</span><b>' + bd(k.name) + '</b></div><div class="archChip a-' + k.arch + '">' + (ARCH_ICON[k.arch] || '') + ' ' + esc(k.archHe) + '</div>' +
      '<div class="muted">נק׳ למשחק: בית ' + ppg(k.home && k.home.n ? (k.home.w * 3 + k.home.d) / k.home.n : null) + ' · חוץ ' + ppg(k.away && k.away.n ? (k.away.w * 3 + k.away.d) / k.away.n : null) + '</div>' +
      '<div class="formRow">' + String(k.form || '').split('').map(c => '<span class="fc ' + c + '">' + ({ W: 'נ', D: 'ת', L: 'ה' })[c] + '</span>').join('') + '</div></div>').join('') + '</div>';
  $('#tmLg').onchange = e => { tmState.lg = e.target.value; tmState.q = ''; renderTeams(); };
  $('#tmQ').oninput = e => { tmState.q = e.target.value; const pos = e.target.selectionStart; renderTeams(); const i = $('#tmQ'); i.focus(); i.setSelectionRange(pos, pos); };
  el.querySelectorAll('[data-tid]').forEach(c => c.onclick = () => { tmState.id = c.dataset.tid; renderTeams(); window.scrollTo(0, 0); });
}
function lgProfileHtml(P) {
  if (!P) return '';
  const cell = (n, v, u) => v == null ? '' : '<div class="lgCell"><b>' + v + (u || '') + '</b><span>' + n + '</span></div>';
  return '<div class="card lgCard"><h4>🌍 אופי הליגה</h4><div class="lgGrid">' + cell('שערים למשחק', P.goals) + cell('קרנות למשחק', P.corners) + cell('בעיטות למשחק', P.shots) + cell('כרטיסים למשחק', P.cards) + cell('ניצחונות בית (מכל 10)', P.homeW == null ? null : (P.homeW / 10).toFixed(1)) + cell('תיקו (מכל 10)', P.draw == null ? null : (P.draw / 10).toFixed(1)) + cell('ניצחונות חוץ (מכל 10)', P.awayW == null ? null : (P.awayW / 10).toFixed(1)) + cell('משחקים עם מעל 2.5 שערים (מכל 10)', P.o25 == null ? null : (P.o25 / 10).toFixed(1)) + '</div>' + (P.lines && P.lines.length ? '<ul class="notes">' + P.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') + '<p class="muted" style="margin:6px 0 0">מבוסס על ' + P.n + ' משחקי העונה.</p></div>';
}
const POS_HE = { 1: 'שוער', 2: 'מגן', 3: 'קשר', 4: 'חלוץ' };
function storyCardHtml(K) {
  const st = K.story && K.story.length ? K.story : K.lines || [];
  if (!st.length) return '<div class="card"><h4>📖 הסיפור של הקבוצה</h4><p class="muted" style="margin:0">אין עדיין מספיק משחקים.</p></div>';
  const first = st.slice(0, 6), rest = (K.lines || []).slice(4).filter(l => !first.includes(l));
  const coach = K.lore && K.lore.coach;
  return '<div class="card storyCard"><h4>📖 הסיפור של הקבוצה</h4>' + (coach ? '<div class="coachBox"><span class="coachLbl">🎙 המאמן</span><b>' + esc(coach.name) + '</b><span class="muted">' + coach.games + ' משחקים · ' + coach.w + '-' + coach.d + '-' + coach.l + (coach.isNew ? ' · <b class="neg">מאמן חדש</b>' : '') + '</span></div>' : '') + first.map(p => '<p>' + esc(p) + '</p>').join('') + (rest.length ? '<ul class="notes">' + rest.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') + '</div>';
}
function playersCardHtml(K) {
  const L = K.lore; if (!L || !L.core || !L.core.length) return '';
  return '<div class="card"><h4>⭐ שחקני הליבה' + (L.formations && L.formations.length ? ' <span class="muted">· מערך ' + L.formations.map(f => f.f).join(', ') + '</span>' : '') + '</h4><div class="tblWrap"><table><thead><tr><th>שחקן</th><th>תפקיד</th><th class="num">משחקים</th><th class="num">פתח</th><th class="num">דקות</th><th class="num">שערים</th><th class="num">בישולים</th></tr></thead><tbody>' + L.core.map(p => '<tr><td><b>' + bd(p.name) + '</b></td><td>' + (POS_HE[p.pos] || '') + '</td><td class="num">' + p.apps + '</td><td class="num">' + p.starts + '</td><td class="num">' + p.min + '</td><td class="num">' + p.goals + '</td><td class="num">' + p.ast + '</td></tr>').join('') + '</tbody></table></div>' + (L.gk ? '<p class="muted" style="margin:6px 0 0">שוער: ' + bd(L.gk.name) + '.</p>' : '') + '</div>';
}
function teamDetail(el, K, L) {
  const row = (label, b) => b && b.n ? '<tr><td>' + label + '</td><td class="num">' + b.n + '</td><td class="num">' + b.w + '-' + b.d + '-' + b.l + '</td><td class="num"><bdi dir="ltr">' + (b.gf ?? '—') + ':' + (b.ga ?? '—') + '</bdi></td><td class="num"><bdi dir="ltr">' + (b.c ?? '—') + ':' + (b.cAg ?? '—') + '</bdi></td><td class="num"><bdi dir="ltr">' + (b.sh ?? '—') + ':' + (b.shAg ?? '—') + '</bdi></td></tr>' : '';
  const rel = K.rel || {}, bar = (v) => '<span class="relBar"><i style="width:' + Math.min(100, Math.round(v / 2 * 100)) + '%"></i></span>';
  el.innerHTML = '<div class="mbar"><button class="btn" id="tmBack">← כל הקבוצות</button><span class="muted">' + esc(L.he) + '</span></div>' +
    '<div class="mhero"><div class="teamsRow"><b>' + bd(K.name) + '</b></div><div class="meta"><span>מקום ' + (K.rank || '–') + ' מתוך ' + (K.nTeams || '–') + '</span><span>' + K.n + ' משחקים העונה</span><span class="archChip a-' + K.arch + '">' + (ARCH_ICON[K.arch] || '') + ' ' + esc(K.archHe) + '</span></div><div>' + esc(K.archShort) + '.</div></div>' +
    storyCardHtml(K) + playersCardHtml(K) +
    '<div class="card"><h4>🔀 איך היא משחקת בכל מצב</h4><p class="sub2">בכל שורה: כמה משחקים, ניצחונות-תיקו-הפסדים, ובממוצע למשחק (בעד:נגד) שערים, קרנות ובעיטות. ההשוואה בין השורות מראה איפה היא חזקה ואיפה היא מתקשה.</p><div class="tblWrap"><table><thead><tr><th></th><th class="num">מש׳</th><th class="num">נ-ת-ה</th><th class="num">שערים</th><th class="num">קרנות</th><th class="num">בעיטות</th></tr></thead><tbody>' +
      row('כל המשחקים', K.all) + row('בבית', K.home) + row('בחוץ', K.away) + row('מול קבוצות גדולות (שליש עליון)', K.top) + row('מול קבוצות בינוניות', K.mid) + row('מול קבוצות קטנות (שליש תחתון)', K.bot) + row('מול קבוצות שמתבצרות', K.block) + row('מול כל השאר', K.other) + '</tbody></table></div></div>' +
    '<div class="card"><h4>📊 הסגנון ביחס לממוצע הליגה</h4><div class="relGrid">' + [['שליטה בכדור', K.pos / 50], ['בעיטות שהיא יוצרת', rel.shF], ['בעיטות שהיא מרשה', rel.shA], ['שערים שהיא כובשת', rel.gF], ['שערים שהיא סופגת', rel.gA], ['קרנות שהיא מביאה', rel.cF]].map(([n, v]) => '<div><span>' + n + '</span>' + bar(v || 1) + '<b>' + ((v || 1).toFixed(2)) + '×</b></div>').join('') + '</div><p class="muted" style="margin:8px 0 0">1.00 = ממוצע הליגה. מעל 1 = יותר מהממוצע.</p></div>' +
    '<div class="card"><h4>🗓 המשחקים האחרונים</h4><div class="tblWrap"><table><thead><tr><th>תאריך</th><th>יריבה</th><th class="num">תוצאה</th><th class="num">קרנות</th><th class="num">בעיטות</th></tr></thead><tbody>' +
      (K.last || []).map(e => '<tr><td>' + fmtShort(new Date(e.ts * 1000).toISOString().slice(0, 10)) + '</td><td>' + (e.v === 'H' ? '🏠 ' : '✈️ ') + bd(e.opp) + (e.rank ? ' <span class="muted">(#' + e.rank + (e.tier ? ' ' + TIER[e.tier] : '') + ')</span>' : '') + '</td><td class="num"><bdi dir="ltr">' + e.g[0] + ':' + e.g[1] + '</bdi></td><td class="num"><bdi dir="ltr">' + (e.c[0] ?? '—') + ':' + (e.c[1] ?? '—') + '</bdi></td><td class="num"><bdi dir="ltr">' + (e.sh[0] ?? '—') + ':' + (e.sh[1] ?? '—') + '</bdi></td></tr>').join('') + '</tbody></table></div></div>';
  $('#tmBack').onclick = () => { tmState.id = null; renderTeams(); };
  window.scrollTo(0, 0);
}

// ================= ניחושים בין חברים =================
const GOPT = [['1', 'ניצחון בית'], ['X', 'תיקו'], ['2', 'ניצחון חוץ']];
const guessKey = d => 'ciq-guess-' + d;
function loadGuess(d) { try { return JSON.parse(store.get(guessKey(d)) || '{}'); } catch (e) { return {}; } }
function saveGuess(d, g) { store.set(guessKey(d), JSON.stringify(g)); }
function b64e(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
const resultOf = f => { if (!f || !f.result) return null; const r = f.result; return { w: r.g[0] > r.g[1] ? '1' : r.g[0] < r.g[1] ? '2' : 'X', o: r.g[0] + r.g[1] > 2 ? 'o' : 'u', cT: r.h + r.a }; };
function scoreGuess(g, km, fixtures) {
  // תוצאה נכונה = 2 נקודות, שערים מעל/מתחת 2.5 = נקודה, קרנות מעל/מתחת = נקודה
  let pts = 0, done = 0, max = 0; const detail = [];
  km.forEach((k, i) => {
    const f = fixtures.find(x => String(x.id) === String(k.fid)), a = resultOf(f), p = g[i] || {};
    if (!a) { detail.push(null); return; }
    done++; max += 4;
    const okW = p.w && p.w === a.w, okG = p.g && p.g === a.o, okC = p.c && p.c === (a.cT > k.cLine ? 'o' : 'u');
    pts += (okW ? 2 : 0) + (okG ? 1 : 0) + (okC ? 1 : 0); detail.push({ okW, okG, okC });
  });
  return { pts, done, max, detail };
}
function renderGuess() {
  const el = $('#view-guess'), d = state.day, km = d.keyMatches || [], date = d.date;
  const g = loadGuess(date), name = store.get('ciq-name') || '';
  let html = mnav('guess') + '<h2>🎯 ניחושים בין חברים</h2><p class="lead">בחרו מה לדעתכם יקרה במשחקים המרכזיים של היום. הניחושים נשמרים בדפדפן שלכם. לחצו "שלחו לקבוצה" כדי לשלוח אותם בוואטסאפ, ובתחתית העמוד מדביקים את ההודעות של כולם ומקבלים דירוג. תוצאה נכונה = 2 נקודות, שערים וקרנות = נקודה כל אחד. אפשר לנחש רק עד תחילת המשחק: אחריה הניחוש ננעל, וניחוש שנעשה אחרי הפתיחה לא נספר בדירוג.</p>';
  if (!km.length) { el.innerHTML = html + '<div class="empty">אין היום משחקים מרכזיים לניחוש.</div>'; return; }
  html += '<div class="filters"><label>השם שלכם: <input id="gName" class="search" style="max-width:200px" placeholder="למשל: דני" value="' + esc(name) + '"></label></div>';
  const sc = scoreGuess(g, km, d.fixtures);
  html += km.map((k, i) => {
    const f = findFx(k.fid); if (!f) return '';
    const p = g[i] || {}, a = resultOf(f), det = sc.detail[i], P = f.probs || {}, mw = f.character && f.character.mw, lock = !!a || f.ts * 1000 <= Date.now();
    const btn = (grp, val, label) => '<button class="opt' + (p[grp] === val ? ' on' : '') + (det && p[grp] === val ? (det['ok' + grp.toUpperCase()] ? ' ok' : ' bad') : '') + '" data-i="' + i + '" data-g="' + grp + '" data-v="' + val + '"' + (lock ? ' disabled' : '') + '>' + label + '</button>';
    return '<article class="card gcard"><div class="mhead"><div class="mtitle"><div class="teamsRow">' + teamsRow(f) + '</div><div class="meta"><span>' + esc(leagueOf(f.lg).he) + '</span><span>' + fmtTime(f.ts) + '</span></div></div>' + (!a && lock ? '<span class="chk bad">🔒 המשחק התחיל: הניחוש ננעל</span>' : '') + (a ? '<span class="res ' + (det && (det.okW) ? 'win' : 'push') + '">' + f.result.g[0] + ':' + f.result.g[1] + ' · קרנות ' + a.cT + '</span>' : '') + '</div>' +
      '<div class="gq"><div class="gl">🏁 מנצחת</div><div class="opts">' + GOPT.map(([v, l]) => btn('w', v, l)).join('') + '</div></div>' +
      '<div class="gq"><div class="gl">⚽ שערים</div><div class="opts">' + btn('g', 'o', 'מעל 2.5') + btn('g', 'u', 'מתחת 2.5') + '</div></div>' +
      '<div class="gq"><div class="gl">🚩 קרנות</div><div class="opts">' + btn('c', 'o', 'מעל ' + k.cLine) + btn('c', 'u', 'מתחת ' + k.cLine) + '</div></div>' +
      '<div class="muted" style="margin-top:6px">' + (f.character && f.character.mwOdds ? 'יחסי Bet365: בית ' + f.character.mwOdds.h + ' · תיקו ' + f.character.mwOdds.d + ' · חוץ ' + f.character.mwOdds.a : '') + (f.character && f.character.ouOdds ? ' · מעל 2.5 שערים ' + f.character.ouOdds.over : '') + '</div></article>';
  }).join('');
  const mine = sc.done ? '<div class="card"><b>הניקוד שלכם: ' + sc.pts + ' מתוך ' + sc.max + '</b> (' + sc.done + ' משחקים הסתיימו)</div>' : '<p class="muted">התוצאות יתעדכנו אחרי סיום המשחקים (בעדכון הבוקר).</p>';
  html += mine + '<div class="card"><h4>📤 שלחו לקבוצה</h4><div class="pfoot"><a class="btn primary" id="gWa" target="_blank" rel="noopener noreferrer" href="#">שלחו בוואטסאפ</a><button class="btn" id="gCopy">📋 העתקת ההודעה</button><span id="gMsg" class="muted"></span></div><textarea id="gText" class="gtext" readonly></textarea></div>';
  html += '<div class="card"><h4>🏆 דירוג החברים</h4><p class="sub2">הדביקו כאן את ההודעות שחברים שלחו בקבוצה (כמה הודעות ביחד, אפשר גם את כל השיחה). האתר מזהה את הניחושים ומחשב ניקוד ליום שנבחר.</p><textarea id="gPaste" class="gtext" placeholder="הדביקו כאן..."></textarea><div id="gBoard"></div></div>';
  el.innerHTML = html;
  const build = () => {
    const nm = ($('#gName').value || '').trim() || 'אנונימי', gg = loadGuess(date);
    const lines = km.map((k, i) => { const f = findFx(k.fid), p = gg[i] || {}; if (!f) return ''; const w = p.w === '1' ? 'בית' : p.w === '2' ? 'חוץ' : p.w === 'X' ? 'תיקו' : '—', gl = p.g === 'o' ? 'מעל 2.5' : p.g === 'u' ? 'מתחת 2.5' : '—', c = p.c === 'o' ? 'מעל ' + k.cLine : p.c === 'u' ? 'מתחת ' + k.cLine : '—'; return (i + 1) + ') ' + f.home.name + ' – ' + f.away.name + ': ' + w + ' | ' + gl + ' | קרנות ' + c; }).filter(Boolean);
    const code = 'CIQ1:' + b64e({ n: nm, d: date, p: km.map((k, i) => { const p = gg[i] || {}; const t = p.t || {}; return [p.w || '', p.g || '', p.c || '', t.w || 0, t.g || 0, t.c || 0]; }) });
    const msg = '🎯 הניחושים של ' + nm + ' ל-' + fmtShort(date) + ' (קורנר IQ)\n' + lines.join('\n') + '\n\nכדי לראות דירוג: ' + SITE_URL + '\n' + code;
    $('#gText').value = msg; $('#gWa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  };
  build();
  $('#gName').oninput = e => { store.set('ciq-name', e.target.value); build(); };
  el.querySelectorAll('.opt').forEach(b => b.onclick = () => { const gg = loadGuess(date), i = b.dataset.i, fx = findFx(km[i].fid); if (fx && fx.ts * 1000 <= Date.now()) { renderGuess(); return; } gg[i] = gg[i] || {}; gg[i].t = gg[i].t || {}; const same = gg[i][b.dataset.g] === b.dataset.v; gg[i][b.dataset.g] = same ? '' : b.dataset.v; if (same) delete gg[i].t[b.dataset.g]; else gg[i].t[b.dataset.g] = Date.now(); saveGuess(date, gg); renderGuess(); });
  $('#gCopy').onclick = () => { const t = $('#gText'); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } try { if (navigator.clipboard) { navigator.clipboard.writeText(t.value); ok = true; } } catch (e) { /* ignore */ } $('#gMsg').textContent = ok ? 'ההודעה הועתקה ✓' : 'סמנו את הטקסט והעתיקו ידנית'; };
  $('#gPaste').oninput = e => {
    const codes = [...e.target.value.matchAll(/CIQ1:([A-Za-z0-9_-]+)/g)].map(m => { try { return b64d(m[1]); } catch (err) { return null; } }).filter(x => x && x.d === date && Array.isArray(x.p));
    const byName = new Map(); codes.forEach(c => byName.set(String(c.n).slice(0, 30), c)); // אחרון מנצח
    const rows = [...byName.entries()].map(([n, c]) => { const gg = {}; c.p.forEach((x, i) => { const fx = km[i] && findFx(km[i].fid), cut = fx ? fx.ts * 1000 + 60000 : Infinity, ok = k => !(x[k + 3] && x[k + 3] > cut); gg[i] = { w: ok(0) ? x[0] : '', g: ok(1) ? x[1] : '', c: ok(2) ? x[2] : '' }; }); const s = scoreGuess(gg, km, d.fixtures); return { n, s }; }).sort((a, b) => b.s.pts - a.s.pts);
    $('#gBoard').innerHTML = rows.length ? '<table><thead><tr><th>#</th><th>שם</th><th class="num">ניקוד</th><th class="num">משחקים שהסתיימו</th></tr></thead><tbody>' + rows.map((r, i) => '<tr><td>' + (i + 1) + (i === 0 && r.s.done ? ' 🥇' : '') + '</td><td>' + esc(r.n) + '</td><td class="num"><b>' + r.s.pts + '</b> / ' + r.s.max + '</td><td class="num">' + r.s.done + '</td></tr>').join('') + '</tbody></table>' + (rows.every(r => !r.s.done) ? '<p class="muted">הניקוד יופיע אחרי סיום המשחקים.</p>' : '') : '<p class="muted">לא נמצאו ניחושים ליום הזה בטקסט שהודבק.</p>';
  };
}

// ================= מעקב אחרי ההמלצות =================
// תצוגת ליגה: רק הליגה שנבחרה, וכל ההמלצות שניתנו בה (נתפס / נפל / ממתין)
function renderLeagueView(el) {
  const lg = leagueOf(Number(state.tlg)), all = (state.index.leagueLog || []).filter(e => String(e.lg) === String(state.tlg)).sort((a, b) => b.ts - a.ts);
  const isW = e => e.res && e.res.includes('win'), isL = e => e.res && e.res.includes('lose'), isP = e => e.res && !isW(e) && !isL(e);
  const w = all.filter(isW).length, l = all.filter(isL).length, pu = all.filter(isP).length, pend = all.filter(e => !e.res).length;
  const f = state.lgf || 'all', list = all.filter(e => f === 'all' || (f === 'win' && isW(e)) || (f === 'lose' && isL(e)) || (f === 'pend' && !e.res));
  let html = '<div class="mbar"><button class="btn" id="lgBack">← כל הליגות</button></div><h2>⚽ ' + esc(lg.he) + (lg.country ? ' <span class="muted">· ' + esc(lg.country) + '</span>' : '') + '</h2>' +
    '<p class="lead">כל ההמלצות שנתנו בליגה הזאת: ציון 6 ומעלה, ויחס Bet365 אמיתי של 1.45 ומעלה.</p>' +
    '<div class="kpis"><div class="kpi"><b>' + all.length + '</b><span>המלצות</span></div><div class="kpi"><b class="pos">' + w + '</b><span>נתפסו ✅</span></div><div class="kpi"><b class="neg">' + l + '</b><span>נפלו ❌</span></div><div class="kpi"><b>' + (w + l ? w + ' מתוך ' + (w + l) : '—') + '</b><span>נתפסו מתוך שנגמרו</span></div><div class="kpi"><b>' + pend + '</b><span>ממתינות ⏳</span></div>' + (pu ? '<div class="kpi"><b>' + pu + '</b><span>הוחזרו ↩</span></div>' : '') + '</div>';
  const types = {}; all.filter(e => e.res).forEach(e => { const b = types[e.t] ||= { w: 0, l: 0, p: 0 }; if (isW(e)) b.w++; else if (isL(e)) b.l++; else b.p++; });
  const tk = ['res', 'g', 'c', 'c1', 'sh', 'sot'].filter(t => types[t]);
  if (tk.length) html += '<div class="card"><h4>לפי סוג הימור</h4><div class="tblWrap"><table><thead><tr><th>סוג הימור</th><th class="num">נתפסו</th><th class="num">נפלו</th><th class="num">נתפסו מתוך שנגמרו</th></tr></thead><tbody>' + tk.map(t => { const b = types[t]; return '<tr><td>' + (TYPE_NAME[t] || t) + '</td><td class="num">' + b.w + '</td><td class="num">' + b.l + '</td><td class="num">' + (b.w + b.l ? b.w + ' מתוך ' + (b.w + b.l) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  const chip = (k, name) => '<button class="chip' + (f === k ? ' on' : '') + '" data-lgf="' + k + '">' + name + '</button>';
  html += '<div class="card"><h4>כל ההמלצות בליגה</h4><div class="chips" style="margin-bottom:8px">' + chip('all', 'הכל (' + all.length + ')') + chip('win', 'נתפסו (' + w + ')') + chip('lose', 'נפלו (' + l + ')') + chip('pend', 'ממתינות (' + pend + ')') + '</div>' +
    (list.length ? '<div class="tblWrap"><table><thead><tr><th>יום</th><th>משחק</th><th>ההימור</th><th class="num">ציון</th><th class="num">יחס</th><th class="num">מצב</th><th>מה קרה בפועל</th></tr></thead><tbody>' +
      list.map(e => { const r = e.res ? RES[e.res] : null; return '<tr class="clk" onclick="openMatchOf(\'' + e.d + '\',\'' + String(e.id).replace(/'/g, '') + '\')"><td>' + fmtShort(e.d) + '</td><td>' + bd(e.h) + ' – ' + bd(e.a) + '</td><td>' + (TYPE_NAME[e.t] || '').split(' ')[0] + ' ' + esc(e.label) + '</td><td class="num"><span class="score ' + scoreCls(e.score) + '">' + e.score + '</span></td><td class="num">' + e.price.toFixed(2) + '</td><td class="num">' + (r ? '<span class="res ' + r[1] + '">' + r[0] + '</span>' : '<span class="muted">⏳</span>') + '</td><td>' + esc(e.act || '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="muted" style="margin:0">אין המלצות במצב הזה.</p>') + '</div>';
  el.innerHTML = html;
  $('#lgBack').onclick = () => { state.tlg = 'all'; state.lgf = 'all'; renderTrack(); window.scrollTo(0, 0); };
  el.querySelectorAll('[data-lgf]').forEach(b => b.onclick = () => { state.lgf = b.dataset.lgf; renderLeagueView(el); });
}
// ================= סיכום שבועי (שבוע = ראשון עד שבת) =================
const ilToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStartOf = s => addDays(s, -new Date(s + 'T00:00:00Z').getUTCDay());
const wkLabel = ws => fmtShort(ws) + '–' + fmtShort(addDays(ws, 6));
function weekList() {
  const ds = new Set([...(state.index.picksLog || []).map(e => e.d), ...((bb.idx && bb.idx.picksLog) || []).map(e => e.d), ...((state.slips && state.slips.days) || []).map(d => d.date)]);
  return [...new Set([...ds].map(weekStartOf))].sort().reverse();
}
function slipsOfWeek(ws) {
  const out = [], end = addDays(ws, 6);
  for (const d of ((state.slips && state.slips.days) || []).filter(x => x.date >= ws && x.date <= end && x.k)) {
    for (const [lv, lvName] of SLIP_LV) for (const [sp, spName] of SLIP_SP) { const X = slipAt(d, lv, sp); if (X.legs.length) out.push({ d: d.date, lv, sp, name: lvName.replace('הטופס ', '') + ' · ' + spName, S: X }); }
    for (const w of (d.k.win || [])) if (w.legs.length) out.push({ d: d.date, lv: 'win', sp: 'f', name: 'לפי שעות · ⚽ כדורגל', S: w });
    for (const w of (d.k.lg || [])) if (w.legs.length) out.push({ d: d.date, lv: 'lg', sp: 'f', name: 'קבוע · ⚽ כדורגל', S: w });
  }
  return out;
}
function weekHtml(ws, compact) {
  const end = addDays(ws, 6), inW = d => d >= ws && d <= end, isW = r => r && r.includes('win'), isL = r => r && r.includes('lose');
  const F = (state.index.picksLog || []).filter(e => inW(e.d) && (isW(e.res) || isL(e.res)));
  const B = ((bb.idx && bb.idx.picksLog) || []).filter(e => inW(e.d) && (e.res === 'win' || e.res === 'lose'));
  const fw = F.filter(e => isW(e.res)).length, bw = B.filter(e => e.res === 'win').length;
  const SL = slipsOfWeek(ws), done = SL.filter(x => x.S.res), sw = done.filter(x => x.S.res === 'win').length;
  const strongDone = SL.filter(x => x.lv === 'strong' && x.S.res), strongW = strongDone.filter(x => x.S.res === 'win').length;
  const legs = SL.flatMap(x => x.S.legs).filter(l => l.res && l.res !== 'push'), legW = legs.filter(l => l.res === 'win').length;
  const money = done.reduce((t, x) => t + slipMoney(x.S), 0), of = (w, n) => n ? w + ' מתוך ' + n : '—';
  const kpi = (v, t, cls) => '<div class="kpi"><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b><span>' + t + '</span></div>';
  let html = '<div class="card wkCard"><h4>📅 סיכום שבועי · ' + wkLabel(ws) + (ws === weekStartOf(ilToday()) ? ' <span class="muted">(השבוע, עד עכשיו)</span>' : '') + '</h4>' +
    '<div class="kpis">' + kpi(of(fw, F.length), '⚽ המלצות כדורגל שנתפסו') + kpi(of(bw, B.length), '🏀 המלצות כדורסל שנתפסו') + kpi(of(strongW, strongDone.length), '📋 טפסים חזקים שנתפסו') + kpi(of(sw, done.length), '📋 כל הטפסים שנתפסו') + kpi(of(legW, legs.length), '🎯 רגליים בטפסים שעברו') + kpi(done.length ? fmtMoney(money) : '—', '💰 מאזן טפסים (100 ₪ לטופס)', done.length ? moneyCls(money) : '') + '</div>';
  if (F.length + B.length + done.length) html += '<p class="wkNote">' + (F.length + B.length ? 'הימורים בודדים עברו ' + (fw + bw) + ' מתוך ' + (F.length + B.length) + '. ' : '') + (legs.length ? 'רגליים בתוך טפסים עברו ' + legW + ' מתוך ' + legs.length + ', אבל טופס נתפס רק כששלוש הרגליים עוברות יחד, ולכן הטפסים נתפסו ' + of(sw, done.length) + '. ' : '') + 'זה לא טעות בחישוב: ככל שיש יותר רגליים בטופס, כך קשה יותר לתפוס אותו.</p>';
  else html += '<p class="muted">עוד אין תוצאות שנגמרו בשבוע הזה.</p>';
  if (compact) return html + '<p style="margin:8px 0 0"><button class="linkBtn" onclick="state.trSub=\'week\';state.wk=\'' + ws + '\';goTab(\'track\')">לפרטים המלאים (לפי ליגה וטפסים) ←</button></p></div>';
  const tbl = (title, head, rows) => rows.length ? '<h4 class="secSub">' + title + '</h4><div class="tblWrap"><table><thead><tr><th>' + head + '</th><th class="num">נתפסו</th><th class="num">מתוך</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '';
  const grp = (L, keyFn, nameFn, winFn) => { const o = {}; L.forEach(e => { const k = keyFn(e), b = o[k] ||= { w: 0, n: 0 }; b.n++; if (winFn(e)) b.w++; }); return Object.entries(o).sort((a, b) => b[1].n - a[1].n).map(([k, b]) => '<tr><td>' + nameFn(k) + '</td><td class="num"><b>' + b.w + '</b></td><td class="num">' + b.n + '</td></tr>'); };
  html += tbl('⚽ כדורגל לפי ליגה', 'ליגה', grp(F, e => e.lg, k => esc(leagueOf(Number(k)).he), e => isW(e.res)));
  html += tbl('🏀 כדורסל לפי ליגה', 'ליגה', grp(B, e => e.comp, k => esc(bbComp(Number(k))), e => e.res === 'win'));
  if (done.length) {
    const g2 = {}; done.forEach(x => { const b = g2[x.name] ||= { n: 0, w: 0, legs: 0, lw: 0, m: 0 }; b.n++; if (x.S.res === 'win') b.w++; b.m += slipMoney(x.S); x.S.legs.filter(l => l.res && l.res !== 'push').forEach(l => { b.legs++; if (l.res === 'win') b.lw++; }); });
    html += '<h4 class="secSub">📋 הטפסים לפי סוג</h4><div class="tblWrap"><table><thead><tr><th>טופס</th><th class="num">נתפסו</th><th class="num">מתוך</th><th class="num">רגליים שעברו</th><th class="num">מאזן</th></tr></thead><tbody>' + Object.entries(g2).map(([k, b]) => '<tr><td>' + k + '</td><td class="num"><b>' + b.w + '</b></td><td class="num">' + b.n + '</td><td class="num">' + b.lw + ' מתוך ' + b.legs + '</td><td class="num"><b class="' + moneyCls(b.m) + '">' + fmtMoney(b.m) + '</b></td></tr>').join('') + '</tbody></table></div>';
    html += '<h4 class="secSub">📋 כל טפסי השבוע</h4><div class="tblWrap"><table><thead><tr><th>יום</th><th>טופס</th><th>ההימורים</th><th class="num">יחס</th><th class="num">מצב</th></tr></thead><tbody>' + SL.sort((a, b) => b.d.localeCompare(a.d)).map(x => '<tr><td>' + fmtShort(x.d) + '</td><td>' + x.name + '</td><td>' + x.S.legs.map(l => (l.res === 'win' ? '✅ ' : l.res === 'lose' ? '❌ ' : l.res === 'push' ? '↩ ' : '⏳ ') + esc(l.label)).join('<br>') + '</td><td class="num">' + x.S.total.toFixed(2) + '</td><td class="num">' + (x.S.res === 'win' ? 'נתפס ✅' : x.S.res === 'lose' ? 'נפל ❌' : '⏳') + '</td></tr>').join('') + '</tbody></table></div>';
  }
  return html + '</div>';
}
const trTab = () => state.trSub || 'slips', hid = k => trTab() === k ? '' : ' hidden';
const trNav = () => subNav([['slips', '💰 הטפסים שלי'], ['singles', '🎯 המלצות בודדות'], ['learn', '🧠 מה למדנו'], ['week', '📅 סיכום שבועי'], ['recs', '🏟 לפי ליגה'], ['list', '🗂 כל ההמלצות']], trTab(), 'trsub');
function weekPanel() {
  const wl = weekList(); if (!wl.length) return '<div class="empty">עוד אין נתונים לסיכום.</div>';
  const cur = state.wk && wl.includes(state.wk) ? state.wk : wl[0];
  return '<div class="chips" style="margin-bottom:10px">' + wl.map(w => '<button class="chip' + (w === cur ? ' on' : '') + '" data-wk="' + w + '">' + wkLabel(w) + '</button>').join('') + '</div>' + weekHtml(cur, false);
}
// ---- סטטיסטיקה לפי ליגה: בטופס החזק / בטפסים אחרים / בהמלצות בודדות שלא נכנסו לטופס ----
function leagueSplit() {
  const S = state.slips && state.slips.days || [], idx = state.index, idLg = new Map();
  for (const e of [...(idx.matchLog || []), ...(idx.picksLog || []), ...(idx.leagueLog || [])]) idLg.set(String(e.id), e.lg);
  const rows = {}, cat = { strong: 'שלט', other: 'אחר', single: 'בודד' };
  const isDone = r => r === 'win' || r === 'lose' || (r && (r.includes('win') || r.includes('lose')));
  const bump = (lgKey, type, c, res) => {
    for (const [obj, k] of [[rows, lgKey]]) { const r = obj[k] ||= { strong: { w: 0, l: 0, p: 0 }, other: { w: 0, l: 0, p: 0 }, single: { w: 0, l: 0, p: 0 }, types: {} }; const x = r[c]; if (res && res.includes('win')) x.w++; else if (res && res.includes('lose')) x.l++; else if (!res) x.p++; }
  };
  const typeRows = {}, bumpT = (t, c, res) => { const r = typeRows[t] ||= { strong: { w: 0, l: 0, p: 0 }, other: { w: 0, l: 0, p: 0 }, single: { w: 0, l: 0, p: 0 } }; const x = r[c]; if (res && res.includes('win')) x.w++; else if (res && res.includes('lose')) x.l++; else if (!res) x.p++; };
  const legType = l => /^g\|(1x2|dc)\|/.test(l.kind || '') ? 'res' : (l.stat || String(l.kind || '').split('|')[0]);
  const inSlip = new Set(), bbInSlip = new Set(), seen = new Set();
  const lgOfLeg = l => l.sport === 'n' ? 'nba' : l.sport === 'e' ? 'el' : String(l.lg != null ? l.lg : (idLg.get(String(l.id)) != null ? idLg.get(String(l.id)) : '?'));
  for (const pass of ['strong', 'other']) for (const d of S) {
    if (!d.k) continue;
    const lists = pass === 'strong' ? ['f', 'n', 'e'].map(sp => slipAt(d, 'strong', sp)) : [...['f', 'n', 'e'].map(sp => slipAt(d, 'second', sp)), ...(d.k.win || []), ...(d.k.lg || [])];
    for (const X of lists) for (const l of X.legs || []) {
      const key = d.date + '|' + l.id + '|' + (l.kind || l.key), sp = l.sport || 'f';
      if (sp === 'f') inSlip.add(d.date + '|' + l.id + '|' + l.kind); else bbInSlip.add(d.date + '|' + l.id + '|' + l.label);
      if (seen.has(key)) continue; seen.add(key);
      bump(lgOfLeg(l), null, pass, l.res || null);
      if (sp === 'f') bumpT(legType(l), pass, l.res || null);
    }
  }
  for (const e of idx.matchLog || []) { if (inSlip.has(e.d + '|' + e.id + '|' + e.kind)) continue; bump(String(e.lg), null, 'single', e.res); bumpT(e.t, 'single', e.res); }
  for (const e of (bb.idx && bb.idx.picksLog) || []) { if (bbInSlip.has(e.d + '|' + e.id + '|' + e.label)) continue; bump(e.comp === 103 ? 'nba' : 'el', null, 'single', e.res); }
  return { rows, typeRows };
}
const lgLabel = k => k === 'nba' ? '🏀 NBA' : k === 'el' ? '🏀 יורוליג' : k === '?' ? 'לא ידוע' : esc(leagueOf(Number(k)).he);
function splitPanel() {
  const { rows, typeRows } = leagueSplit();
  const cell = x => (x.w + x.l ? '<b>' + x.w + ' מתוך ' + (x.w + x.l) + '</b>' : '<span class="muted">—</span>') + (x.p ? '<br><small class="muted">' + x.p + ' ממתינים</small>' : '');
  const tot = r => ({ w: r.strong.w + r.other.w + r.single.w, l: r.strong.l + r.other.l + r.single.l, p: r.strong.p + r.other.p + r.single.p });
  const head = first => '<thead><tr><th>' + first + '</th><th class="num">⭐ בטופס החזק</th><th class="num">📋 בטפסים אחרים</th><th class="num">🎯 בהמלצות בודדות (לא בטופס)</th><th class="num">סה״כ</th></tr></thead>';
  const line = (name, r, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + name + '</td><td class="num">' + cell(r.strong) + '</td><td class="num">' + cell(r.other) + '</td><td class="num">' + cell(r.single) + '</td><td class="num">' + cell(tot(r)) + '</td></tr>';
  const keys = Object.keys(rows).sort((a, b) => { const n = k => rows[k].strong.w + rows[k].strong.l + rows[k].other.w + rows[k].other.l + rows[k].single.w + rows[k].single.l; return n(b) - n(a); });
  if (!keys.length) return '';
  const all = { strong: { w: 0, l: 0, p: 0 }, other: { w: 0, l: 0, p: 0 }, single: { w: 0, l: 0, p: 0 } };
  for (const k of keys) for (const c of ['strong', 'other', 'single']) for (const f of ['w', 'l', 'p']) all[c][f] += rows[k][c][f];
  const tk = Object.keys(typeRows).sort((a, b) => ['res', 'g', 'c', 'c1', 'sh', 'sot'].indexOf(a) - ['res', 'g', 'c', 'c1', 'sh', 'sot'].indexOf(b));
  return '<div class="card"><h4>🏟 לפי ליגה: מה נכנס לטופס ומה נשאר בהמלצות בודדות</h4><p class="sub2">לכל ליגה שהימרנו בה: כמה הימורים <b>נתפסו מתוך כמה שנגמרו</b>. ⭐ = ההימורים בטופס החזק. 📋 = בטפסים אחרים (שני / שעות / קבוע). 🎯 = ההמלצה הטובה של המשחק שלא נכנסה לאף טופס. הימור שחוזר בכמה טפסים נספר פעם אחת.</p><div class="tblWrap"><table>' + head('ליגה') + '<tbody>' + keys.map(k => line(lgLabel(k), rows[k])).join('') + line('כל הליגות', all, 'avgRow') + '</tbody></table></div></div>' +
    '<div class="card"><h4>⚽ כדורגל לפי סוג הימור</h4><div class="tblWrap"><table>' + head('סוג הימור') + '<tbody>' + tk.map(t => line(TYPE_NAME[t] || t, typeRows[t])).join('') + '</tbody></table></div></div>';
}
// "מה למדנו מהתוצאות": הלקחים שהמערכת מחשבת לבד מכל ההימורים שנגמרו
async function fillLearn() {
  const box = $('#learnBox'); if (!box) return;
  let L; try { L = await getJson('data/lessons.json'); } catch (e) { box.innerHTML = '<div class="empty">עדיין אין לקחים.</div>'; return; }
  const nice = t => t.replace(/(d+)%/g, (m, n) => 'כ-' + Math.round(n / 10) + ' מתוך 10').replace(/\b(c|g|sh|sot|c1|th|total|home|away)\|[a-z0-9|.]+/gi, '').replace(/\(למשל "([^"]+)"\)/g, '— $1').replace(/\s{2,}/g, ' ').trim();
  box.innerHTML = '<p class="sub2">מה המערכת למדה מכל ההימורים שנגמרו: איפה היא פוגעת יותר ממה שציפתה ואיפה פחות. היא משתמשת בזה כדי להוריד או להעלות ציונים. מתעדכן אחרי כל הרצה.</p>' +
    L.sections.map(s => '<div class="card"><h4>' + esc(s.title) + '</h4><ul class="notes">' + s.lines.map(x => '<li>' + esc(nice(x)) + '</li>').join('') + '</ul></div>').join('');
}
function singlesPanel() {
  const log = (state.index.matchLog || []).slice().sort((a, b) => b.ts - a.ts), done = log.filter(e => e.res), isW = r => r.includes('win'), isL = r => r.includes('lose');
  if (!done.length) return '<div class="empty">עדיין אין המלצות בודדות שנגמרו.</div>';
  const W = done.filter(e => isW(e.res)).length, Lo = done.filter(e => isL(e.res)).length, P = done.length - W - Lo, pend = log.length - done.length;
  const agg = keyFn => { const o = {}; done.forEach(e => { const k = keyFn(e), b = o[k] ||= { n: 0, w: 0, l: 0 }; b.n++; if (isW(e.res)) b.w++; else if (isL(e.res)) b.l++; }); return o; };
  const rate = b => b.w + b.l ? b.w + ' מתוך ' + (b.w + b.l) : '—';
  const tbl = (title, obj, nameFn, order) => '<div class="card"><h4>' + title + '</h4><div class="tblWrap"><table><thead><tr><th></th><th class="num">נגמרו</th><th class="num">נתפסו</th><th class="num">נפלו</th><th class="num">נתפסו מתוך שנגמרו</th></tr></thead><tbody>' + (order || Object.keys(obj)).filter(k => obj[k]).map(k => '<tr><td>' + nameFn(k) + '</td><td class="num">' + obj[k].n + '</td><td class="num">' + obj[k].w + '</td><td class="num">' + obj[k].l + '</td><td class="num"><b>' + rate(obj[k]) + '</b></td></tr>').join('') + '</tbody></table></div></div>';
  const days = [...new Set(done.map(e => e.d))].sort().reverse(), byLg = agg(e => e.lg);
  return '<div class="card"><h4>🎯 המלצות בודדות: ההמלצה הטובה ביותר בכל משחק</h4><p class="sub2">לכל משחק נבחרת המלצה אחת (הציון הגבוה ביותר), בין אם היא נכנסה לטפסים ובין אם לא. כל המשחקים נספרים, ולא רק ההמלצות החזקות. ימים קודמים מחושבים לפי אותו כלל אחרי המשחק, לפי הציון בלבד.</p>' +
    '<div class="kpis"><div class="kpi"><b>' + log.length + '</b><span>המלצות</span></div><div class="kpi"><b class="pos">' + W + '</b><span>נתפסו ✅</span></div><div class="kpi"><b class="neg">' + Lo + '</b><span>נפלו ❌</span></div><div class="kpi"><b>' + (W + Lo ? W + ' מתוך ' + (W + Lo) : '—') + '</b><span>נתפסו מתוך שנגמרו</span></div><div class="kpi"><b>' + (pend + P) + '</b><span>ממתינות או החזר</span></div></div></div>' +
    '<div class="grid2">' + tbl('לפי סוג הימור', agg(e => e.t), k => TYPE_NAME[k] || k, ['res', 'g', 'c', 'c1', 'sh', 'sot']) + tbl('לפי ציון', agg(e => e.score >= 7 ? '7+' : e.score >= 6 ? '6' : '5 ומטה'), k => 'ציון ' + k, ['7+', '6', '5 ומטה']) + '</div>' +
    tbl('לפי ליגה', byLg, k => esc(leagueOf(Number(k)).he), Object.keys(byLg).sort((a, b) => byLg[b].n - byLg[a].n)) +
    '<div class="grid2">' + tbl('לפי יום בשבוע', agg(e => new Date(e.ts * 1000).toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' })), k => k) + tbl('לפי שעת פתיחה', agg(e => { const h = Number(new Date(e.ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' })); return h < 17 ? 'עד 17:00' : h < 20 ? '17:00 עד 20:00' : h < 22 ? '20:00 עד 22:00' : 'אחרי 22:00'; }), k => k, ['עד 17:00', '17:00 עד 20:00', '20:00 עד 22:00', 'אחרי 22:00']) + '</div>' +
    tbl('לפי יום', agg(e => e.d), k => fmtDay(k), days) +
    '<div class="card"><h4>כל ההמלצות שנגמרו</h4><div class="tblWrap"><table><thead><tr><th>יום</th><th>משחק</th><th>המלצה</th><th class="num">ציון</th><th class="num">מצב</th><th>מה קרה</th></tr></thead><tbody>' + done.slice(0, 120).map(e => '<tr class="clk" onclick="openMatchOf(\'' + e.d + '\',\'' + String(e.id).replace(/'/g, '') + '\')"><td>' + fmtShort(e.d) + '</td><td>' + bd(e.h) + ' – ' + bd(e.a) + '</td><td>' + esc(e.label) + '</td><td class="num"><span class="score ' + scoreCls(e.score) + '">' + e.score + '</span></td><td class="num">' + (RES[e.res] ? '<span class="res ' + RES[e.res][1] + '">' + RES[e.res][0] + '</span>' : '') + '</td><td class="muted">' + esc(e.act || '') + '</td></tr>').join('') + '</tbody></table></div></div>';
}
function renderTrack() {
  const el = $('#view-track'), log = (state.index.picksLog || []).slice().sort((a, b) => b.ts - a.ts);
  if (state.tlg && state.tlg !== 'all') { renderLeagueView(el); return; }
  let html = '<h2>📊 מעקב</h2>' + trNav() + '<section data-tp="learn"' + hid('learn') + '><div id="learnBox"><div class="empty">טוען...</div></div></section><section data-tp="singles"' + hid('singles') + '>' + singlesPanel() + '</section><section data-tp="week"' + hid('week') + '>' + weekPanel() + '</section><section data-tp="slips"' + hid('slips') + '><div id="slipHist"></div></section><section data-tp="recs"' + hid('recs') + '>' + splitPanel() + '<p class="lead" hidden>כל ההמלצות הנבחרות של כל יום נבדקות אחרי שהמשחק נגמר: נתפס, נפל או החזר. התוצאות מתעדכנות במהלך היום (בערך כל חצי שעה). כאן רואים את כל ההיסטוריה והסיכומים.</p>';
  { // ⚽ כדורגל לפי ליגה: איפה ההמלצות עובדות יותר ואיפה פחות (כל ההמלצות על משחקים, לא רק הנבחרות של היום)
    const D = state.index.detail || {}, byLg = D.byLeague || {}, byLT = D.byLeagueType || {};
    const dn = x => x.win + x.lose, keys = Object.keys(byLg).filter(k => dn(byLg[k]) > 0).sort((x, y) => (byLg[y].win / dn(byLg[y])) - (byLg[x].win / dn(byLg[x])) || dn(byLg[y]) - dn(byLg[x]));
    const tw = keys.reduce((s, k) => s + byLg[k].win, 0), tn = keys.reduce((s, k) => s + dn(byLg[k]), 0), avg = tn ? tw / tn : 0;
    const row = (name, b, attr) => { const n = dn(b), r = n ? b.win / n : 0, mark = n >= 8 ? (r >= avg + 0.08 ? '👍' : r <= avg - 0.08 ? '👎' : '') : ''; return '<tr' + (attr || '') + '><td>' + name + '</td><td class="num">' + n + '</td><td class="num">' + b.win + '</td><td class="num">' + b.lose + '</td><td class="num">' + b.win + ' מתוך ' + n + '</td><td class="num">' + mark + '</td></tr>'; };
    const th = '<thead><tr><th>#</th><th class="num">שנגמרו</th><th class="num">נתפסו</th><th class="num">נפלו</th><th class="num">נתפסו מתוך שנגמרו</th><th class="num"></th></tr></thead>';
    if (keys.length) {
      html += '<div class="card"><h4>⚽ כדורגל לפי ליגה</h4><p class="sub2">איפה ההמלצות שלנו על משחקים עובדות יותר ואיפה פחות (רק המלצות בציון 6 ומעלה עם יחס Bet365 אמיתי של 1.45 ומעלה, במשחקים שנגמרו. ימים קודמים עם יחסים מוערכים לא נספרים, ולכן המדגם עוד קטן). הליגות מסודרות מהטובה לחלשה. 👍 = טוב מהממוצע, 👎 = חלש מהממוצע (רק כשיש לפחות 8 המלצות). לחצו על ליגה כדי לראות אותה לפי סוג הימור.</p>' +
        '<div class="chips" style="margin-bottom:10px"><button class="chip' + (!state.tlg || state.tlg === 'all' ? ' on' : '') + '" data-tlg="all">כל הליגות</button>' + keys.map(k => '<button class="chip' + (String(state.tlg) === String(k) ? ' on' : '') + '" data-tlg="' + k + '">' + esc(leagueOf(Number(k)).he) + '</button>').join('') + '</div>' +
        '<div class="tblWrap"><table>' + th.replace('<th>#</th>', '<th>ליגה</th>') + '<tbody>' + keys.map(k => row(esc(leagueOf(Number(k)).he), byLg[k], ' class="clk" data-tlg="' + k + '"')).join('') + row('כל הליגות', { win: tw, lose: tn - tw }, ' class="avgRow"') + '</tbody></table></div>';
      if (state.tlg && state.tlg !== 'all' && byLg[state.tlg]) {
        const ord = ['res', 'g', 'c', 'c1', 'sh', 'sot'], tk = ord.filter(t => byLT[state.tlg + '|' + t] && dn(byLT[state.tlg + '|' + t]) > 0);
        html += '<h4 style="margin:14px 0 6px">' + esc(leagueOf(Number(state.tlg)).he) + ' לפי סוג הימור</h4><div class="tblWrap"><table>' + th.replace('<th>#</th>', '<th>סוג הימור</th>') + '<tbody>' + (tk.length ? tk.map(t => row(TYPE_NAME[t] || t, byLT[state.tlg + '|' + t])).join('') : '<tr><td colspan="6" class="muted">אין עדיין נתונים לפי סוג בליגה הזאת.</td></tr>') + '</tbody></table></div>';
      }
      html += '</div>';
    }
  }
  if (!log.length) { el.innerHTML = html + '</section><div class="empty">עדיין אין המלצות במעקב. ההמלצות הנבחרות של היום ייכנסו, והתוצאות יופיעו אחרי סיום המשחקים.</div>'; return; }
  const done = log.filter(e => e.res), win = done.filter(e => e.res.includes('win')).length, lose = done.filter(e => e.res.includes('lose')).length, pend = log.length - done.length;
  const rate = win + lose ? win / (win + lose) : null;
  let streak = 0, sType = null; for (const e of done) { const t = e.res.includes('win') ? 'W' : e.res.includes('lose') ? 'L' : null; if (!t) continue; if (sType == null) sType = t; if (t === sType) streak++; else break; }
  const todayStr = state.index.days[0].date, todays = log.filter(e => e.d === todayStr), tw = todays.filter(e => e.res && e.res.includes('win')).length, tl = todays.filter(e => e.res && e.res.includes('lose')).length;
  html += '<div class="kpis"><div class="kpi"><b>' + log.length + '</b><span>המלצות במעקב</span></div><div class="kpi"><b class="pos">' + win + '</b><span>נתפסו ✅</span></div><div class="kpi"><b class="neg">' + lose + '</b><span>נפלו ❌</span></div><div class="kpi"><b>' + (win + lose ? win + ' מתוך ' + (win + lose) : '—') + '</b><span>נתפסו מתוך שנגמרו</span></div><div class="kpi"><b>' + pend + '</b><span>ממתינות ⏳</span></div>' + (streak > 1 ? '<div class="kpi"><b>' + streak + (sType === 'W' ? ' 🔥' : ' 🧊') + '</b><span>רצף ' + (sType === 'W' ? 'תפיסות' : 'נפילות') + '</span></div>' : '') + '</div>';
  if (todays.length) html += '<div class="card"><b>היום (' + fmtShort(todayStr) + '):</b> ' + tw + ' נתפסו ✅ · ' + tl + ' נפלו ❌ · ' + (todays.length - tw - tl) + ' עוד בדרך או ממתינות</div>';
  const agg = keyFn => { const o = {}; done.forEach(e => { const k = keyFn(e); const b = o[k] ||= { n: 0, w: 0, l: 0, p: 0 }; b.n++; if (e.res.includes('win')) b.w++; else if (e.res.includes('lose')) b.l++; else b.p++; }); return o; };
  const tbl = (title, obj, nameFn, order) => { const ks = (order || Object.keys(obj)).filter(k => obj[k]); if (!ks.length) return ''; return '<div class="card"><h4>' + title + '</h4><div class="tblWrap"><table><thead><tr><th></th><th class="num">המלצות</th><th class="num">נתפסו</th><th class="num">נפלו</th><th class="num">החזר</th><th class="num">נתפסו מתוך שנגמרו</th></tr></thead><tbody>' + ks.map(k => { const b = obj[k]; return '<tr><td>' + nameFn(k) + '</td><td class="num">' + b.n + '</td><td class="num">' + b.w + '</td><td class="num">' + b.l + '</td><td class="num">' + b.p + '</td><td class="num"><b>' + (b.w + b.l ? b.w + ' מתוך ' + (b.w + b.l) : '—') + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>'; };
  const dayOrder = [...new Set(done.map(e => e.d))].sort().reverse();
  if (done.length) html += '<div class="grid2">' + tbl('לפי סוג הימור', agg(e => e.t), k => TYPE_NAME[k] || k, ['res', 'g', 'c', 'c1', 'sh', 'sot']) + tbl('לפי דירוג', agg(e => e.score >= 7 ? '7+' : e.score >= 6 ? '6' : '5 ומטה'), k => 'דירוג ' + k, ['7+', '6', '5 ומטה']) + '</div>' + tbl('לפי יום', agg(e => e.d), k => fmtDay(k), dayOrder);
  // רשימה עם סינון לפי מצב ויום
  const base = log.filter(e => state.tday === 'all' || e.d === state.tday);
  const list = base.filter(e => state.sf === 'all' || statusOfLog(e) === state.sf);
  html += '</section><section data-tp="list"' + hid('list') + '>';
  html += '<div class="card"><h4>כל ההמלצות</h4><p class="muted" style="margin:0 0 8px">בחרו יום כדי לראות מה הומלץ בו ומה נתפס. לחיצה על שורה פותחת את המשחק עם כל ההמלצות שלו.</p><div class="chips" style="margin-bottom:8px"><button class="chip' + (state.tday === 'all' ? ' on' : '') + '" data-td="all">כל הימים</button>' + [...new Set(log.map(e => e.d))].sort().reverse().map(d => { const L = log.filter(e => e.d === d), w = L.filter(e => e.res && e.res.includes('win')).length, n = L.filter(e => e.res).length; return '<button class="chip dchip' + (state.tday === d ? ' on' : '') + '" data-td="' + d + '"><b>' + fmtShort(d) + '</b>' + (n ? '<small>' + w + ' מתוך ' + n + '</small>' : '') + '</button>'; }).join('') + '</div>' + sfBar(base, statusOfLog) +
    (list.length ? '<div class="tblWrap" style="margin-top:10px"><table><thead><tr><th>יום</th><th>משחק</th><th>המלצה</th><th class="num">דירוג</th><th class="num">יחס</th><th class="num">מצב</th><th>מה קרה</th></tr></thead><tbody>' +
    list.map(e => { const r = e.res ? RES[e.res] : null, st = statusOfLog(e); return '<tr class="clk" onclick="openMatchOf(\'' + e.d + '\',\'' + String(e.id).replace(/'/g, '') + '\')"><td>' + fmtShort(e.d) + '</td><td>' + bd(e.h) + ' – ' + bd(e.a) + '</td><td>' + (TYPE_NAME[e.t] || '').split(' ')[0] + ' ' + esc(e.label) + '</td><td class="num"><span class="score ' + scoreCls(e.score) + '">' + e.score + '</span></td><td class="num">' + (e.price ? e.price.toFixed(2) : '—') + '</td><td class="num">' + (r ? '<span class="res ' + r[1] + '">' + r[0] + '</span>' : st === 'upcoming' ? '🕒 ' + fmtTime(e.ts) : '⏳') + '</td><td>' + esc(e.act || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin-top:10px">אין המלצות במצב הזה.</p>') + '</div>';
  html += '</section>';
  el.innerHTML = html;
  fillSlipHist(); fillLearn();
  bindSf(renderTrack);
  el.querySelectorAll('[data-trsub]').forEach(b => b.onclick = () => { state.trSub = b.dataset.trsub; renderTrack(); });
  el.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { state.wk = b.dataset.wk; renderTrack(); });
  el.querySelectorAll('[data-td]').forEach(b => b.onclick = () => { state.tday = b.dataset.td; renderTrack(); });
  el.querySelectorAll('[data-tlg]').forEach(b => b.onclick = () => { state.tlg = b.dataset.tlg; state.lgf = 'all'; renderTrack(); window.scrollTo(0, 0); });
}

// ================= הסבר =================
function renderAbout() {
  const sc = Array.from({ length: 10 }, (_, i) => i + 1).map(s => '<div style="background:var(--' + (s >= 7 ? 'good' : s >= 5 ? 'warn' : 'bad') + ')">' + s + '</div>').join('');
  $('#view-about').innerHTML = mnav('about') + '<h2>ℹ️ הסבר קצר</h2><div class="about">' +
    '<details open><summary>מה האתר עושה?</summary><p>כל בוקר האתר מנתח את משחקי היום בכדורגל (11 ליגות, אירופה וליגת האומות) ובכדורסל (NBA ויורוליג): צפי לתוצאה, לשערים או לנקודות, לקרנות ולבעיטות. מכל ההימורים נבחרים הטובים ביותר, ו<b>הטופס היומי</b> הוא 3 ההימורים החזקים ביותר, עם יחסי Bet365 אמיתיים ויחס כולל.</p></details>' +
    '<details><summary>מה אומר הדירוג?</summary><div class="scale">' + sc + '</div><ul><li><b>7–10:</b> הסטטיסטיקה והמודל מסכימים, והיחס טוב.</li><li><b>5–6:</b> יתרון קטן.</li><li><b>1–4:</b> אין ערך.</li></ul></details>' +
    '<details><summary>יחסים</summary><p>"Bet365" = יחס אמיתי. "משוער" = Bet365 לא מציעה את הקו (למשל בעיטות), וזו הערכה. הטופס היומי משתמש רק ביחסים אמיתיים.</p></details>' +
    '<details><summary>מעקב</summary><p>כל ההמלצות והטפסים נבדקים אחרי המשחק ומופיעים בלשונית "מעקב": נתפס, נפל או החזר.</p></details>' +
    '<details id="modelAcc"><summary>עד כמה המודל מדויק?</summary><div id="modelAccBody" class="muted">טוען...</div></details>' +
    '<details><summary>חשוב לדעת</summary><p>זה ניתוח סטטיסטי ולא הבטחה לרווח. הרכבים וחיסורים משתנים עד שעה לפני המשחק, ולכן תמיד בדקו אותם. תחזיות שחקנים בכדורסל הן כיוון לפי ההקשר, ואין להן קווי Bet365.</p></details></div>';
  fillModelAcc();
}

document.addEventListener('mousemove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]'), tip = $('#tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY - 36) + 'px';
});
window.state = state;
const setHH = () => document.documentElement.style.setProperty('--hh', document.querySelector('.top').offsetHeight + 'px');
setHH(); window.addEventListener('resize', setHH);
init();

// ---- דיוק המודל (בדיקה על משחקי עבר) ----
async function fillModelAcc() {
  const el = document.getElementById("modelAccBody"); if (!el) return;
  try {
    const m = await getJson('data/model.json'), N = { g: '⚽ שערים', c: '🚩 קרנות', sh: '🎯 בעיטות', sot: '🥅 בעיטות למסגרת' };
    const ss = Object.keys(m.seasons).sort().reverse();
    el.innerHTML = '<p>כך נבדק המודל: לכל משחק בעבר הוא חזה את הסכום (שערים, קרנות, בעיטות) רק מהמידע שהיה ידוע לפני המשחק, ואז השוונו לתוצאה. המספרים הם הטעות הממוצעת (נמוך = טוב יותר), מול ניחוש פשוט של "ממוצע הליגה".</p><div class="tblWrap"><table><thead><tr><th>מדד</th>' + ss.map(s => '<th class="num">עונה ' + s + '/' + String(+s + 1).slice(2) + '<br>המודל · ממוצע ליגה</th>').join('') + '</tr></thead><tbody>' +
      Object.keys(N).map(k => '<tr><td>' + N[k] + '</td>' + ss.map(s => { const x = m.seasons[s][k]; return '<td class="num"><b>' + x.mae + '</b> · ' + x.maeNaive + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>' +
      '<p>בסך המשחק ההבדל קטן, כי כדורגל רועש. ההתאמה לכל קבוצה משפרת בעיקר את החיזוי של בעיטות, ומעט את הקרנות והשערים, ולכן ההמלצות הן יתרון קטן ולא ודאות. הפרמטרים נבחרו בבדיקה על ' + Math.round(Object.values(m.seasons).reduce((t, x) => t + x.g.n, 0)) + ' משחקים, כולל שימוש בעונה הקודמת כידע מקדים.</p>';
  } catch (e) { el.textContent = 'אין עדיין נתוני בדיקה.'; }
}
// ---- פסקאות הסבר ארוכות נקפלות ל"ℹ️ הסבר": פחות רעש, והמידע עדיין שם ----
new MutationObserver(() => {
  document.querySelectorAll('main p.lead:not([data-f])').forEach(p => {
    p.dataset.f = '1'; if (p.hidden || p.textContent.length < 60) return;
    const d = document.createElement('details'); d.className = 'leadFold'; const sm = document.createElement('summary'); sm.textContent = 'ℹ️ הסבר על המסך הזה'; d.appendChild(sm);
    p.parentNode.insertBefore(d, p); d.appendChild(p);
  });
}).observe(document.querySelector('main'), { childList: true, subtree: true });

// ---- כפתור חזרה למעלה ----
{ const tt = document.getElementById('toTop'); if (tt) { tt.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' }); window.addEventListener('scroll', () => { tt.hidden = window.scrollY < 700; }, { passive: true }); } }
