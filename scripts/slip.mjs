// "הטפסים היומיים":
// כל טופס הוא בדיוק 3 הימורים. אם אין 3 הימורים חזקים מתאימים, אין טופס.
//  • כדורגל: "טופס חזק" (3 ההימורים הכי חזקים של היום, בלי קשר לשעות ולליגות) ומתחתיו "טופס שני" (3 הבאים אחריהם).
//    בימים עמוסים נוספים "טפסי שעות" (עמודה נפרדת): כל טופס מורכב ממשחקים שמתחילים בטווח של עד שעה וחצי זה מזה.
//    וטפסים קבועים לפי ליגה ושעה: בונדסליגה בשבת 16:30, פרמייר ליג בשבת 17:00 (רק מהמשחקים האלה).
//  • כדורסל: NBA ויורוליג לא מתערבבים. טופס חזק של NBA וטופס חזק של יורוליג. אם אין טופס יורוליג, יש טופס שני של NBA, ולהפך.
// נבחרים מכל ההימורים שיש (כדורגל: תוצאה, שערים, קרנות, בעיטות...; כדורסל: מנצחת, ליינים, סך נקודות, נקודות שחקן...), רק עם יחסי Bet365 אמיתיים.
// מותר כמה הימורים מאותו משחק (בכדורסל: שחקן + הנדיקאפ + נקודות; בכדורגל: למשל בעיטות וקרנות כשהשני חזק מספיק), אבל לא סותרים או כפולים.
// לפני שמתחייבים על רגל היא עוברת בדיקות (vet). הטפסים מתעדכנים בהרצות הראשונות של היום, עד שהמנתח סיים לקרוא את המשחקים.
// ברגע שהם "סופיים" הם לא משתנים יותר: רגל שנבחרה נשארת, ולא נוצרים טפסים חדשים. רק בטופס שכבר קיים ופחות משלוש רגליים משלימים מהנשארים.
import fs from 'node:fs';
import { LEAGUES } from './config.mjs';
import path from 'node:path';
import { settle, oneHot } from './model.mjs';
import { footAct } from './acttext.mjs';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const clean = s => String(s || '').replace(/[⁦-⁩]/g, '');
const r2 = x => Math.round(x * 100) / 100;
const KICK = 5 * 60e3, MAX_PROPS = 2, SPORTS = ['f', 'n', 'e'], LEVELS = ['strong', 'second'];
const fKey = m => [m.stat, m.group, m.side, m.line ?? ''].join('|');
const bKey = m => [m.group, m.side, m.line ?? ''].join('|');
const blank = () => ({ legs: [], total: null, res: null });
const bbSport = g => (g.comp === 569 ? 'e' : 'n');
const ilMin = ts => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ts * 1000)); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value); };
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const WIN_EDGES = [16 * 60, 19 * 60, 22 * 60];                       // חלונות: עד 16:00, 16:00-19:00, 19:00-22:00, 22:00 ומעלה
const winOf = ts => { const m = ilMin(ts); return WIN_EDGES.filter(e => m >= e).length; };

// בדיקות לפני שהימור נכנס לטופס: ציון 6+, יחס אמיתי בטווח, משחק שלא התחיל, נתונים מספיקים, לא יותר מדי אזהרות
function vet(m, game, nowMs) {
  const odds = m.odds || m.estOdds;   // אין יחס Bet365 (מקור היחסים מושעה / ימים רחוקים): משתמשים ביחס המשוער, והטופס מסומן "משוער"
  if (!odds || m.score < 6 || odds < 1.45 || odds > 8) return false;                 // היחס לא קובע: מה שחשוב הוא איכות הניתוח (המשתמש: גם יחס 3, 4 או 5 אם הניתוח טוב)
  if (!(game.enough || game.cup) || game.ts * 1000 < nowMs - KICK) return false;
  if (m.anomaly) return false;                         // קו חריג מול ההיסטוריה: לא נכנס לטופס
  if (!(m.pFinal >= 0.5)) return false;
  const early = game.ts * 1000 - nowMs > 8 * 3600e3;   // רחוק מהמשחק: הרכבים עוד לא סופיים זה טבעי ולא אזהרה
  const bad = (m.checks || []).filter(c => c.k === 'bad' && !String(c.t).includes('משוער') && !(early && String(c.t).includes('ההרכבים'))).length;
  if (bad >= 3 && !(m.analystD > 0 && bad <= 4)) return false;      // המנתח העלה את ההימור בגלל הבנת המשחק: מותרות עד 4 אזהרות כלליות (למשל יום שני ברצף שתומך ב"מתחת")
  if (m.group === 'prop' && (m.min || 0) < 24) return false;       // הימורי שחקן בטופס רק לשחקני רוטציה מרכזיים (24+ דקות): לשחקני ספסל הדקות לא יציבות
  if (m.group === 'prop' && (m.pModel < 0.55 || (m.hist && m.hist.v != null && m.hist.v < 0.45))) return false;
  return true;
}

function candidates(footDay, bbDay, nowMs) {
  const out = [];
  for (const f of (footDay && footDay.fixtures) || []) {
    f.markets.forEach((m, mi) => {
      if (!vet(m, f, nowMs)) return;
      out.push({ sport: 'f', id: f.id, lg: f.lg, mi, key: fKey(m), kind: [m.stat, m.group, m.side].join('|'), stat: m.stat, label: clean(m.label), game: `${clean(f.home.name)} – ${clean(f.away.name)}`, ts: f.ts, odds: m.odds || m.estOdds, est: !m.odds, score: m.score, p: m.pFinal || 0, ev: m.ev || 0 });
    });
  }
  for (const g of (bbDay && bbDay.fixtures) || []) {
    g.markets.forEach((m, mi) => {
      if (!vet(m, g, nowMs)) return;
      // לקחים מהתוצאות (analyst-lessons.md): ביורוליג הימור על האורחת וסך נקודות "מעל" נפלו (4/11 ו-0/3), וב-NBA "מעל" עבר רק 56% מול 82% ל"מתחת": לא נכנסים לטפסים עד שיש יותר נתונים
      if (g.comp === 569 && ((m.group === 'spread' && m.side === 'away') || (m.group === 'total' && m.side === 'over'))) return;
      if (g.comp !== 569 && m.group === 'total' && m.side === 'over') return;
      if (m.group === 'spread' && m.side === 'away') return;       // הנדיקאפ על האורחת: עבר 41 מתוך 74 (NBA 32 מתוך 58)
      out.push({ sport: bbSport(g), id: g.id, mi, key: bKey(m), kind: [m.group, m.side].join('|'), grp: m.group, sd: String(m.side), label: clean(m.label), game: `${clean(g.home.name)} – ${clean(g.away.name)}`, ts: g.ts, odds: m.odds, score: m.score, p: m.pFinal || 0, ev: m.ev || 0, prop: m.group === 'prop' });
    });
  }
  // הטפסים החזקים בנויים מההימורים שהסיכוי שלהם גבוה ביותר (טופס של 3 רגליים בסיכוי 62% לרגל עובר רק בכרבע מהמקרים; עם רגליים של 72%+ זה כמעט חצי).
  // לכן ממיינים קודם לפי הסיכוי (ציון 6+ ויחס 1.45+ כבר מובטחים), ובין סיכויים קרובים קודם ההימור ששווה יותר
  return out.sort((a, b) => Math.round(b.p * 20) - Math.round(a.p * 20) || b.score - a.score || b.ev - a.ev || b.p - a.p);
}

// האם הימור c לא מתאים לצד רגל l שכבר בטופס (אותו משחק)
const clash = (l, c) => {
  if (l.sport !== c.sport || String(l.id) !== String(c.id)) return false;
  if (c.sport === 'f') return c.stat === l.stat || c.score < 7 || l.score < 6;   // כדורגל: הימור שני מאותו משחק רק על מדד אחר (למשל בעיטות וקרנות) ורק אם הוא חזק (7+)
  const side = g => g === 'ml' || g === 'spread';
  if (side(l.grp) && side(c.grp)) return true;                                   // כדורסל: שני הימורי צד סותרים או כפולים
  if (l.grp === c.grp && ['total', 'th', 'ta'].includes(c.grp)) return true;
  if (l.grp === 'prop' && c.grp === 'prop' && l.sd === c.sd) return true;
  return false;
};

// ממלא טופס חזק וטופס שני לענף אחד, מהחזק לחלש. רגליים קיימות נשמרות כמות שהן
export function pickSlips(cands, existing1 = [], existing2 = [], n = 3) {
  const A = [...existing1], B = [...existing2];
  const legId = l => l.sport + '|' + l.id + '|' + (l.key || l.mi);
  const used = new Set([...A, ...B].map(legId));
  const props = L => L.filter(l => l.prop).length;
  const kinds = (L, k) => L.filter(l => l.kind === k).length;
  const sameGame = (L, c) => L.filter(l => l.sport === c.sport && String(l.id) === String(c.id)).length;
  for (const L of [A, B]) {
    const other = L === A ? B : A;
    for (const pass of [0, 1]) {            // סבב ראשון: לא יותר משתי רגליים מאותו סוג הימור, לגיוון. סבב שני: בלי הגבלה, רק כדי להשלים שלוש
      for (const c of cands) {
        if (L.length >= n) break;
        if (used.has(legId(c))) continue;
        if (pass === 0 && c.sport === 'f' && sameGame(other, c) > 0) continue;               // בכדורגל: קודם הטופס השני לא משתמש במשחקים של החזק (בסבב השני מותר: מותר לשלב כמה הימורים מאותו משחק)
        if (c.sport === 'f' && sameGame(L, c) >= (pass === 0 ? 2 : 3)) continue;
        if (L.some(l => clash(l, c))) continue;
        if (c.prop && props(L) >= (L === A ? 0 : 1)) continue;          // הימורי שחקן עברו רק 39 מתוך 71 (ביורוליג 1 מתוך 7): לא בטופס החזק, ולכל היותר אחד בטופס השני
        if (pass === 0 && kinds(L, c.kind) >= 2) continue;
        L.push(c); used.add(legId(c));
      }
    }
  }
  const byTime = (a, b) => a.ts - b.ts;
  return [A.sort(byTime), B.sort(byTime)];
}

// טפסי שעות לכדורגל: משחקים מצטברים לצברים שבהם הטווח בין הראשון לאחרון הוא עד שעה וחצי. טופס לכל צבר שיש בו 3 הימורים חזקים.
// רק ביום עמוס: לפחות שני צברים כאלה (אחרת זה היה אותו דבר כמו הטופס החזק)
const CLUSTER_MIN = 90;
function buildWindows(footCands) {
  const games = [...new Map(footCands.map(c => [String(c.id), c.ts])).entries()].map(([id, ts]) => ({ id, ts })).sort((x, y) => x.ts - y.ts);
  const out = [];
  for (let i = 0; i < games.length;) {
    const start = games[i].ts, ids = new Set(), times = [];
    while (i < games.length && games[i].ts - start <= CLUSTER_MIN * 60) { ids.add(games[i].id); times.push(ilMin(games[i].ts)); i++; }
    const L = footCands.filter(c => ids.has(String(c.id)));
    const legs = pickSlips(L, [], [], 3)[0]; if (legs.length !== 3) continue;
    const from = Math.min(...times), to = Math.max(...times);
    out.push({ id: 'w' + out.length, label: from === to ? 'משחקי ' + hhmm(from) : 'משחקי ' + hhmm(from) + '–' + hhmm(to), ...blank(), legs });
  }
  return out.length >= 2 ? out : [];
}

// טפסים קבועים: ליגה + יום בשבוע + שעה. מרכיבים אותם רק מהמשחקים האלה
const FIXED = [
  { id: 'bl16', lg: 78, dow: 'Sat', from: 16 * 60 + 15, to: 16 * 60 + 45, label: 'בונדסליגה · שבת 16:30' },
  { id: 'pl17', lg: 39, dow: 'Sat', from: 16 * 60 + 45, to: 17 * 60 + 15, label: 'פרמייר ליג · שבת 17:00' },
];
// טופס חזק אחד לכל ליגה: משלושה משחקים שונים לפחות, מכל שעות המשחקים של הליגה באותו יום
function buildLeagueSlips(footCands, fixed = []) {
  const out = [], byLg = new Map();
  for (const c of footCands) { if (!byLg.has(Number(c.lg))) byLg.set(Number(c.lg), []); byLg.get(Number(c.lg)).push(c); }
  for (const [lg, L] of byLg) {
    if (new Set(L.map(c => String(c.id))).size < 3) continue;
    const legs = pickSlips(L, [], [], 3)[0]; if (legs.length !== 3) continue;
    const sig = legs.map(l => l.id + '|' + (l.key || l.mi)).sort().join(','); if (fixed.some(w => w.legs.map(l => l.id + '|' + (l.key || l.mi)).sort().join(',') === sig)) continue;   // אותו טופס כמו הטופס הקבוע של הליגה: לא מכפילים
    const info = LEAGUES.find(l => l.id === lg);
    out.push({ id: 'L' + lg, kind: 'league', label: (info ? info.he : 'ליגה ' + lg) + ' · כל משחקי היום', ...blank(), legs });
  }
  return out;
}
const ilDow = ts => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(new Date(ts * 1000));
function buildFixed(footCands) {
  const out = [];
  for (const R of FIXED) {
    const L = footCands.filter(c => Number(c.lg) === R.lg && ilDow(c.ts) === R.dow && ilMin(c.ts) >= R.from && ilMin(c.ts) <= R.to);
    const legs = pickSlips(L, [], [], 3)[0]; if (legs.length !== 3) continue;
    out.push({ id: R.id, label: R.label, ...blank(), legs });
  }
  return out;
}

const find = (g, leg) => {
  if (!g) return null;
  if (leg.key) { const k = g.markets.find(m => (leg.sport === 'f' ? fKey(m) : bKey(m)) === leg.key); if (k) return k; }
  const m = g.markets[leg.mi]; return m && clean(m.label) === leg.label ? m : null;
};
// כדורסל: אם ההימור כבר לא ברשימת ההימורים של המשחק (הציון ירד אחרי שהטופס ננעל), בודקים אותו ישירות מול תוצאת המשחק
let PLC = null;
const loadPL = root => { if (PLC === null) PLC = readJson(path.join(root, 'data', 'cache', 'bball-players.json'), { games: {} }); return PLC; };
function bbFallback(leg, g, root) {
  if (!g || !g.result || !g.result.g || leg.sport === 'f' || !leg.key) return null;
  if (leg.key.startsWith('pst|')) {                                   // הימור שחקן מהאתר: pst|<שחקן>|<pts/reb/ast/tpm>|<over/under>|<קו>
    const [, pid, stt, sd, ln2] = leg.key.split('|'), box = loadPL(root).games[String(leg.id)]; if (!box) return null;
    const row = box.p.find(x => String(x[0]) === pid); if (!row) return null;
    if (!(row[2] > 0)) return { res: 'push', act: 'לא שיחק (ההימור מוחזר)' };
    const col = { pts: 3, reb: 4, ast: 5, tpm: 6 }[stt], v = row[col], L2 = Number(ln2), HE = { pts: 'נקודות', reb: 'ריבאונדים', ast: 'אסיסטים', tpm: 'שלשות' }[stt];
    return { res: v === L2 ? 'push' : ((v > L2) === (sd === 'over')) ? 'win' : 'lose', act: 'סיים עם ' + v + ' ' + HE };
  }
  const [grp, side, ln] = leg.key.split('|'), line = Number(ln), [hp, ap] = g.result.g, cmp = (x, over) => x === line ? 'push' : (over ? x > line : x < line) ? 'win' : 'lose';
  const hn = clean(g.home && g.home.name), an = clean(g.away && g.away.name);
  let res = null, act = null;
  if (grp === 'ml') { res = hp === ap ? 'push' : ((hp > ap) === (side === 'home')) ? 'win' : 'lose'; act = 'תוצאת המשחק ' + hp + ':' + ap; }
  else if (grp === 'spread') { const v = (hp - ap) + line; res = v === 0 ? 'push' : ((v > 0) === (side === 'home')) ? 'win' : 'lose'; const d = side === 'home' ? hp - ap : ap - hp, t = side === 'home' ? hn : an; act = d > 0 ? t + ' ניצחה ב-' + d + ' נקודות' : d < 0 ? t + ' הפסידה ב-' + (-d) + ' נקודות' : 'תיקו'; }
  else if (grp === 'total') { res = cmp(hp + ap, side === 'over'); act = 'סה״כ ' + (hp + ap) + ' נקודות במשחק (' + hp + ':' + ap + ')'; }
  else if (grp === 'th') { res = cmp(hp, side === 'over'); act = hn + ' קלעה ' + hp + ' נקודות'; }
  else if (grp === 'ta') { res = cmp(ap, side === 'over'); act = an + ' קלעה ' + ap + ' נקודות'; }
  else if (grp === 'prop') {
    const box = loadPL(root).games[String(leg.id)]; if (!box) return null;
    const row = box.p.find(x => String(x[0]) === String(side));
    if (!row || !(row[2] > 0)) { res = 'push'; act = 'לא שיחק (ההימור מוחזר)'; } else { res = row[3] >= line ? 'win' : 'lose'; act = 'סיים עם ' + row[3] + ' נקודות'; }
  }
  return res ? { res, act } : null;
}
// כדורגל: רגל שנבחרה לפי יחסי האתר ואינה ברשימת השווקים של המודל נבדקת ישירות מול הסטטיסטיקות של המשחק
function footFallback(leg, g) {
  if (!g || !g.result || !g.result.stats || leg.sport !== 'f' || !leg.key) return null;
  const [stat, group, side, ln] = leg.key.split('|'), line = ln === '' ? null : Number(ln), st = g.result.stats;
  const hv = stat === 'g' ? g.result.g[0] : st[stat] && st[stat][0], av = stat === 'g' ? g.result.g[1] : st[stat] && st[stat][1];
  if (hv == null || av == null) return null;
  if (group === 'combo') {                                            // צירוף מהאתר: side = <1x|x2|12|home|away|draw>_<over|under>, למשל g|combo|1x_under|3.5 = "קוסובו לא מפסידה וגם מתחת ל-3.5 שערים"
    const [rs, ou] = side.split('_'), d = hv - av, t = hv + av;
    const rok = rs === '1x' ? d >= 0 : rs === 'x2' ? d <= 0 : rs === '12' ? d !== 0 : rs === 'home' ? d > 0 : rs === 'away' ? d < 0 : d === 0;
    return { res: rok && (ou === 'over' ? t > line : t < line) ? 'win' : 'lose', act: 'תוצאת המשחק ' + hv + ':' + av };
  }
  const mk = { stat, group, side, line }, s = settle(mk, oneHot(hv), oneHot(av));
  const res = s.win >= 0.99 ? 'win' : s.lose >= 0.99 ? 'lose' : s.push >= 0.99 ? 'push' : s.win > s.lose ? 'win' : 'lose';
  return { res, act: footAct(g, mk) };
}
let ROOT_FOR_FALLBACK = null;
const legRes = (leg, footDay, bbDay) => {
  const doc = leg.sport === 'f' ? footDay : bbDay; if (!doc) return null;
  const g = doc.fixtures.find(x => String(x.id) === String(leg.id)), m = find(g, leg);
  if (!m || !m.res) return leg.sport === 'f' ? footFallback(leg, g) : ROOT_FOR_FALLBACK ? bbFallback(leg, g, ROOT_FOR_FALLBACK) : null;
  const act = m.actT || null;   // מה שקרה בפועל בדבר שעליו הימרנו (נקודות השחקן, קרנות, הפרש...)
  return { res: m.res.includes('win') ? 'win' : m.res.includes('lose') ? 'lose' : 'push', act };
};
export function totalOdds(legs) { const live = legs.filter(l => l.res !== 'push'); return r2(live.reduce((p, l) => p * l.odds, 1)); }
function gradeOne(S, footDay, bbDay) {
  for (const l of S.legs) { const r = legRes(l, footDay, bbDay); if (r) { l.res = r.res; l.act = r.act; } }
  S.total = S.legs.length ? totalOdds(S.legs) : null;
  S.res = S.legs.some(l => l.res === 'lose') ? 'lose' : S.legs.length && S.legs.every(l => l.res) ? (S.legs.every(l => l.res === 'push') ? 'push' : 'win') : null;
  return S;
}
export const slipsOf = day => [...LEVELS.flatMap(lv => SPORTS.map(sp => ({ level: lv, sport: sp, S: day.k[lv][sp] }))), ...(day.k.win || []).map(S => ({ level: 'win', sport: 'f', S })), ...(day.k.lg || []).map(S => ({ level: 'lg', sport: 'f', S }))];
export function gradeSlip(day, footDay, bbDay) { for (const { S } of slipsOf(day)) gradeOne(S, footDay, bbDay); return day; }

// ימים ישנים נשמרו בפורמטים קודמים: טופס אחד מעורב; אחר כך כדורגל/כדורסל ('b'). מעבירים לכדורגל / NBA / יורוליג
function migrate(day, root) {
  if (!day.k) {
    day.k = { strong: { f: blank(), b: blank() }, second: { f: blank(), b: blank() } };
    for (const [lv, legs] of [['strong', day.legs || []], ['second', (day.s2 && day.s2.legs) || []]]) for (const l of legs) day.k[lv][l.sport].legs.push(l);
    for (const k of ['legs', 'total', 'res', 's2']) delete day[k];
  }
  const bb = day.k.strong.b || day.k.second.b ? readJson(path.join(root, 'data', 'bball', `${day.date}.json`), null) : null;
  for (const lv of LEVELS) {
    const S = day.k[lv];
    for (const sp of SPORTS) S[sp] ||= blank();
    if (S.b) {
      for (const l of S.b.legs) { const g = bb && bb.fixtures.find(x => String(x.id) === String(l.id)); l.sport = g ? bbSport(g) : 'n'; S[l.sport].legs.push(l); }
      delete S.b;
    }
  }
  day.k.win ||= []; day.k.lg ||= [];
  return day;
}

const israelHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false }).format(new Date()));
export function runSlip({ root, today, log = () => {} }) {
  const file = path.join(root, 'data', 'slips.json'), store = readJson(file, { days: [] });
  const footDay = readJson(path.join(root, 'data', 'days', `${today}.json`), null), bbDay = readJson(path.join(root, 'data', 'bball', `${today}.json`), null);
  const nowMs = Date.now(); ROOT_FOR_FALLBACK = root;
  for (const d of store.days) migrate(d, root);
  let day = store.days.find(d => d.date === today);
  if (!day) { day = { date: today, final: false, k: { strong: { f: blank(), n: blank(), e: blank() }, second: { f: blank(), n: blank(), e: blank() }, win: [], lg: [] } }; store.days.push(day); }
  const cands = candidates(footDay, bbDay, nowMs);
  const started = l => l.ts * 1000 < nowMs - KICK, keep = L => day.final ? L : L.filter(started);   // לפני שהטופס סופי: רגל של משחק שכבר התחיל נשארת
  for (const sp of SPORTS) {
    const oldA = day.k.strong[sp].legs, oldB = day.k.second[sp].legs;
    if (oldA.length && oldA.every(l => l.src === 'fivebet')) continue;               // טופס שנבחר לפי יחסי האתר (fivebet) לא נבנה מחדש
    if (day.final && !oldA.length && !oldB.length) continue;                     // אחרי הנעילה לא נוצרים טפסים חדשים
    const [A, B] = pickSlips(cands.filter(c => c.sport === sp), keep(oldA), keep(oldB));
    // טופס שני חייב 3 הימורים טובים: אם אין, אין טופס שני (גם לא אחרי הנעילה: טופס שלא נוצר לא נוסף בדיעבד)
    const noSecond = B.length !== 3 || (day.final && oldB.length < 3);
    day.k.strong[sp].legs = A.length === 3 ? A : []; day.k.second[sp].legs = noSecond ? [] : B;   // כל טופס הוא בדיוק 3 הימורים: לא 2 ולא 4. אם אין 3 חזקים, אין טופס
  }
  // כדורסל: NBA ויורוליג נפרדים. טופס יורוליג מופיע רק עם 3 רגליים. בלי יורוליג יש טופס שני של NBA, ובלי NBA יש טופס שני של יורוליג
  { const K = day.k, okN = K.strong.n.legs.length >= 3, okE = K.strong.e.legs.length >= 3;
    if (!okE) { K.strong.e = blank(); K.second.e = blank(); }
    if (!okN && okE) { K.strong.n = blank(); K.second.n = blank(); }
    if (okN && okE) { K.second.n = blank(); K.second.e = blank(); }
    if (okN && !okE) K.second.e = blank();
    if (!okN && okE) K.second.n = blank(); }
  // כדורגל: טפסי שעות (ביום עמוס). אחרי הנעילה לא משתנים
  if (!day.final) {
    const fc = cands.filter(c => c.sport === 'f');
    const merge = (old, fresh) => { const st = (old || []).filter(w => w.legs.some(started)), keep = new Set(st.map(w => w.label)); return [...st, ...fresh.filter(w => !keep.has(w.label) && !w.legs.some(started))]; };
    day.k.win = merge(day.k.win, buildWindows(fc));
    const fixedNew = buildFixed(fc); day.k.lg = merge(day.k.lg, [...fixedNew, ...buildLeagueSlips(fc, fixedNew)]);
  }
  // סופי = הרצה חוזרת אחרי שהמנתח כתב את הערותיו (או אחרי 14:00 שעון ישראל), וכשיש לפחות הימור אחד בטופס חזק כלשהו. אחרי זה הטפסים לא משתנים
  const notes = fs.existsSync(path.join(root, 'data', 'expert', `${today}.json`)) || fs.existsSync(path.join(root, 'data', 'expert', `bball-${today}.json`));
  const realToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  if (!day.final && today <= realToday && process.env.REUSE_INPUTS && (notes || israelHour() >= 14) && SPORTS.some(sp => day.k.strong[sp].legs.length)) day.final = true;
  for (const d of store.days) { const fd = d.date === today ? footDay : readJson(path.join(root, 'data', 'days', `${d.date}.json`), null), bd = d.date === today ? bbDay : readJson(path.join(root, 'data', 'bball', `${d.date}.json`), null); gradeSlip(d, fd, bd); }
  store.days.sort((a, b) => b.date.localeCompare(a.date));
  store.updated = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(store));
  const K = day.k;
  log(`הטפסים היומיים: כדורגל ${K.strong.f.legs.length}/${K.second.f.legs.length}/${K.win.length} טפסי שעות, ${(K.lg || []).length} קבועים · NBA ${K.strong.n.legs.length}/${K.second.n.legs.length} · יורוליג ${K.strong.e.legs.length}/${K.second.e.legs.length}${day.final ? ' · סופיים' : ' · עדיין לא סופיים'}`);
  return day;
}
