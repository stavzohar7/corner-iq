// הרצה יומית: מושך משחקים, סטטיסטיקות ויחסי Bet365, מנתח, ובודק תוצאות של ימים קודמים
// שימוש:  API_FOOTBALL_KEY=xxx node scripts/update.mjs      (אמיתי)
//         MOCK=1 node scripts/update.mjs                      (נתוני דמו)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUES, LEAGUE_IDS, BET365_ID, TIMEZONE } from './config.mjs';
import { createClient, BudgetExceeded } from './api.mjs';
import { compactFixture, buildLeagueModel, analyzeFixture, settle, oneHot } from './model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const CACHE_FILE = path.join(DATA, 'cache', 'matches.json');
const DAYS = path.join(DATA, 'days');
const MOCK = !!process.env.MOCK;
const MODE = MOCK ? 'demo' : 'live';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
const log = (...a) => console.log('•', ...a);

const today = process.env.DATE || new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());

async function main() {
  if (!MOCK && !process.env.API_FOOTBALL_KEY) throw new Error('חסר API_FOOTBALL_KEY (או הריצו עם MOCK=1 לנתוני דמו)');
  let mock = null;
  if (MOCK) mock = (await import('./mock.mjs')).createMock(today);
  const api = createClient({ mock });

  // ---- מטמון ----
  let cache = readJson(CACHE_FILE, null);
  if (!cache || cache.mode !== MODE) {
    log(`מאתחל מטמון (${MODE})`);
    cache = { mode: MODE, matches: {}, teams: {}, noStats: {} };
    fs.rmSync(DAYS, { recursive: true, force: true });
  }
  const notes = [];

  const rememberTeams = it => {
    for (const t of [it.teams.home, it.teams.away]) cache.teams[t.id] = { n: t.name, l: t.logo || null };
  };

  // ---- 1. משחקי היום ----
  const dayFx = (await api.getAll('/fixtures', { date: today, timezone: TIMEZONE }))
    .filter(it => LEAGUE_IDS.has(it.league.id));
  dayFx.forEach(rememberTeams);
  log(`משחקים היום בליגות הנבחרות: ${dayFx.length}`);
  const leagueSeasons = new Map(dayFx.map(it => [it.league.id, it.league.season]));

  // ---- 2. רשימת משחקים שהסתיימו בכל ליגה שמשחקת היום ----
  const finished = []; // {id, ts, lg, h, a}
  const odds = new Map();
  try {
    for (const [lg, season] of leagueSeasons) {
      const list = await api.getAll('/fixtures', { league: lg, season, status: 'FT-AET-PEN' });
      for (const it of list) {
        rememberTeams(it);
        finished.push({ id: it.fixture.id, ts: it.fixture.timestamp, lg, h: it.teams.home.id, a: it.teams.away.id });
      }
    }
    // ---- 3. יחסי Bet365 ----
    for (const [lg, season] of leagueSeasons) {
      const list = await api.getAll('/odds', { league: lg, season, date: today, bookmaker: BET365_ID });
      for (const it of list) {
        const bm = (it.bookmakers || []).find(b => b.id === BET365_ID) || it.bookmakers?.[0];
        if (bm) odds.set(it.fixture.id, bm.bets);
      }
    }
  } catch (e) {
    if (!(e instanceof BudgetExceeded)) throw e;
    notes.push('התקציב היומי של ה-API נגמר באמצע — חלק מהנתונים חסרים.');
  }
  log(`יחסי Bet365 נמצאו ל-${odds.size} משחקים`);

  // ---- 4. מה חסר במטמון (סדר עדיפויות) ----
  const index = readJson(path.join(DAYS, 'index.json'), { days: [] });
  const gradeIds = new Set();
  for (const d of index.days.slice(0, 14)) {
    const day = readJson(path.join(DAYS, `${d.date}.json`), null);
    for (const f of day?.fixtures || []) if (!f.graded && !cache.matches[f.id] && f.ts * 1000 < Date.now() - 2.5 * 3600e3) gradeIds.add(f.id);
  }
  const todayTeams = new Set(dayFx.flatMap(it => [it.teams.home.id, it.teams.away.id]));
  const missing = finished.filter(f => !cache.matches[f.id] && (cache.noStats[f.id] || 0) < 2);
  missing.sort((x, y) => {
    const px = todayTeams.has(x.h) || todayTeams.has(x.a) ? 1 : 0, py = todayTeams.has(y.h) || todayTeams.has(y.a) ? 1 : 0;
    return py - px || y.ts - x.ts;
  });
  const queue = [...gradeIds, ...missing.map(f => f.id).filter(id => !gradeIds.has(id))];
  log(`חסרות סטטיסטיקות ל-${queue.length} משחקים`);

  // ---- 5. משיכת סטטיסטיקות ב-batch של 20 ----
  let fetched = 0;
  try {
    for (let i = 0; i < queue.length; i += 20) {
      const ids = queue.slice(i, i + 20).join('-');
      const list = await api.getAll('/fixtures', { ids });
      for (const it of list) {
        rememberTeams(it);
        if (!['FT', 'AET', 'PEN'].includes(it.fixture.status.short)) continue;
        const rec = compactFixture(it);
        if (rec) { cache.matches[rec.id] = rec; fetched++; }
        else cache.noStats[it.fixture.id] = (cache.noStats[it.fixture.id] || 0) + 1;
      }
    }
  } catch (e) {
    if (!(e instanceof BudgetExceeded)) throw e;
    const left = queue.length - fetched;
    if (left > 0) notes.push(`נשארו ${left} משחקים עבר למשוך — יושלם בהרצות הבאות (המאגר מתמלא בהדרגה).`);
  }
  log(`נוספו למאגר ${fetched} משחקים (סה״כ ${Object.keys(cache.matches).length})`);

  // ---- 6. ניתוח משחקי היום ----
  const prevToday = readJson(path.join(DAYS, `${today}.json`), null);
  const models = new Map();
  const getModel = (lg, season) => {
    const k = `${lg}-${season}`;
    if (!models.has(k)) models.set(k, buildLeagueModel(Object.values(cache.matches).filter(m => m.lg === lg && m.season === season)));
    return models.get(k);
  };
  const fixtures = [];
  for (const it of dayFx.sort((x, y) => x.fixture.timestamp - y.fixture.timestamp)) {
    const status = it.fixture.status.short;
    const prev = prevToday?.fixtures?.find(f => f.id === it.fixture.id);
    if (prev && !['NS', 'TBD'].includes(status)) { fixtures.push({ ...prev, status }); continue; } // כבר התחיל — שומרים את הניתוח המקורי
    if (prev?.hasOdds && !odds.has(it.fixture.id)) { fixtures.push({ ...prev, status }); continue; } // לא לדרוס ניתוח טוב בניתוח בלי יחסים
    const fx = {
      id: it.fixture.id, ts: it.fixture.timestamp, status, round: it.league.round, venue: it.fixture.venue?.name || '',
      lg: it.league.id, h: it.teams.home.id, a: it.teams.away.id,
    };
    fixtures.push(analyzeFixture(fx, getModel(it.league.id, it.league.season), cache.teams, odds.get(fx.id)));
  }

  const dayDoc = {
    date: today, mode: MODE, updated: new Date().toISOString(), calls: api.calls,
    leagues: LEAGUES, notes, fixtures,
  };
  writeJson(path.join(DAYS, `${today}.json`), dayDoc);

  // ---- 7. בדיקת תוצאות ימים קודמים + טבלת הצלחה ----
  if (!index.days.find(d => d.date === today)) index.days.push({ date: today });
  index.days.sort((x, y) => y.date.localeCompare(x.date));
  const buckets = {};
  for (let s = 1; s <= 10; s++) buckets[s] = { n: 0, win: 0, lose: 0, push: 0, staked: 0, profit: 0 };
  for (const d of index.days) {
    const f = path.join(DAYS, `${d.date}.json`);
    const day = d.date === today ? dayDoc : readJson(f, null);
    if (!day) continue;
    let changed = false, games = 0, picks = 0;
    for (const fx of day.fixtures) {
      games++;
      const rec = cache.matches[fx.id];
      if (!fx.graded && rec) {
        fx.result = { h: rec.s.h.c, a: rec.s.a.c, g: rec.g };
        const dh = oneHot(rec.s.h.c), da = oneHot(rec.s.a.c);
        for (const m of fx.markets) {
          const s = settle(m, dh, da);
          m.res = s.win >= 0.99 ? 'win' : s.lose >= 0.99 ? 'lose' : s.push >= 0.99 ? 'push' : s.win > s.lose ? 'halfwin' : 'halflose';
          m.profit = m.odds ? Math.round((s.win * (m.odds - 1) - s.lose) * 100) / 100 : null;
        }
        fx.graded = true; changed = true;
      }
      for (const i of fx.picks) {
        picks++;
        const m = fx.markets[i];
        if (!m?.res) continue;
        const b = buckets[m.score];
        b.n++;
        if (m.res.includes('win')) b.win++; else if (m.res.includes('lose')) b.lose++; else b.push++;
        if (m.odds) { b.staked++; b.profit = Math.round((b.profit + m.profit) * 100) / 100; }
      }
    }
    d.games = games; d.picks = picks;
    d.graded = day.fixtures.filter(x => x.graded).length;
    if (changed && d.date !== today) writeJson(f, day);
  }
  if (dayDoc.fixtures.some(f => f.graded)) writeJson(path.join(DAYS, `${today}.json`), dayDoc);
  index.track = buckets;
  index.mode = MODE;
  index.updated = dayDoc.updated;
  writeJson(path.join(DAYS, 'index.json'), index);
  writeJson(path.join(DATA, 'latest.json'), { date: today });
  writeJson(CACHE_FILE, cache);
  log(`סיום. קריאות API: ${api.calls}. ${notes.join(' ')}`);
}

main().catch(e => { console.error('שגיאה:', e.message); process.exit(1); });
