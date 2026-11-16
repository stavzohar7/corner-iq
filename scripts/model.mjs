// מודל רב-שווקי: קרנות, שערים, תוצאה, בעיטות, בעיטות למסגרת, עבירות, כרטיסים
// לכל קבוצה: כמה היא "מייצרת" וכמה היא "נותנת" מכל מדד — בנפרד בבית ובחוץ — מול היריבה הספציפית,
// ועל זה שכבת "אופי משחק": פייבוריטית, קצב, פתיחות של כל קבוצה, שופט, טבלה וכושר.
import { LEAGUE_NAME_HE } from './config.mjs';
import { learnFactor, archMatchup, ARCH } from './arch.mjs';
// פרמטרים שאפשר לכוון (הבדיקה לאחור ב-backtest.mjs מצאה את הערכים הטובים ביותר)
export const TUNE = {
  DECAY: 0.98,       // משקל למשחקים ישנים יותר
  SHRINK_K: 8,       // כיווץ לממוצע הליגה כשיש מעט משחקים
  W_CORNERS: 0.4,   // קרנות: משקל מודל הקרנות מול מודל הבעיטות
  PRIOR_W: 0.4,        // משקל משחקי העונה הקודמת (0 = לא משתמשים)
  VENUE_MIX: 1,    // משקל כלל המשחקים (בית+חוץ) מול משחקי אותו מגרש
  OPP_ADJ: 0,        // כמה לנכות את חוזק היריבות מהמשחקים (0 = לא, 1 = מלא)
  PHI_K: 0.5,        // כמה מהפיזור הנצפה בליגה נכנס להתפלגות (0 = פואסון)
  PRIOR_GAP2: 0.5,   // משקל העונה שלפני הקודמת ביחס לעונה הקודמת
};
const W_CORNERS_DEFAULT = TUNE.W_CORNERS;
const W_MARKET = 0.5;    // משקל השוק (יחס אמיתי או קו מקובל) בהסתברות הסופית
const MAXK = 45;
export const FOCUS = ['g', 'c', 'c1', 'sh', 'sot'];
const CB = ['c', 'c1', 'sh', 'sot'];
// חלונות קווים ריאליים (מה שאתרי הימורים באמת מציעים): לא ממליצים על קווים שאף אחד לא מציע
const LINE_WIN = { c: { total: [7.5, 12.5], team: [3.5, 7.5] }, c1: { total: [3.5, 6.5], team: [1.5, 3.5] }, sh: { total: [20.5, 31.5], team: [9.5, 17.5] }, sot: { total: [6.5, 11.5], team: [2.5, 6.5] }, g: { total: [1.5, 3.5], team: [0.5, 2.5] } };

const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const iso = s => '⁨' + s + '⁩'; // בידוד כיווניות לשמות באנגלית
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const variance = a => { const m = mean(a); return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0; };
function wmean(arr, f, wf) { let s = 0, w = 0; arr.forEach((x, i) => { const wt = TUNE.DECAY ** i * (wf ? wf(x) : 1); s += wt * f(x); w += wt; }); return w ? s / w : null; }
export const tierFromRank = (rank, n) => { const k = Math.ceil(n / 3); return rank <= k ? 'top' : rank > n - k ? 'bot' : 'mid'; };

// ---------- המדדים ----------
export const STATS = {
  c1:  { he: 'קרנות במחצית הראשונה', forHi: 'מייצרת הרבה קרנות מוקדם', agHi: 'נותנת קרנות מוקדם', forLo: 'מעט קרנות מוקדם', agLo: 'כמעט לא נותנת קרנות מוקדם' },
  c:   { he: 'קרנות',          forHi: 'מייצרת הרבה קרנות', agHi: 'נותנת ליריבות הרבה קרנות', forLo: 'מייצרת מעט קרנות', agLo: 'כמעט לא נותנת קרנות' },
  g1:  { he: 'שערים במחצית הראשונה', forHi: 'כובשת מוקדם', agHi: 'סופגת מוקדם', forLo: 'כובשת מאוחר', agLo: 'כמעט לא סופגת מוקדם' },
  g:   { he: 'שערים',          forHi: 'כובשת הרבה', agHi: 'סופגת הרבה', forLo: 'מתקשה לכבוש', agLo: 'הגנה חזקה' },
  sh:  { he: 'בעיטות',         forHi: 'בועטת הרבה', agHi: 'נותנת ליריבות לבעוט הרבה', forLo: 'בועטת מעט', agLo: 'כמעט לא נותנת לבעוט' },
  sot: { he: 'בעיטות למסגרת',  forHi: 'מגיעה להרבה בעיטות למסגרת', agHi: 'סופגת הרבה בעיטות למסגרת', forLo: 'מעט בעיטות למסגרת', agLo: 'כמעט לא סופגת בעיטות למסגרת' },
  f:   { he: 'עבירות',         forHi: 'מבצעת הרבה עבירות', agHi: 'סוחטת הרבה עבירות מהיריבות', forLo: 'מבצעת מעט עבירות', agLo: 'היריבות מבצעות עליה מעט עבירות' },
  k:   { he: 'כרטיסים',        forHi: 'מקבלת הרבה כרטיסים', agHi: 'גורמת ליריבות לקבל כרטיסים', forLo: 'מקבלת מעט כרטיסים', agLo: 'היריבות שלה מקבלות מעט כרטיסים' },
};
const MODEL_STATS = [...Object.keys(STATS), 'xg'];
const val = (m, side, st) => st === 'g' ? m.g?.[side === 'h' ? 0 : 1] ?? null : st === 'g1' ? m.ht?.[side === 'h' ? 0 : 1] ?? null : st === 'c1' ? m.h1?.c?.[side === 'h' ? 0 : 1] ?? null : m.s?.[side]?.[st] ?? null;

// ---------- המרת תשובת API-Football לרשומה קומפקטית ----------
const API_STAT = { 'Corner Kicks': 'c', 'Total Shots': 'sh', 'Shots on Goal': 'sot', 'Ball Possession': 'pos', 'Fouls': 'f', 'Yellow Cards': 'y', 'Red Cards': 'r', 'expected_goals': 'xg' };
export function compactFixture(it) {
  const st = it.statistics;
  if (!Array.isArray(st) || st.length < 2) return null;
  const side = {};
  for (const t of st) {
    const o = {};
    for (const s of t.statistics || []) { const k = API_STAT[s.type]; if (k) o[k] = s.value == null ? (k === 'y' || k === 'r' ? 0 : null) : parseFloat(String(s.value)); }
    if (o.c == null) return null;
    o.k = o.y != null ? (o.y || 0) + (o.r || 0) : null; delete o.y; delete o.r;
    side[t.team.id === it.teams.home.id ? 'h' : 'a'] = o;
  }
  if (!side.h || !side.a) return null;
  return { id: it.fixture.id, ts: it.fixture.timestamp, lg: it.league.id, season: it.league.season, h: it.teams.home.id, a: it.teams.away.id, ref: it.fixture.referee || null, g: [it.goals.home, it.goals.away], s: side };
}

// ---------- ממוצעי ליגה ופרופילי קבוצות ----------
const DEFAULTS = { c: [5.4, 4.4], g: [1.5, 1.2] };
export function buildLeagueModel(matches, priorMatches = []) {
  const ms = [...matches].sort((x, y) => y.ts - x.ts);
  const pool = priorMatches.length ? [...ms, ...priorMatches] : ms;
  const avg = {}, avail = [];
  for (const st of MODEL_STATS) {
    const rows = pool.filter(m => val(m, 'h', st) != null && val(m, 'a', st) != null);
    if (rows.length >= 8) {
      const hv = rows.map(m => val(m, 'h', st)), av = rows.map(m => val(m, 'a', st));
      const phiObs = rows.length >= 20 ? (variance(hv) / (mean(hv) || 1) + variance(av) / (mean(av) || 1)) / 2 : 1.4;
      avg[st] = { h: mean(hv), a: mean(av), n: rows.length, phi: st === 'g' || st === 'xg' || st === 'g1' ? 1.0 : clamp(1 + TUNE.PHI_K * (phiObs - 1), 1.02, 2.2) };
      if (STATS[st]) avail.push(st);
    } else if (DEFAULTS[st]) { // קרנות ושערים תמיד (עם ברירת מחדל)
      avg[st] = { h: DEFAULTS[st][0], a: DEFAULTS[st][1], n: rows.length, phi: st === 'g' ? 1.0 : 1.3 };
      avail.push(st);
    }
  }
  // שופטים
  const refs = {};
  for (const m of ms) if (m.ref) {
    const r = refs[m.ref] ||= { n: 0, k: [], f: [] };
    r.n++;
    if (val(m, 'h', 'k') != null && val(m, 'a', 'k') != null) r.k.push(val(m, 'h', 'k') + val(m, 'a', 'k'));
    if (val(m, 'h', 'f') != null && val(m, 'a', 'f') != null) r.f.push(val(m, 'h', 'f') + val(m, 'a', 'f'));
  }
  // רשימת משחקים לכל קבוצה (מהחדש לישן)
  const teams = {}, priors = {};
  const push = (id, e) => (teams[id] ||= []).push(e);
  const pushP = (id, e) => (priors[id] ||= []).push(e);
  for (const m of [...priorMatches].sort((x, y) => y.ts - x.ts)) {
    if (m.g?.[0] == null) continue;
    const F = {}, A = {};
    for (const st of MODEL_STATS) { F[st] = val(m, 'h', st); A[st] = val(m, 'a', st); }
    const pw = m.pw != null ? m.pw : undefined;
    pushP(m.h, { id: m.id, ts: m.ts, opp: m.a, v: 'H', F, A, g: m.g, prior: true, pw });
    pushP(m.a, { id: m.id, ts: m.ts, opp: m.h, v: 'A', F: A, A: F, g: [m.g[1], m.g[0]], prior: true, pw });
  }
  for (const m of ms) {
    const F = {}, A = {};
    for (const st of MODEL_STATS) { F[st] = val(m, 'h', st); A[st] = val(m, 'a', st); }
    const hasPos = m.s?.h?.pos != null && m.s?.a?.pos != null;
    const sh1 = m.s?.h?.sh || 0, sh2 = m.s?.a?.sh || 0;
    const posH = hasPos ? m.s.h.pos : (sh1 + sh2 ? Math.round(100 * sh1 / (sh1 + sh2)) : 50);
    push(m.h, { id: m.id, ts: m.ts, opp: m.a, v: 'H', F, A, pos: posH, pk: hasPos, g: m.g });
    push(m.a, { id: m.id, ts: m.ts, opp: m.h, v: 'A', F: A, A: F, pos: 100 - posH, pk: hasPos, g: [m.g[1], m.g[0]] });
  }
  const rates = (() => {
    let n = 0, cs = 0, btts = 0, o25 = 0, g = 0, g1 = 0;
    for (const m of ms) {
      if (m.g?.[0] == null) continue;
      n++; cs += ((m.g[0] === 0) + (m.g[1] === 0)) / 2; btts += m.g[0] > 0 && m.g[1] > 0 ? 1 : 0; o25 += m.g[0] + m.g[1] > 2 ? 1 : 0;
      if (m.ht?.[0] != null) { g += m.g[0] + m.g[1]; g1 += m.ht[0] + m.ht[1]; }
    }
    return n ? { n, cs: cs / n, btts: btts / n, o25: o25 / n, fh: g ? g1 / g : null } : { n: 0 };
  })();
  return { lg: { n: ms.length, avg, avail, refs, rates }, teams, priors, matches: ms };
}

// ממוצע ליגה של מדד לפי מיקום וצד (F = של הקבוצה, A = של היריבה)
export function lgBase(lg, st, v, side) { const a = lg.avg[st]; if (!a) return 1; return ((v === 'H') === (side === 'F') ? a.h : a.a) || 1; }

// חוזק יחסי (1 = ממוצע ליגה) עם כיווץ
export function strength(list, v, st, side, lg, wf, prior, adj) {
  const Lc = list.filter(e => e[side][st] != null);
  const Lp = TUNE.PRIOR_W > 0 && prior ? prior.filter(e => e[side][st] != null) : [];
  const L = Lc.concat(Lp);
  if (!L.length) return 1;
  const w = e => e.prior ? (e.pw != null ? e.pw : TUNE.PRIOR_W) : 1;
  const venue = L.filter(e => e.v === v);
  const nV = venue.reduce((x, e) => x + w(e), 0), nA = L.reduce((x, e) => x + w(e), 0);
  const wf2 = e => (wf ? wf(e) : 1) * w(e);
  const ad = adj && TUNE.OPP_ADJ > 0 ? (e => Math.pow(adj(e) || 1, TUNE.OPP_ADJ)) : (() => 1);
  const rV = venue.length ? wmean(venue, e => e[side][st] / ad(e), wf2) / lgBase(lg, st, v, side) : 1;
  const rA = wmean(L, e => e[side][st] / lgBase(lg, st, e.v, side) / ad(e), wf2);
  const neff = nV + TUNE.VENUE_MIX * nA;
  const comb = (nV * rV + TUNE.VENUE_MIX * nA * rA) / neff;
  return (neff * comb + TUNE.SHRINK_K) / (neff + TUNE.SHRINK_K);
}

function summary(list, lg) {
  if (!list.length) return { n: 0, st: {} };
  const st = {};
  for (const s of [...lg.avail, 'xg']) {
    const L = list.filter(e => e.F[s] != null && e.A[s] != null);
    if (L.length) st[s] = [r1(mean(L.map(e => e.F[s]))), r1(mean(L.map(e => e.A[s])))];
  }
  return { n: list.length, pos: Math.round(mean(list.map(e => e.pos))), posKind: list.some(e => e.pk) ? 'pos' : 'shots', st };
}

// פרופיל סגנון: דיוק, יעילות, פיזיות, מחצית ראשונה, שערים נקיים...
function styleOf(list) {
  const L = list.filter(e => e.g?.[0] != null);
  if (!L.length) return null;
  const mn = (arr) => arr.length ? mean(arr) : null;
  const o = { n: L.length };
  const shL = L.filter(e => e.F.sh != null && e.F.sot != null);
  if (shL.length >= 3) {
    const sh = shL.reduce((x, e) => x + e.F.sh, 0), sot = shL.reduce((x, e) => x + e.F.sot, 0), g = shL.reduce((x, e) => x + e.g[0], 0);
    o.acc = sh ? sot / sh : null; o.conv = sot ? g / sot : null;
    const cL = shL.filter(e => e.F.c != null), csum = cL.reduce((x, e) => x + e.F.c, 0), shc = cL.reduce((x, e) => x + e.F.sh, 0);
    o.cps = shc ? csum / shc : null;
  }
  o.fouls = mn(L.filter(e => e.F.f != null).map(e => e.F.f)); o.foulsAg = mn(L.filter(e => e.A.f != null).map(e => e.A.f));
  o.cards = mn(L.filter(e => e.F.k != null).map(e => e.F.k)); o.cardsAg = mn(L.filter(e => e.A.k != null).map(e => e.A.k));
  const xL = L.filter(e => e.F.xg != null); o.xgd = xL.length >= 3 ? mean(xL.map(e => e.g[0] - e.F.xg)) : null;
  const fL = L.filter(e => e.F.g1 != null && e.g[0] > 0); const gs = fL.reduce((x, e) => x + e.g[0], 0); o.fh = fL.length >= 4 && gs ? fL.reduce((x, e) => x + e.F.g1, 0) / gs : null;
  const fa = L.filter(e => e.A.g1 != null && e.g[1] > 0); const ga = fa.reduce((x, e) => x + e.g[1], 0); o.fhAg = fa.length >= 4 && ga ? fa.reduce((x, e) => x + e.A.g1, 0) / ga : null;
  o.cs = mean(L.map(e => e.g[1] === 0 ? 1 : 0)); o.fts = mean(L.map(e => e.g[0] === 0 ? 1 : 0));
  o.btts = mean(L.map(e => e.g[0] > 0 && e.g[1] > 0 ? 1 : 0)); o.o25 = mean(L.map(e => e.g[0] + e.g[1] > 2 ? 1 : 0));
  const res = e => e.g[0] > e.g[1] ? 'W' : e.g[0] === e.g[1] ? 'D' : 'L';
  o.w = L.filter(e => res(e) === 'W').length; o.d = L.filter(e => res(e) === 'D').length; o.l = L.filter(e => res(e) === 'L').length;
  o.form = L.slice(0, 6).map(res).join('');
  o.ppg = (o.w * 3 + o.d) / L.length;
  for (const k of Object.keys(o)) if (typeof o[k] === 'number' && !Number.isInteger(o[k])) o[k] = Math.round(o[k] * 1000) / 1000;
  return o;
}

export function teamProfile(model, teamId, v, teamsInfo, opt = {}) {
  const { lg } = model;
  const rankOf = opt.rankOf || null;
  const tierOf = id => { const r = rankOf && rankOf(id); return r ? tierFromRank(r.rank, r.n) : null; };
  const wf = rankOf && opt.oppTier ? (e => { const t = tierOf(e.opp); if (!t) return 1; return t === opt.oppTier ? 1 : (t === 'mid' || opt.oppTier === 'mid') ? 0.85 : 0.7; }) : null;
  const list = model.teams[teamId] || [];
  const all = summary(list, lg), home = summary(list.filter(e => e.v === 'H'), lg), away = summary(list.filter(e => e.v === 'A'), lg);
  const str = {};
  for (const s of lg.avail) {
    const pr = (model.priors && model.priors[teamId]) || null;
    let att = strength(list, v, s, 'F', lg, wf, pr), def = strength(list, v, s, 'A', lg, wf, pr);
    if (s === 'g' && lg.avg.xg && list.some(e => e.F.xg != null)) { // שערים: חצי שערים בפועל, חצי xG
      att = 0.5 * att + 0.5 * strength(list, v, 'xg', 'F', lg, wf, pr);
      def = 0.5 * def + 0.5 * strength(list, v, 'xg', 'A', lg, wf, pr);
    }
    str[s] = { att: r2(att), def: r2(def) };
  }
  // פתיחות: כמה "קורה" במשחקים של הקבוצה (בעיטות + xG + שערים של שני הצדדים) ביחס לממוצע הליגה
  let open = null;
  if (all.n >= 3 && all.st.sh && lg.avg.sh) {
    const shRatio = (all.st.sh[0] + all.st.sh[1]) / (lg.avg.sh.h + lg.avg.sh.a);
    const xgRatio = all.st.xg && lg.avg.xg ? (all.st.xg[0] + all.st.xg[1]) / (lg.avg.xg.h + lg.avg.xg.a) : null;
    const gRatio = all.st.g ? (all.st.g[0] + all.st.g[1]) / (lg.avg.g.h + lg.avg.g.a) : 1;
    open = r2(xgRatio != null ? 0.45 * shRatio + 0.35 * xgRatio + 0.2 * gRatio : 0.7 * shRatio + 0.3 * gRatio);
  }
  const totals = list.filter(e => e.F.c != null && e.A.c != null).map(e => e.F.c + e.A.c);
  const cv = totals.length > 2 ? Math.sqrt(variance(totals)) / (mean(totals) || 1) : 0.5;
  const last5 = list.slice(0, 5).map(e => ({ ts: e.ts, opp: teamsInfo[e.opp]?.n || '?', v: e.v, g: e.g, c: [e.F.c, e.A.c], sh: [e.F.sh, e.A.sh], f: [e.F.f, e.A.f], k: [e.F.k, e.A.k] }));

  const tags = [];
  if (all.n >= 3) {
    const pw = all.posKind === 'pos' ? 'בהחזקת כדור' : 'מהבעיטות במשחקים שלה';
    if (all.pos >= 56) tags.push({ t: `קבוצה שולטת (${pw})`, k: 'up' });
    else if (all.pos <= 44) tags.push({ t: `משחק תגובתי / קונטרות (${pw})`, k: 'down' });
    if (open != null && open >= 1.1) tags.push({ t: 'משחקת פתוח — הרבה קורה במשחקים שלה', k: 'up' });
    else if (open != null && open <= 0.9) tags.push({ t: 'משחקים סגורים — מעט אירועים', k: 'down' });
    for (const s of ['c', 'g', 'f', 'k']) {
      if (!str[s] || !all.st[s]) continue;
      if (str[s].att >= 1.15) tags.push({ t: STATS[s].forHi, k: 'up' }); else if (str[s].att <= 0.85) tags.push({ t: STATS[s].forLo, k: 'down' });
      if (str[s].def >= 1.15) tags.push({ t: STATS[s].agHi, k: 'up' }); else if (str[s].def <= 0.85) tags.push({ t: STATS[s].agLo, k: 'down' });
    }
    if (all.st.xg && all.n >= 4) {
      if (all.st.xg[0] >= 1.8) tags.push({ t: `מייצרת מצבים איכותיים (xG ${all.st.xg[0]})`, k: 'up' });
      if (all.st.xg[1] <= 0.9) tags.push({ t: `הגנה הרמטית (xG נגד ${all.st.xg[1]})`, k: 'down' });
    }
    const l5 = list.slice(0, 5).filter(e => e.F.c != null);
    if (l5.length >= 4 && totals.length >= 8) {
      const recent = mean(l5.map(e => e.F.c)), season = mean(list.filter(e => e.F.c != null).map(e => e.F.c));
      if (recent >= season * 1.2) tags.push({ t: 'מגמת עלייה בקרנות (5 אחרונים)', k: 'up' });
      else if (recent <= season * 0.8) tags.push({ t: 'מגמת ירידה בקרנות (5 אחרונים)', k: 'down' });
    }
  }
  const style = { all: styleOf(list), role: styleOf(list.filter(e => e.v === v)) };
  // פילוח: כל המשחקים / לפי הבית-חוץ של המשחק הקרוב / מול גדולות-בינוניות-קטנות / מול סוג היריבה הקרובה
  const SPL = ['g', 'g1', 'c', 'c1', 'sh', 'sot', 'f', 'k'];
  const agg = L => { const st = {}; for (const x of SPL) { const X = L.filter(e => e.F[x] != null && e.A[x] != null); if (X.length) st[x] = [r1(mean(X.map(e => e.F[x]))), r1(mean(X.map(e => e.A[x])))]; } return { n: L.length, st }; };
  const roleL = list.filter(e => e.v === v);
  const splits = { all: agg(list), role: agg(roleL), top: agg(list.filter(e => tierOf(e.opp) === 'top')), mid: agg(list.filter(e => tierOf(e.opp) === 'mid')), bot: agg(list.filter(e => tierOf(e.opp) === 'bot')),
    rel: opt.oppTier ? agg(roleL.filter(e => tierOf(e.opp) === opt.oppTier)) : null, relAll: opt.oppTier ? agg(list.filter(e => tierOf(e.opp) === opt.oppTier)) : null };
  const rd = x => x == null ? null : Math.round(x * 10) / 10;
  const log = list.map(e => { const rk = rankOf && rankOf(e.opp); return { ts: e.ts, opp: teamsInfo[e.opp]?.n || '?', v: e.v, g: e.g, g1: [e.F.g1, e.A.g1], c: [e.F.c, e.A.c], sh: [e.F.sh, e.A.sh], sot: [e.F.sot, e.A.sot], f: [e.F.f, e.A.f], k: [e.F.k, e.A.k], xg: [rd(e.F.xg), rd(e.A.xg)], tier: tierOf(e.opp), rank: rk ? rk.rank : null }; });
  const me = rankOf && rankOf(teamId);
  return { id: teamId, rank: me ? me.rank : null, nTeams: me ? me.n : null, tier: me ? tierFromRank(me.rank, me.n) : null, splits, log,
   name: teamsInfo[teamId]?.n || String(teamId), logo: teamsInfo[teamId]?.l || null, games: list.length, all, home, away, str, open, cv: r2(cv), last5, tags, style };
}

// ---------- התפלגויות ----------
export function nbPmf(lambda, phi) {
  const out = new Array(MAXK + 1).fill(0);
  lambda = Math.max(lambda, 0.05);
  if (phi <= 1.0001) { out[0] = Math.exp(-lambda); for (let k = 1; k <= MAXK; k++) out[k] = out[k - 1] * lambda / k; }
  else {
    const r = lambda / (phi - 1), q = lambda / (r + lambda);
    out[0] = Math.pow(r / (r + lambda), r);
    for (let k = 1; k <= MAXK; k++) out[k] = out[k - 1] * (k - 1 + r) / k * q;
  }
  const s = out.reduce((a, b) => a + b, 0);
  return out.map(x => x / s);
}
export const oneHot = k => { const a = new Array(MAXK + 1).fill(0); a[Math.min(Math.round(k), MAXK)] = 1; return a; };

function joint(dh, da) {
  const tot = new Array(2 * MAXK + 1).fill(0), diff = new Map();
  let both = 0;
  for (let i = 0; i <= MAXK; i++) {
    if (dh[i] < 1e-9) continue;
    for (let j = 0; j <= MAXK; j++) {
      const p = dh[i] * da[j]; if (p < 1e-12) continue;
      tot[i + j] += p; diff.set(i - j, (diff.get(i - j) || 0) + p); if (i > 0 && j > 0) both += p;
    }
  }
  return { tot, diff, both };
}

// ---------- סליקת שוק — {win, push, lose} ----------
function settleOn(values, pass) { const o = { win: 0, push: 0, lose: 0 }; for (const [x, p] of values) { const r = pass(x); if (r > 0) o.win += p; else if (r < 0) o.lose += p; else o.push += p; } return o; }
function splitQuarter(line, fn) {
  const frac = Math.round((line % 1 + 1) % 1 * 100);
  if (frac === 25 || frac === 75) { const a = fn(line - 0.25), b = fn(line + 0.25); return { win: (a.win + b.win) / 2, push: (a.push + b.push) / 2, lose: (a.lose + b.lose) / 2 }; }
  return fn(line);
}
const sgn = x => (Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1);

export function settle(mk, dh, da) {
  const { tot, diff, both } = joint(dh, da);
  const totV = tot.map((p, i) => [i, p]), diffV = [...diff.entries()];
  const hV = dh.map((p, i) => [i, p]), aV = da.map((p, i) => [i, p]);
  const ou = (vals, side, line) => splitQuarter(line, l => settleOn(vals, x => side === 'over' ? sgn(x - l) : sgn(l - x)));
  switch (mk.group) {
    case 'total': return ou(totV, mk.side, mk.line);
    case 'home': return ou(hV, mk.side, mk.line);
    case 'away': return ou(aV, mk.side, mk.line);
    case 'total3': return settleOn(totV, x => (mk.side === 'over' ? x > mk.line : mk.side === 'under' ? x < mk.line : x === mk.line) ? 1 : -1);
    case '1x2': return settleOn(diffV, d => (mk.side === 'home' ? d > 0 : mk.side === 'away' ? d < 0 : d === 0) ? 1 : -1);
    case 'dc': return settleOn(diffV, d => (mk.side === '1x' ? d >= 0 : mk.side === 'x2' ? d <= 0 : d !== 0) ? 1 : -1);
    case 'ah': return splitQuarter(mk.line, l => settleOn(diffV, d => sgn((mk.side === 'home' ? d : -d) + l)));
    case 'btts': return mk.side === 'yes' ? { win: both, push: 0, lose: 1 - both } : { win: 1 - both, push: 0, lose: both };
  }
  throw new Error('unknown market ' + mk.group);
}

// ---------- יחסים ----------
// שווקי קרנות של Bet365 (מ-API-Football בתשלום)
export function parseCornerOdds(bets) {
  const out = [];
  for (const b of bets || []) {
    const name = b.name || '';
    if (!/corner/i.test(name) || /1st|2nd|first|second|half/i.test(name)) continue;
    const vals = b.values || [];
    const has3 = vals.some(v => /^exactly/i.test(String(v.value)));
    for (const v of vals) {
      const value = String(v.value).trim(), odds = parseFloat(v.odd);
      if (!(odds > 1)) continue;
      let m;
      if (/asian handicap/i.test(name) && !/european/i.test(name) && (m = value.match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)$/i))) { const sd = m[1].toLowerCase(), hl = parseFloat(m[2]); out.push({ stat: 'c', group: 'ah', side: sd, line: sd === 'away' ? -hl : hl, odds }); }   // Bet365 מצטטת את שני הצדדים לפי הקו של המארחת: "Away +1.5" = האורחת -1.5
      else if (/1x2|3[\s-]?way|three|most/i.test(name) && !has3 && /^(home|draw|away|1|x|2)$/i.test(value)) out.push({ stat: 'c', group: '1x2', side: { '1': 'home', 'x': 'draw', '2': 'away' }[value.toLowerCase()] || value.toLowerCase(), odds });
      else if ((m = value.match(/^(over|under|exactly)\s*(\d+(?:\.\d+)?)$/i))) {
        const side = m[1].toLowerCase(), line = parseFloat(m[2]);
        let group = 'total';
        if (/home/i.test(name)) group = 'home'; else if (/away/i.test(name)) group = 'away'; else if (has3) group = 'total3';
        if (side === 'exactly' && group !== 'total3') continue;
        out.push({ stat: 'c', group, side, line, odds });
      }
    }
  }
  const seen = new Set();
  return out.filter(o => { const k = `${o.group}|${o.side}|${o.line}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// 1X2 ושערים מעל/מתחת 2.5 (יחסי Bet365 אמיתיים)
export function parseMatchOdds(bets) {
  const out = {};
  for (const b of bets || []) {
    const name = b.name || '';
    if (/^match winner$|^1x2$|^fulltime result$/i.test(name)) {
      const raw = Object.fromEntries((b.values || []).map(x => [String(x.value).toLowerCase(), parseFloat(x.odd)]));
      const o = { h: raw.home ?? raw['1'], d: raw.draw ?? raw.x, a: raw.away ?? raw['2'] };
      if (o.h > 1 && o.d > 1 && o.a > 1) { const s = 1 / o.h + 1 / o.d + 1 / o.a; out.mw = { h: r2(1 / o.h / s), d: r2(1 / o.d / s), a: r2(1 / o.a / s) }; out.mwOdds = o; }
    }
    if (/^goals over\/under$/i.test(name)) {
      const ov = (b.values || []).find(x => /^over 2\.5$/i.test(x.value)), un = (b.values || []).find(x => /^under 2\.5$/i.test(x.value));
      if (ov && un) { const po = 1 / ov.odd, pu = 1 / un.odd; out.o25 = r2(po / (po + pu)); out.ouOdds = { over: parseFloat(ov.odd), under: parseFloat(un.odd) }; }
    }
  }
  return out;
}

// כל יחסי Bet365 האמיתיים שמוצעים במשחק (חוץ מקרנות לכל המשחק, שמטופלות ב-parseCornerOdds)
export function parseRealOdds(bets) {
  const list = [];
  const push = (stat, group, side, line, odds) => { if (odds > 1) list.push({ stat, group, side, line, odds }); };
  for (const b of bets || []) {
    const name = b.name || '', vals = b.values || [];
    const ou = (stat, group) => { for (const v of vals) { const m = String(v.value).trim().match(/^(over|under)\s*(\d+(?:\.\d+)?)$/i); if (m) push(stat, group, m[1].toLowerCase(), parseFloat(m[2]), parseFloat(v.odd)); } };
    if (/^goals over\/under$/i.test(name)) ou('g', 'total');
    else if (/^total - home$/i.test(name)) ou('g', 'home');
    else if (/^total - away$/i.test(name)) ou('g', 'away');
    else if (/^both teams score$/i.test(name)) { for (const v of vals) { const k = String(v.value).toLowerCase(); if (k === 'yes' || k === 'no') push('g', 'btts', k, null, parseFloat(v.odd)); } }
    else if (/^double chance$/i.test(name)) { const mp = { 'home/draw': '1x', 'draw/away': 'x2', 'home/away': '12' }; for (const v of vals) { const k = mp[String(v.value).toLowerCase()]; if (k) push('g', 'dc', k, null, parseFloat(v.odd)); } }
    else if (/^match winner$/i.test(name)) { for (const v of vals) { const k = String(v.value).toLowerCase(); if (['home', 'draw', 'away'].includes(k)) push('g', '1x2', k, null, parseFloat(v.odd)); } }
    else if (/corners/i.test(name) && /1st half|first half/i.test(name) && !/handicap|race|range|3 way/i.test(name)) {
      const has3 = vals.some(v => /^exactly/i.test(String(v.value)));
      for (const v of vals) { const mm = String(v.value).trim().match(/^(over|under|exactly)\s*(\d+(?:\.\d+)?)$/i); if (!mm) continue; push('c1', has3 ? 'total3' : /home/i.test(name) ? 'home' : /away/i.test(name) ? 'away' : 'total', mm[1].toLowerCase(), parseFloat(mm[2]), parseFloat(v.odd)); }
    }
    else if (/shots? on (target|goal)/i.test(name) && !/player|1st|first|half/i.test(name)) ou('sot', /home/i.test(name) ? 'home' : /away/i.test(name) ? 'away' : 'total');
    else if (/^(home |away )?(total )?shots( over\/under)?$/i.test(name) || /^(home|away) shots/i.test(name)) ou('sh', /home/i.test(name) ? 'home' : /away/i.test(name) ? 'away' : 'total');
  }
  // הסתברות שוק בלי עמלה, לפי זוגות מעל/מתחת וכן/לא
  const pair = o => list.find(x => x !== o && x.stat === o.stat && x.group === o.group && x.line === o.line && x.side !== o.side && ['over', 'under', 'yes', 'no'].includes(x.side));
  for (const o of list) { if (['over', 'under', 'yes', 'no'].includes(o.side) && (o.group !== 'total3' || o.line % 1 !== 0)) { const p = pair(o); if (p) o.pMarket = (1 / o.odds) / (1 / o.odds + 1 / p.odds); } }
  for (const o of list) if (o.group === 'total3' && o.line % 1 === 0) { const trio = ['over', 'under', 'exactly'].map(sd => list.find(x => x.stat === o.stat && x.group === 'total3' && x.line === o.line && x.side === sd)); if (trio.every(Boolean)) o.pMarket = (1 / o.odds) / trio.reduce((t, x) => t + 1 / x.odds, 0); }
  return list;
}

// הסתברות שוק ללא עמלה לשווקי קרנות אמיתיים
function marketProbs(list) {
  const groups = new Map();
  for (const o of list) { const k = o.group === '1x2' ? '1x2' : `${o.group}|${o.group === 'ah' ? Math.abs(o.line) : o.line ?? ''}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  for (const g of groups.values()) {
    if (g[0].group === 'ah') { for (const o of g) { const opp = g.find(p => p.side !== o.side && Math.abs(p.line + o.line) < 1e-9); o.pMarket = opp ? (1 / o.odds) / (1 / o.odds + 1 / opp.odds) : 0.95 / o.odds; } continue; }
    const inv = g.reduce((s, o) => s + 1 / o.odds, 0);
    const complete = (g[0].group === '1x2' || g[0].group === 'total3') ? g.length === 3 : g.length === 2;
    for (const o of g) o.pMarket = complete ? (1 / o.odds) / inv : 0.95 / o.odds;
  }
}

// ---------- תוויות ----------
const OU = (m) => `${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line}`;
function label(m, H, A) {
  const S = STATS[m.stat].he;
  if (m.stat === 'g') {
    if (m.group === '1x2') return m.side === 'home' ? `${H} מנצחת` : m.side === 'away' ? `${A} מנצחת` : 'תיקו';
    if (m.group === 'dc') return m.side === '1x' ? `${H} לא מפסידה (1X)` : m.side === 'x2' ? `${A} לא מפסידה (X2)` : 'לא תיקו (12)';
    if (m.group === 'btts') return m.side === 'yes' ? 'שתי הקבוצות כובשות' : 'לפחות קבוצה אחת לא כובשת';
  }
  if (m.group === 'total') return `${OU(m)} ${S} במשחק`;
  if (m.group === 'total3') return m.side === 'exactly' ? `בדיוק ${m.line} ${S}` : `${OU(m)} ${S} (3 אפשרויות)`;
  if (m.group === 'home') return `${H} – ${OU(m)} ${S}`;
  if (m.group === 'away') return `${A} – ${OU(m)} ${S}`;
  if (m.group === '1x2') return m.side === 'home' ? `${H} תיקח יותר ${S}` : m.side === 'away' ? `${A} תיקח יותר ${S}` : `שוויון ב${S}`;
  if (m.group === 'ah') return `${m.side === 'home' ? H : A} ${m.line > 0 ? '+' : ''}${m.line} הנדיקאפ ${S}`;
  return '?';
}

// ---------- דירוג ----------
function scoreMarket(m, conf, hist) {
  // הסתברות משוקללת: המודל שלנו, היסטוריית בית/חוץ העונה, 6 אחרונים, ראש בראש והשוק (יחס אמיתי או משוער)
  const parts = [], wts = [];
  const add = (v, w) => { if (v != null && !Number.isNaN(v)) { parts.push(v * w); wts.push(w); } };
  add(m.pModel, 0.5);
  if (hist) { add(hist.v, 0.2); add(hist.l6, 0.1); add(hist.t, 0.1); if (hist.x && hist.x[1] >= 2) add(hist.x[0], 0.05); }
  add(m.pMarket, m.odds ? 0.3 : 0.15);
  const p = parts.reduce((x, y) => x + y, 0) / wts.reduce((x, y) => x + y, 0);
  let S = (p - 0.45) / 0.35;                                   // 45% = 0, 80% = 1
  const edge = m.pMarket != null ? m.pModel - m.pMarket : 0;
  S += clamp(edge / 0.2, -0.3, 0.3) * 0.5;                     // יתרון מול השוק
  if (m.pMarket != null && Math.abs(edge) > 0.18) S -= (Math.abs(edge) - 0.18) * 2; // פער חשוד מהשוק: כנראה חסר מידע למודל
  if (hist && hist.v != null && hist.v < 0.4 && m.pModel >= 0.5) S -= 0.15;
  let score = 1 + 9 * clamp(S, 0, 1);
  score *= 0.55 + 0.45 * conf;                                 // ביטחון בנתונים
  const nHist = hist && hist.hv && hist.av ? Math.min(hist.hv[1], hist.av[1]) : 0;
  if (nHist < 4) score = Math.min(score, 6);                   // מעט משחקים: לא דירוג גבוה
  if (!m.odds) score -= 0.3;                                   // יחס משוער = קצת פחות ודאות
  if (m.pFinal < 0.5) score = Math.min(score, 4);
  const price = m.odds || m.estOdds;                           // יחס נמוך מאוד = תמורה קטנה: לא נותנים ציון גבוה
  if (price != null) { if (price < 1.35) score = Math.min(score, 6); else if (price < 1.5) score = Math.min(score, 7); }
  return clamp(Math.round(score), 1, 10);
}

// קווים מועמדים סביב הצפי
function candidateLines(stat, eT, eH, eA) {
  const out = [];
  const around = (center, span) => { const b = Math.floor(center); const ls = []; for (let l = b - span + 0.5; l <= b + span + 0.5; l += 1) if (l > 0) ls.push(l); return ls; };
  if (stat === 'c1') {
    for (const l of [3.5, 4.5, 5.5]) for (const side of ['over', 'under']) out.push({ group: 'total', side, line: l });
    for (const g of ['home', 'away']) for (const l of [1.5, 2.5]) for (const side of ['over', 'under']) out.push({ group: g, side, line: l });
    return out;
  }
  if (stat === 'g1') {
    for (const l of [0.5, 1.5]) for (const side of ['over', 'under']) out.push({ group: 'total', side, line: l });
    for (const g of ['home', 'away']) for (const side of ['over', 'under']) out.push({ group: g, side, line: 0.5 });
    return out;
  }
  if (stat === 'g') {
    for (const l of [1.5, 2.5, 3.5]) for (const side of ['over', 'under']) out.push({ group: 'total', side, line: l });
    for (const [g, lam] of [['home', eH], ['away', eA]]) for (const l of [0.5, 1.5, 2.5]) if (l < lam + 1.5) for (const side of ['over', 'under']) out.push({ group: g, side, line: l });
    for (const side of ['home', 'draw', 'away']) out.push({ group: '1x2', side });
    for (const side of ['1x', 'x2', '12']) out.push({ group: 'dc', side });
    for (const side of ['yes', 'no']) out.push({ group: 'btts', side });
    return out;
  }
  const spanT = stat === 'sh' || stat === 'f' ? 4 : 3, spanTeam = stat === 'sh' || stat === 'f' ? 3 : 2;
  for (const l of around(eT, spanT)) for (const side of ['over', 'under']) out.push({ group: 'total', side, line: l });
  for (const [g, lam] of [['home', eH], ['away', eA]]) for (const l of around(lam, spanTeam)) for (const side of ['over', 'under']) out.push({ group: g, side, line: l });
  if (stat === 'c') {
    for (const side of ['home', 'away']) out.push({ group: '1x2', side });
    for (const l of [-2.5, -1.5, 1.5, 2.5]) for (const side of ['home', 'away']) out.push({ group: 'ah', side, line: l });
  }
  return out;
}

// ---------- היסטוריה: באיזה אחוז מהמשחקים ההימור "עבר" ----------
// e = רשומת משחק מנקודת מבט הקבוצה; who = התפקיד שלה במשחק הקרוב (H בית / A חוץ)
function outcome(mk, e, who) {
  const st = mk.stat, f = e.F[st], a = e.A[st];
  if (f == null || a == null) return null;
  const sm = settle(mk, oneHot(who === 'H' ? f : a), oneHot(who === 'H' ? a : f));
  const d = sm.win + sm.lose;
  return d > 1e-9 ? sm.win / d : null;
}
function rateOf(list, mk, who) {
  let sum = 0, n = 0;
  for (const e of list) { const r = outcome(mk, e, who); if (r != null) { sum += r; n++; } }
  return n ? [Math.round(sum / n * 100) / 100, n] : null;
}
const MEET_KEY = { g: 'g', c: 'c', sh: 'sh', sot: 'sot', f: 'f', k: 'k' };
function meetRate(meetings, mk) {
  const key = MEET_KEY[mk.stat];
  if (!key) return null;
  let sum = 0, n = 0;
  for (const m of meetings || []) {
    const arr = m[key]; if (!arr || arr[0] == null || arr[1] == null) continue;
    const sm = settle(mk, oneHot(arr[0]), oneHot(arr[1])), d = sm.win + sm.lose;
    if (d > 1e-9) { sum += sm.win / d; n++; }
  }
  return n ? [Math.round(sum / n * 100) / 100, n] : null;
}
const combine = (a, b) => { const p = [a, b].filter(x => x && x[1] >= 3); if (!p.length) return null; const n = p.reduce((s, x) => s + x[1], 0); return Math.round(p.reduce((s, x) => s + x[0] * x[1], 0) / n * 100) / 100; };
function histOf(mk, listH, listA, meetings, tf) {
  const hv = rateOf(listH.filter(e => e.v === 'H'), mk, 'H'), av = rateOf(listA.filter(e => e.v === 'A'), mk, 'A');
  const h6 = rateOf(listH.slice(0, 6), mk, 'H'), a6 = rateOf(listA.slice(0, 6), mk, 'A');
  const x = meetRate(meetings, mk);
  const t = tf ? combine(rateOf(listH.filter(tf.h), mk, 'H'), rateOf(listA.filter(tf.a), mk, 'A')) : null;
  return { hv, av, h6, a6, x, v: combine(hv, av), l6: combine(h6, a6), t };
}
const TREND_STEP = { g: 1, g1: 1, c: 1, c1: 1, sh: 2, sot: 1, f: 2, k: 1 };
function trendLines(stat, eT) {
  const step = TREND_STEP[stat] || 1, base = Math.floor(eT) + 0.5, out = [];
  if (stat === 'g1') return [0.5, 1.5];
  if (stat === 'c1') return [3.5, 4.5, 5.5];
  for (let i = -2; i <= 2; i++) { const l = base + i * step; if (l > (stat === 'g' ? 1 : 0)) out.push(l); }
  return out;
}

// ---------- ניתוח משחק ----------
function pooledLg(a, b) {
  const avg = {}, avail = a.avail.filter(s => b.avail.includes(s));
  for (const s of new Set([...Object.keys(a.avg), ...Object.keys(b.avg)])) {
    const x = a.avg[s], y = b.avg[s];
    avg[s] = x && y ? { h: (x.h + y.h) / 2, a: (x.a + y.a) / 2, n: x.n + y.n, phi: Math.max(x.phi, y.phi) } : x || y;
  }
  return { n: a.n + b.n, avg, avail, refs: {}, rates: a.rates };
}
const pois = (l, n = 12) => { const o = [Math.exp(-l)]; for (let k = 1; k <= n; k++) o.push(o[k - 1] * l / k); return o; };
function estimate1x2(lh, la) { // 1X2 ו-over 2.5 משוערים מציפי שערים (כשאין יחסי Bet365)
  const a = pois(lh), b = pois(la); let h = 0, d = 0, w = 0, o = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) { const p = a[i] * b[j]; if (i > j) h += p; else if (i === j) d += p; else w += p; if (i + j > 2) o += p; }
  const s = h + d + w; return { mw: { h: r2(h / s), d: r2(d / s), a: r2(w / s) }, o25: r2(o / s) };
}

// "קריאת שוק": מה Bet365 אומרת על המשחק (פייבוריטית, קו שערים וקו קרנות מרכזיים). משמש כשאין לנו נתונים על אחת הקבוצות, למשל קבוצה חובבנית בגביע
export function marketRead(bets) {
  const B = (bets || []).filter(b => b && b.values && b.name), out = {};
  const mw = B.find(b => /^match winner$/i.test(b.name));
  if (mw) {
    const g = k => { const v = mw.values.find(x => String(x.value).toLowerCase() === k); return v ? parseFloat(v.odd) : null; };
    const o = { h: g('home'), d: g('draw'), a: g('away') };
    if (o.h > 0 && o.d > 0 && o.a > 0) { const t = 1 / o.h + 1 / o.d + 1 / o.a; out.odds = o; out.p = { h: r2(1 / o.h / t), d: r2(1 / o.d / t), a: r2(1 / o.a / t) }; }
  }
  const central = re => {
    const b = B.find(x => re.test(x.name)); if (!b) return null;
    const lines = {}; for (const v of b.values) { const m = String(v.value).match(/^(over|under)\s*(\d+(?:\.\d+)?)$/i); if (m) (lines[m[2]] ||= {})[m[1].toLowerCase()] = parseFloat(v.odd); }
    let best = null; for (const [l, x] of Object.entries(lines)) if (x.over > 1 && x.under > 1) { const p = (1 / x.over) / (1 / x.over + 1 / x.under), d = Math.abs(p - 0.5); if (!best || d < best.d) best = { d, line: Number(l), pOver: r2(p), over: x.over, under: x.under }; }
    return best ? { line: best.line, pOver: best.pOver, over: best.over, under: best.under } : null;
  };
  out.goals = central(/^goals over\/under$/i); out.corners = central(/^corners over under$/i);
  return out.odds || out.goals || out.corners ? out : null;
}

export function analyzeFixture(fx, model, teamsInfo, bets, ctx = {}) {
  const modelA = ctx.modelA || model, cross = modelA !== model;
  const lg = cross ? pooledLg(model.lg, modelA.lg) : model.lg;
  const tierId = id => { const r = ctx.rankOf && ctx.rankOf(id); return r ? tierFromRank(r.rank, r.n) : null; };
  const H = teamProfile(model, fx.h, 'H', teamsInfo, { rankOf: ctx.rankOf, oppTier: tierId(fx.a) });
  const A = teamProfile(modelA, fx.a, 'A', teamsInfo, { rankOf: ctx.rankOf, oppTier: tierId(fx.h) });
  const matchup = { h: { opp: A.name, rank: A.rank, n: A.nTeams, tier: A.tier }, a: { opp: H.name, rank: H.rank, n: H.nTeams, tier: H.tier } };
  const mo = parseMatchOdds(bets);
  if (!mo.mw && Math.min(H.games, A.games) >= 3 && lg.avg.g && H.str.g && A.str.g) { // בלי יחסים אמיתיים: מעריכים מהמודל
    const est = estimate1x2(lg.avg.g.h * H.str.g.att * A.str.g.def * (ctx.coef ? Math.sqrt(ctx.coef) : 1), lg.avg.g.a * A.str.g.att * H.str.g.def / (ctx.coef ? Math.sqrt(ctx.coef) : 1));
    mo.mw = est.mw; mo.o25 = est.o25; mo.est = true;
  }
  const ref = fx.ref ? { name: fx.ref, ...(lg.refs[fx.ref] || { n: 0, k: [], f: [] }) } : null;
  const ch = matchCharacter(H, A, mo, ctx, lg, ref);
  ch.mwOdds = mo.mwOdds || null;
  const news = ctx.news || null;

  // ---- צפי לכל מדד ----
  const exp = {};
  for (const s of lg.avail) {
    const av = lg.avg[s];
    let eh = av.h * H.str[s].att * A.str[s].def, ea = av.a * A.str[s].att * H.str[s].def;
    const raw = { h: r2(eh), a: r2(ea) };
    const ex = s === 'g' || s === 'g1' ? 1 : CB.includes(s) ? 0.5 : 0;
    if (cross && ctx.coef && ex) { const f = Math.pow(ctx.coef, ex); eh *= Math.sqrt(f); ea /= Math.sqrt(f); } // פער עוצמה בין הליגות
    if (s === 'g' && ch.bogeyAdj) { eh *= ch.bogeyAdj.h; ea *= ch.bogeyAdj.a; }
    if (news?.adj && ex) { // פציעות / הרכבים (מוגבל ל-±20%)
      const c = x => Math.min(1.2, Math.max(0.8, x || 1));
      eh *= Math.pow(c(news.adj.h?.att) * c(news.adj.a?.def), ex); ea *= Math.pow(c(news.adj.a?.att) * c(news.adj.h?.def), ex);
    }
    if (s === 'c' && lg.avg.sh && H.str.sh && A.str.sh) { // קרנות: שילוב עם נפח בעיטות
      const hs = av.h * H.str.sh.att * A.str.sh.def, as = av.a * A.str.sh.att * H.str.sh.def;
      exp.cShots = { h: r2(hs), a: r2(as) }; exp.cOnly = { h: r2(eh), a: r2(ea) };
      eh = TUNE.W_CORNERS * eh + (1 - TUNE.W_CORNERS) * hs; ea = TUNE.W_CORNERS * ea + (1 - TUNE.W_CORNERS) * as;
    }
    if (CB.includes(s) && ch.share != null) { // מי שולטת לפי השוק
      const T = eh + ea, sm = eh / T, sh = 0.75 * sm + 0.25 * ch.share;
      eh = T * sh; ea = T * (1 - sh);
    }
    if (CB.includes(s)) { eh *= ch.tempo; ea *= ch.tempo; }
    if ((s === 'k' || s === 'f') && ch.refFactor?.[s]) { eh *= ch.refFactor[s]; ea *= ch.refFactor[s]; }
    let lf = null;
    if (['g', 'c', 'sh', 'sot'].includes(s) && ctx.learn) { // תיקון לפי מה שלמדנו מהמעקב על כל קבוצה
      const fh = learnFactor(ctx.learn[String(fx.h)] && ctx.learn[String(fx.h)][s]), fa = learnFactor(ctx.learn[String(fx.a)] && ctx.learn[String(fx.a)][s]);
      if (fh !== 1 || fa !== 1) { eh *= fh; ea *= fa; lf = { h: r2(fh), a: r2(fa) }; }
    }
    exp[s] = { h: r2(eh), a: r2(ea), total: r2(eh + ea), raw, lg: { h: r1(av.h), a: r1(av.a), total: r1(av.h + av.a) } };
    if (lf) exp[s].lf = lf;
  }

  // ---- רמת ביטחון ----
  const n = Math.min(H.games, A.games);
  const c1 = clamp(n / 12, 0.25, 1);
  const dev = exp.cShots ? Math.abs((exp.cOnly.h + exp.cOnly.a) - (exp.cShots.h + exp.cShots.a)) / (exp.cOnly.h + exp.cOnly.a + 0.01) : 0.1;
  const c2 = clamp(1 - 2 * dev, 0.3, 1);
  const c3 = clamp(1.4 - (H.cv + A.cv) / 2, 0.4, 1);
  const conf = n < 3 ? 0.3 : r2(clamp((0.5 * c1 + 0.3 * c2 + 0.2 * c3) * (news?.uncertain ? 0.9 : 1) * (cross ? 0.92 : 1), 0.3, 1));
  const enough = n >= 3;

  // ---- שווקים ----
  const cornerOdds = parseCornerOdds(bets);
  const okey = o => [o.stat, o.group, o.side, o.line ?? ''].join('|');
  const realList = parseRealOdds(bets);
  if (cornerOdds.length) marketProbs(cornerOdds);
  const markets = [], dists = {};
  const listH = model.teams[fx.h] || [], listA = modelA.teams[fx.a] || [], meetings = ctx.rivalry?.meetings || [];
  const tA = tierId(fx.a), tH = tierId(fx.h), tf = tA && tH ? { h: e => tierId(e.opp) === tA, a: e => tierId(e.opp) === tH } : null; // רק המשחקים מול אותו סוג יריבה
  for (const s of lg.avail) {
    if (!FOCUS.includes(s)) continue;
    const e = exp[s], phi = lg.avg[s].phi;
    const dh = nbPmf(e.h, phi), da = nbPmf(e.a, phi);
    dists[s] = { dh, da };
    if (!enough) continue;
    // "הקו המקובל": ממוצעים פשוטים של בית/חוץ — בערך מה שהשוק משקף
    const avgOf = (...xs) => { const v = xs.filter(x => x != null); return v.length ? mean(v) : null; };
    // "הקו המקובל": הצפי הבסיסי של שתי הקבוצות (בית/חוץ מול ליגה) לפני התאמות — בערך מה שאתר הימורים יציע
    const nh = e.raw ? e.raw.h : lg.avg[s].h, na = e.raw ? e.raw.a : lg.avg[s].a;
    const ndh = nbPmf(nh, phi), nda = nbPmf(na, phi);

    let cands = s === 'c' && cornerOdds.length ? cornerOdds : candidateLines(s, e.total, e.h, e.a).map(c => ({ stat: s, ...c }));
    const realS = s === 'c' ? [] : realList.filter(o => o.stat === s);
    if (realS.length) { // שווקים ש-Bet365 באמת מציעה: רק הקווים שלה, עם היחס שלה
      const offered = new Set(realS.map(o => o.group)), have = new Set(realS.map(okey));
      cands = [...realS.map(o => ({ ...o })), ...cands.filter(c => !offered.has(c.group) && !have.has(okey({ stat: s, ...c })))];
    }
    for (const c0 of cands) {
      const c = { ...c0 };
      // יחסים אמיתיים לשערים: 1X2 ומעל/מתחת 2.5 מ-Bet365
      if (s === 'g' && c.group === '1x2' && mo.mwOdds) { c.odds = mo.mwOdds[c.side[0]]; c.pMarket = mo.mw[c.side[0]]; }
      if (s === 'g' && c.group === 'dc' && mo.mw) { const p = c.side === '1x' ? mo.mw.h + mo.mw.d : c.side === 'x2' ? mo.mw.a + mo.mw.d : mo.mw.h + mo.mw.a; c.pMarket = p; c.estOdds = r2(1 / (p * 1.05)); }
      if (s === 'g' && c.group === 'total' && c.line === 2.5 && mo.ouOdds) { c.odds = mo.ouOdds[c.side]; c.pMarket = c.side === 'over' ? mo.o25 : 1 - mo.o25; }
      if (c.pMarket == null) { const sn = settle(c, ndh, nda); const pn = sn.win / (sn.win + sn.lose || 1e-9); c.pMarket = pn; c.estOdds = r2(clamp(1 / (pn * 1.07), 1.02, 20)); }
      // בלי יחס אמיתי: רק הקו הראשי (שם הבוקי מציע יחס של בערך 1.6–2.4), ונותנים יותר משקל לשוק המשוער
      if (!c.odds && c.group !== 'dc' && (c.pMarket < 0.4 || c.pMarket > 0.62)) continue;
      const st = settle(c, dh, da);
      const pModel = st.win / (st.win + st.lose || 1e-9);
      const wm = s === 'g' && (c.odds || c.group === 'dc') ? 0.7 : c.odds ? W_MARKET : 0.6; // יחסי Bet365 לתוצאה ושערים חדים מאוד — סומכים עליהם יותר
      const pFinal = (1 - wm) * pModel + wm * c.pMarket;
      const price = c.odds || c.estOdds;
      if (!(price >= 1.45 && price <= 4)) continue;   // רק קווים שבאמת מוצעים, ומחיר מינימלי להמלצה 1.45
      if (c.line != null && LINE_WIN[s] && c.group !== 'ah') { const w = LINE_WIN[s][['home', 'away'].includes(c.group) ? 'team' : 'total']; if (c.line < w[0] || c.line > w[1]) continue; }
      const m = {
        ...c, label: label(c, iso(H.name), iso(A.name)),
        pModel: r2(pModel), pMarket: r2(c.pMarket), pFinal: r2(pFinal), push: r2(st.push), fair: r2(1 / Math.max(pModel, 0.01)),
        minOdds: r2(1 + (0.03 / Math.max(1 - st.push, 0.05) + (1 - pFinal)) / Math.max(pFinal, 0.01)),
        ev: r2(pFinal * (1 - st.push) * (price - 1) - (1 - pFinal) * (1 - st.push)),
      };
      if (!m.odds) delete m.odds;
      m.hist = histOf(m, listH, listA, meetings, tf);
      m.score = scoreMarket(m, conf, m.hist);
      markets.push(m);
    }
  }
  markets.sort((x, y) => y.score - x.score || y.ev - x.ev);
  markets.splice(48);

  // ---- בחירות: עד 4, מגוונות ולא סותרות ----
  const family = m => `${m.stat}:${['1x2', 'ah', 'dc'].includes(m.group) ? 'side' : ['btts', 'total3'].includes(m.group) ? 'total' : m.group}`;
  const picks = [], usedF = new Set(), perStat = {};
  for (const m of markets) {
    if (m.score < 6) break;   // מתחת לציון 6 לא ממליצים בכלל
    const f = family(m);
    if (usedF.has(f) || (perStat[m.stat] || 0) >= 2) continue;
    usedF.add(f); perStat[m.stat] = (perStat[m.stat] || 0) + 1;
    m.reason = reasonFor(m, H, A, exp);
    m.why = whyOf(m, H, A, exp, lg, ch, news, ctx);
    m.checks = checksOf(m, news);
    picks.push(m);
    if (picks.length === 4) break;
  }
  const top = picks.slice(0, 2).map(p => p.score);
  const quality = top.length ? r1(mean(top) * (0.7 + 0.3 * conf)) : 0;

  // טבלאות מגמות: לכל מדד כמה פעמים כל קבוצה "עברה" קו (בבית/בחוץ, 6 אחרונים, מפגשים ישירים) מול המודל
  const pOver = (s, line) => { const d = dists[s]; if (!d) return null; const sm = settle({ stat: s, group: 'total', side: 'over', line }, d.dh, d.da); return r2(sm.win / (sm.win + sm.lose || 1e-9)); };
  const trends = { stats: {}, extra: {} };
  if (enough) {
    for (const s of lg.avail) {
      if (!exp[s] || !FOCUS.includes(s)) continue;
      trends.stats[s] = trendLines(s, exp[s].total).map(line => {
        const mk = { stat: s, group: 'total', side: 'over', line };
        let odds = null, real = false;
        const rr = [...cornerOdds, ...realList].find(o => o.stat === s && o.group === 'total' && o.side === 'over' && o.line === line);
        if (rr) { odds = rr.odds; real = true; }
        else if (s === 'g' && line === 2.5 && mo.ouOdds) { odds = mo.ouOdds.over; real = true; }
        else if (exp[s].raw && lg.avg[s]) { const ph = lg.avg[s].phi, sn = settle(mk, nbPmf(exp[s].raw.h, ph), nbPmf(exp[s].raw.a, ph)), pn = sn.win / (sn.win + sn.lose || 1e-9); odds = r2(clamp(1 / (Math.max(pn, 0.03) * 1.07), 1.05, 15)); }
        return { line, model: pOver(s, line), odds, real, ...histOf(mk, listH, listA, meetings) };
      });
    }
    const mkB = { stat: 'g', group: 'btts', side: 'yes' };
    trends.extra.btts = { model: dists.g ? r2(settle(mkB, dists.g.dh, dists.g.da).win) : null, ...histOf(mkB, listH, listA, meetings) };
    const rec = (list, who) => { const L = list.filter(e => e.g?.[0] != null); const w = L.filter(e => e.g[0] > e.g[1]).length, d = L.filter(e => e.g[0] === e.g[1]).length; return { n: L.length, w, d, l: L.length - w - d }; };
    trends.extra.record = { h: rec(listH.filter(e => e.v === 'H')), a: rec(listA.filter(e => e.v === 'A')) };
    const cs = (list, v) => { const L = list.filter(e => e.v === v && e.g?.[0] != null); return L.length ? [Math.round(L.filter(e => e.g[1] === 0).length / L.length * 100) / 100, L.length] : null; };
    const fts = (list, v) => { const L = list.filter(e => e.v === v && e.g?.[0] != null); return L.length ? [Math.round(L.filter(e => e.g[0] === 0).length / L.length * 100) / 100, L.length] : null; };
    trends.extra.cs = { h: cs(listH, 'H'), a: cs(listA, 'A') }; trends.extra.fts = { h: fts(listH, 'H'), a: fts(listA, 'A') };
  }
  const probs = {};
  if (dists.g) { probs.o25 = pOver('g', 2.5); probs.btts = trends.extra?.btts?.model ?? r2(settle({ stat: 'g', group: 'btts', side: 'yes' }, dists.g.dh, dists.g.da).win); }
  for (const [s, key] of [['c', 'c'], ['c1', 'c1'], ['sh', 'sh'], ['sot', 'sot']]) if (exp[s]) { const line = Math.floor(exp[s].total) + 0.5; probs[key + 'Line'] = line; probs[key + 'Over'] = pOver(s, line); }

  // תכונות סגנון בעברית (מול ממוצע הליגה) + תקציר המשחק
  const base = model.lg, rt = base.rates || {};
  const avg2 = (st) => base.avg[st] ? (base.avg[st].h + base.avg[st].a) / 2 : null;
  const bAcc = base.avg.sot && base.avg.sh ? (base.avg.sot.h + base.avg.sot.a) / (base.avg.sh.h + base.avg.sh.a) : null;
  const bConv = base.avg.g && base.avg.sot ? (base.avg.g.h + base.avg.g.a) / (base.avg.sot.h + base.avg.sot.a) : null;
  const bCps = base.avg.c && base.avg.sh ? (base.avg.c.h + base.avg.c.a) / (base.avg.sh.h + base.avg.sh.a) : null;
  const pc = x => Math.round(x * 100) + '%';
  const traits = (T) => {
    const st = T.style.all; if (!st || st.n < 4) return [];
    const out = [], add = (w, t, k) => out.push({ w: Math.abs(w), t, k });
    if (st.acc != null && bAcc) { const r = st.acc / bAcc; if (r >= 1.12) add(r - 1, `בועטת מדויק: ${pc(st.acc)} מהבעיטות למסגרת (ממוצע ליגה ${pc(bAcc)})`, 'up'); else if (r <= 0.88) add(1 - r, `בועטת לא מדויק: ${pc(st.acc)} מהבעיטות למסגרת (ממוצע ליגה ${pc(bAcc)})`, 'down'); }
    if (st.conv != null && bConv) { const r = st.conv / bConv; if (r >= 1.2) add(r - 1, `סיום יעיל: ${pc(st.conv)} מהבעיטות למסגרת הופכות לשער (ממוצע ${pc(bConv)})`, 'up'); else if (r <= 0.8) add(1 - r, `סיום חלש: רק ${pc(st.conv)} מהבעיטות למסגרת הופכות לשער (ממוצע ${pc(bConv)})`, 'down'); }
    if (st.xgd != null) { if (st.xgd >= 0.3) add(st.xgd, `כובשת הרבה מעל ה-xG (+${st.xgd.toFixed(1)} למשחק): ייתכן שהרצף לא יימשך`, 'info'); else if (st.xgd <= -0.3) add(-st.xgd, `כובשת פחות מהצפוי לפי xG (${st.xgd.toFixed(1)} למשחק): יש פוטנציאל לשיפור`, 'info'); }
    if (st.fh != null && rt.fh) { if (st.fh >= rt.fh + 0.1) add(st.fh - rt.fh, `מתחילה חזק: ${pc(st.fh)} משעריה נכנסים במחצית הראשונה (ממוצע ${pc(rt.fh)})`, 'up'); else if (st.fh <= rt.fh - 0.1) add(rt.fh - st.fh, `גומרת חזק: רק ${pc(st.fh)} משעריה במחצית הראשונה (ממוצע ${pc(rt.fh)})`, 'down'); }
    if (st.fouls != null && avg2('f')) { const r = st.fouls / avg2('f'); if (r >= 1.15) add(r - 1, `משחק פיזי: ${st.fouls.toFixed(1)} עבירות למשחק (ממוצע ${avg2('f').toFixed(1)})`, 'up'); else if (r <= 0.85) add(1 - r, `משחק נקי: ${st.fouls.toFixed(1)} עבירות למשחק (ממוצע ${avg2('f').toFixed(1)})`, 'down'); }
    if (st.cards != null && avg2('k')) { const r = st.cards / avg2('k'); if (r >= 1.2) add(r - 1, `מקבלת הרבה כרטיסים: ${st.cards.toFixed(1)} למשחק (ממוצע ${avg2('k').toFixed(1)})`, 'up'); else if (r <= 0.8) add(1 - r, `ממושמעת: ${st.cards.toFixed(1)} כרטיסים למשחק (ממוצע ${avg2('k').toFixed(1)})`, 'down'); }
    if (st.cps != null && bCps) { const r = st.cps / bCps; if (r >= 1.15) add(r - 1, 'מייצרת הרבה קרנות ביחס לבעיטות (לחץ מהצדדים והגבהות)', 'up'); else if (r <= 0.85) add(1 - r, 'מעט קרנות ביחס לבעיטות (משחק מרכזי / כדורים קצרים)', 'down'); }
    if (rt.cs != null) { if (st.cs >= rt.cs + 0.15) add(st.cs - rt.cs, `שומרת על שער נקי ב-${pc(st.cs)} ממשחקיה (ממוצע ${pc(rt.cs)})`, 'up'); if (st.fts >= rt.cs + 0.15) add(st.fts - rt.cs, `נכשלת בכיבוש ב-${pc(st.fts)} ממשחקיה (ממוצע ${pc(rt.cs)})`, 'down'); }
    if (rt.btts != null) { if (st.btts >= rt.btts + 0.15) add(st.btts - rt.btts, `שתי הקבוצות כובשות ב-${pc(st.btts)} ממשחקיה (ממוצע ${pc(rt.btts)})`, 'up'); else if (st.btts <= rt.btts - 0.15) add(rt.btts - st.btts, `שתי הקבוצות כובשות רק ב-${pc(st.btts)} ממשחקיה (ממוצע ${pc(rt.btts)})`, 'down'); }
    if (rt.o25 != null) { if (st.o25 >= rt.o25 + 0.15) add(st.o25 - rt.o25, `מעל 2.5 שערים ב-${pc(st.o25)} ממשחקיה (ממוצע ${pc(rt.o25)})`, 'up'); else if (st.o25 <= rt.o25 - 0.15) add(rt.o25 - st.o25, `מעל 2.5 שערים רק ב-${pc(st.o25)} ממשחקיה (ממוצע ${pc(rt.o25)})`, 'down'); }
    return out.sort((a, b) => b.w - a.w).slice(0, 6).map(({ t, k }) => ({ t, k }));
  };
  const styleLines = { h: traits(H), a: traits(A) };
  const Hn = iso(H.name), An = iso(A.name), sum = [];
  if (enough) {
    if (ch.mw) { const fav = ch.mw.h >= ch.mw.a ? Hn : An, p = Math.max(ch.mw.h, ch.mw.a); sum.push(p >= 0.5 ? `${fav} הפייבוריטית (${mo.est ? 'לפי המודל' : 'לפי Bet365'}).` : 'משחק שקול, בלי פייבוריטית ברורה.'); }
    if (exp.g) sum.push(`שערים: צפי ${r1(exp.g.h)}–${r1(exp.g.a)} (סה״כ ${r1(exp.g.total)}). מעל 2.5: ${pc(probs.o25 ?? 0)} · שתי הקבוצות כובשות: ${pc(probs.btts ?? 0)}.`);
    for (const [s, name, unit] of [['c', 'קרנות'], ['c1', 'קרנות במחצית הראשונה'], ['sh', 'בעיטות'], ['sot', 'בעיטות למסגרת']]) {
      const e = exp[s]; if (!e) continue; const d = (e.total - e.lg.total) / (e.lg.total || 1);
      if (Math.abs(d) >= 0.08) sum.push(`${name}: צפי ${r1(e.total)}, ${d > 0 ? 'גבוה' : 'נמוך'} מהממוצע בליגה (${e.lg.total}).`);
    }
    if (ch.lines[0] && !/אין עדיין מספיק/.test(ch.lines[0])) { const l = ch.lines.find(x => /משחקת פתוח|משחקת סגור|קרב סגנונות|מצב מעניין|דרבי|כבשה שחורה/.test(x)); if (l) sum.push(l); }
    if (ctx.rivalry?.derby) sum.push(`דרבי (${ctx.rivalry.derby}): משחק לוהט, והכושר לא תמיד קובע.`);
    if (news?.uncertain) sum.push('ההרכבים לא סופיים. כדאי לבדוק לפני הימור.'); else if (!news) sum.push('פציעות והרכבים עדיין לא נבדקו למשחק הזה.');
  }

  // ---- פלט רזה: רק מה שרלוונטי להימור ----
  const pickSt = st => { const o = {}; for (const k of FOCUS) if (st && st[k]) o[k] = st[k]; return o; };
  const slimSum = x => x ? { n: x.n, st: pickSt(x.st), pos: x.pos } : null;
  const slim = T => ({
    id: T.id, name: T.name, logo: T.logo, games: T.games, rank: T.rank, nTeams: T.nTeams, tier: T.tier,
    all: slimSum(T.all), home: slimSum(T.home), away: slimSum(T.away),
    splits: Object.fromEntries(Object.entries(T.splits).map(([k, v]) => [k, v ? { n: v.n, st: pickSt(v.st) } : null])),
    form: T.style && T.style.all ? T.style.all.form : '', ppg: T.style && T.style.all ? T.style.all.ppg : null,
    role: T.style && T.style.role ? { n: T.style.role.n, w: T.style.role.w, d: T.style.role.d, l: T.style.role.l } : null,
    log: T.log.map(e => ({ ts: e.ts, opp: e.opp, v: e.v, g: e.g, c: e.c, sh: e.sh, sot: e.sot, tier: e.tier, rank: e.rank })),
  });
  const trendsOut = { stats: trends.stats, extra: trends.extra && trends.extra.btts ? { btts: trends.extra.btts, record: trends.extra.record } : {} };
  const rv = ctx.rivalry;
  return {
    id: fx.id, ts: fx.ts, status: fx.status, round: fx.round, venue: fx.venue, ref: fx.ref || null,
    lg: fx.lg, home: slim(H), away: slim(A), exp: Object.fromEntries(FOCUS.filter(x => exp[x]).map(x => [x, exp[x]])), conf, quality, enough, missing: ctx.missing || [], mread: marketRead(bets),
    character: { label: ch.label, lines: ch.lines.slice(0, 3), mw: ch.mw, mwEst: !!mo.est, mwOdds: mo.mwOdds || null, ouOdds: mo.ouOdds || null, o25: ch.o25, rank: ch.rank, rivalry: rv ? { derby: rv.derby, n: rv.n, rec: rv.rec, bogey: rv.bogey, meetings: (rv.meetings || []).map(m => ({ ts: m.ts, h: m.h, g: m.g, c: m.c, sh: m.sh, sot: m.sot })) } : null },
    news: news ? { items: news.items || [], adj: news.adj || null, updated: news.updated || null, uncertain: !!news.uncertain, lineups: news.lineups || null, coach: news.coach || null, source: news.source || null, checked: !!news.checked } : null,
    cross: cross ? { lgH: ctx.lgH, lgA: ctx.lgA, coef: r2(ctx.coef || 1) } : null,
    probs, trends: trendsOut, summary: sum, matchup, scout: enough ? scoutOf(H, A, model, modelA, tierId, fx, ctx, exp) : null, story: storyOf(H, A, exp, ch, mo, news, picks, ctx, lg), opinion: opinionOf(H, A, exp, ch, mo, news, picks, ctx, lg),
    markets, picks: picks.map(p => markets.indexOf(p)),
  };
}

// ---------- הסברים ----------
function notesFor(H, exp, n, missing) {
  const out = [];
  if (missing?.length) out.push(`אין לנו נתוני סטטיסטיקה על ${missing.map(iso).join(', ')} (הקבוצה לא משחקת באחת הליגות שבמעקב, או שאין עדיין נתוני עבר עליה), ולכן אין דירוג להימורים במשחק הזה.`);
  if (n < 3) { if (!missing?.length) out.push('אין עדיין מספיק משחקים במאגר לקבוצות האלה, ולכן אין דירוג להימורים. המאגר מתמלא יום אחרי יום.'); return out; }
  for (const s of ['c', 'g', 'g1', 'sh', 'sot', 'f', 'k']) {
    const e = exp[s]; if (!e) continue;
    const d = (e.total - e.lg.total) / (e.lg.total || 1);
    out.push(`${STATS[s].he}: צפי ${r1(e.h)} – ${r1(e.a)}, סה״כ ${r1(e.total)} (ממוצע ליגה ${e.lg.total}${Math.abs(d) >= 0.08 ? `, ${d > 0 ? 'גבוה' : 'נמוך'} מהממוצע` : ''}).`);
  }
  if (exp.cOnly && exp.cShots && Math.abs(exp.cOnly.h - exp.cShots.h) / (exp.c.h || 1) > 0.25) out.push(`שימו לב: לפי הבעיטות ${iso(H.name)} צפויה ל-${r1(exp.cShots.h)} קרנות ולפי הקרנות עצמן ${r1(exp.cOnly.h)}. אי-ההתאמה מורידה ביטחון.`);
  if (n < 5) out.push('מעט משחקים במאגר עדיין, ולכן הדירוג נזהר יותר.');
  return out;
}

// ---------- סוג יריבה: מתבצרת או משחקת רגיל ----------
const kindMemo = new WeakMap();
export function oppKind(model, id) {
  if (!model || id == null) return null;
  let c = kindMemo.get(model); if (!c) { c = new Map(); kindMemo.set(model, c); }
  if (c.has(id)) return c.get(id);
  const lg = model.lg, list = model.teams[id] || [];
  let k = null;
  if (list.length >= 4 && lg.avg.sh) {
    const avgSh = (lg.avg.sh.h + lg.avg.sh.a) / 2;
    const mm = f => { const a = list.map(f).filter(Number.isFinite); return a.length >= 3 ? mean(a) : null; };
    const shF = mm(e => e.F.sh), shA = mm(e => e.A.sh), pos = mm(e => e.pos);
    if (shF != null && shA != null && pos != null && avgSh) {
      k = { pos: Math.round(pos), shF: r2(shF / avgSh), shA: r2(shA / avgSh), shAabs: r1(shA), shFabs: r1(shF), n: list.length };
      k.block = k.pos <= 48 && k.shA <= 1.0; // מעט החזקה, ומרשה מעט בעיטות = מתבצרת
    }
  }
  c.set(id, k); return k;
}
export function bucketStats(list, pred) {
  const L = list.filter(e => e.g && e.g[0] != null && pred(e));
  if (!L.length) return null;
  const av = f => { const a = L.map(f).filter(Number.isFinite); return a.length >= Math.min(3, L.length) ? r1(mean(a)) : null; };
  return { n: L.length, w: L.filter(e => e.g[0] > e.g[1]).length, d: L.filter(e => e.g[0] === e.g[1]).length, l: L.filter(e => e.g[0] < e.g[1]).length,
    gf: av(e => e.g[0]), ga: av(e => e.g[1]), c: av(e => e.F.c), cAg: av(e => e.A.c), sh: av(e => e.F.sh), shAg: av(e => e.A.sh), sot: av(e => e.F.sot) };
}
const TIER_HE = { top: 'קבוצות מהשליש העליון', mid: 'קבוצות מאמצע הטבלה', bot: 'קבוצות מהשליש התחתון' };
const rec3 = b => (b.w === 0 ? 'בלי ניצחונות' : b.w === 1 ? 'ניצחון אחד' : b.w + ' ניצחונות') + ', ' + (b.d === 0 ? 'בלי תיקו' : b.d === 1 ? 'תיקו אחד' : b.d + ' תיקו') + ' ו' + (b.l === 0 ? 'בלי הפסדים' : b.l === 1 ? 'הפסד אחד' : '-' + b.l + ' הפסדים');
const PAT_HE = { grind: ' מול סוג כזה של יריבה נוטה ללחוץ ולצבור קרנות, אבל לכבוש פחות.', flow: ' מול סוג כזה של יריבה דווקא כובשת יותר מהרגיל.', stall: ' מול סוג כזה של יריבה מאבדת קצב: פחות שערים ופחות קרנות.', quiet: ' מול סוג כזה של יריבה כובשת פחות מהרגיל.' };
function scoutOf(H, A, model, modelA, tierId, fx, ctx = {}, exp = {}) {
  const listH = model.teams[fx.h] || [], listA = modelA.teams[fx.a] || [];
  const kindH = oppKind(model, fx.h), kindA = oppKind(modelA, fx.a);
  const lines = [], pat = {}, data = {};
  const side = (key, T, list, mdl, role, oppId, oppName, oppK) => {
    const Tn = iso(T.name), all = bucketStats(list, () => true);
    if (!all || all.n < 3) return;
    const d = { all, venue: bucketStats(list, e => e.v === role), other: bucketStats(list, e => e.v !== role) };
    const ot = tierId(oppId), vt = ot ? bucketStats(list, e => tierId(e.opp) === ot) : null;
    d.tier = vt ? { key: ot, ...vt } : null;
    d.block = oppK && oppK.block ? bucketStats(list, e => { const k = oppKind(mdl, e.opp); return k && k.block; }) : null;
    const rl = role === 'H' ? 'בבית' : 'בחוץ', ol = role === 'H' ? 'בחוץ' : 'בבית';
    // איך היא משחקת בבית / בחוץ
    if (d.venue && d.venue.n >= 3) {
      const ex = []; if (d.venue.gf != null) ex.push(d.venue.gf + ' שערים'); if (d.venue.c != null) ex.push(d.venue.c + ' קרנות');
      let t = Tn + ' ' + rl + ': ' + rec3(d.venue) + ' ב-' + d.venue.n + ' משחקים' + (ex.length ? ', בממוצע ' + ex.join(' ו-') + ' למשחק' : '');
      if (d.other && d.other.n >= 3 && d.other.gf != null && d.venue.gf != null && Math.abs(d.venue.gf - d.other.gf) >= 0.5) t += ' (' + ol + ' ' + d.other.gf + ' שערים למשחק)';
      lines.push(t + '.');
    }
    // איך היא מסתדרת מול גדולות / בינוניות / קטנות
    if (d.tier && d.tier.n >= 3) {
      const df = []; if (d.tier.gf != null && all.gf != null) df.push(d.tier.gf + ' שערים (בכל המשחקים ' + all.gf + ')'); if (d.tier.c != null && all.c != null) df.push(d.tier.c + ' קרנות (בכל המשחקים ' + all.c + ')');
      lines.push('מול ' + TIER_HE[d.tier.key] + ' ' + Tn + ' ' + rec3(d.tier) + ' ב-' + d.tier.n + ' משחקים' + (df.length ? ', בממוצע ' + df.join(' ו-') : '') + '.');
    }
    // יריבה שמתבצרת
    if (oppK && oppK.block) lines.push(oppName + ' בנויה להתבצר: מחזיקה מעט בכדור, ומרשה ליריבות רק ' + oppK.shAabs + ' בעיטות למשחק.');
    if (d.block && d.block.n >= 2) {
      const df = []; if (d.block.gf != null && all.gf != null) df.push(d.block.gf + ' שערים (בכל המשחקים ' + all.gf + ')'); if (d.block.c != null && all.c != null) df.push(d.block.c + ' קרנות (בכל המשחקים ' + all.c + ')');
      lines.push('מול קבוצות שמתבצרות ' + Tn + ' שיחקה ' + d.block.n + ' משחקים (' + rec3(d.block) + ')' + (df.length ? ', בממוצע ' + df.join(' ו-') : '') + (d.block.n < 3 ? ' — מעט משחקים, לא מסקנה חדה' : '') + '.');
    }
    // המסקנה
    const ref = d.block && d.block.n >= 3 ? d.block : d.tier && d.tier.n >= 3 ? d.tier : null;
    if (ref && ref.gf != null && all.gf != null) {
      const dG = ref.gf - all.gf, dC = ref.c != null && all.c != null ? ref.c - all.c : 0;
      pat[key] = dG <= -0.5 && dC >= 0.8 ? 'grind' : dG >= 0.4 ? 'flow' : dG <= -0.5 && dC <= -0.8 ? 'stall' : dG <= -0.5 ? 'quiet' : null;
      if (pat[key]) lines.push(Tn + PAT_HE[pat[key]]);
    }
    data[key] = d;
  };
  side('h', H, listH, model, 'H', fx.a, iso(A.name), kindA);
  side('a', A, listA, modelA, 'A', fx.h, iso(H.name), kindH);
  // אופי וסגנון של כל קבוצה (מהידע שנצבר) והמפגש ביניהן
  const KH = ctx.know && ctx.know[String(fx.h)], KA = ctx.know && ctx.know[String(fx.a)], head = [];
  if (KH && KA) {
    head.push(iso(H.name) + ': ' + ARCH[KH.arch].he + ' — ' + ARCH[KH.arch].short + '. ' + iso(A.name) + ': ' + ARCH[KA.arch].he + ' — ' + ARCH[KA.arch].short + '.');
    head.push(...archMatchup(KH.arch, KA.arch, iso(H.name), iso(A.name)));
    for (const K of [KH, KA]) if (K.brief) head.push(K.brief.replace(K.name, iso(K.name)));
    for (const [K, T] of [[KH, H], [KA, A]]) if (K.lore && K.lore.coach && K.lore.coach.isNew) head.push('שימו לב: ' + iso(T.name) + ' עם מאמן חדש (' + K.lore.coach.name + '), רק ' + K.lore.coach.games + ' משחקים, ולכן ההיסטוריה שלה פחות אמינה.');
  }
  const LN = { c: 'קרנות', sh: 'בעיטות', g: 'שערים' };
  for (const s of ['c', 'sh', 'g']) {
    const lf = exp[s] && exp[s].lf; if (!lf) continue;
    for (const [sd, T] of [['h', H], ['a', A]]) if (Math.abs(lf[sd] - 1) >= 0.04) head.push('תיקון מהמעקב: ב-' + LN[s] + ' המודל נטה להעריך את ' + iso(T.name) + (lf[sd] > 1 ? ' בחסר' : ' ביתר') + ', ולכן הצפי תוקן.');
  }
  return { lines: [...head, ...lines].slice(0, 13), pat, kind: { h: kindH, a: kindA }, data };
}

// ---------- איך המשחק נראה: סיפור קצר וחי, בלי אחוזים ----------
function storyOf(H, A, exp, ch, mo, news, picks, ctx, lg) {
  const Hn = iso(H.name), An = iso(A.name), P = [];
  if (!exp || !exp.g || !(Math.min(H.games, A.games) >= 3)) return [];
  const mw = ch && ch.mw, favH = mw ? mw.h >= mw.a : exp.g.h >= exp.g.a, pf = mw ? Math.max(mw.h, mw.a) : 0.5;
  const Fav = favH ? Hn : An, Dog = favH ? An : Hn, FavT = favH ? H : A, DogT = favH ? A : H;
  const rank = T => (T.rank ? ' (מקום ' + T.rank + ')' : '');
  const dec = x => (Math.round(x * 10) / 10).toString();
  const oddsOf = k => mo && mo.mwOdds ? mo.mwOdds[k] : null;
  // 1. סוג המשחק
  const derby = ctx && ctx.rivalry && ctx.rivalry.derby, bogey = ctx && ctx.rivalry && ctx.rivalry.bogey;
  let s1;
  if (derby) s1 = 'דרבי (' + derby + '), ובדרבי הכל יכול לקרות: משחק לוהט, הרבה מאבקים, ופחות חשוב מי גבוהה בטבלה.';
  else if (mw && pf >= 0.62) { const od = oddsOf(favH ? 'h' : 'a'); s1 = 'משחק של צד אחד על הנייר: ' + Fav + rank(FavT) + ' הפייבוריטית הברורה מול ' + Dog + rank(DogT) + (od ? ', וב-Bet365 היחס שלה לניצחון ' + od + '.' : '.'); }
  else if (mw && pf >= 0.5) s1 = Fav + rank(FavT) + ' עדיפה קצת' + (favH ? ' כמארחת' : ', ואפילו כאורחת') + ', אבל ' + Dog + rank(DogT) + ' לא מגיעה רק כדי להתגונן.';
  else s1 = 'משחק שקול בין ' + Hn + rank(H) + ' ל-' + An + rank(A) + ', כזה שיכול ליפול לכל כיוון.';
  if (ch && ch.label === 'משחק אירופי') s1 += ' זה משחק אירופי, ושם הקבוצות נוטות להיות זהירות יותר.';
  P.push(s1);
  // 2. סגנון המשחק של כל קבוצה
  const pos = T => (T.all && T.all.n >= 3 && T.all.pos != null ? T.all.pos : null), pH = pos(H), pA = pos(A);
  if (pH != null && pA != null) {
    if (pH >= 54 && pA <= 47) P.push(Hn + ' אוהבת לשלוט במשחקים שלה ולבנות מההחזקה, ו-' + An + ' נוטה להמתין ולצאת למתפרצות.');
    else if (pA >= 54 && pH <= 47) P.push(An + ' היא הקבוצה ששולטת גם כשהיא אורחת, ו-' + Hn + ' משחקת יותר מהתגובה.');
    else if (pH >= 54 && pA >= 54) P.push('שתי הקבוצות אוהבות את הכדור, ולכן צפוי קרב על השליטה.');
    else if (pH <= 46 && pA <= 46) P.push('שתי הקבוצות לא ממהרות לקחת את הכדור, ולכן צפוי משחק של מאבקים ופחות שליטה.');
  }
  // 2b. חוזק בבית / בחוץ העונה
  const rH = H.style && H.style.role, rA = A.style && A.style.role;
  if (rH && rH.n >= 4 && rH.w / rH.n >= 0.65) P.push(Hn + ' חזקה במיוחד בבית: ' + rH.w + ' ניצחונות ב-' + rH.n + ' משחקי הבית שלה העונה.');
  else if (rH && rH.n >= 4 && rH.l / rH.n >= 0.6) P.push(Hn + ' מתקשה בבית: ' + rH.l + ' הפסדים ב-' + rH.n + ' משחקי הבית שלה.');
  if (rA && rA.n >= 4 && rA.w / rA.n >= 0.6) P.push(An + ' מרגישה טוב גם בחוץ: ' + rA.w + ' ניצחונות ב-' + rA.n + ' משחקי החוץ.');
  else if (rA && rA.n >= 4 && rA.l / rA.n >= 0.6) P.push(An + ' מתקשה בחוץ: ' + rA.l + ' הפסדים ב-' + rA.n + ' משחקי החוץ שלה.');
  // 2c. מתי הן כובשות
  const fhH = H.style && H.style.all && H.style.all.fh, fhA = A.style && A.style.all && A.style.all.fh;
  const early = T => T != null && T >= 0.58, late = T => T != null && T <= 0.38;
  if (early(fhH) && early(fhA)) P.push('שתי הקבוצות נוטות לכבוש מוקדם, ולכן סביר שנראה שערים כבר בחצי הראשון.');
  else if (late(fhH) && late(fhA)) P.push('שתי הקבוצות כובשות בעיקר בחצי השנייה, ולכן החצי הראשון עשוי להיות שקט יחסית.');
  else if (early(fhH) || early(fhA)) P.push((early(fhH) ? Hn : An) + ' מתחילה חזק: רוב שעריה העונה נכנסים בחצי הראשון.');
  else if (late(fhH) || late(fhA)) P.push((late(fhH) ? Hn : An) + ' מתעוררת מאוחר: רוב שעריה העונה נכנסים בחצי השנייה.');
  // 3. קצב ושערים
  const eg = exp.g, tot = eg.total, lgt = eg.lg.total;
  if (tot >= lgt * 1.12) P.push('לפי איך שהן משחקות העונה, צפוי משחק פתוח עם שערים: בערך ' + dec(tot) + ' שערים בסך הכל, יותר מהרגיל בליגה.');
  else if (tot <= lgt * 0.88) P.push('צפוי משחק סגור וטקטי, עם פחות שערים מהרגיל בליגה (בערך ' + dec(tot) + ').');
  else P.push('בשערים צפוי קצב רגיל לליגה, בערך ' + dec(tot) + ' שערים בסך הכל.');
  // 4. קרנות ובעיטות
  const ec = exp.c;
  if (ec) {
    const d = ec.h - ec.a, big = ec.h >= ec.a ? Hn : An;
    let t = Math.abs(d) >= 1.3 ? 'את רוב הקרנות צפויה להביא ' + big + ' (בערך ' + dec(Math.max(ec.h, ec.a)) + ' מול ' + dec(Math.min(ec.h, ec.a)) + ')' : 'הקרנות צפויות להתחלק בין שתי הקבוצות (בערך ' + dec(ec.total) + ' בסך הכל)';
    if (exp.c1) t += ', ובחצי הראשון בערך ' + dec(exp.c1.total) + ' קרנות';
    P.push(t + '.');
  }
  const es = exp.sh;
  if (es && Math.abs(es.h - es.a) >= 3) P.push('בבעיטות ' + (es.h > es.a ? Hn : An) + ' צפויה ליצור הרבה יותר (בערך ' + dec(Math.max(es.h, es.a)) + ' מול ' + dec(Math.min(es.h, es.a)) + ').');
  // 5. חיסורים
  const items = (news && news.items) || [];
  const names = sd => items.filter(i => (i.side === sd) && (i.impact === 'high' || (i.impact === 'medium' && /חלוץ|שוער/.test(i.text)))).slice(0, 2).map(i => { const nm = String(i.text).split(' (')[0], role = (String(i.text).match(/\(([^,)]+)/) || [])[1]; return nm + (role ? ' (' + role + ')' : ''); });
  const mh = names('h'), ma = names('a');
  if (mh.length || ma.length) P.push('חיסורים: ' + [mh.length ? 'אצל ' + Hn + (mh.length > 1 ? ' חסרים ' : ' חסר ') + mh.join(' ו-') : null, ma.length ? 'אצל ' + An + (ma.length > 1 ? ' חסרים ' : ' חסר ') + ma.join(' ו-') : null].filter(Boolean).join(', ') + '.');
  if (bogey) P.push((bogey.victim === 'H' ? An : Hn) + ' היא ממש "כבשה שחורה" של ' + (bogey.victim === 'H' ? Hn : An) + ' בשנים האחרונות.');
  // 6. הזווית שהכי מתאימה
  if (picks && picks.length) { const m = picks[0]; P.push('הזווית שהכי מתאימה למשחק הזה: ' + m.label + (m.odds ? ' (יחס ' + m.odds + ').' : m.estOdds ? ' (יחס משוער בערך ' + m.estOdds + ').' : '.')); }
  return P.slice(0, 9);
}

// ---------- שקלול גלוי: מה תומך בהימור ומה מדאיג ----------
function checksOf(m, news) {
  const h = m.hist || {}, out = [], ok = t => out.push({ k: 'ok', t }), bad = t => out.push({ k: 'bad', t });
  const nH = h.hv && h.av ? Math.min(h.hv[1], h.av[1]) : 0;
  if (nH >= 4 && h.v != null) { if (h.v >= 0.62) ok('ההיסטוריה העונה של שתי הקבוצות תומכת'); else if (h.v <= 0.4) bad('ההיסטוריה העונה מתנגדת'); }
  if (h.l6 != null) { if (h.l6 >= 0.65) ok('גם ב-6 המשחקים האחרונים'); else if (h.l6 <= 0.35) bad('ב-6 האחרונים זה פחות קרה'); }
  if (h.t != null) { if (h.t >= 0.65) ok('גם מול יריבות מאותו סוג זה קרה'); else if (h.t <= 0.35) bad('מול יריבות מאותו סוג זה פחות קרה'); }
  if (h.x && h.x[1] >= 3) { if (h.x[0] >= 0.66) ok('במפגשים הישירים זה קרה'); else if (h.x[0] <= 0.34) bad('במפגשים הישירים זה לא קרה'); }
  if (m.odds && m.pMarket != null) { const e = m.pModel - m.pMarket; if (e >= 0.06) ok('לפי הניתוח היחס גבוה ממה שההימור שווה'); else if (e <= -0.06) bad('היחס כבר מתמחר את זה'); }
  const hi = ((news && news.items) || []).filter(i => i.impact === 'high' && (i.type === 'injury' || i.type === 'suspension'));
  if (hi.length) bad(hi.length === 1 ? 'חיסור משמעותי אחד' : hi.length + ' חיסורים משמעותיים');
  if (news && news.lineups && news.uncertain === false) ok('הרכבים סופיים'); else if (news && news.uncertain) bad('ההרכבים עדיין לא סופיים');
  if (nH > 0 && nH < 5) bad('מעט משחקים בהיסטוריה');
  if (!m.odds) bad('היחס משוער');
  return out.slice(0, 6);
}

// ---------- "המחשבה שלנו": קריאה של המשחק אחרי השקלול ----------
function opinionOf(H, A, exp, ch, mo, news, picks, ctx, lg) {
  const out = [];
  if (!exp || !exp.g || !(Math.min(H.games, A.games) >= 3)) return out;
  const Hn = iso(H.name), An = iso(A.name), mw = ch && ch.mw, favH = mw ? mw.h >= mw.a : exp.g.h >= exp.g.a, pf = mw ? Math.max(mw.h, mw.a) : 0.5;
  const Fav = favH ? Hn : An, Dog = favH ? An : Hn, tot = exp.g.total, lgt = exp.g.lg.total;
  const open = tot >= lgt * 1.1, closed = tot <= lgt * 0.9;
  // 1. הסצנריו הסביר
  let sc;
  if (ctx && ctx.rivalry && ctx.rivalry.derby) sc = 'בדרבי כזה אני מצפה למשחק עצבני וצמוד, עם הרבה מאבקים, ושער אחד או טעות אחת יכולים להכריע.';
  else if (mw && pf >= 0.62) sc = 'הסצנריו הסביר: ' + Fav + ' תשלוט בקצב ותקבל את רוב הקרנות והבעיטות. ' + (open ? 'אם ' + Dog + ' תצא למשחק פתוח, יהיו שערים משני הצדדים.' : closed ? 'אם ' + Fav + ' תעלה ליתרון, ' + Dog + ' תתבצר ויהיו מעט מצבים.' : 'אם ' + Fav + ' תעלה ליתרון, ' + Dog + ' תיאלץ לצאת, וזה יביא קרנות בדקות האחרונות.');
  else if (mw && pf >= 0.5) sc = 'אני רואה משחק שבו ' + Fav + ' קצת עדיפה, אבל ' + Dog + ' מסוגלת לפגוע במעברים. ' + (open ? 'צפוי חילוף מהלכים.' : closed ? 'סביר שזה יהיה משחק קטן שיוכרע בפרט אחד.' : 'המשחק יוכרע בפרטים.');
  else sc = 'משחק שקול, בלי פייבוריטית ברורה: ' + (open ? 'שתיהן משחקות קדימה, ואני מצפה לשערים.' : closed ? 'שתיהן זהירות, ואני מצפה למשחק צפוף עם מעט מצבים.' : 'אני לא רואה פייבוריטית ברורה, ולכן ההימורים על הכמויות (קרנות, בעיטות) בטוחים יותר מהימור על המנצחת.');
  out.push(sc);
  // 2. אחרי השקלול
  if (picks && picks.length) {
    const p0 = picks[0], c0 = p0.checks || [], okN = c0.filter(c => c.k === 'ok').length, badN = c0.filter(c => c.k === 'bad').length;
    const price = p0.odds ? 'יחס ' + p0.odds : p0.estOdds ? 'יחס משוער בערך ' + p0.estOdds : '';
    let v = 'אחרי שקלול ההיסטוריה, הסגנון של הקבוצות והחיסורים, ההימור הכי נקי הוא ' + p0.label + (price ? ' (' + price + ')' : '') + '.';
    if (okN >= 3 && badN === 0) v += ' כל הסימנים מצביעים לאותו כיוון.';
    else if (badN >= 2) v += ' יש כאן כמה סימני שאלה, ולכן כדאי להמר בזהירות.';
    else v += ' יש יתרון, אבל לא ברור לגמרי.';
    if (picks[1]) v += ' אם רוצים עוד זווית: ' + picks[1].label + '.';
    out.push(v);
  } else out.push('אחרי השקלול אני לא רואה הימור שבולט במשחק הזה, ולכן אני לא ממליץ להיכנס אליו.');
  // 3. מה יכול לשבש
  const hi = ((news && news.items) || []).filter(i => i.impact === 'high' && (i.type === 'injury' || i.type === 'suspension'));
  let w;
  if (news && news.uncertain) w = 'מה יכול לשבש: ההרכבים עדיין לא סופיים, וכדאי לבדוק אותם כשעה לפני המשחק.';
  else if (hi.length) w = 'מה יכול לשבש: ' + (hi.length === 1 ? 'חיסור משמעותי אחד שעלול' : hi.length + ' חיסורים משמעותיים שעלולים') + ' לשנות את התמונה.';
  else if (mw && pf >= 0.62) w = 'מה יכול לשבש: שער מוקדם של ' + Fav + ' יכול להוריד לה את הקצב ולצמצם את הקרנות והבעיטות.';
  else if (ctx && ctx.rivalry && ctx.rivalry.derby) w = 'מה יכול לשבש: בדרבי הכושר לא תמיד קובע, וכרטיס אדום מוקדם יכול לשנות הכל.';
  else w = 'מה יכול לשבש: שער מוקדם או כרטיס אדום משנים את מהלך המשחק, ואי אפשר לצפות אותם.';
  out.push(w);
  return out;
}

// הסבר קצר להמלצה בודדת, בנתונים קונקרטיים וללא אחוזים
function whyOf(m, H, A, exp, lg, ch, news, ctx) {
  const out = [], Hn = iso(H.name), An = iso(A.name), s = m.stat, S = STATS[s], avg = lg.avg[s], e = exp[s];
  const hf = H.home.st[s], af = A.away.st[s];
  const winnerish = s === 'g' && ['1x2', 'dc', 'btts'].includes(m.group);
  if (!winnerish && hf && af && avg) {
    if (m.group === 'home') out.push(Hn + ' בבית יוצרת ' + hf[0] + ' ' + S.he + ' למשחק (בליגה בממוצע ' + r1(avg.h) + '), ו-' + An + ' בחוץ נותנת ליריבות ' + af[1] + '.');
    else if (m.group === 'away') out.push(An + ' בחוץ יוצרת ' + af[0] + ' ' + S.he + ' למשחק (בליגה בממוצע ' + r1(avg.a) + '), ו-' + Hn + ' בבית נותנת ליריבות ' + hf[1] + '.');
    else out.push(Hn + ' בבית: ' + hf[0] + ' בעד ו-' + hf[1] + ' נגד. ' + An + ' בחוץ: ' + af[0] + ' בעד ו-' + af[1] + ' נגד. ממוצע הליגה: ' + r1(avg.h) + ' ו-' + r1(avg.a) + '.');
  }
  if (!winnerish && e) {
    if (m.group === 'home') out.push('אנחנו מצפים ל-' + r1(e.h) + ' ל-' + Hn + ', מול קו ' + m.line + '.');
    else if (m.group === 'away') out.push('אנחנו מצפים ל-' + r1(e.a) + ' ל-' + An + ', מול קו ' + m.line + '.');
    else if (['total', 'total3'].includes(m.group) && m.line != null) out.push('אנחנו מצפים לכ-' + r1(e.total) + ' ' + S.he + ' בסך הכל, מול קו ' + m.line + '.');
    else out.push('אנחנו מצפים ל-' + r1(e.h) + ' ' + S.he + ' ל-' + Hn + ' ול-' + r1(e.a) + ' ל-' + An + '.');
  }
  if (winnerish && ch && ch.mw) {
    const od = ch.mwOdds;
    if (od) out.push('היחסים ב-Bet365: ' + Hn + ' ' + od.h + ' · תיקו ' + od.d + ' · ' + An + ' ' + od.a + '.');
    const fh = H.style && H.style.all && H.style.all.form, fa = A.style && A.style.all && A.style.all.form;
    const L = f => f.split('').map(c => ({ W: 'נ', D: 'ת', L: 'ה' })[c]).join(' ');
    if (fh && fa) out.push('כושר אחרון (מהחדש לישן): ' + Hn + ' ' + L(fh) + ' · ' + An + ' ' + L(fa) + '.');
  }
  const hi = ((news && news.items) || []).filter(i => i.impact === 'high' && (i.type === 'injury' || i.type === 'suspension'));
  if (hi.length) out.push('שימו לב: ' + hi.length + ' חיסורים משמעותיים (' + hi.slice(0, 2).map(i => String(i.text).split(' (')[0]).join(', ') + ').');
  if (ctx && ctx.rivalry && ctx.rivalry.derby) out.push('דרבי (' + ctx.rivalry.derby + '): משחק לוהט, והכושר לא תמיד קובע.');
  return out.slice(0, 3);
}

function reasonFor(m, H, A, exp) {
  const S = STATS[m.stat], e = exp[m.stat], parts = [];
  const Hn = iso(H.name), An = iso(A.name), hi = 1.12, lo = 0.88;
  const sH = H.str[m.stat], sA = A.str[m.stat];
  if (m.stat === 'g' && ['1x2', 'dc'].includes(m.group)) parts.push(`צפי שערים ${r1(e.h)} – ${r1(e.a)}`);
  else if (['total', 'total3', 'btts'].includes(m.group)) parts.push(`צפי ${r1(e.total)} ${S.he}${m.line != null ? ` מול קו ${m.line}` : ''}`);
  else if (m.group === 'home') parts.push(`צפי ל-${Hn}: ${r1(e.h)} מול קו ${m.line}`);
  else if (m.group === 'away') parts.push(`צפי ל-${An}: ${r1(e.a)} מול קו ${m.line}`);
  else parts.push(`צפי ${r1(e.h)} מול ${r1(e.a)}`);
  const totalish = ['total', 'total3', 'btts'].includes(m.group);
  const up = m.side === 'over' || m.side === 'yes', down = m.side === 'under' || m.side === 'no';
  const homeUp = (up && (totalish || m.group === 'home')) || ['home', '1x'].includes(m.side);
  const awayUp = (up && (totalish || m.group === 'away')) || ['away', 'x2'].includes(m.side);
  if (homeUp) { if (sH.att >= hi) parts.push(`${Hn} ${S.forHi}`); if (sA.def >= hi) parts.push(`${An} ${S.agHi}`); }
  if (awayUp) { if (sA.att >= hi) parts.push(`${An} ${S.forHi}`); if (sH.def >= hi) parts.push(`${Hn} ${S.agHi}`); }
  if (down && (totalish || m.group === 'home')) { if (sH.att <= lo) parts.push(`${Hn} ${S.forLo}`); if (sA.def <= lo) parts.push(`${An} ${S.agLo}`); }
  if (down && (totalish || m.group === 'away')) { if (sA.att <= lo) parts.push(`${An} ${S.forLo}`); if (sH.def <= lo) parts.push(`${Hn} ${S.agLo}`); }
  if (m.ev > 0) parts.push(m.odds ? `יחס Bet365 ${m.odds} מול יחס הוגן ${m.fair}` : `הקו המקובל מתומחר בערך ${m.estOdds}, לפי המודל היחס ההוגן ${m.fair}`);
  return [...new Set(parts)].join(' · ');
}

// ---------- אופי המשחק ----------
const FORM_W = f => (f || '').slice(-5).split('').filter(c => c === 'W').length;
const FORM_L = f => (f || '').slice(-5).split('').filter(c => c === 'L').length;

export function matchCharacter(H, A, mo, ctx, lg, ref) {
  const Hn = iso(H.name), An = iso(A.name);
  const lines = [], labels = [];
  let share = null, tempo = 1;
  const mw = mo.mw;
  const src = mo.est ? 'לפי המודל שלנו' : 'לפי Bet365';
  const sH = ctx.standings?.[H.id], sA = ctx.standings?.[A.id], n = ctx.nTeams || 0;

  // 1. מי הפייבוריטית (לפי Bet365)
  if (mw) {
    share = clamp(0.5 + 0.4 * (mw.h - mw.a) + 0.04, 0.2, 0.8);
    const favH = mw.h >= mw.a, pf = favH ? mw.h : mw.a, Fav = favH ? Hn : An, Dog = favH ? An : Hn;
    if (pf >= 0.65) {
      labels.push('שליטה חד-צדדית');
      lines.push(`${Fav} פייבוריטית ברורה (${src}). צפויה להחזיק בכדור ולתקוף לאורך זמן, ו-${Dog} צפויה להתבצר. בדרך כלל זה אומר הרבה קרנות ובעיטות לפייבוריטית ומעט לאנדרדוג.`);
      lines.push(`אם ${Fav} תעלה ליתרון מוקדם היא עלולה להוריד קצב, ו-${Dog} תצטרך לצאת. זה מוסיף לאנדרדוג קרנות בדקות המאוחרות.`);
    } else if (pf >= 0.5) {
      labels.push(favH ? 'יתרון למארחת' : 'יתרון לאורחת');
      lines.push(`${Fav} עדיפה, אבל לא בפער ענק. ${Dog} תנסה לפגוע במעברים, כך שהמשחק לא יהיה חד-צדדי.`);
    } else {
      labels.push('משחק שקול');
      lines.push('משחק שקול, בלי פייבוריטית ברורה. שתי הקבוצות ינסו לנצח.');
    }
    if (mw.d >= 0.32) lines.push('אחוז התיקו גבוה: השוק מצפה למשחק זהיר עם מעט סיכונים.');
  }

  // 2. קצב צפוי (לפי השוק)
  if (mo.o25 != null) {
    tempo = clamp(1 + 0.15 * (mo.o25 - 0.52), 0.95, 1.05);
    if (mo.o25 >= 0.6) { labels.push('משחק פתוח'); lines.push('השוק מצפה למשחק פתוח עם שערים: יותר התקפות, יותר בעיטות וקרנות.'); }
    else if (mo.o25 <= 0.45) { labels.push('משחק סגור'); lines.push('השוק מצפה למשחק סגור וטקטי, עם מעט שערים: פחות מצבים.'); }
  }

  // 2b. משחק אירופי: פער עוצמה בין הליגות
  if (ctx.cross) {
    const { lgH, lgA, coef } = ctx.cross;
    labels.push('משחק אירופי');
    if (coef >= 1.15 || coef <= 0.87) lines.push(`${coef > 1 ? Hn : An} מגיעה מליגה חזקה יותר (${LEAGUE_NAME_HE[coef > 1 ? lgH : lgA] || 'ליגה חזקה'} מול ${LEAGUE_NAME_HE[coef > 1 ? lgA : lgH] || 'ליגה חלשה יותר'}). הסטטיסטיקה של כל קבוצה נלקחה מהליגה המקומית שלה והותאמה לפער העוצמה.`);
    else lines.push('שתי קבוצות מליגות ברמה דומה. הסטטיסטיקה של כל קבוצה נלקחה מהליגה המקומית שלה.');
    lines.push('במשחקי אירופה הקבוצות בדרך כלל זהירות יותר, ולפעמים מסובבות שחקנים בין משחקי ליגה. כדאי לבדוק הרכבים.');
  }

  // 3. פתיחות של כל קבוצה — הסגנון שלה, לא המקום בטבלה
  for (const [T, Tn, s] of [[H, Hn, sH], [A, An, sA]]) {
    if (T.open == null) continue;
    const shT = T.all.st.sh ? r1(T.all.st.sh[0] + T.all.st.sh[1]) : null, shL = lg.avg.sh ? r1(lg.avg.sh.h + lg.avg.sh.a) : null;
    const detail = shT != null ? ` (${shT} בעיטות למשחק בממוצע במשחקים שלה, ממוצע ליגה ${shL})` : '';
    if (T.open >= 1.1) {
      const vs = s && n && s.rank > n / 2 ? ` — למרות שהיא במקום ${s.rank} בטבלה` : '';
      lines.push(`${Tn} משחקת פתוח והתקפי${vs}${detail}. במשחקים שלה יש הרבה אירועים בשני הצדדים.`);
    } else if (T.open <= 0.9) {
      const vs = s && n && s.rank <= Math.ceil(n / 3) ? ` — למרות שהיא בצמרת (מקום ${s.rank})` : '';
      lines.push(`${Tn} משחקת סגור ושמרני${vs}${detail}. מעט מצבים ובעיטות במשחקים שלה.`);
    }
  }
  if (H.open != null && A.open != null) {
    if (H.open >= 1.08 && A.open >= 1.08) labels.push('שתי קבוצות פתוחות');
    else if (H.open <= 0.92 && A.open <= 0.92) labels.push('שתי קבוצות סגורות');
  }

  // 4. קרב סגנונות
  if (H.all.n >= 3 && A.all.n >= 3) {
    const pH = H.all.pos, pA = A.all.pos, wH = H.all.posKind === 'pos' ? 'החזקת כדור' : 'מהבעיטות', wA = A.all.posKind === 'pos' ? 'החזקת כדור' : 'מהבעיטות';
    if (pH >= 54 && pA <= 47) lines.push(`קרב סגנונות: ${Hn} שולטת במשחקים שלה (${wH}) מול ${An} שמעדיפה לחכות ולצאת למתפרצות. ${Hn} צפויה לבלות הרבה זמן בשליש האחרון.`);
    else if (pA >= 54 && pH <= 47) lines.push(`מצב מעניין: ${An} היא הקבוצה הדומיננטית (${wA}) גם כשהיא אורחת, ו-${Hn} משחקת תגובתי. אל תניחו שהמארחת תשלוט.`);
    else if (pH >= 54 && pA >= 54) lines.push('שתי קבוצות שאוהבות לשלוט: קרב על הכדור, משחק פתוח יחסית.');
    else if (pH <= 46 && pA <= 46) { lines.push('שתי קבוצות תגובתיות: הרבה כדורים ארוכים ומאבקים באמצע, בדרך כלל יותר עבירות ופחות קרנות.'); labels.push('משחק פיזי'); }
  }

  // 5. שופט
  let refFactor = null, refInfo = null;
  if (ref) {
    refInfo = { name: ref.name, n: ref.n };
    refFactor = {};
    for (const s of ['k', 'f']) {
      if (!lg.avg[s] || ref[s].length < 3) continue;
      const lgT = lg.avg[s].h + lg.avg[s].a, rAvg = mean(ref[s]), nn = ref[s].length;
      refFactor[s] = r2((nn * (rAvg / lgT) + 4) / (nn + 4)); refInfo[s] = r1(rAvg); refInfo[s + 'Lg'] = r1(lgT);
    }
    if (refInfo.k != null) {
      const d = refInfo.k / refInfo.kLg;
      if (d >= 1.15) { lines.push(`השופט קפדן: ${refInfo.k} כרטיסים למשחק בממוצע (ממוצע ליגה ${refInfo.kLg}, ${ref.k.length} משחקים).`); labels.push('שופט קפדן'); }
      else if (d <= 0.85) lines.push(`השופט מקל: רק ${refInfo.k} כרטיסים למשחק בממוצע (ממוצע ליגה ${refInfo.kLg}).`);
    }
  }

  // 5b. דרבי, יריבויות וכבשה שחורה
  let bogeyAdj = null;
  const rv = ctx.rivalry;
  if (rv?.derby) {
    labels.push('דרבי');
    lines.push(`דרבי: ${rv.derby}. משחקי דרבי נוטים להיות לוהטים יותר, עם יותר עבירות וכרטיסים ופחות חיזיון, והכושר לא תמיד קובע.`);
    refFactor = refFactor || {}; refFactor.k = r2((refFactor.k || 1) * 1.12); refFactor.f = r2((refFactor.f || 1) * 1.06);
  }
  if (rv?.bogey) {
    const b = rv.bogey, V = b.victim === 'H' ? Hn : An, O = b.victim === 'H' ? An : Hn;
    labels.push('כבשה שחורה');
    lines.push(`${O} היא "הכבשה השחורה" של ${V}: ב-${b.n} המפגשים האחרונים בין הקבוצות (3 עונות) ${b.w === 0 ? `${V} לא ניצחה אף פעם` : `${V} ניצחה רק ${b.w}`} (${b.d} תיקו, ${b.l} הפסדים). ${b.ppg} נקודות למשחק מולה, לעומת ${b.base} בדרך כלל.`);
    bogeyAdj = b.victim === 'H' ? { h: 0.95, a: 1.04 } : { h: 1.04, a: 0.95 };
  }
  if (rv?.n >= 3 && rv.avg) {
    const bits = [rv.avg.g != null ? `${rv.avg.g} שערים` : null, rv.avg.c != null ? `${rv.avg.c} קרנות` : null, rv.avg.k != null ? `${rv.avg.k} כרטיסים` : null].filter(Boolean);
    if (bits.length) lines.push(`במפגשים הישירים האחרונים (${rv.n}): ממוצע ${bits.join(', ')} למשחק.`);
  }

  // 6. טבלה, מוטיבציה וכושר
  const rank = sH && sA ? { h: sH.rank, a: sA.rank, n } : null;
  if (rank && n) {
    const late = Math.max(sH.played, sA.played) >= 0.75 * 2 * (n - 1);
    if (sH.rank <= 4 && sA.rank <= 4) { labels.push('קרב צמרת'); lines.push(`משחק צמרת: מקום ${sH.rank} מול מקום ${sA.rank}. משחקים כאלה נוטים להתחיל בזהירות, ולפעמים חמים יותר (עבירות, כרטיסים).`); }
    else if (sH.rank > n - 4 && sA.rank > n - 4) { labels.push('קרב תחתית'); lines.push(`קרב תחתית: מקום ${sH.rank} מול מקום ${sA.rank}. לחץ גבוה, הרבה הגבהות ומאבקים, ובדרך כלל יותר קרנות וכרטיסים.`); }
    if (late) for (const [s, T] of [[sH, Hn], [sA, An]]) {
      if (s.rank <= 2) lines.push(`סוף עונה: ${T} נלחמת על האליפות, ולכן מוטיבציה מקסימלית.`);
      else if (s.rank > n - 3) lines.push(`סוף עונה: ${T} נלחמת על ההישרדות.`);
    }
    for (const [s, T] of [[sH, Hn], [sA, An]]) {
      if (FORM_W(s.form) >= 4) lines.push(`${T} בכושר שיא (${s.form.slice(-5)}).`);
      else if (FORM_L(s.form) >= 3) lines.push(`${T} בכושר רע (${s.form.slice(-5)}). קבוצה בלחץ לפעמים נסגרת ולפעמים מסתערת.`);
    }
  }

  if (!lines.length) lines.push('אין עדיין מספיק מידע על אופי המשחק. הניתוח מבוסס על הסטטיסטיקה בלבד.');
  const PRI = ['דרבי', 'כבשה שחורה', 'משחק אירופי', 'קרב צמרת', 'קרב תחתית', 'שליטה חד-צדדית', 'שתי קבוצות פתוחות', 'שתי קבוצות סגורות', 'משחק סגור', 'משחק פתוח', 'שופט קפדן', 'משחק פיזי', 'משחק שקול'];
  const lbl = PRI.find(p => labels.includes(p)) || labels[0] || null;
  return { label: lbl, lines, share, tempo, refFactor, bogeyAdj, refInfo, mw: mw || null, o25: mo.o25 ?? null, rank, open: { h: H.open, a: A.open } };
}
