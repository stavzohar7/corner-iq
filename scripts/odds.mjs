// יחסי Bet365 אמיתיים מ-API-Football (חבילה חינמית: 100 קריאות ביום, ורק תאריכים מאתמול עד מחר).
// עלות: קריאה אחת לרשימת משחקי היום + קריאה אחת לכל משחק שעוד לא התחיל. התוצאה נשמרת במטמון (data/cache/odds-DATE.json),
// כך שריצות חוזרות באותו יום לא מבזבזות קריאות.
import fs from 'node:fs';
import path from 'node:path';
import { norm } from './context.mjs';

const BASE = 'https://v3.football.api-sports.io';
const BET365 = 8;
const DAILY_CAP = 90;          // משאירים מרווח מתחת ל-100
const REFRESH_H = 7;           // כמה שעות לפני שמרעננים יחסים של משחק שכבר נמשכו

const bigrams = s => { const t = ' ' + s + ' ', m = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
export function dice(a, b) {
  const A = bigrams(norm(a)), B = bigrams(norm(b)); let inter = 0, sa = 0, sb = 0;
  for (const [g, c] of A) { sa += c; if (B.has(g)) inter += Math.min(c, B.get(g)); }
  for (const c of B.values()) sb += c;
  return sa + sb ? 2 * inter / (sa + sb) : 0;
}

// התאמה בין המשחקים שלנו למשחקי ה-API: אותה ליגה, שעה קרובה, ושמות דומים
export function matchFixtures(ours, theirs) {
  const out = new Map(), used = new Set(), pairs = [];
  for (const o of ours) for (const t of theirs) {
    if (t.league.id !== o.lg || Math.abs(t.fixture.timestamp - o.ts) > 3600) continue;
    pairs.push({ o, t, s: dice(o.h, t.teams.home.name) + dice(o.a, t.teams.away.name) });
  }
  pairs.sort((x, y) => y.s - x.s);
  for (const p of pairs) {
    if (p.s < 1.0 || out.has(p.o.id) || used.has(p.t.fixture.id)) continue;
    out.set(p.o.id, p.t.fixture.id); used.add(p.t.fixture.id);
  }
  // שאריות: אם בליגה ובשעה הזאת נשאר משחק אחד אצלנו ואחד אצלם, הם כנראה אותו משחק
  const left = ours.filter(o => !out.has(o.id));
  for (const o of left) {
    const cands = theirs.filter(t => t.league.id === o.lg && !used.has(t.fixture.id) && Math.abs(t.fixture.timestamp - o.ts) <= 1800);
    const rivals = left.filter(x => x.lg === o.lg && Math.abs(x.ts - o.ts) <= 1800);
    if (cands.length === 1 && rivals.length === 1) { out.set(o.id, cands[0].fixture.id); used.add(cands[0].fixture.id); }
  }
  return out;
}

function readKey(root) {
  if (process.env.API_FOOTBALL_KEY) return process.env.API_FOOTBALL_KEY;
  try { return fs.readFileSync(path.join(root, 'key.txt'), 'utf8').trim(); } catch { return null; }
}

// dayFx: פריטי משחק (it.fixture, it.league, it.teams). מחזיר Map: מזהה משחק אצלנו -> מערך bets של Bet365
export async function fetchRealOdds({ root, today, dayFx, order = [], log = () => {} }) {
  const file = path.join(root, 'data', 'cache', `odds-${today}.json`);
  let cache = { date: today, calls: 0, fx: {} };
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.date === today) cache = c; } catch { /* אין מטמון */ }
  const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(cache)); };
  const result = () => new Map(Object.entries(cache.fx).filter(([, v]) => v.bets && v.bets.length).map(([k, v]) => [k, v.bets]));
  const key = readKey(root);
  if (!key) { log('יחסי Bet365: אין מפתח API, מדלגים'); return result(); }

  const now = Date.now();
  const upcoming = dayFx.filter(it => it.fixture.timestamp * 1000 > now + 5 * 60e3);
  const stale = id => { const e = cache.fx[id]; return !e || (now - e.at) > REFRESH_H * 3600e3; };
  const need = upcoming.filter(it => stale(String(it.fixture.id)));
  if (!need.length) { log(`יחסי Bet365: ${result().size} משחקים מהמטמון`); return result(); }

  const get = async p => {
    if (cache.calls >= DAILY_CAP) throw new Error('תקציב היומי של קריאות היחסים נגמר');
    cache.calls++;
    const r = await fetch(BASE + p, { headers: { 'x-apisports-key': key } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.json();
    const errs = b.errors && (Array.isArray(b.errors) ? b.errors : Object.values(b.errors));
    if (errs && errs.length) throw new Error(errs.join(' | '));
    return b;
  };
  try {
    const dates = [...new Set(need.map(it => new Date(it.fixture.timestamp * 1000).toISOString().slice(0, 10)))];
    let theirs = [];
    for (const d of dates) theirs = theirs.concat((await get('/fixtures?date=' + d)).response || []);
    const ours = need.map(it => ({ id: String(it.fixture.id), lg: it.league.id, ts: it.fixture.timestamp, h: it.teams.home.name, a: it.teams.away.name }));
    const pair = matchFixtures(ours, theirs);
    const rank = lg => { const i = order.indexOf(lg); return i < 0 ? 99 : i; };
    const queue = ours.filter(o => pair.has(o.id)).sort((x, y) => rank(x.lg) - rank(y.lg) || x.ts - y.ts);
    let got = 0;
    for (const o of queue) {
      const b = await get('/odds?fixture=' + pair.get(o.id) + '&bookmaker=' + BET365);
      const bk = b.response && b.response[0] && b.response[0].bookmakers && b.response[0].bookmakers.find(x => x.id === BET365);
      const prev = cache.fx[o.id];
      cache.fx[o.id] = { api: pair.get(o.id), at: now, bets: bk && bk.bets && bk.bets.length ? bk.bets : (prev && prev.bets) || null };
      if (cache.fx[o.id].bets) got++;
    }
    for (const o of ours) if (!pair.has(o.id) && !cache.fx[o.id]) cache.fx[o.id] = { api: null, at: now, bets: null };
    log(`יחסי Bet365: נמצאו ל-${got} משחקים מתוך ${ours.length} (${pair.size} הותאמו ל-API, ${cache.calls} קריאות היום)`);
  } catch (e) {
    { if (/suspend/i.test(e.message)) try { fs.mkdirSync(path.join(root, 'data', 'cache'), { recursive: true }); fs.writeFileSync(path.join(root, 'data', 'cache', 'api-status.json'), JSON.stringify({ suspended: true, at: Date.now(), msg: e.message })); } catch { /* */ } }
    log('יחסי Bet365: נעצר (' + e.message + ')');
  }
  save();
  return result();
}
