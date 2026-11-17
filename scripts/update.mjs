// הרצה יומית: מושך משחקים וסטטיסטיקות, מנתח, בודק תוצאות של ימים קודמים ובונה את דפי הסטטיסטיקה
// שימוש:  node scripts/update.mjs               (מפתח API-Football נקרא מ-key.txt או מ-API_FOOTBALL_KEY)
//         REUSE_INPUTS=1 node scripts/update.mjs  (ניתוח מחדש בלי הורדות — אחרי שנוספו חדשות/הרכבים)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUES, EURO, ISRAEL, TIMEZONE, LEAGUE_COEF } from './config.mjs';
import { COMP, DOMESTIC, ISRAEL_COMPS, EURO_COMPS, NATIONS_COMPS, NATIONS_FIXTURE, stats365, dayGames, toBrief, isFinished, syncLists, fillStats, gameStats, gameLineups, lineupsToNews, loadCache as loadC365, saveCache as saveC365, pool } from './source-365.mjs';
import { gatherFootballData, standingsFromRecords, FD_DIVS } from './source-fd.mjs';
import { buildResolver, rivalryOf } from './context.mjs';
import { applyExpert, writeDossier } from './expert.mjs';
import { fetchRealOdds } from './odds.mjs';
import { loadNames, saveNames, ensureTeams, heTeam, heInfo } from './names-he.mjs';
import { runBasketball } from './bball.mjs';
import { runSlip } from './slip.mjs';
import { runLearnReport } from './learn-report.mjs';
import { footAct } from './acttext.mjs';
import { loadCupRows, tierOf, refreshCups, cupClass, cupMarkets } from './cup-mismatch.mjs';
import { loadLore, saveLore, syncLore, buildLore, loreBrief, teamStory } from './lore.mjs';
import { teamKnowledge, learnFromDays, leagueStats, leagueProfile } from './knowledge.mjs';
import { buildRestIndex, stakesOf, addStakeWarnings } from './stakes.mjs';
import { compactFixture, buildLeagueModel, analyzeFixture, teamProfile, settle, oneHot, TUNE } from './model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const CACHE_FILE = path.join(DATA, 'cache', 'matches.json');
const HIST_FILE = path.join(DATA, 'cache', 'history-v2.json');
const DAYS = path.join(DATA, 'days');
const seasonOfTs = ts => { const d = new Date(ts * 1000); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const LEARN_FILE = path.join(DATA, 'knowledge', 'learn.json');
const REUSE = !!process.env.REUSE_INPUTS;

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
const log = (...a) => console.log('•', ...a);
const fmtIl = d => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
const today = process.env.DATE || fmtIl(new Date());
const divLeague = id => FD_DIVS[String(id).split(':')[0]] ?? null; // מזהה קבוצה של football-data → ליגה
const isFdId = id => String(id).includes(':');

// ההמלצה הטובה ביותר של משחק (לפי ציון, ואז יחס אמיתי, ואז ערך): נבחרת לכל משחק, גם אם לא נכנסה לטפסים
const bestIdx = f => { let bi = -1; (f.markets || []).forEach((m, i) => { if (bi < 0) { bi = i; return; } const b = f.markets[bi]; if (m.score > b.score || (m.score === b.score && ((!!m.odds && !b.odds) || ((!!m.odds === !!b.odds) && (m.ev || 0) > (b.ev || 0))))) bi = i; }); return bi; };
const LEARNING_LEAGUES = LEAGUES.filter(l => !EURO.includes(l.id));

async function main() {

  let cache = readJson(CACHE_FILE, null);
  if (!cache || cache.v !== 5) { log('מאתחל מטמון נתונים'); cache = { v: 5, matches: {}, teams: {}, noStats: {} }; }
  const history = readJson(HIST_FILE, {});
  const notes = [];
  const rememberTeams = it => { for (const t of [it.teams.home, it.teams.away]) if (!isFdId(t.id)) cache.teams[t.id] = { n: t.name, l: t.logo || null }; };
  const inputsFile = path.join(DATA, 'cache', `inputs-${today}.json`);

  // ================= 1. איסוף נתונים =================
  let dayFx = [], odds = new Map(), standings = new Map(), histRecords = [], ids365 = {}, meta = {};
  const c365file = path.join(DATA, 'cache', 's365.json');
  const c365 = loadC365(c365file);
  const seasonYear = (() => { const [y, m] = today.split('-').map(Number); return m >= 7 ? y : y - 1; })();
  if (REUSE) {
    const inp = readJson(inputsFile, null);
    if (!inp) throw new Error('אין קובץ קלט שמור להיום — הריצו קודם בלי REUSE_INPUTS');
    ids365 = inp.ids365 || {}; meta = inp.meta || {};
    dayFx = inp.dayFx; odds = new Map(Object.entries(inp.odds)); standings = new Map(Object.entries(inp.standings).map(([k, v]) => [Number(k), v]));
    histRecords = Object.values(history).flatMap(d => Object.values(d).flat());
    notes.push(...(inp.notes || []));
    log(`ניתוח מחדש על ${dayFx.length} משחקים (בלי הורדות)`);
  } else {
    // ---- football-data: 13 ליגות + שתי עונות היסטוריה ----
    const fd = await gatherFootballData(today, log, history);
    writeJson(HIST_FILE, fd.history);
    histRecords = fd.histRecords;
    Object.assign(cache.teams, fd.teams);
    dayFx = [...fd.dayItems]; odds = fd.odds; standings = fd.standings;
    log(`football-data: ${fd.records.length} משחקי עבר העונה, ${fd.dayItems.length} משחקים היום`);

    // ---- 365Scores: מחצית ראשונה, החזקת כדור, xG, ליגות ישראל, מפעלי אירופה, הרכבים ----
    try {
      const seasonStartTs = Date.UTC(seasonYear, 6, 1) / 1000;
      const resolveFD = buildResolver(fd.teams);
      const yest = fmtIl(new Date(new Date(today + 'T12:00:00Z').getTime() - 86400e3));
      const gToday = (await dayGames(today)).map(toBrief).filter(b => COMP[b.comp]);
      // משחקים שהסתיימו ב-4 הימים האחרונים (כל התחרויות שלנו): כך גם משחקי נבחרות/אירופה שחסרים ברשימות הליגה נבדקים, גם אחרי יום שהמחשב היה כבוי
      const gYest = []; for (let k = 1; k <= 4; k++) gYest.push(...(await dayGames(fmtIl(new Date(new Date(today + 'T12:00:00Z').getTime() - k * 86400e3)))).map(toBrief).filter(b => COMP[b.comp]));
      // מיפוי משחקי football-data למזהי 365, והוספת משחקי ישראל ואירופה להיום
      for (const it of fd.dayItems) for (const b of gToday) {
        if (COMP[b.comp] !== it.league.id) continue;
        if (resolveFD(b.hn) === it.teams.home.id && resolveFD(b.an) === it.teams.away.id) { ids365[it.fixture.id] = b.id; break; }
      }
      for (const b of gToday) if (ISRAEL_COMPS.includes(b.comp) || EURO_COMPS.includes(b.comp) || b.comp === NATIONS_FIXTURE) {
        dayFx.push({ fixture: { id: b.id, timestamp: b.ts, status: { short: b.sg === 2 ? 'NS' : isFinished(b) ? 'FT' : 'LIVE' }, venue: {}, referee: null }, league: { id: COMP[b.comp], season: seasonYear, round: b.round ? 'Round ' + b.round : '' }, teams: { home: { id: b.h, name: b.hn }, away: { id: b.a, name: b.an } } });
        ids365[b.id] = b.id; cache.teams[b.h] = { n: b.hn, l: null }; cache.teams[b.a] = { n: b.an, l: null };
      }
      // רשימות המשחקים של העונה + סטטיסטיקות (מלא ומחצית ראשונה), בתקציב קריאות לכל הרצה
      await syncLists(c365, DOMESTIC, seasonStartTs, log);
      await syncLists(c365, NATIONS_COMPS, Date.UTC(seasonYear - 2, 6, 1) / 1000, log); // נבחרות: שנתיים אחורה, כידע מקדים
      for (const b of [...gYest, ...gToday]) if (COMP[b.comp] && isFinished(b) && !c365.games[b.id]) c365.games[b.id] = { ...b, full: undefined, h1: undefined };
      const fill = await fillStats(c365, Number(process.env.S365_MAX || 600), log);
      saveC365(c365file, c365);
      log(`365: נמשכו סטטיסטיקות ל-${fill.done} משחקים, נשארו ${fill.left}`);
      if (fill.left > 0) notes.push(`נתוני המחצית הראשונה עדיין נאספים (${fill.left} משחקים נותרו), ולכן בחלק מהמשחקים עדיין אין המלצות על קרנות במחצית.`);

      // ישראל ואירופה: רשומות משחק מלאות מ-365
      const sideObj = (f, i) => ({ c: f.c[i], sh: f.sh[i], sot: f.sot[i], f: f.f[i], k: f.k[i], pos: f.pos[i], xg: f.xg[i] });
      for (const g of Object.values(c365.games)) {
        const lgId = COMP[g.comp];
        if (!(ISRAEL_COMPS.includes(g.comp) || EURO_COMPS.includes(g.comp) || NATIONS_COMPS.includes(g.comp)) || !g.full) continue;
        cache.matches[g.id] = { id: g.id, ts: g.ts, lg: lgId, season: NATIONS_COMPS.includes(g.comp) ? seasonOfTs(g.ts) : seasonYear, h: g.h, a: g.a, g: g.g, ht: [null, null], ref: null, s: { h: sideObj(g.full, 0), a: sideObj(g.full, 1) }, h1: g.h1 ? { c: g.h1.c, sh: g.h1.sh, sot: g.h1.sot } : null };
        cache.teams[g.h] ||= { n: g.hn, l: null }; cache.teams[g.a] ||= { n: g.an, l: null };
      }
      // ליגת האומות: דירוג לפי הליגה (A עד D) ואז לפי נקודות בעונה הנוכחית, כדי לחלק לקבוצות גדולות / בינוניות / קטנות
      {
        const cur = Object.values(c365.games).filter(g => g.comp === NATIONS_FIXTURE && g.ts >= Date.UTC(seasonYear, 7, 15) / 1000 && g.grp);
        const T = {};
        for (const g of cur.sort((x, y) => x.ts - y.ts)) for (const [id, gf, ga, name] of [[g.h, g.g[0], g.g[1], g.hn], [g.a, g.g[1], g.g[0], g.an]]) {
          const m = String(g.grp).match(/League ([A-D]).*?(?:Group (\d+))?$/i); const letter = m ? m[1].toUpperCase() : 'D';
          const t = T[id] ||= { grp: letter + (m && m[2] ? m[2] : ''), letter, points: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, played: 0, form: '' };
          t.played++; t.gf += gf; t.ga += ga; t.gd += gf - ga;
          const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L'; t.form += res; if (res === 'W') { t.w++; t.points += 3; } else if (res === 'D') { t.d++; t.points += 1; } else t.l++;
        }
        const rows = Object.entries(T).sort((x, y) => x[1].letter.localeCompare(y[1].letter) || y[1].points - x[1].points || y[1].gd - x[1].gd || y[1].gf - x[1].gf);
        if (rows.length) { const map = {}; rows.forEach(([id, t], i) => map[id] = { rank: i + 1, points: t.points, played: t.played, form: t.form.slice(-5), w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga, grp: t.grp }); standings.set(5, { map, n: rows.length }); }
      }
      for (const lg of [383, 382]) { const recs = Object.values(cache.matches).filter(m => m.lg === lg && m.season === seasonYear); if (recs.length) standings.set(lg, standingsFromRecords(recs)); }

      // football-data: צירוף מחצית ראשונה והשלמת החזקת כדור / xG, ובדיקת התאמה בין שני המקורות
      const FD_LEAGUES = new Set(Object.values(FD_DIVS));
      const byPair = new Map(); for (const r of fd.records) { const k = r.h + '|' + r.a; if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(r); }
      let joined = 0, h1n = 0, checked = 0, mism = 0;
      for (const g of Object.values(c365.games)) {
        if (!FD_LEAGUES.has(COMP[g.comp]) || ISRAEL_COMPS.includes(g.comp)) continue;
        const hid = resolveFD(g.hn), aid = resolveFD(g.an); if (!hid || !aid) continue;
        const r = (byPair.get(hid + '|' + aid) || []).find(x => Math.abs(x.ts - g.ts) < 2 * 86400); if (!r) continue;
        joined++;
        if (g.h1 && g.h1.c && g.h1.c[0] != null && g.h1.c[1] != null) { r.h1 = { c: g.h1.c, sh: g.h1.sh, sot: g.h1.sot }; h1n++; }
        if (g.full) for (const [i, sd] of [[0, 'h'], [1, 'a']]) {
          const o = r.s[sd];
          if (o.c != null && g.full.c[i] != null) { checked++; if (o.c !== g.full.c[i]) mism++; }
          if (o.c == null) o.c = g.full.c[i]; if (o.sh == null) o.sh = g.full.sh[i]; if (o.sot == null) o.sot = g.full.sot[i];
          if (o.f == null) o.f = g.full.f[i]; if (o.k == null) o.k = g.full.k[i];
          if (o.pos == null) o.pos = g.full.pos[i]; if (o.xg == null) o.xg = g.full.xg[i];
        }
      }
      log(`365 ↔ football-data: ${joined} משחקים חוברו (מחצית ראשונה: ${h1n}). בדיקת קרנות: ${checked - mism}/${checked} זהים`);
      meta = { fd: fd.records.length, s365: Object.keys(c365.games).length, joined, h1: h1n, checked, same: checked - mism };
      if (checked > 40 && mism / checked > 0.08) notes.push(`נמצא פער בין שני מקורות הנתונים בקרנות ב-${Math.round(mism / checked * 100)}% מהמשחקים שנבדקו. הנתונים מ-football-data הם הבסיס.`);
    } catch (e) {
      log('365: ' + e.message);
      notes.push('לא הצלחנו למשוך היום את כל הנתונים מ-365Scores (ליגות ישראל, מפעלי אירופה והרכבים).');
    }
    for (const r of fd.records) cache.matches[r.id] = r;
    writeJson(inputsFile, { dayFx, odds: Object.fromEntries(odds), standings: Object.fromEntries(standings), notes, ids365, meta });
  }

  // ---- תוצאות של היום, מיד אחרי שהמשחק נגמר (365Scores) — כדי שהמעקב יתמלא באותו יום ----
  try {
    const gNow = (await dayGames(today)).map(toBrief);
    const byGid = new Map(gNow.map(b => [b.id, b]));
    const todo = dayFx.filter(it => { const b = byGid.get(ids365[it.fixture.id]); const rec = cache.matches[it.fixture.id]; return b && isFinished(b) && !(rec && rec.g && rec.g[0] != null && rec.s && rec.s.h && rec.s.h.c != null); });
    let got = 0;
    const sideObj = (f, i) => ({ c: f.c[i], sh: f.sh[i], sot: f.sot[i], f: f.f[i], k: f.k[i], pos: f.pos[i], xg: f.xg[i] });
    await pool(todo, async it => {
      const b = byGid.get(ids365[it.fixture.id]);
      const full = await gameStats(b.id, b.h, b.a, -1); if (!full) return;
      const h1 = await gameStats(b.id, b.h, b.a, 6);
      cache.matches[it.fixture.id] = { id: it.fixture.id, ts: it.fixture.timestamp, lg: it.league.id, season: seasonYear, h: it.teams.home.id, a: it.teams.away.id, g: b.g, ht: [null, null], ref: null, final: true, s: { h: sideObj(full, 0), a: sideObj(full, 1) }, h1: h1 ? { c: h1.c, sh: h1.sh, sot: h1.sot } : null };
      got++;
    }, 4);
    if (todo.length) log(`365: תוצאות סופיות למשחקי היום: ${got}/${todo.length}`);
  } catch (e) { log('365 תוצאות: ' + e.message); }

  // ================= 2. מודלים, זיהוי קבוצות, הקשר =================
  const season = Object.values(cache.matches).filter(m => isFdId(m.h)).reduce((mx, m) => Math.max(mx, m.season || 0), 0) || new Date().getFullYear();
  const models = new Map();
  const getModel = (lg, seasonYear) => {
    const k = `${lg}-${seasonYear}`;
    if (!models.has(k)) {
      // העונות הקודמות משמשות כידע מקדים (הבדיקה לאחור הראתה שזה משפר את החיזוי בכל המדדים, במיוחד בתחילת עונה)
      const priors = [...histRecords, ...Object.values(cache.matches)].filter(m => m.lg === lg && (m.season === seasonYear - 1 || m.season === seasonYear - 2) && m.g && m.g[0] != null)
        .map(m => ({ ...m, pw: TUNE.PRIOR_W * (m.season === seasonYear - 1 ? 1 : TUNE.PRIOR_GAP2) }));
      models.set(k, buildLeagueModel(Object.values(cache.matches).filter(m => m.lg === lg && m.season === seasonYear), priors));
    }
    return models.get(k);
  };
  const resolve = buildResolver(Object.fromEntries(Object.entries(cache.teams).filter(([id]) => isFdId(id))));
  // ---- שמות בעברית (לתצוגה בלבד; הזיהוי הפנימי נשאר באנגלית) ----
  const HE = loadNames(ROOT);
  for (const g of Object.values(c365.games)) for (const [en, id365] of [[g.hn, g.h], [g.an, g.a]]) { const fd = resolve(en); if (fd && !HE.fd[fd]) HE.fd[fd] = id365; }
  try { const n = await ensureTeams(HE, [...Object.keys(cache.teams), ...Object.values(HE.fd), ...Object.values(HE.fd).map(String)]); if (n) log(`שמות בעברית: נוספו ${n} קבוצות`); saveNames(ROOT, HE); } catch (e) { log('שמות בעברית נכשלו: ' + e.message); }
  const infoHe = heInfo(HE, cache.teams);
  const allRecords = [...Object.values(cache.matches).filter(m => isFdId(m.h)), ...histRecords];
  const taskNews = readJson(path.join(DATA, 'news', `${today}.json`), { fixtures: {} }).fixtures || {};
  const autoNews = {};
  {
    const targets = dayFx.filter(it => it.fixture.timestamp * 1000 > Date.now() - 5 * 60e3 && ids365[it.fixture.id]);
    await pool(targets, async it => {
      const L = await gameLineups(ids365[it.fixture.id]); if (!L) return;
      const n = lineupsToNews(L); if (n) autoNews[String(it.fixture.id)] = { ...n, updated: new Date().toISOString() };
      if (L.ref && !it.fixture.referee) it.fixture.referee = L.ref;
      if (L.venue && !it.fixture.venue.name) it.fixture.venue = { name: L.venue };
    }, 4);
    log(`365: הרכבים וחיסורים ל-${Object.keys(autoNews).length} משחקים`);
  }
  const mergeNews = (t, a) => {
    if (!t && !a) return null; if (!t) return a; if (!a) return t;
    const seen = new Set(), items = [...(a.items || []), ...(t.items || [])].filter(i => { const k = String(i.text).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    return { items, adj: t.adj || a.adj || null, lineups: a.lineups || t.lineups || null, coach: t.coach || null, uncertain: a.lineups ? a.uncertain : (t.uncertain ?? a.uncertain), updated: a.updated || t.updated, source: a.source || null };
  };
  const news = {}; for (const k of new Set([...Object.keys(taskNews), ...Object.keys(autoNews)])) news[k] = mergeNews(taskNews[k], autoNews[k]);
  // מקום בטבלה לכל קבוצה (לחלוקה לגדולות / בינוניות / קטנות)
  const rankInfo = {};
  for (const [lg, st] of standings) for (const [id, r] of Object.entries(st.map)) rankInfo[id] = { rank: r.rank, n: st.n, lg };
  const rankOf = id => rankInfo[id] || null;

  // ================= 3. ניתוח משחקי היום =================
  const prevToday = readJson(path.join(DAYS, `${today}.json`), null);
  if (process.env.FORCE && prevToday?.dayPicks?.length) throw new Error('FORCE אסור כשכבר יש המלצות במעקב להיום: הוא היה משנה אותן אחרי המשחק');
  // ---- ידע על כל קבוצה + למידה מהמעקב (מה חזינו מול מה קרה) ----
  const learn = readJson(LEARN_FILE, { seen: {}, teams: {} });
  const dayFiles = fs.readdirSync(DAYS).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => readJson(path.join(DAYS, f), null)).filter(Boolean);
  const learned = learnFromDays(learn, dayFiles);
  if (learned) { writeJson(LEARN_FILE, learn); log(`למידה: נוספו ${learned} משחקים שנבדקו (${Object.keys(learn.seen).length} בסך הכל)`); }
  // ---- התיק של כל קבוצה: מאמן, מערכים, שחקני ליבה ---- (נטען משחק אחרי משחק, החדשים קודם)
  const LORE = loadLore(ROOT);
  try { await syncLore(LORE, Object.values(c365.games).filter(g => g.g && g.g[0] >= 0 && g.ts), Number(process.env.LORE_MAX || 450), log); saveLore(ROOT, LORE); } catch (e) { log('הרכבים ומאמנים נכשלו: ' + e.message); }
  const know = {}, knowByLeague = {};
  for (const lgInfo of LEARNING_LEAGUES) {
    const m = getModel(lgInfo.id, season); if (!m.lg.n) continue;
    const arr = knowByLeague[lgInfo.id] = [];
    for (const id of Object.keys(m.teams)) { const K = teamKnowledge(m, id, infoHe, rankOf, learn.teams[id]); if (K) { K.lg = lgInfo.id; const lore = buildLore(LORE, Number(HE.fd[id] || id)); K.lore = lore; K.brief = loreBrief(K.name, lore); K.story = teamStory(K, lore); know[String(id)] = K; arr.push(K); } }
  }
  log(`ידע: פרופיל ל-${Object.keys(know).length} קבוצות`);
  const realOdds = await fetchRealOdds({ root: ROOT, today, dayFx, order: LEAGUES.map(l => l.id), log });
  const expertDoc = readJson(path.join(DATA, 'expert', `${today}.json`), {});
  // גביעים: קבוצה מקצועית מול קבוצה קטנה בלי נתונים. מנתחים לפי היסטוריית הגביעים (cup-mismatch.mjs)
  const CUP_LG = [45, 48, 137, 143, 81, 384]; let cupRows = [], cupCls = new Map();
  if (dayFx.some(it => CUP_LG.includes(it.league.id))) { try { await refreshCups(ROOT, log); cupRows = loadCupRows(ROOT); cupCls = await cupClass(ROOT, today); } catch (e) { log('גביע: ' + e.message); } }
  const restIdx = buildRestIndex([...Object.values(cache.matches), ...histRecords]);
  const fixtures = [];
  for (const it of [...dayFx].sort((x, y) => x.fixture.timestamp - y.fixture.timestamp)) {
    const id = it.fixture.id, lgId = it.league.id;
    const prev = prevToday?.fixtures?.find(f => String(f.id) === String(id));
    const started = it.fixture.timestamp * 1000 < Date.now() - 5 * 60e3 || (it.fixture.status?.short && !['NS', 'TBD'].includes(it.fixture.status.short));
    if (prev && started && !process.env.FORCE) { fixtures.push(prev); continue; } // כבר התחיל — שומרים את הניתוח המקורי
    const names = { h: it.teams.home.name, a: it.teams.away.name };
    let hId = it.teams.home.id, aId = it.teams.away.id, model;
    const ctx = { news: news[String(id)] || null };
    const info = { ...infoHe };
    if (EURO.includes(lgId)) {
      const sy = it.league.season || season;
      // זיהוי הקבוצה: קודם football-data (13 ליגות), ואז ליגות ישראל (לפי מזהה ה-API)
      const locate = (name, apiId) => {
        const fdId = resolve(name);
        if (fdId) return { id: fdId, lg: divLeague(fdId) };
        for (const l of ISRAEL) { const m = getModel(l, sy); if (m.teams[apiId]) return { id: apiId, lg: l }; }
        return null;
      };
      const th = locate(names.h, it.teams.home.id), ta = locate(names.a, it.teams.away.id);
      model = th ? getModel(th.lg, sy) : buildLeagueModel([]);
      ctx.modelA = ta ? getModel(ta.lg, sy) : buildLeagueModel([]);
      if (th) hId = th.id; if (ta) aId = ta.id;
      info[hId] = { n: heTeam(HE, hId) || names.h, l: it.teams.home.logo || null }; info[aId] = { n: heTeam(HE, aId) || names.a, l: it.teams.away.logo || null };
      ctx.missing = [!th && names.h, !ta && names.a].filter(Boolean);
      if (th && ta) { ctx.coef = Math.pow((LEAGUE_COEF[th.lg] || 0.7) / (LEAGUE_COEF[ta.lg] || 0.7), 1.5); ctx.lgH = th.lg; ctx.lgA = ta.lg; ctx.cross = { lgH: th.lg, lgA: ta.lg, coef: ctx.coef }; }
      if (th && ta && th.lg === ta.lg) ctx.modelA = model;
    } else {
      model = getModel(lgId, it.league.season || season);
      const st = standings.get(lgId); ctx.standings = st?.map; ctx.nTeams = st?.n;
    }
    ctx.rankOf = rankOf; ctx.know = know; ctx.learn = learn.teams;
    ctx.rivalry = rivalryOf(allRecords, hId, aId, names.h, names.a);
    const fx = { id, ts: it.fixture.timestamp, status: it.fixture.status?.short || 'NS', round: it.league.round || '', venue: it.fixture.venue?.name || '', lg: lgId, h: hId, a: aId, ref: it.fixture.referee || null };
    const bets = [...(odds.get(id) || []), ...(realOdds.get(String(id)) || [])]; // יחסי football-data, ואז Bet365 אמיתיים (מחליפים)
    fixtures.push(applyExpert(analyzeFixture(fx, model, info, bets, ctx), expertDoc[String(id)]));
    try { fixtures[fixtures.length - 1].ctx = stakesOf({ standMap: standings.get(lgId)?.map, restIdx, hId, aId, ts: it.fixture.timestamp }); addStakeWarnings(fixtures[fixtures.length - 1]); } catch (e) { log('מה על הכף נכשל: ' + e.message); }
    if (prev && prev.markets && prev.markets.length && !fixtures[fixtures.length - 1].markets.length) { fixtures[fixtures.length - 1] = prev; log(`נשמר הניתוח הקודם של ${names.h} – ${names.a} (הרצה זו לא הצליחה לבנות שווקים)`); }
    { const f0 = fixtures[fixtures.length - 1], cl = cupCls.get(String(id));
      if (!f0.enough && cl && CUP_LG.includes(lgId)) { const tH = tierOf(cl.hm), tA = tierOf(cl.am);
        if (!!tH !== !!tA) { const side = tH ? 'h' : 'a', res = cupMarkets(f0, tH || tA, side, bets, cupRows, { h: f0.home.name, a: f0.away.name });
          if (res && res.markets.length) { f0.markets = res.markets; f0.cup = { ...res.summary, side }; f0.conf = Math.min(res.summary.conf, 0.5); f0.picks = res.markets.map((m, i) => i).filter(i => res.markets[i].score >= 6).slice(0, 3); applyExpert(f0, expertDoc[String(id)]); } } } }
  }

  // ---- ההמלצות הנבחרות של היום (עד 6) ----
  const nowMs = Date.now(), KICK = 5 * 60e3, N_PICKS = 6;
  const tkey = m => m.stat === 'g' && (m.group === '1x2' || m.group === 'dc') ? 'res' : m.stat;
  const byId = new Map(fixtures.map(f => [String(f.id), f]));
  const locked = (prevToday?.dayPicks || []).filter(p => { const f = byId.get(String(p.fid)); return f && f.ts * 1000 < nowMs - KICK && f.markets[p.mi]; }); // משחק שהתחיל: ההמלצה נשארת כמו שהיא
  const lockedIds = new Set(locked.map(p => String(p.fid)));
  const cand = [];
  for (const f of fixtures) {
    if (lockedIds.has(String(f.id)) || f.ts * 1000 < nowMs - KICK || !(f.enough || f.cup)) continue;
    f.picks.forEach(mi => { const m = f.markets[mi]; if (m) cand.push({ fid: f.id, mi, score: m.score, ev: m.ev, conf: f.conf, t: tkey(m) }); });
  }
  const choose = minScore => {
    const pool = cand.filter(c => c.score >= minScore).sort((a, b) => b.score - a.score || b.conf - a.conf || b.ev - a.ev);
    const out = [], seen = new Set(), perType = {};
    for (const c of pool) {
      if (out.length + locked.length >= N_PICKS) break;
      if (seen.has(String(c.fid)) || (perType[c.t] || 0) >= 3) continue;
      out.push(c); seen.add(String(c.fid)); perType[c.t] = (perType[c.t] || 0) + 1;
    }
    return out;
  };
  const chosen = choose(6);   // רק ציון 6 ומעלה
  // גיוון: לפחות המלצה אחת על קרנות ועל בעיטות (או בעיטות למסגרת), אם יש כאלה בדירוג 5 ומעלה
  const have = t => [...chosen, ...locked.map(p => ({ t: tkey(byId.get(String(p.fid)).markets[p.mi]) }))].some(c => (Array.isArray(t) ? t.includes(c.t) : c.t === t));
  for (const want of ['c', ['sh', 'sot']]) {
    if (have(want)) continue;
    const alt = cand.filter(c => (Array.isArray(want) ? want.includes(c.t) : c.t === want) && c.score >= 6 && !chosen.some(x => String(x.fid) === String(c.fid)) && !lockedIds.has(String(c.fid))).sort((x, y) => y.score - x.score || y.ev - x.ev)[0];
    if (!alt) continue;
    if (chosen.length + locked.length < N_PICKS) chosen.push(alt);
    else { const worst = chosen.map((c, i) => [c, i]).sort((x, y) => x[0].score - y[0].score)[0]; if (worst && worst[0].score <= alt.score) chosen[worst[1]] = alt; }
  }
  const dayPicks = [...locked.map(p => ({ fid: p.fid, mi: p.mi })), ...chosen.map(c => ({ fid: c.fid, mi: c.mi }))]
    .sort((a, b) => (byId.get(String(b.fid)).markets[b.mi].score - byId.get(String(a.fid)).markets[a.mi].score));

  // ---- משחקי הניחושים של החברים (קבועים ליום) ----
  const importance = f => f.quality * 0.5 + (EURO.includes(f.lg) ? 3 : 0) + (f.character?.rivalry?.derby ? 2 : 0) +
    ((f.home.rank && f.away.rank && f.home.rank <= Math.ceil(f.home.nTeams / 3) && f.away.rank <= Math.ceil(f.away.nTeams / 3)) ? 2 : 0) + ([39, 140, 135, 78, 61].includes(f.lg) ? 1 : 0);
  let keyMatches = (prevToday?.keyMatches || []).filter(k => byId.has(String(k.fid)));
  if (!keyMatches.length) {
    keyMatches = fixtures.filter(f => f.enough && f.ts * 1000 > nowMs).sort((a, b) => importance(b) - importance(a)).slice(0, 5)
      .sort((a, b) => a.ts - b.ts).map(f => ({ fid: f.id, cLine: (f.probs && f.probs.cLine) || 9.5 }));
  }

  const matchPicks = fixtures.map(f => ({ fid: f.id, mi: bestIdx(f) })).filter(p => p.mi >= 0);   // המלצה אחת לכל משחק, לפי הליגות שנבחרו
  const dayDoc = { date: today, mode: 'live', updated: new Date().toISOString(), leagues: LEAGUES, notes, fixtures, dayPicks, matchPicks, keyMatches, meta };
  writeJson(path.join(DAYS, `${today}.json`), dayDoc);
  try { const n = writeDossier(path.join(DATA, 'cache', `dossier-${today}.md`), { date: today, fixtures, leagueName: id => (LEAGUES.find(l => l.id === id) || {}).he || String(id) }); log(`תיקי משחק למנתח: ${n}`); } catch (e) { log('תיק משחק נכשל:', e.message); }

  // ================= 4. בדיקת תוצאות ימים קודמים + טבלת הצלחה =================
  const index = readJson(path.join(DAYS, 'index.json'), { days: [] });
  if (!index.days.find(d => d.date === today)) index.days.push({ date: today });
  index.days.sort((x, y) => y.date.localeCompare(x.date));
  const picksLog = [], leagueLog = [], matchLog = []; let newly = 0;
  const actualText = (fx, m) => {
    const r = fx.result; if (!r) return null; const S = r.stats || {};
    const val = (st, i) => st === 'g' ? r.g[i] : st === 'c' ? (i === 0 ? r.h : r.a) : (S[st] ? S[st][i] : null);
    const h = val(m.stat, 0), a = val(m.stat, 1);
    if (['1x2', 'dc', 'btts'].includes(m.group)) return 'תוצאה ' + r.g[0] + ':' + r.g[1];
    if (h == null || a == null) return null;
    return m.group === 'total' ? 'סה״כ ' + (h + a) : m.group === 'home' ? 'המארחת ' + h : m.group === 'away' ? 'האורחת ' + a : h + ':' + a;
  };
  const buckets = {};
  for (let s = 1; s <= 10; s++) buckets[s] = { n: 0, win: 0, lose: 0, push: 0, staked: 0, profit: 0 };
  const detail = { byType: {}, byLeague: {}, byLeagueType: {}, byKind: {}, daily: {} };
  const addRes = (o, key, res) => { const b = o[key] ||= { n: 0, win: 0, lose: 0, push: 0 }; b.n++; if (res.includes('win')) b.win++; else if (res.includes('lose')) b.lose++; else b.push++; };
  for (const d of index.days) {
    const f = path.join(DAYS, `${d.date}.json`);
    const day = d.date === today ? dayDoc : readJson(f, null);
    if (!day) continue;
    let changed = false, games = 0, picks = 0;
    for (const fx of day.fixtures) {
      games++;
      const rec = cache.matches[fx.id];
      const regrade = fx.graded && fx.markets.some(m => m.stat === 'c1' && !m.res) && rec && rec.h1 && rec.g?.[0] != null;   // קרנות מחצית ראשונה לא נבדקו בעבר
      if ((!fx.graded || regrade) && rec && rec.g?.[0] != null) {
        const v = (st, side) => st === 'g' ? rec.g[side === 'h' ? 0 : 1] : st === 'g1' ? rec.ht?.[side === 'h' ? 0 : 1] : st === 'c1' ? rec.h1?.c?.[side === 'h' ? 0 : 1] : rec.s?.[side]?.[st];
        fx.result = { h: rec.s.h.c, a: rec.s.a.c, g: rec.g, stats: Object.fromEntries(['c', 'c1', 'sh', 'sot', 'f', 'k', 'g1'].map(st => [st, [v(st, 'h') ?? null, v(st, 'a') ?? null]])) };
        for (const m of fx.markets) {
          const st = m.stat || 'c', ah = v(st, 'h'), aa = v(st, 'a');
          if (ah == null || aa == null) continue;
          const s = settle(m, oneHot(ah), oneHot(aa));
          m.res = s.win >= 0.99 ? 'win' : s.lose >= 0.99 ? 'lose' : s.push >= 0.99 ? 'push' : s.win > s.lose ? 'halfwin' : 'halflose';
          m.profit = m.odds ? Math.round((s.win * (m.odds - 1) - s.lose) * 100) / 100 : null;
          m.actT = footAct(fx, m);
        }
        fx.graded = true; changed = true; if (!regrade) newly++;
      }
      if (fx.graded && fx.result) for (const m of fx.markets) if (m.res && !m.actT) { m.actT = footAct(fx, m); changed = true; }
      for (const i of fx.picks) {
        picks++;
        const m = fx.markets[i];
        if (!m?.res) continue;
        const b = buckets[m.score];
        b.n++;
        if (m.res.includes('win')) b.win++; else if (m.res.includes('lose')) b.lose++; else b.push++;
        if (m.odds) { b.staked++; b.profit = Math.round((b.profit + m.profit) * 100) / 100; }
      }
      // סטטיסטיקת ליגות וסוגי הימור: כל ההמלצות בציון 6 ומעלה עם יחס אמיתי של 1.45 ומעלה (לא רק הנבחרות לכל משחק)
      for (const m of fx.markets) {
        if (!(m.score >= 6 && m.odds >= 1.45)) continue;
        const tkey = m.stat === 'g' && (m.group === '1x2' || m.group === 'dc') ? 'res' : m.stat;
        leagueLog.push({ d: d.date, id: fx.id, lg: fx.lg, h: fx.home.name, a: fx.away.name, ts: fx.ts, t: tkey, label: m.label, score: m.score, price: m.odds, res: m.res || null, act: m.actT || null });
        if (!m.res) continue;
        addRes(detail.byType, tkey, m.res); addRes(detail.byLeague, fx.lg, m.res); addRes(detail.byLeagueType, fx.lg + '|' + tkey, m.res); addRes(detail.byKind, 'real', m.res); addRes(detail.daily, d.date, m.res);
      }
    }
    for (const p of day.dayPicks || []) {
      const fx = day.fixtures.find(x => String(x.id) === String(p.fid)), m = fx && fx.markets[p.mi];
      if (!m) continue;
      picksLog.push({ d: d.date, id: fx.id, h: fx.home.name, a: fx.away.name, lg: fx.lg, ts: fx.ts, t: tkey(m), label: m.label, score: m.score, price: m.odds || m.estOdds || null, real: !!m.odds, res: m.res || null, act: m.actT || footAct(fx, m) });
    }
    for (const f of day.fixtures) { const mi = bestIdx(f), m = mi >= 0 && f.markets[mi]; if (!m) continue; matchLog.push({ d: d.date, id: f.id, h: f.home.name, a: f.away.name, lg: f.lg, ts: f.ts, t: tkey(m), kind: [m.stat, m.group, m.side].join('|'), label: m.label, score: m.score, price: m.odds || null, res: m.res || null, act: m.actT || footAct(f, m) }); }
    d.games = games; d.picks = picks; d.graded = day.fixtures.filter(x => x.graded).length;
    if (changed && d.date !== today) writeJson(f, day);
  }
  if (dayDoc.fixtures.some(f => f.graded)) writeJson(path.join(DAYS, `${today}.json`), dayDoc);
  index.track = buckets; index.detail = detail; index.picksLog = picksLog; index.matchLog = matchLog; index.leagueLog = leagueLog; index.mode = 'live'; index.updated = dayDoc.updated;
  writeJson(path.join(DAYS, 'index.json'), index);
  writeJson(path.join(DATA, 'latest.json'), { date: today });

  // ================= 5. דפי סטטיסטיקה לכל ליגה =================
  const r1 = x => Math.round(x * 10) / 10;
  const stats = { updated: dayDoc.updated, leagues: {} };
  for (const lgInfo of LEAGUES) {
    if (EURO.includes(lgInfo.id)) continue;
    const model = getModel(lgInfo.id, season);
    if (!model.lg.n) { stats.leagues[lgInfo.id] = { n: 0, teams: [], refs: [], avg: null, last: null }; continue; }
    const mini = p => ({ n: p.n, st: p.st, pos: p.pos });
    const teams = Object.keys(model.teams).map(id => {
      const p = teamProfile(model, id, 'H', infoHe, { rankOf });
      return { name: p.name, games: p.games, all: mini(p.all), home: mini(p.home), away: mini(p.away), open: p.open, rank: p.rank, nTeams: p.nTeams, tier: p.tier, vs: { top: p.splits.top, mid: p.splits.mid, bot: p.splits.bot }, last5: p.last5 };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const refs = Object.entries(model.lg.refs).filter(([, r]) => r.k.length >= 3).map(([name, r]) => ({ name, n: r.n, k: r1(r.k.reduce((a, b) => a + b, 0) / r.k.length), f: r.f.length ? r1(r.f.reduce((a, b) => a + b, 0) / r.f.length) : null })).sort((a, b) => b.k - a.k);
    const avg = {}; for (const s of Object.keys(model.lg.avg)) avg[s] = { h: Math.round(model.lg.avg[s].h * 100) / 100, a: Math.round(model.lg.avg[s].a * 100) / 100 };
    stats.leagues[lgInfo.id] = { n: model.lg.n, teams, refs, avg, last: Math.max(...model.matches.map(m => m.ts)) };
  }
  // טבלאות ליגה (מקום, מאזן, שערים, נקודות, כושר)
  stats.tables = {};
  for (const lgInfo of LEAGUES) {
    const st = standings.get(lgInfo.id); if (!st || EURO.includes(lgInfo.id)) continue;
    stats.tables[lgInfo.id] = Object.entries(st.map).map(([id, r]) => ({ rank: r.rank, name: (infoHe[id] && infoHe[id].n) || String(id), p: r.played, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.points, form: r.form, grp: r.grp || null })).sort((a, b) => a.rank - b.rank);
  }
  writeJson(path.join(DATA, 'stats.json'), stats);
  // אופי כל ליגה, ביחס לממוצע של כל הליגות ולעונה שעברה
  const lgS = {}, KEYS = ['goals', 'corners', 'shots', 'sot', 'cards', 'fouls', 'homeW', 'draw', 'awayW', 'o25', 'btts'], gl = {};
  for (const lgInfo of LEARNING_LEAGUES) { const m = getModel(lgInfo.id, season); lgS[lgInfo.id] = { cur: leagueStats(m.matches), prev: leagueStats(histRecords.filter(r => r.lg === lgInfo.id && r.season === season - 1)) }; }
  for (const k of KEYS) { const xs = Object.values(lgS).filter(x => x.cur && x.cur[k] != null); const n = xs.reduce((s, x) => s + x.cur.n, 0); gl[k] = n ? xs.reduce((s, x) => s + x.cur[k] * x.cur.n, 0) / n : null; }
  writeJson(path.join(DATA, 'teams.json'), { updated: dayDoc.updated, learned: Object.keys(learn.seen).length, leagues: Object.fromEntries(Object.entries(knowByLeague).map(([id, arr]) => [id, { he: (LEAGUES.find(l => l.id === Number(id)) || {}).he || id, profile: lgS[id] ? leagueProfile((LEAGUES.find(l => l.id === Number(id)) || {}).he, lgS[id].cur, lgS[id].prev, gl, arr) : null, teams: arr.sort((a, b) => (a.rank || 99) - (b.rank || 99)) }])) });
  writeJson(path.join(DATA, 'cache', 'last-run.json'), { at: dayDoc.updated, newlyGraded: newly });
  writeJson(CACHE_FILE, cache);
  if (!process.env.SKIP_EXTRAS) try { await runBasketball({ root: ROOT, today, log, reuse: REUSE }); } catch (e) { log('כדורסל נכשל: ' + e.message); }
  try { const sf = path.join(DATA, 'cache', 'api-status.json'), stt = readJson(sf, null), df = path.join(DAYS, `${today}.json`), dd = readJson(df, null);
    if (stt && stt.suspended && Date.now() - stt.at < 36 * 3600e3 && dd) { const msg = '⚠️ מקור יחסי Bet365 (API-Football) מושעה כרגע. אין יחסים חדשים: בכדורסל (NBA ויורוליג) אין המלצות וטפסים, ובכדורגל ההמלצות החדשות מסתמכות על יחסים מוערכים.'; dd.notes = [...(dd.notes || []).filter(n => !String(n).includes('מושעה')), msg]; writeJson(df, dd); log('מקור היחסים מושעה'); } } catch (e) { log('בדיקת סטטוס API נכשלה: ' + e.message); }
  if (!process.env.SKIP_EXTRAS) try { runSlip({ root: ROOT, today, log }); } catch (e) { log('הטופס היומי נכשל: ' + e.message); }
  try { runLearnReport({ root: ROOT, log }); } catch (e) { log('לקחים נכשל: ' + e.message); }
  log(`סיום. ${fixtures.length} משחקים, תוצאות חדשות שנבדקו: ${newly}. קריאות ל-365Scores: ${stats365.calls}. ${notes.join(' ')}`);
}

main().catch(e => { console.error('שגיאה:', e.message); process.exit(1); });
