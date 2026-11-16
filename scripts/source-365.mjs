// מקור נוסף: 365Scores (ה-API הציבורי שבו האתר עצמו משתמש, ללא מפתח).
// נותן: סטטיסטיקות מלאות ו-**מחצית ראשונה** (קרנות, בעיטות...), החזקת כדור, xG, הרכבים וחיסורים, שופט.
// בקצב מתון ועם מטמון, כדי לא להעמיס. הערה: זה API לא רשמי, ולכן כל קריאה עטופה כך שכשל לא מפיל את ההרצה.
import fs from 'node:fs';

const BASE = 'https://webws.365scores.com/web';
const Q = 'appTypeId=5&langId=1&timezoneName=Asia/Jerusalem&userCountryId=6';
const GAP_MS = Number(process.env.S365_GAP || 150);

// מזהי תחרויות ב-365Scores → מזהה הליגה שלנו
export const COMP = { 7: 39, 1: 40, 11: 140, 17: 135, 25: 78, 26: 79, 35: 61, 57: 88, 73: 94, 98: 144, 78: 203, 84: 197, 61: 179, 42: 383, 43: 382, 572: 2, 573: 3, 7685: 848, 7016: 5, 5421: 5, 5930: 5, 8: 45, 9: 48, 20: 137, 13: 143, 28: 81, 49: 384 };
export const DOMESTIC = [7, 1, 11, 17, 25, 26, 35, 57, 73, 98, 78, 84, 61, 42, 43];
export const ISRAEL_COMPS = [42, 43];
export const EURO_COMPS = [572, 573, 7685, 8, 9, 20, 13, 28, 49];
// נבחרות: ליגת האומות (7016) והמשחקים שמזינים את ההיכרות עם הנבחרות: מוקדמות המונדיאל של אופ״א (5421) והמונדיאל (5930)
export const NATIONS_COMPS = [7016, 5421, 5930];
export const NATIONS_FIXTURE = 7016;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let nextSlot = 0;
export const stats365 = { calls: 0, fails: 0 };
export async function http(url) {
  for (let i = 0; i < 3; i++) {
    const now = Date.now(); const slot = Math.max(now, nextSlot); nextSlot = slot + GAP_MS; if (slot > now) await sleep(slot - now);
    try {
      stats365.calls++;
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (personal football analysis)' } });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) { stats365.fails++; return null; }
      return await r.json();
    } catch (e) { await sleep(700 * (i + 1)); }
  }
  stats365.fails++;
  return null;
}
export async function pool(items, worker, n = 4) {
  let i = 0; const run = async () => { while (i < items.length) { const k = i++; try { await worker(items[k], k); } catch (e) { /* ignore single failure */ } } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}

const dmy = d => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
export async function dayGames(dateIso) {
  const j = await http(`${BASE}/games/allscores/?${Q}&sports=1&startDate=${dmy(dateIso)}&endDate=${dmy(dateIso)}`);
  return (j && j.games) || [];
}
const brief = g => ({ id: g.id, comp: g.competitionId, ts: Math.floor(new Date(g.startTime).getTime() / 1000), h: g.homeCompetitor.id, a: g.awayCompetitor.id, hn: g.homeCompetitor.name, an: g.awayCompetitor.name, hl: g.homeCompetitor.imageVersion ? null : null, sg: g.statusGroup, g: [g.homeCompetitor.score, g.awayCompetitor.score], round: g.roundNum, season: g.seasonNum, grp: g.groupName || null, stage: g.stageNum });
export const isFinished = g => g.sg === 4 && g.g && g.g[0] >= 0 && g.g[1] >= 0;
export const isUpcoming = g => g.sg === 2;
export const toBrief = brief;

// רשימת משחקים של תחרות: העמוד האחרון ואחורה (20 בעמוד)
export async function recentOfComp(comp) {
  const j = await http(`https://webws.365scores.com/web/games/current/?langId=1&timezoneId=15&userCountryId=6&apptype=5&competitions=${comp}&games=100`);
  return ((j && j.games) || []).map(brief);
}
export async function pageBack(comp, afterId) {
  const j = await http(`https://webws.365scores.com/web/games/?langId=1&timezoneId=15&userCountryId=6&apptype=5&competitions=${comp}&games=100&aftergame=${afterId}&direction=-1`);
  return ((j && j.games) || []).map(brief);
}

// סטטיסטיקות משחק (filter: -1 = כל המשחק, 6 = מחצית ראשונה)
const SID = { c: 8, sh: 3, sot: 4, f: 12, y: 1, r: 2, pos: 10, xg: 76 };
const num = v => { if (v == null) return null; const x = parseFloat(String(v).replace('%', '')); return Number.isFinite(x) ? x : null; };
export async function gameStats(id, hid, aid, filter = -1) {
  const j = await http(`${BASE}/game/stats/?${Q}&games=${id}${filter !== -1 ? '&filterId=' + filter : ''}`);
  if (!j || !Array.isArray(j.statistics)) return null;
  const pick = (sid, comp) => { const s = j.statistics.find(x => x.id === sid && x.competitorId === comp); return s ? num(s.value) : null; };
  const out = {};
  for (const [k, sid] of Object.entries(SID)) out[k] = [pick(sid, hid), pick(sid, aid)];
  out.k = out.y[0] != null && out.y[1] != null ? [out.y[0] + (out.r[0] || 0), out.y[1] + (out.r[1] || 0)] : [null, null];
  delete out.y; delete out.r;
  return out.c[0] == null && out.sh[0] == null ? null : out;
}

// הרכבים וחיסורים (משחק עתידי או שהתחיל)
const POS_HE = { Goalkeeper: 'שוער', Defender: 'מגן', Midfielder: 'קשר', Attacker: 'חלוץ' };
const INJ_HE = [[/hamstring/i, 'שריר הירך האחורי'], [/knee/i, 'ברך'], [/ankle/i, 'קרסול'], [/hip/i, 'ירך'], [/groin/i, 'מפשעה'], [/calf/i, 'שוק'], [/leg\b/i, 'רגל'], [/head|face|eye/i, 'ראש'], [/rib|chest/i, 'צלעות'], [/ligament/i, 'רצועה'], [/hand|wrist|arm/i, 'יד'], [/toe/i, 'בוהן'], [/adductor/i, 'שריר מקרב'], [/quad/i, 'ארבע-ראשי'], [/personal|family/i, 'סיבה אישית'], [/thigh/i, 'ירך'], [/muscle/i, 'שריר'], [/back/i, 'גב'], [/foot/i, 'כף רגל'], [/shoulder/i, 'כתף'], [/illness|ill\b|virus/i, 'מחלה'], [/concussion/i, 'זעזוע מוח'], [/knock/i, 'מכה'], [/fitness/i, 'כושר'], [/surgery/i, 'ניתוח'], [/cruciate|acl/i, 'ברך (רצועה צולבת)'], [/achilles/i, 'גיד אכילס']];
const MON_HE = { january: 'ינואר', february: 'פברואר', march: 'מרץ', april: 'אפריל', may: 'מאי', june: 'יוני', july: 'יולי', august: 'אוגוסט', september: 'ספטמבר', october: 'אוקטובר', november: 'נובמבר', december: 'דצמבר' };
const retDate = t => { const m = String(t || '').match(/^(early|mid|late)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?$/i); if (!m) return null; return ({ early: 'תחילת ', mid: 'אמצע ', late: 'סוף ' }[(m[1] || '').toLowerCase()] || '') + MON_HE[m[2].toLowerCase()] + (m[3] ? ' ' + m[3] : ''); };
const RET_HE = [[/few days/i, 'כמה ימים'], [/few weeks/i, 'כמה שבועות'], [/unknown|undetermined/i, 'לא ידוע'], [/season/i, 'עד סוף העונה'], [/month/i, 'כחודש']];
const retNum = t => { const m = String(t || '').match(/(\d+)(?:\s*-\s*(\d+))?\s*(day|week|month)s?/i); if (!m) return null; return 'כ-' + m[1] + (m[2] ? '-' + m[2] : '') + ' ' + ({ day: 'ימים', week: 'שבועות', month: 'חודשים' })[m[3].toLowerCase()]; };
const tr = (txt, table) => { for (const [re, he] of table) if (re.test(txt || '')) return he; return null; };
const Q_HE = Q.replace('langId=1', 'langId=2');
const POS_BY_ID = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Attacker' };
export async function gameLineups(id) {
  const j = await http(`${BASE}/game/?${Q_HE}&gameId=${id}`);
  const g = j && j.game; if (!g) return null;
  const names = new Map((g.members || []).map(m => [m.id, m.name]));
  const side = C => {
    const L = C && C.lineups; if (!L) return null;
    const xi = (L.members || []).filter(m => m.statusText === 'Starting').map(m => names.get(m.id)).filter(Boolean);
    const missing = (L.members || []).filter(m => m.statusText === 'Missing').map(m => {
      const ap = (m.seasonStats || []).map(s => String(s.text || '').match(/(?:Appearances|הופעות) \((\d+)\/(\d+)\)/)).find(Boolean);
      const reason = m.suspension ? m.suspension.name : m.injury ? m.injury.reason : null;
      return { name: names.get(m.id) || '?', pos: m.position && (POS_BY_ID[m.position.id] || m.position.name), type: m.suspension ? 'suspension' : 'injury', reason, back: m.injury && m.injury.expectedReturn, apps: ap ? [+ap[1], +ap[2]] : null };
    });
    return { status: L.status, formation: L.formation, xi, missing };
  };
  return { status: g.homeCompetitor.lineups ? g.homeCompetitor.lineups.status : null, h: side(g.homeCompetitor), a: side(g.awayCompetitor), ref: g.officials && g.officials[0] ? g.officials[0].name : null, venue: g.venue ? g.venue.name : null };
}

// ממיר נתוני הרכבים לפורמט "חדשות" של האתר, כולל חשיבות החיסור (לפי שיעור הופעות העונה ותפקיד)
export function lineupsToNews(L) {
  if (!L || (!L.h && !L.a)) return null;
  const items = [], adj = { h: { att: 1, def: 1 }, a: { att: 1, def: 1 } }, lineups = {};
  let any = false;
  for (const sd of ['h', 'a']) {
    const T = L[sd]; if (!T) continue;
    if (T.xi.length >= 10) { lineups[sd] = { formation: T.formation || null, confirmed: T.status === 'Confirmed', xi: T.xi }; any = true; }
    let att = 1, def = 1;
    for (const m of T.missing) {
      const r = m.apps && m.apps[1] >= 4 ? m.apps[0] / m.apps[1] : null;
      const gk = m.pos === 'Goalkeeper';
      const impact = r == null ? 'low' : r >= 0.75 || (gk && r >= 0.5) ? 'high' : r >= 0.4 ? 'medium' : 'low';
      if (impact === 'low' && (r == null || r < 0.2)) continue; // שחקן שולי: לא מציגים
      const reasonHe = m.type === 'suspension' ? ('מורחק' + (m.reason ? ' (' + (/red/i.test(m.reason) ? 'כרטיס אדום' : /yellow/i.test(m.reason) ? 'צבירת צהובים' : m.reason) + ')' : '')) : ('פצוע' + (m.reason ? ': ' + (tr(m.reason, INJ_HE) || m.reason) : ''));
      const back = m.back ? ' · חזרה צפויה: ' + (tr(m.back, RET_HE) || retNum(m.back) || retDate(m.back) || m.back) : '';
      const role = (POS_HE[m.pos] || '') + (m.apps ? `, ${m.apps[0]} הופעות מתוך ${m.apps[1]}` : '');
      items.push({ side: sd, type: m.type, impact, text: `${m.name} (${role}) חסר — ${reasonHe}${back}`.slice(0, 190) });
      any = true;
      if (impact === 'high') { if (m.pos === 'Attacker') att *= 0.97; else if (m.pos === 'Midfielder') att *= 0.985; else if (gk) def *= 1.05; else if (m.pos === 'Defender') def *= 1.03; }
    }
    adj[sd] = { att: Math.max(0.92, +att.toFixed(3)), def: Math.min(1.12, +def.toFixed(3)) };
  }
  if (!any) return { items: [], adj: null, lineups: null, uncertain: true, source: '365Scores', checked: true };
  const uncertain = !(L.status === 'Confirmed');
  const hasAdj = ['h', 'a'].some(s => adj[s].att !== 1 || adj[s].def !== 1);
  return { items, adj: hasAdj ? adj : null, lineups: Object.keys(lineups).length ? lineups : null, uncertain, source: '365Scores', checked: true };
}

// ---------- מטמון ----------
export const loadCache = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { v: 1, games: {}, comps: {} }; } };
export const saveCache = (file, c) => { fs.mkdirSync(file.replace(/[\\/][^\\/]+$/, ''), { recursive: true }); fs.writeFileSync(file, JSON.stringify(c)); };

// מוסיף לרשימת המשחקים שבמטמון את כל המשחקים שהסתיימו העונה (עמוד אחרי עמוד אחורה), ועדכון אחרון בכל הרצה
export async function syncLists(cache, comps, seasonStartTs, log = () => {}) {
  for (const comp of comps) {
    const st = cache.comps[comp] ||= { complete: false, oldestId: null };
    const add = arr => { for (const b of arr) if (isFinished(b) && b.ts >= seasonStartTs - 86400 && !cache.games[b.id]) cache.games[b.id] = { ...b, full: undefined, h1: undefined }; };
    let page = await recentOfComp(comp); add(page);
    if (st.complete) continue;
    const earliest = arr => arr.reduce((m, b) => (b.ts < m.ts ? b : m));
    let oldest = page.length ? earliest(page).id : null;
    let guard = 0;
    while (oldest && guard++ < 40) {
      const back = await pageBack(comp, oldest); if (!back.length) { st.complete = true; break; }
      add(back);
      const minTs = Math.min(...back.map(b => b.ts)); oldest = earliest(back).id;
      if (minTs < seasonStartTs) { st.complete = true; break; }
    }
    log(`365: תחרות ${comp}: ${Object.values(cache.games).filter(x => x.comp === comp).length} משחקים ברשימה${st.complete ? '' : ' (עוד לא הושלם)'}`);
  }
}

// מושך סטטיסטיקות (מלא + מחצית ראשונה) למשחקים שחסרים, עד תקציב קריאות
export async function fillStats(cache, maxCalls, log = () => {}) {
  const retry = (v, n) => v === undefined || (v === null && (n || 0) < 2);
  const need = Object.values(cache.games).filter(g => retry(g.full, g.fe) || retry(g.h1, g.he)).sort((x, y) => y.ts - x.ts);
  let used = 0; const work = [];
  for (const g of need) { const c = (retry(g.full, g.fe) ? 1 : 0) + (retry(g.h1, g.he) ? 1 : 0); if (used + c > maxCalls) break; used += c; work.push(g); }
  let n = 0;
  await pool(work, async g => {
    if (retry(g.full, g.fe)) { g.full = await gameStats(g.id, g.h, g.a, -1); if (g.full === null) g.fe = (g.fe || 0) + 1; }
    if (retry(g.h1, g.he)) { g.h1 = await gameStats(g.id, g.h, g.a, 6); if (g.h1 === null) g.he = (g.he || 0) + 1; }
    if (++n % 100 === 0) log(`365: ${n}/${work.length} משחקים`);
  }, 4);
  return { done: work.length, left: need.length - work.length };
}
