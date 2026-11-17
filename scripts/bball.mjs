// כדורסל: NBA ויורוליג. נתונים מ-365Scores (תוצאות ולוח משחקים), יחסי Bet365 אמיתיים מ-API-Basketball,
// מודל התקפה/הגנה לכל קבוצה (עם העונה הקודמת כידע מקדים), מרווח וסכום נקודות, פרופילי קבוצות ולמידה מהמעקב.
import fs from 'node:fs';
import path from 'node:path';
import { http, recentOfComp, pageBack, isFinished, toBrief, pool, gameLineups } from './source-365.mjs';
import { matchFixtures, dice } from './odds.mjs';
import { fetchRotowire, normName } from './rotowire.mjs';
import { bbAct } from './acttext.mjs';
import { syncPlayers, buildLogs, projectTeam, coachOf, coreOf } from './bball-players.mjs';
import { loadNames, saveNames, ensureTeams, ensurePlayers } from './names-he.mjs';
import { learnFactor } from './arch.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const BASE365 = 'https://webws.365scores.com/web';
const Q = 'appTypeId=5&langId=1&timezoneName=Asia/Jerusalem&userCountryId=6';
const BASE_BB = 'https://v1.basketball.api-sports.io';
const BET365_BB = 4;
export const BB_COMPS = { 103: { api: 12, he: 'NBA', short: 'NBA' }, 569: { api: 120, he: 'יורוליג', short: 'יורוליג' } };
const COMP_IDS = Object.keys(BB_COMPS).map(Number);

// פרמטרים שאפשר לכוון (bball-backtest.mjs)
// הערכים נבחרו בבדיקה לאחור (bball-backtest.mjs). המודל לבדו טוב מניחוש ממוצע, אבל פחות מהשוק, ולכן משלבים אותו עם קווי Bet365
export const TB = { DECAY: 0.93, SHRINK_K: 10, PRIOR_W: 0.4, VENUE_MIX: 1, B2B: 0.005, W_MODEL: 0.3, SD_M: { 103: 13.5, 569: 11.6 }, SD_T: { 103: 18.5, 569: 17.5 }, SD_TEAM: { 103: 11.5, 569: 10.5 } };
// ההפוכה של ההתפלגות הנורמלית (קירוב של Acklam)
function invPhi(p) {
  p = clamp(p, 1e-6, 1 - 1e-6);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
    c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const iso = s => '⁨' + s + '⁩';
const erf = x => { const s = Math.sign(x), t = 1 / (1 + 0.3275911 * Math.abs(x)); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
const seasonOfTs = ts => { const d = new Date(ts * 1000); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };

// ---------- יום משחקים: לפי שעון ישראל, כשמשחקי הלילה (עד 07:00) שייכים ליום הקודם ----------
const ilParts = ts => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000)); const g = t => p.find(x => x.type === t).value; return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') }; };
export const gameDayOf = ts => { const { date, hour } = ilParts(ts); if (hour >= 7) return date; const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dmy = d => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
async function dayGamesBB(dateIso) {
  const j = await http(`${BASE365}/games/allscores/?${Q}&sports=2&startDate=${dmy(dateIso)}&endDate=${dmy(dateIso)}`);
  return ((j && j.games) || []).filter(g => COMP_IDS.includes(g.competitionId)).map(toBrief);
}

// ---------- סנכרון היסטוריית משחקים ----------
export async function syncHistory(cache, startTs, log = () => {}, today) {
  const add = arr => { for (const b of arr) if (isFinished(b) && b.ts >= startTs && b.g[0] > 0) cache.games[b.id] = { id: b.id, comp: b.comp, ts: b.ts, h: b.h, a: b.a, hn: b.hn, an: b.an, g: b.g, stage: b.stage }; };
  for (const comp of COMP_IDS) {
    const st = cache.comps[comp] ||= { complete: false };
    const page = await recentOfComp(comp); add(page);
    if (st.complete) continue;
    let oldest = page.length ? page.reduce((m, b) => (b.ts < m.ts ? b : m)) : null, guard = 0;
    while (oldest && guard++ < 280) {
      const back = await pageBack(comp, oldest.id);
      if (!back.length) { st.complete = true; break; }
      add(back);
      oldest = back.reduce((m, b) => (b.ts < m.ts ? b : m));
      if (oldest.ts < startTs) { st.complete = true; break; }
    }
    log(`כדורסל: תחרות ${comp}: ${Object.values(cache.games).filter(g => g.comp === comp).length} משחקים${st.complete ? '' : ' (עוד לא הושלם)'}`);
  }
  // סימון חד-פעמי של שלב המשחק (טרום עונה = 1) למשחקים שכבר במטמון: עוברים אחורה עד תחילת הספטמבר האחרון
  for (const comp of COMP_IDS) {
    const st = cache.comps[comp] ||= {};
    if (st.staged) continue;
    const stop = Date.UTC(new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0), 8, 1) / 1000;
    let page = await recentOfComp(comp); add(page);
    let oldest = page.length ? page.reduce((m, b) => (b.ts < m.ts ? b : m)) : null, guard = 0;
    while (oldest && oldest.ts > stop && guard++ < 40) { const back = await pageBack(comp, oldest.id); if (!back.length) break; add(back); oldest = back.reduce((m, b) => (b.ts < m.ts ? b : m)); }
    st.staged = true;
  }
  // רשת ביטחון: משחקים שהסתיימו ב-3 הימים האחרונים (הדף האחרון של 365 קצר ב-NBA)
  for (let i = -3; i <= 1; i++) add(await dayGamesBB(addDays(today, i)));
}

// ---------- מודל ----------
export function buildBB(games, priorGames = []) {
  const ms = [...games].sort((a, b) => b.ts - a.ts);
  const all = ms.concat(priorGames);
  const lg = { h: all.length ? mean(all.map(g => g.g[0])) : 110, a: all.length ? mean(all.map(g => g.g[1])) : 107, n: ms.length };
  const teams = {}, priors = {};
  const put = (m, g, prior, pw) => {
    const tgt = prior ? priors : teams;
    (tgt[g.h] ||= []).push({ id: g.id, ts: g.ts, opp: g.a, v: 'H', pf: g.g[0], pa: g.g[1], prior, pw });
    (tgt[g.a] ||= []).push({ id: g.id, ts: g.ts, opp: g.h, v: 'A', pf: g.g[1], pa: g.g[0], prior, pw });
  };
  for (const g of ms) put(teams, g, false);
  for (const g of [...priorGames].sort((a, b) => b.ts - a.ts)) put(priors, g, true, g.pw);
  return { lg, teams, priors };
}
function wmean(arr, f, w) { let s = 0, t = 0; arr.forEach((x, i) => { const wt = TB.DECAY ** i * w(x); s += wt * f(x); t += wt; }); return t ? s / t : null; }
// side 'F' = נקודות שהקבוצה קולעת, 'A' = נקודות שהיא סופגת. יחס מול ממוצע הליגה באותו מגרש
function strengthBB(list, prior, v, side, lg) {
  const L = list.concat(TB.PRIOR_W > 0 && prior ? prior : []);
  if (!L.length) return 1;
  const w = e => e.prior ? (e.pw != null ? e.pw : TB.PRIOR_W) : 1;
  const val = e => side === 'F' ? e.pf : e.pa;
  const base = (vv) => side === 'F' ? (vv === 'H' ? lg.h : lg.a) : (vv === 'H' ? lg.a : lg.h);
  const venue = L.filter(e => e.v === v);
  const nV = venue.reduce((s, e) => s + w(e), 0), nA = L.reduce((s, e) => s + w(e), 0);
  const rV = venue.length ? wmean(venue, val, w) / base(v) : 1;
  const rA = wmean(L, e => val(e) / base(e.v), w);
  const neff = nV + TB.VENUE_MIX * nA, comb = (nV * rV + TB.VENUE_MIX * nA * rA) / neff;
  return (neff * comb + TB.SHRINK_K) / (neff + TB.SHRINK_K);
}
const restOf = (list, ts) => list.length ? (ts - list[0].ts) / 86400 : 7;
export function predictBB(model, hId, aId, ts, opt = {}) {
  const lg = model.lg, lh = model.teams[hId] || [], la = model.teams[aId] || [], ph = model.priors[hId], pa = model.priors[aId];
  const attH = strengthBB(lh, ph, 'H', 'F', lg), defH = strengthBB(lh, ph, 'H', 'A', lg), attA = strengthBB(la, pa, 'A', 'F', lg), defA = strengthBB(la, pa, 'A', 'A', lg);
  let muH = lg.h * attH * defA, muA = lg.a * attA * defH;
  const rH = restOf(lh, ts), rA = restOf(la, ts), b2bH = rH < 1.4, b2bA = rA < 1.4;
  if (b2bH) muH *= 1 - TB.B2B; if (b2bA) muA *= 1 - TB.B2B;
  if (opt.fH) muH *= opt.fH; if (opt.fA) muA *= opt.fA;
  if (opt.adjH) muH *= opt.adjH; if (opt.adjA) muA *= opt.adjA;
  return { muH, muA, attH, defH, attA, defA, rH, rA, b2bH, b2bA };
}

// ---------- יחסי Bet365 (API-Basketball) ----------
function parseBBOdds(bets) {
  const out = [], push = (group, side, line, odds) => { if (odds > 1) out.push({ group, side, line, odds }); };
  for (const b of bets || []) {
    const vals = b.values || [], name = b.name || '';
    if (b.id === 2 || /^home\/away$/i.test(name)) for (const v of vals) { const s = String(v.value).toLowerCase(); if (s === 'home' || s === 'away') push('ml', s, null, parseFloat(v.odd)); }
    else if (b.id === 3 || /^asian handicap$/i.test(name)) for (const v of vals) { const m = String(v.value).match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)$/i); if (m) push('spread', m[1].toLowerCase(), parseFloat(m[2]), parseFloat(v.odd)); }
    else if (b.id === 4 || /^over\/under$/i.test(name)) for (const v of vals) { const m = String(v.value).match(/^(over|under)\s*(\d+(?:\.\d+)?)$/i); if (m) push('total', m[1].toLowerCase(), parseFloat(m[2]), parseFloat(v.odd)); }
    else if (b.id === 28 || /^home team total.*including ot/i.test(name)) for (const v of vals) { const m = String(v.value).match(/^(over|under)\s*(\d+(?:\.\d+)?)$/i); if (m) push('th', m[1].toLowerCase(), parseFloat(m[2]), parseFloat(v.odd)); }
    else if (/^player points milestones$/i.test(name)) for (const v of vals) { const m = String(v.value).match(/^(.+?)\s*-\s*(\d+)$/); if (m) push('pp', m[1].trim(), parseInt(m[2], 10), parseFloat(v.odd)); }
    else if (b.id === 29 || /^away team total.*including ot/i.test(name)) for (const v of vals) { const m = String(v.value).match(/^(over|under)\s*(\d+(?:\.\d+)?)$/i); if (m) push('ta', m[1].toLowerCase(), parseFloat(m[2]), parseFloat(v.odd)); }
  }
  // הסתברות שוק בלי עמלה: זוגות מעל/מתחת, בית/חוץ (בהנדיקאפ הקו של הבית הוא ההפוך של האורחת)
  const opp = o => o.group === 'ml' ? out.find(x => x.group === 'ml' && x.side !== o.side) : o.group === 'spread' ? out.find(x => x.group === 'spread' && x.side !== o.side && x.line === o.line) : out.find(x => x.group === o.group && x.line === o.line && x.side !== o.side);
  for (const o of out) { if (o.group === 'pp') continue; const p = opp(o); if (p) { o.pMarket = (1 / o.odds) / (1 / o.odds + 1 / p.odds); o.ovr = 1 / o.odds + 1 / p.odds; } }
  return out;
}
export async function fetchBBOdds({ root, today, games, log = () => {} }) {
  const file = path.join(root, 'data', 'cache', `bball-odds-${today}.json`);
  let cache = { date: today, calls: 0, fx: {} };
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.date === today) cache = c; } catch { /* אין */ }
  const result = () => new Map(Object.entries(cache.fx).filter(([, v]) => v.bets && v.bets.length).map(([k, v]) => [k, v.bets]));
  let key = process.env.API_FOOTBALL_KEY; try { key = key || fs.readFileSync(path.join(root, 'key.txt'), 'utf8').trim(); } catch { /* */ }
  if (!key) return result();
  const now = Date.now(), upcoming = games.filter(g => g.ts * 1000 > now + 5 * 60e3);
  const stale = id => { const e = cache.fx[id]; return !e || (now - e.at) > 5 * 3600e3; };
  const need = upcoming.filter(g => stale(String(g.id)));
  if (!need.length) return result();
  let lastCall = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const get = async p => {
    if (cache.calls >= 80) throw new Error('תקציב קריאות');
    for (let attempt = 0; attempt < 2; attempt++) {
      const gap = Date.now() - lastCall; if (gap < 6500) await wait(6500 - gap);   // המכסה של ה-API: 10 קריאות בדקה
      lastCall = Date.now(); cache.calls++;
      const r = await fetch(BASE_BB + p, { headers: { 'x-apisports-key': key } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = await r.json(); const errs = b.errors && (Array.isArray(b.errors) ? b.errors : Object.values(b.errors));
      if (errs && errs.length) { if (attempt === 0 && /too many|rate limit/i.test(errs.join(' '))) { await wait(62000); continue; } throw new Error(errs.join(' | ')); }
      return b;
    }
    throw new Error('Too many requests');
  };
  try {
    const dates = [...new Set(need.flatMap(g => [new Date(g.ts * 1000).toISOString().slice(0, 10)]))];
    let theirs = [];
    for (const d of dates) theirs = theirs.concat((await get('/games?date=' + d)).response || []);
    const adapt = theirs.map(t => ({ league: { id: t.league.id }, fixture: { id: t.id, timestamp: t.timestamp }, teams: { home: { name: t.teams.home.name }, away: { name: t.teams.away.name } } }));
    const ours = need.map(g => ({ id: String(g.id), lg: BB_COMPS[g.comp].api, ts: g.ts, h: g.hn, a: g.an }));
    const pair = matchFixtures(ours, adapt);
    let got = 0;
    for (const o of ours) {
      if (!pair.has(o.id)) { cache.fx[o.id] ||= { api: null, at: now, bets: null }; continue; }
      const b = await get('/odds?game=' + pair.get(o.id) + '&bookmaker=' + BET365_BB);
      const bk = b.response && b.response[0] && b.response[0].bookmakers && b.response[0].bookmakers.find(x => x.id === BET365_BB);
      const prev = cache.fx[o.id];
      cache.fx[o.id] = { api: pair.get(o.id), at: now, bets: bk && bk.bets && bk.bets.length ? bk.bets : (prev && prev.bets) || null };
      if (cache.fx[o.id].bets) got++;
    }
    log(`כדורסל: יחסי Bet365 ל-${got} משחקים מתוך ${ours.length} (${cache.calls} קריאות היום)`);
  } catch (e) { { if (/suspend/i.test(e.message)) try { fs.mkdirSync(path.join(root, 'data', 'cache'), { recursive: true }); fs.writeFileSync(path.join(root, 'data', 'cache', 'api-status.json'), JSON.stringify({ suspended: true, at: Date.now(), msg: e.message })); } catch { /* */ } } log('כדורסל: יחסים נעצרו (' + e.message + ')'); }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(cache));
  return result();
}

// ---------- הימורים ----------
// נקודות (לבית ולחוץ) מול קו: win / push / lose בהתפלגות נורמלית של סכום שלם
function settleNormal(mu, sd, line, over) {
  const isInt = Math.abs(line - Math.round(line)) < 1e-9;
  const up = 1 - Phi(((isInt ? line + 0.5 : line) - mu) / sd);            // P(X > line)
  const push = isInt ? Phi((line + 0.5 - mu) / sd) - Phi((line - 0.5 - mu) / sd) : 0;
  const pOver = up, pUnder = 1 - up - push;
  return over ? { win: pOver, push, lose: pUnder } : { win: pUnder, push, lose: pOver };
}
const gameOutcome = (mk, hp, ap) => { // תוצאת הימור על משחק עם נקודות הבית והחוץ: 1 / 0 / 0.5 (החזר)
  const cmp = (x, line, over) => x === line ? 0.5 : (over ? x > line : x < line) ? 1 : 0;
  if (mk.group === 'ml') return hp === ap ? 0.5 : ((hp > ap) === (mk.side === 'home')) ? 1 : 0;
  if (mk.group === 'spread') { const v = (hp - ap) + mk.homeLine; return v === 0 ? 0.5 : ((v > 0) === (mk.side === 'home')) ? 1 : 0; }
  if (mk.group === 'total') return cmp(hp + ap, mk.line, mk.side === 'over');
  if (mk.group === 'th') return cmp(hp, mk.line, mk.side === 'over');
  if (mk.group === 'ta') return cmp(ap, mk.line, mk.side === 'over');
  return 0;
};
const rate = (xs, mk, orient) => { let s = 0, n = 0; for (const e of xs) { const [hp, ap] = orient(e); const r = gameOutcome(mk, hp, ap); if (r !== 0.5) { s += r; n++; } } return n ? [r2(s / n), n] : null; };
const combine = (a, b) => { const p = [a, b].filter(x => x && x[1] >= 3); if (!p.length) return null; const n = p.reduce((s, x) => s + x[1], 0); return r2(p.reduce((s, x) => s + x[0] * x[1], 0) / n); };
function histBB(mk, lh, la) {
  const hv = rate(lh.filter(e => e.v === 'H'), mk, e => [e.pf, e.pa]), av = rate(la.filter(e => e.v === 'A'), mk, e => [e.pa, e.pf]);
  const h6 = rate(lh.slice(0, 6), mk, e => [e.pf, e.pa]), a6 = rate(la.slice(0, 6), mk, e => [e.pa, e.pf]);
  return { hv, av, v: combine(hv, av), l6: combine(h6, a6) };
}
function scoreBB(m, conf, hist) {
  const parts = [], wts = [], add = (v, w) => { if (v != null && !Number.isNaN(v)) { parts.push(v * w); wts.push(w); } };
  add(m.pModel, 0.5); if (hist) { add(hist.v, 0.2); add(hist.l6, 0.1); } add(m.pMarket, 0.3);
  const p = parts.reduce((x, y) => x + y, 0) / wts.reduce((x, y) => x + y, 0);
  let S = (p - 0.45) / 0.35;
  const edge = m.pMarket != null ? m.pModel - m.pMarket : 0;
  S += clamp(edge / 0.2, -0.3, 0.3) * 0.5;
  if (m.pMarket != null && Math.abs(edge) > 0.18) S -= (Math.abs(edge) - 0.18) * 2;
  if (hist && hist.v != null && hist.v < 0.4 && m.pModel >= 0.5) S -= 0.15;
  let score = 1 + 9 * clamp(S, 0, 1);
  score *= 0.55 + 0.45 * conf;
  const nH = hist && hist.hv && hist.av ? Math.min(hist.hv[1], hist.av[1]) : 0;
  if (nH < 4) score = Math.min(score, 6);
  if (m.pFinal < 0.5) score = Math.min(score, 4);
  if (m.odds < 1.35) score = Math.min(score, 6); else if (m.odds < 1.5) score = Math.min(score, 7);
  return clamp(Math.round(score), 1, 10);
}
const fmtLine = x => (x > 0 ? '+' : '') + x;

// ---------- פרופילי קבוצות ----------
export function profileBB(model, id, rankOf, names) {
  const L = model.teams[id] || []; if (L.length < 3) return null;
  const lg = model.lg, avgT = (lg.h + lg.a) / 2;
  const w = L.filter(e => e.pf > e.pa).length, l = L.length - w;
  const ppg = mean(L.map(e => e.pf)), opp = mean(L.map(e => e.pa));
  const rec = f => { const X = L.filter(f); return X.length ? { n: X.length, w: X.filter(e => e.pf > e.pa).length, ppg: r1(mean(X.map(e => e.pf))), opp: r1(mean(X.map(e => e.pa))) } : null; };
  const tierOf = t => { const r = rankOf(t); if (!r) return null; const k = Math.ceil(r.n / 3); return r.rank <= k ? 'top' : r.rank > r.n - k ? 'bot' : 'mid'; };
  const off = ppg / avgT, def = opp / avgT, pace = (ppg + opp) / (2 * avgT);
  const arch = off >= 1.03 && def <= 0.98 ? 'elite' : off >= 1.04 && def > 0.98 ? 'offense' : def <= 0.96 && off < 1.04 ? 'defense' : off <= 0.97 && def >= 1.03 ? 'weak' : 'balanced';
  const ARCH = { elite: ['חזקה משני הצדדים', 'קולעת הרבה וסופגת מעט'], offense: ['התקפה לפני הכל', 'קולעת הרבה אבל מרשה גם'], defense: ['הגנה קודם', 'מגינה חזק ומנצחת במשחקים נמוכים'], weak: ['חלשה משני הצדדים', 'מתקשה לקלוע ומרשה הרבה'], balanced: ['מאוזנת', 'בלי קיצוניות בסגנון'] }[arch];
  const form = L.slice(0, 6).map(e => e.pf > e.pa ? 'W' : 'L').join('');
  const lines = [];
  const H = rec(e => e.v === 'H'), A = rec(e => e.v === 'A');
  if (H && A && H.n >= 3 && A.n >= 3) { const d = H.w / H.n - A.w / A.n; if (d >= 0.3) lines.push(`קבוצת בית: ${H.w} ניצחונות ב-${H.n} משחקי בית מול ${A.w} ב-${A.n} משחקי חוץ.`); else if (d <= -0.2) lines.push(`דווקא טובה יותר בחוץ: ${A.w} ניצחונות ב-${A.n} משחקי חוץ מול ${H.w} ב-${H.n} בבית.`); }
  const T = { top: rec(e => tierOf(e.opp) === 'top'), mid: rec(e => tierOf(e.opp) === 'mid'), bot: rec(e => tierOf(e.opp) === 'bot') };
  if (T.top && T.top.n >= 3) lines.push(`מול קבוצות מהשליש העליון: ${T.top.w} ניצחונות ב-${T.top.n} משחקים.`);
  if (T.bot && T.bot.n >= 3 && T.bot.w / T.bot.n < 0.6) lines.push(`מאבדת נקודות גם מול קבוצות מהתחתית: ${T.bot.w} ניצחונות ב-${T.bot.n} משחקים.`);
  if (pace >= 1.04) lines.push(`משחק מהיר: ${r1(ppg + opp)} נקודות למשחק בסך הכל (ממוצע ${r1(avgT * 2)}).`); else if (pace <= 0.96) lines.push(`משחק איטי: ${r1(ppg + opp)} נקודות למשחק בסך הכל (ממוצע ${r1(avgT * 2)}).`);
  const b2b = L.filter((e, i) => L[i + 1] && (e.ts - L[i + 1].ts) / 86400 < 1.4);
  if (b2b.length >= 4) { const bw = b2b.filter(e => e.pf > e.pa).length; if (bw / b2b.length <= 0.3) lines.push(`נחלשת ביום שני ברצף: ${bw} ניצחונות ב-${b2b.length} משחקים כאלה.`); }
  const l5 = L.slice(0, 5), net5 = mean(l5.map(e => e.pf - e.pa)), net = mean(L.map(e => e.pf - e.pa));
  if (L.length >= 8) { if (net5 - net >= 5) lines.push(`בעלייה: הפרש של ${r1(net5)} נקודות למשחק ב-5 האחרונים (העונה ${r1(net)}).`); else if (net5 - net <= -5) lines.push(`בירידה: הפרש של ${r1(net5)} נקודות למשחק ב-5 האחרונים (העונה ${r1(net)}).`); }
  // אופי הקבוצה בבית ובחוץ ומול סוגי יריבות: שורות קבועות לכל קבוצה (לא רק כשיש חריגה)
  const chars = [];
  if (H && A && H.n >= 2 && A.n >= 2) {
    const parts = ['בבית ' + H.w + '-' + (H.n - H.w) + ' (' + H.ppg + ' קלועות, ' + H.opp + ' סופגות), בחוץ ' + A.w + '-' + (A.n - A.w) + ' (' + A.ppg + ' קלועות, ' + A.opp + ' סופגות).'];
    const dOff = H.ppg - A.ppg, dDef = A.opp - H.opp;
    if (Math.abs(dDef) >= 5) parts.push(dDef > 0 ? 'ההגנה שלה חזקה יותר בבית.' : 'ההגנה שלה חזקה יותר דווקא בחוץ.');
    if (Math.abs(dOff) >= 5) parts.push(dOff > 0 ? 'ההתקפה שלה זורמת יותר בבית.' : 'ההתקפה שלה זורמת יותר דווקא בחוץ.');
    chars.push(parts.join(' '));
  }
  { const tp = [['גדולות', T.top], ['בינוניות', T.mid], ['קטנות', T.bot]].filter(([, x]) => x && x.n >= 2).map(([nm, x]) => nm + ' ' + x.w + '-' + (x.n - x.w) + ' (' + x.ppg + ':' + x.opp + ')');
    if (tp.length >= 2) chars.push('מול ' + tp.join(' · ') + '.'); }
  lines.unshift(...chars.filter(c => !lines.includes(c)));
  const r = rankOf(id);
  return { id, name: names[id] || String(id), n: L.length, w, l, ppg: r1(ppg), opp: r1(opp), net: r1(ppg - opp), off: r2(off), def: r2(def), pace: r2(pace), rank: r ? r.rank : null, nTeams: r ? r.n : null, arch, archHe: ARCH[0], archShort: ARCH[1], form, home: H, away: A, top: T.top, mid: T.mid, bot: T.bot, lines: lines.slice(0, 9),
    last: L.slice(0, 8).map(e => ({ ts: e.ts, opp: names[e.opp] || '?', v: e.v, pf: e.pf, pa: e.pa })) };
}

// ---------- ניתוח משחק ----------
function analyzeBB(g, model, rankOf, names, odds, news, learn, logs, meta = {}) {
  const comp = g.comp, lh = model.teams[g.h] || [], la = model.teams[g.a] || [];
  const enough = Math.min(lh.length, la.length) >= 3;
  const lt = id => learn.teams[String(id)] || {};
  const fH = learnFactor(lt(g.h).f) * learnFactor(lt(g.a).a), fA = learnFactor(lt(g.a).f) * learnFactor(lt(g.h).a);
  const adj = n => n ? Math.max(0.93, 1 - 0.012 * n) : 1;
  const P = predictBB(model, g.h, g.a, g.ts, { fH, fA, adjH: adj(news.nH), adjA: adj(news.nA) });
  const sdM = TB.SD_M[comp], sdT = TB.SD_T[comp], sdTeam = TB.SD_TEAM[comp];
  const mainOf = group => { const xs = odds.filter(o => o.group === group && o.side === (group === 'spread' ? 'home' : 'over')); let best = null; for (const o of xs) { const q = odds.find(p => p.group === group && p.line === o.line && p.side !== o.side); if (!q) continue; const d = Math.abs(o.odds - q.odds); if (!best || d < best.d) best = { d, line: o.line, a: o.odds, b: q.odds }; } return best ? { line: best.line, a: best.a, b: best.b } : null; };
  const mS = mainOf('spread'), mT = mainOf('total');
  let margin = P.muH - P.muA, total = P.muH + P.muA; const modelOnly = { margin: r1(margin), total: r1(total) }, market = {};
  if (mS) { market.margin = r1(-mS.line + sdM * invPhi((1 / mS.a) / (1 / mS.a + 1 / mS.b))); margin = TB.W_MODEL * margin + (1 - TB.W_MODEL) * market.margin; }
  if (mT) { market.total = r1(mT.line + sdT * invPhi((1 / mT.a) / (1 / mT.a + 1 / mT.b))); total = TB.W_MODEL * total + (1 - TB.W_MODEL) * market.total; }
  const mu = { h: (total + margin) / 2, a: (total - margin) / 2, margin, total };
  const Hn = iso(names[g.h] || g.hn), An = iso(names[g.a] || g.an);
  const H = profileBB(model, g.h, rankOf, names), A = profileBB(model, g.a, rankOf, names);
  const conf = clamp(Math.min(lh.length, la.length) / 15, 0.3, 1) * (news.checked ? 1 : 0.95);
  const markets = [];
  // ה-API לפעמים מערבב קווי הנדיקאפ של חצאים / מחצית. בודקים שכל קו עקבי עם עקומת השוק סביב הקו הראשי, ומסננים חריגים
  const curveP = o => {
    if (o.group === 'spread' && market.margin != null) { const p = 1 - Phi((-o.line - market.margin) / sdM); return o.side === 'home' ? p : 1 - p; }
    if (o.group === 'total' && market.total != null) { const p = 1 - Phi((o.line - market.total) / sdT); return o.side === 'over' ? p : 1 - p; }
    if (o.group === 'th') { const p = 1 - Phi((o.line - mu.h) / sdTeam); return o.side === 'over' ? p : 1 - p; }
    if (o.group === 'ta') { const p = 1 - Phi((o.line - mu.a) / sdTeam); return o.side === 'over' ? p : 1 - p; }
    return null;
  };
  if (enough) for (const o of odds) {
    if (o.group === 'pp') continue;
    if (!(o.odds >= 1.45 && o.odds <= 3.2)) continue;
    if (o.group !== 'ml') { if (o.ovr == null || o.ovr < 1.02 || o.ovr > 1.14) continue; }   // רק קווים עם שני צדדים ועמלה סבירה (קו אמיתי של Bet365)
    if (o.group === 'spread' && mS && Math.abs(o.line - mS.line) > 9) continue;                 // קווים הגיוניים למשחק (עד 9 נקודות מהקו הראשי), ועקביים עם עקומת השוק
    if (o.group === 'total' && mT && Math.abs(o.line - mT.line) > 11) continue;
    if (o.group === 'th' && Math.abs(o.line - mu.h) > 9) continue;
    if (o.group === 'ta' && Math.abs(o.line - mu.a) > 9) continue;
    if (o.group !== 'ml') { if (o.pMarket == null) continue; const cp = curveP(o); if (cp != null && Math.abs(cp - o.pMarket) > (o.group === 'th' || o.group === 'ta' ? 0.16 : 0.11)) continue; }
    const mk = { group: o.group, side: o.side, line: o.line, odds: o.odds, pMarket: o.pMarket };
    let st, label;
    if (o.group === 'ml') { const p = Phi(mu.margin / sdM); st = { win: o.side === 'home' ? p : 1 - p, push: 0 }; label = `${o.side === 'home' ? Hn : An} מנצחת`; }
    else if (o.group === 'spread') {
      mk.homeLine = o.line; const s = settleNormal(mu.margin, sdM, -o.line, true);        // הבית מכסה אם ההפרש > -הקו
      st = o.side === 'home' ? { win: s.win, push: s.push } : { win: s.lose, push: s.push };
      label = o.side === 'home' ? `${Hn} ${fmtLine(o.line)} הנדיקאפ` : `${An} ${fmtLine(-o.line)} הנדיקאפ`;
    } else if (o.group === 'total') { const s = settleNormal(mu.total, sdT, o.line, o.side === 'over'); st = s; label = `${o.side === 'over' ? 'מעל ' : 'מתחת ל-'}${o.line} נקודות במשחק`; }
    else { const m = o.group === 'th' ? mu.h : mu.a, s = settleNormal(m, sdTeam, o.line, o.side === 'over'); st = s; label = `${o.group === 'th' ? Hn : An} ${o.side === 'over' ? 'מעל ' : 'מתחת ל-'}${o.line} נקודות`; }
    const pModel = st.win / (st.win + (1 - st.win - st.push) || 1e-9);
    mk.label = label; mk.pModel = r2(pModel); mk.push = r2(st.push);
    mk.pFinal = r2(0.5 * pModel + 0.5 * (o.pMarket != null ? o.pMarket : pModel));
    mk.ev = r2(mk.pFinal * (1 - st.push) * (o.odds - 1) - (1 - mk.pFinal) * (1 - st.push));
    mk.hist = histBB(mk, lh, la);
    mk.score = scoreBB(mk, conf, mk.hist);
    mk.checks = checksBB(mk, P, news);
    if (mk.score >= 4) markets.push(mk);
  }
  // תחזית שחקנים + הימורי שחקנים של Bet365 (שוק "X נקודות ומעלה"; רק נקודות קיימות בפיד של Bet365)
  const players = enough && logs ? (() => {
    const lgAvg = (model.lg.h + model.lg.a) / 2, lgTotal = model.lg.h + model.lg.a;
    const h = projectTeam({ logs, teamId: g.h, ts: g.ts, side: 'H', muTeam: mu.h, teamAvg: (H && H.ppg) || lgAvg, margin: mu.margin, lgTotal, muTotal: mu.total, b2b: P.b2bH, outs: news.outs.h, doubt: news.doubt.h, ques: news.ques.h, oppName: names[g.a] || g.an, oppDefRel: A ? A.def : null });
    const a = projectTeam({ logs, teamId: g.a, ts: g.ts, side: 'A', muTeam: mu.a, teamAvg: (A && A.ppg) || lgAvg, margin: -mu.margin, lgTotal, muTotal: mu.total, b2b: P.b2bA, outs: news.outs.a, doubt: news.doubt.a, ques: news.ques.a, oppName: names[g.h] || g.hn, oppDefRel: H ? H.def : null });
    return { h: h.players, a: a.players };
  })() : null;
  if (players) {
    const bestProp = new Map();
    for (const o of odds) {
      if (o.group !== 'pp' || !(o.odds >= 1.45 && o.odds <= 3.2)) continue;
      const nk = normName(o.side);
      const pl = [...players.h, ...players.a].find(x => x.en && normName(x.en) === nk);
      if (!pl || pl.ques || pl.min < 18 || !pl.last || pl.last.length < 6) continue;
      const X = o.line, pm = pl.pts, pModel = 1 - Phi((X - 0.5 - pm.p) / pm.sd);
      const hit = xs => xs.filter(v => v >= X).length / xs.length;
      const h15 = r2(hit(pl.last)), h5 = r2(hit(pl.last.slice(0, 5))), pMarket = Math.min(0.97, (1 / o.odds) / 1.06);
      const mk = { group: 'prop', side: String(pl.id), line: X, odds: o.odds, pMarket: r2(pMarket), pid: pl.id, stat: 'pts', min: pl.min, label: `${pl.name} — ${X}+ נקודות` };
      mk.pModel = r2(pModel); mk.push = 0;
      mk.pFinal = r2(0.4 * pModel + 0.2 * h15 + 0.4 * pMarket);
      mk.ev = r2(mk.pFinal * (o.odds - 1) - (1 - mk.pFinal));
      mk.hist = { hv: [h15, pl.last.length], av: [h5, 5], v: h15, l6: h5 };
      mk.score = Math.min(8, scoreBB(mk, clamp(pl.last.length / 15, 0.3, 1) * (news.checked ? 1 : 0.95), mk.hist));   // הימורי שחקנים: תקרה 8, כי הדקות והסיבוב לא ודאיים
      const ck = [];
      ck.push({ k: h15 >= 0.65 ? 'ok' : h15 <= 0.4 ? 'bad' : 'ok', t: `עבר את הקו ב-${Math.round(h15 * pl.last.length)} מתוך ${pl.last.length} משחקים אחרונים` });
      ck.push({ k: pm.p >= X + 1 ? 'ok' : pm.p < X ? 'bad' : 'ok', t: `צפי ${pm.p} נקודות, ממוצע עונתי ${pm.season}` });
      if (pm.l5 != null && pm.l5 < X - 1) ck.push({ k: 'bad', t: `ב-5 האחרונים ${pm.l5} נקודות בממוצע` });
      if (P.b2bH || P.b2bA) ck.push({ k: 'bad', t: 'משחק יום שני ברצף: סיכון לפחות דקות' });
      if (Math.abs(mu.margin) >= 9) ck.push({ k: 'bad', t: 'פער צפוי גדול: סיכון לפחות דקות בסיום' });
      mk.checks = ck.slice(0, 6);
      bestProp.set(pl.id + '|' + X, mk);   // כל קו של השחקן נשמר: המנתח יכול להעלות קו גבוה יותר (ביחס גבוה) אם הניתוח תומך בו
    }
    { const perP = new Map(); [...bestProp.values()].filter(m => m.score >= 3).sort((x, y) => y.score - x.score || y.ev - x.ev).filter(m => { const n = perP.get(m.pid) || 0; perP.set(m.pid, n + 1); return n < 3; }).slice(0, 18).forEach(m => markets.push(m)); }
  }
  markets.sort((x, y) => y.score - x.score || y.ev - x.ev);
  const picks = choosePicks(markets);
  const ml = odds.filter(o => o.group === 'ml'), mlH = ml.find(o => o.side === 'home'), mlA = ml.find(o => o.side === 'away');
  return {
    id: g.id, comp, ts: g.ts, home: H || { id: g.h, name: names[g.h] || g.hn }, away: A || { id: g.a, name: names[g.a] || g.an }, enough, conf: r2(conf),
    exp: { h: r1(mu.h), a: r1(mu.a), margin: r1(mu.margin), total: r1(mu.total), lg: r1(model.lg.h + model.lg.a), model: modelOnly, market: (mS || mT) ? market : null },
    odds: { ml: mlH && mlA ? { h: mlH.odds, a: mlA.odds } : null, spread: mS, total: mT },
    rest: { h: r1(P.rH), a: r1(P.rA), b2bH: P.b2bH, b2bA: P.b2bA },
    news: news.items.length || news.sources.length ? { items: news.items.slice(0, 10), source: news.sources.join(' + ') || null } : null,
    lineup: news.lineup && (news.lineup.h.length || news.lineup.a.length) ? news.lineup : null,
    players,    meta: meta.team ? { h: meta.team.h, a: meta.team.a } : null, h2h: meta.h2h || [], streak: { h: streakOf(lh), a: streakOf(la) },
    story: storyBB(g, H, A, mu, P, news, model, markets, picks, { meta, h2h: meta.h2h || [], streak: { h: streakOf(lh), a: streakOf(la) } }), markets, picks,
  };
}
const MIN_SCORE = 6;   // מתחת לציון 6 לא ממליצים ולא מציגים
function choosePicks(markets) {
  const picks = [], used = new Set();
  for (const [i, m] of markets.entries()) {
    if (m.score < MIN_SCORE) break;
    const fam = m.group === 'ml' || m.group === 'spread' ? 'side' : m.group;
    if (used.has(fam)) continue;
    used.add(fam); picks.push(i); if (picks.length === 3) break;
  }
  return picks;
}
// אחרי התאמות המנתח: משאירים רק הימורים בציון 6 ומעלה. מה שמתחת נשמר בנפרד לתיק המנתח בלבד
function finalizeBB(f) {
  f.markets.sort((x, y) => y.score - x.score || y.ev - x.ev);
  f.near = f.markets.filter(m => m.score < MIN_SCORE && m.score >= 3).slice(0, 24);
  f.markets = f.markets.filter(m => m.score >= MIN_SCORE);
  f.picks = choosePicks(f.markets);
  return f;
}
function checksBB(m, P, news) {
  const h = m.hist || {}, out = [], ok = t => out.push({ k: 'ok', t }), bad = t => out.push({ k: 'bad', t });
  const nH = h.hv && h.av ? Math.min(h.hv[1], h.av[1]) : 0;
  if (nH >= 4 && h.v != null) { if (h.v >= 0.62) ok('ההיסטוריה העונה של שתי הקבוצות תומכת'); else if (h.v <= 0.4) bad('ההיסטוריה העונה מתנגדת'); }
  if (h.l6 != null) { if (h.l6 >= 0.65) ok('גם ב-6 המשחקים האחרונים'); else if (h.l6 <= 0.35) bad('ב-6 האחרונים זה פחות קרה'); }
  if (m.pMarket != null) { const e = m.pModel - m.pMarket; if (e >= 0.06) ok('לפי הניתוח היחס גבוה ממה שההימור שווה'); else if (e <= -0.06) bad('היחס כבר מתמחר את זה'); }
  if (P.b2bH || P.b2bA) bad(`${P.b2bH && P.b2bA ? 'שתי הקבוצות' : P.b2bH ? 'המארחת' : 'האורחת'} משחקת יום שני ברצף`);
  { const n = news.nH + news.nA; if (n > 0) bad(n < 1 ? 'שחקן משמעותי בספק' : Math.round(n) + (Math.round(n) === 1 ? ' חיסור משמעותי' : ' חיסורים משמעותיים') + ' או בספק'); }
  if (nH > 0 && nH < 5) bad('מעט משחקים בהיסטוריה');
  return out.slice(0, 6);
}
const streakOf = L => { if (!L || !L.length) return 0; const w = L[0].pf > L[0].pa; let n = 0; for (const e of L) { if ((e.pf > e.pa) === w) n++; else break; } return w ? n : -n; };
function storyBB(g, H, A, mu, P, news, model, markets, picks, ex = {}) {
  const Hn = iso((H && H.name) || g.hn), An = iso((A && A.name) || g.an), out = [];
  if (!H || !A) return out;
  const m = mu.margin, fav = m >= 0 ? Hn : An, dog = m >= 0 ? An : Hn, am = Math.abs(m);
  if (am >= 9) out.push(`${fav} הפייבוריטית הברורה, ואנחנו מצפים לניצחון בפער של כ-${Math.round(am)} נקודות.`);
  else if (am >= 4) out.push(`${fav} עדיפה, אבל ${dog} יכולה להישאר קרובה: הפער הצפוי הוא כ-${Math.round(am)} נקודות.`);
  else out.push(`משחק צמוד: ההפרש הצפוי הוא פחות מ-${Math.max(4, Math.round(am) + 1)} נקודות, ויוכרע בדקות האחרונות.`);
  out.push(`${Hn}: ${H.archHe} (${H.w}-${H.l}, ${H.ppg} נקודות קלועות ו-${H.opp} סופגות למשחק). ${An}: ${A.archHe} (${A.w}-${A.l}, ${A.ppg} קלועות ו-${A.opp} סופגות).`);
  const lgT = model.lg.h + model.lg.a;
  if (mu.total >= lgT * 1.04) out.push(`צפוי משחק מהיר עם הרבה נקודות: כ-${Math.round(mu.total)} בסך הכל, מעל הממוצע (${Math.round(lgT)}).`); else if (mu.total <= lgT * 0.96) out.push(`צפוי משחק איטי ונמוך: כ-${Math.round(mu.total)} נקודות בסך הכל, מתחת לממוצע (${Math.round(lgT)}).`); else out.push(`בנקודות צפוי קצב רגיל: כ-${Math.round(mu.total)} בסך הכל.`);
  // המאמנים והכוכבים
  const T = ex.meta && ex.meta.team;
  if (T) {
    const cl = [[Hn, T.h && T.h.coach], [An, T.a && T.a.coach]].filter(x => x[1]).map(([n, c]) => n + ' בהדרכת ' + c.name + (c.isNew ? ' (מאמן חדש, ' + c.games + ' משחקים)' : ''));
    if (cl.length) out.push(cl.join(', ') + '.');
    for (const [n, t] of [[Hn, T.h], [An, T.a]]) if (t && t.core && t.core.length >= 3) out.push('הכוכבים של ' + n + ': ' + t.core.slice(0, 3).map(p => iso(p.name) + ' (' + p.pts + ' נק׳, ' + p.reb + ' ריב׳, ' + p.ast + ' אס׳)').join(', ') + '.');
  }
  const sk = ex.streak || {}, skT = (n, k) => k >= 3 ? n + ': ' + k + ' ניצחונות ברצף' : k <= -3 ? n + ': ' + (-k) + ' הפסדים ברצף' : null;
  const skL = [skT(Hn, sk.h), skT(An, sk.a)].filter(Boolean); if (skL.length) out.push('כושר: ' + skL.join(' · ') + '.');
  out.push('ההתקפה של ' + Hn + ' (' + H.ppg + ' נקודות) פוגשת הגנה שסופגת ' + A.opp + ', וההתקפה של ' + An + ' (' + A.ppg + ') פוגשת הגנה שסופגת ' + H.opp + '.');
  const hh = (ex.h2h || []).slice(0, 2);
  if (hh.length) out.push('המפגש האחרון ביניהן: ' + hh.map(x => (x.homeId === g.h ? Hn : An) + ' ' + x.hs + ':' + x.as + ' ' + (x.homeId === g.h ? An : Hn)).join(' · ') + '.');
  if (P.b2bH !== P.b2bA && (P.b2bH || P.b2bA)) out.push(`${P.b2bH ? Hn : An} משחקת יום שני ברצף, יתרון קטן ל${P.b2bH ? An : Hn}.`);
  else if (P.b2bH && P.b2bA) out.push('שתי הקבוצות משחקות יום שני ברצף, ולכן שוק הנקודות עלול להיות נמוך יותר.');
  if (news.items.length) { const hi = news.items.filter(i => i.impact === 'high').slice(0, 3).map(i => i.text.split(' (')[0]); if (hi.length) out.push(`חיסורים חשובים: ${hi.join(', ')}.`); }
  const lines = [...H.lines.slice(0, 2).map(l => `${Hn}: ${l}`), ...A.lines.slice(0, 2).map(l => `${An}: ${l}`)]; out.push(...lines.slice(0, 3));
  if (picks.length) { const mk = markets[picks[0]]; out.push(`הזווית שהכי מתאימה: ${mk.label} (Bet365 ${mk.odds}).`); }
  return out.slice(0, 12);
}

// ---------- אופי הליגה ----------
function bbLeagueProfile(model, prev, he) {
  const lg = model.lg; if (lg.n < 20) return null;
  const cur = Object.values(model.teams).length ? null : null;
  const seen = new Set(), games = [];
  for (const L of Object.values(model.teams)) for (const e of L) if (e.v === 'H' && !seen.has(e.id)) { seen.add(e.id); games.push(e); }
  const tot = mean(games.map(e => e.pf + e.pa)), hp = mean(games.map(e => e.pf)), ap = mean(games.map(e => e.pa));
  const homeW = games.filter(e => e.pf > e.pa).length / games.length;
  let b2bN = 0, b2bW = 0, restN = 0, restW = 0;
  for (const L of Object.values(model.teams)) L.forEach((e, i) => { if (!L[i + 1]) return; const b = (e.ts - L[i + 1].ts) / 86400 < 1.4; if (b) { b2bN++; if (e.pf > e.pa) b2bW++; } else { restN++; if (e.pf > e.pa) restW++; } });
  const lines = [], pv = prev && prev.length >= 40 ? { tot: mean(prev.map(g => g.g[0] + g.g[1])), homeW: prev.filter(g => g.g[0] > g.g[1]).length / prev.length } : null;
  lines.push(`קצב המשחק: ${r1(tot)} נקודות בסך הכל למשחק (${r1(hp)} לבית ו-${r1(ap)} לחוץ)${pv ? ', העונה שעברה ' + r1(pv.tot) : ''}.`);
  lines.push(`יתרון בית: ${r1(hp - ap)} נקודות למשחק, ו-${Math.round(homeW * 10)} ניצחונות בית מכל 10 משחקים.`);
  if (b2bN >= 40) { const a = b2bW / b2bN, b = restW / restN; lines.push(`קבוצה שמשחקת יום שני ברצף מנצחת ${Math.round(a * 10)} מכל 10 משחקים (בשאר המשחקים ${Math.round(b * 10)} מכל 10), על פני ${b2bN} משחקים.`); }
  if (pv && Math.abs(tot - pv.tot) >= 4) lines.push(`${tot > pv.tot ? 'יותר' : 'פחות'} נקודות מהעונה שעברה: ${r1(tot)} מול ${r1(pv.tot)} למשחק.`);
  return { n: games.length, total: r1(tot), homeW: Math.round(homeW * 100), adv: r1(hp - ap), lines, he };
}
export const bbKey = m => [m.group, m.side, m.line ?? ''].join('|');
function applyBBExpert(f, ex) {
  if (!ex || !f) return f;
  const take = (ex.take || []).map(String).filter(Boolean).slice(0, 6);
  if (take.length) f.expert = { head: ex.head ? String(ex.head) : null, take };
  const byKey = new Map(f.markets.map((m, i) => [bbKey(m), i]));
  for (const [k, a] of Object.entries(ex.adj || {})) {
    const i = byKey.get(k), m = i != null ? f.markets[i] : null; if (!m || !a || typeof a.d !== 'number') continue;
    const d = clamp(a.d, -6, 4); m.score = clamp(Math.round(m.score + d), 1, 10); m.expert = String(a.why || '').slice(0, 220); m.analystD = d;   // המנתח יכול להעלות עד 4 כשהניתוח (מצב הקבוצות, בית/חוץ, חיסורים, סגנון) תומך בהימור שהמספרים מעריכים בחסר
    if (m.expert) m.checks = [{ k: d > 0 ? 'ok' : 'bad', t: 'הערכת המנתח: ' + m.expert }, ...(m.checks || [])].slice(0, 7);
  }
  f.picks = f.picks.slice().sort((x, y) => f.markets[y].score - f.markets[x].score);
  return f;
}
function writeBBDossier(file, date, fixtures) {
  const plain = x => String(x || '').replace(/[\u2066-\u2069]/g, '');
  const out = [`# תיקי משחק כדורסל ל-${date}`, '', 'הוראות למנתח: לכל משחק קראו את התיק וכתבו ב-data/expert/bball-' + date + '.json דעה ספציפית. מבנה: { "<מזהה משחק>": { "head": "כותרת קצרה", "take": ["3-5 פסקאות קצרות בעברית פשוטה"], "adj": { "<מפתח הימור>": { "d": -6..+2, "why": "משפט אחד" } } } }', ''];
  const now = Date.now();
  for (const f of fixtures.filter(x => x.enough && x.ts * 1000 > now - 5 * 60e3)) {
    const H = f.home, A = f.away, e = f.exp, o = f.odds || {};
    out.push(`## [${f.id}] ${f.comp === 103 ? 'NBA' : 'יורוליג'} · ${plain(H.name)} (#${H.rank}, ${H.w}-${H.l}) נגד ${plain(A.name)} (#${A.rank}, ${A.w}-${A.l}) · ${new Date(f.ts * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    out.push(`Bet365: ניצחון בית ${o.ml ? o.ml.h : '?'} / חוץ ${o.ml ? o.ml.a : '?'} · הנדיקאפ ראשי (בית) ${o.spread ? o.spread.line : '?'} · סך נקודות ראשי ${o.total ? o.total.line : '?'}`);
    out.push(`צפי: משולב ${e.h}-${e.a} (סה״כ ${e.total}) · מודל בלבד: הפרש ${e.model.margin}, סה״כ ${e.model.total}${e.market ? ' · שוק: הפרש ' + e.market.margin + ', סה״כ ' + e.market.total : ''} · ממוצע ליגה ${e.lg}`);
    out.push(`מנוחה (ימים מהמשחק הקודם): בית ${f.rest.h}${f.rest.b2bH ? ' (יום שני ברצף)' : ''}, חוץ ${f.rest.a}${f.rest.b2bA ? ' (יום שני ברצף)' : ''}`);
    for (const [T, side] of [[H, 'בית'], [A, 'חוץ']]) {
      const rec = b => b && b.n ? `${b.w}-${b.n - b.w} (${b.ppg}:${b.opp})` : '-';
      out.push(`${plain(T.name)} (${side}): ${T.ppg} קלועות, ${T.opp} סופגות, הפרש ${T.net}, קצב ${T.pace}, סגנון ${T.archHe}. בבית ${rec(T.home)} · בחוץ ${rec(T.away)} · מול גדולות ${rec(T.top)} · בינוניות ${rec(T.mid)} · קטנות ${rec(T.bot)}`);
      out.push('  10 אחרונים: ' + (T.last || []).slice(0, 8).map(l => `${l.v === 'H' ? 'בית' : 'חוץ'} מול ${plain(l.opp)} ${l.pf}-${l.pa}`).join(' | '));
      if (T.lines && T.lines.length) out.push('  קריאה אוטומטית: ' + T.lines.map(plain).join(' · '));
    }
    if (f.meta) for (const [T, key] of [[H, 'h'], [A, 'a']]) { const m = f.meta[key]; if (m && (m.coach || (m.core && m.core.length))) out.push('הקבוצה ' + plain(T.name) + ': ' + (m.coach ? 'מאמן ' + plain(m.coach.name) + (m.coach.isNew ? ' (חדש, ' + m.coach.games + ' משחקים)' : '') + ' · ' : '') + (m.core || []).slice(0, 5).map(p => plain(p.name) + ' ' + p.pts + '/' + p.reb + '/' + p.ast + ' (' + p.min + ' דק׳)').join(' ; ')); }
    if (f.streak) out.push('רצף נוכחי (חיובי=ניצחונות): בית ' + f.streak.h + ' · חוץ ' + f.streak.a);
    if (f.h2h && f.h2h.length) out.push('ראש בראש (אחרונים): ' + f.h2h.map(x => new Date(x.ts * 1000).toISOString().slice(5, 10) + ' ' + (x.homeId === H.id ? plain(H.name) : plain(A.name)) + ' ' + x.hs + ':' + x.as).join(' | '));
    const items = (f.news && f.news.items) || [];
    out.push('חיסורים: ' + (items.length ? items.map(i => `${i.side === 'h' ? plain(H.name) : plain(A.name)}: ${plain(i.text)} [${i.impact}]`).join(' · ') : 'אין מידע'));
    for (const [T, key] of [[H, 'h'], [A, 'a']]) { const ps = (f.players && f.players[key]) || []; if (ps.length) out.push('שחקני ' + plain(T.name) + ' (צפי נקודות | ממוצע עונה | 5 אחרונים | הקשר): ' + ps.slice(0, 5).map(q => plain(q.name) + ' ' + q.pts.p + ' | ' + q.pts.season + ' | ' + q.pts.l5 + (q.why && q.why.length ? ' | ' + plain(q.why[0]) : '') + (q.ques ? ' [בספק]' : '')).join(' ;; ')); }
    out.push('הימורים מובילים (מפתח | יחס | דירוג | בית | חוץ):');
    for (const m of [...f.markets, ...(f.near || [])].slice(0, 14)) { const h = m.hist || {}, fr = x => x ? `${Math.round(x[0] * x[1])}/${x[1]}` : '-'; out.push(`  [${bbKey(m)}] ${plain(m.label)} | ${m.odds} | ${m.score}${m.expert ? ' (אחרי התאמת מנתח)' : ''} | ${fr(h.hv)} | ${fr(h.av)}`); }
    out.push('');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, out.join('\n'));
}

// ---------- הרצה יומית ----------
const INJ_HE = [[/calf/i, 'שוק'], [/knee/i, 'ברך'], [/ankle/i, 'קרסול'], [/back/i, 'גב'], [/hip/i, 'ירך'], [/hamstring/i, 'שריר ירך אחורי'], [/groin/i, 'מפשעה'], [/foot/i, 'כף רגל'], [/toe/i, 'בוהן'], [/shoulder/i, 'כתף'], [/wrist|hand|finger|thumb/i, 'יד'], [/illness|flu/i, 'מחלה'], [/concussion|head/i, 'ראש'], [/thigh|quad/i, 'ירך'], [/achilles/i, 'גיד אכילס'], [/rest|management/i, 'מנוחה'], [/undisclosed/i, 'לא ידוע'], [/personal/i, 'סיבה אישית'], [/lower leg/i, 'חלק תחתון של הרגל'], [/lower body/i, 'פציעה בגוף התחתון'], [/elbow/i, 'מרפק'], [/heel/i, 'עקב'], [/neck/i, 'צוואר'], [/eye/i, 'עין'], [/face|nose/i, 'פנים'], [/rib/i, 'צלעות'], [/leg/i, 'רגל']];
const injHe = t => { for (const [re, he] of INJ_HE) if (re.test(t || '')) return he; return t || null; };
const ST_HE = { out: 'לא ישחק', doubtful: 'בספק גדול', questionable: 'בספק', probable: 'צפוי לשחק' };
const ST_RANK = { out: 4, doubtful: 3, questionable: 2, probable: 1 };
async function avail365(id) {
  const j = await http(BASE365 + '/game/?' + Q + '&gameId=' + id), g = j && j.game; if (!g) return null;
  const nm = new Map((g.members || []).map(m => [m.id, m.name]));
  const side = C => ((C.lineups && C.lineups.members) || []).filter(m => ['Missing', 'Doubtful', 'Management'].includes(m.statusText)).map(m => ({ name: nm.get(m.id) || '?', status: m.statusText === 'Doubtful' ? 'doubtful' : 'out', reason: m.injury ? m.injury.reason : m.statusText === 'Management' ? 'rest' : null, src: '365Scores' }));
  return { h: side(g.homeCompetitor), a: side(g.awayCompetitor) };
}
const nickOf = n => String(n || '').toLowerCase();
function rwGame(rw, g) {
  const lg = g.comp === 103 ? 'nba' : 'euro', list = (rw && rw[lg] && rw[lg].games) || [];
  let best = null;
  for (const x of list) {
    const sc = lg === 'nba' ? (nickOf(g.an).includes(nickOf(x.visT.nick)) && nickOf(g.hn).includes(nickOf(x.homeT.nick)) ? 2 : 0) : dice(g.an, x.visT.nick) + dice(g.hn, x.homeT.nick);
    if (sc >= (lg === 'nba' ? 2 : 1.1) && (!best || sc > best.sc)) best = { x, sc };
  }
  return best ? best.x : null;
}
async function bbAvail(g, rw, byName, logs) {
  const out = { items: [], nH: 0, nA: 0, checked: false, outs: { h: new Set(), a: new Set() }, doubt: { h: new Set(), a: new Set() }, ques: { h: new Set(), a: new Set() }, sources: [], lineup: { h: [], a: [] } };
  const per = { h: new Map(), a: new Map() }, listed = { h: new Set(), a: new Set() };
  const put = (sd, p) => { const k = normName(p.name), cur = per[sd].get(k); if (!cur || (ST_RANK[p.status] || 0) > (ST_RANK[cur.status] || 0)) per[sd].set(k, p); };
  const lg = g.comp === 103 ? 'nba' : 'euro', rg = rwGame(rw, g);
  const nm = x => { const L = byName.get(normName(x)); return L ? (L.he || L.name) : x; };
  if (rg) { // RotoWire הוא המקור העדכני: סטטוס לכל שחקן בהרכב הצפוי וברשימת "עלולים לא לשחק"
    out.sources.push('RotoWire'); out.checked = true;
    for (const [sd, key] of [['h', 'home'], ['a', 'vis']]) {
      const T = rg[key]; if (!T) continue;
      out.lineup[sd] = T.starters.map(p => nm(p.name));
      for (const p of [...T.starters, ...T.may]) { listed[sd].add(normName(p.name)); if (p.status && p.status !== 'probable') put(sd, { name: p.name, status: p.status, reason: null, src: 'RotoWire' }); }
    }
  }
  try { // 365Scores: רק "חסר" מוחלט (פציעה), ורק לשחקן ש-RotoWire לא מזכיר בכלל. סטטוסי "ספק" ו"מנוחה" של 365 לא אמינים
    const A = await avail365(g.id);
    if (A) { out.checked = true; out.sources.push('365Scores'); for (const sd of ['h', 'a']) for (const p of A[sd]) { const k = normName(p.name); if (rg ? (p.status === 'out' && !/^rest$/i.test(p.reason || '') && !listed[sd].has(k)) : true) put(sd, p); } }
  } catch { /* */ }
  const news = (rw && rw[lg] && rw[lg].news) || [];
  for (const n of news) { // חדשות פציעה ציבוריות של RotoWire (לשחקן שלא מופיע בהרכבים)
    const sd = dice(n.team, g.hn) >= 0.7 || nickOf(g.hn).includes(nickOf(n.team)) ? 'h' : dice(n.team, g.an) >= 0.7 || nickOf(g.an).includes(nickOf(n.team)) ? 'a' : null;
    const k = normName(n.name);
    if (sd && ['out', 'doubtful'].includes(n.status) && !per[sd].has(k) && !(rg && listed[sd].has(k))) put(sd, { name: n.name, status: n.status, reason: n.injury, src: 'RotoWire' });
  }
  const wN = { out: 1, doubtful: 0.75, questionable: 0.5 };
  for (const sd of ['h', 'a']) for (const [k, p] of per[sd]) {
    const L = byName.get(k), ppg = L ? L.games.slice(0, 10).reduce((x, y) => x + y.pts, 0) / Math.max(1, Math.min(10, L.games.length)) : null, minu = L ? L.games.slice(0, 10).reduce((x, y) => x + y.min, 0) / Math.max(1, Math.min(10, L.games.length)) : null;
    const impact = ppg == null ? 'low' : ppg >= 15 || minu >= 30 ? 'high' : ppg >= 9 || minu >= 22 ? 'medium' : 'low';
    if (impact === 'low') continue;
    if (p.status === 'out') out.outs[sd].add(k); else if (p.status === 'doubtful') out.doubt[sd].add(k); else if (p.status === 'questionable') out.ques[sd].add(k); else continue;
    if (impact === 'high') out[sd === 'h' ? 'nH' : 'nA'] += wN[p.status] || 0;
    out.items.push({ side: sd, type: 'injury', impact, status: p.status, src: p.src, text: (L ? (L.he || L.name) : p.name) + ' (' + r1(ppg) + ' נקודות ב-' + r1(minu) + ' דקות למשחק) ' + (ST_HE[p.status] || p.status) + (p.reason && !/^rest$/i.test(p.reason) ? ' · ' + injHe(p.reason) : '') });
  }
  out.items.sort((x, y) => (x.impact === 'high' ? 0 : 1) - (y.impact === 'high' ? 0 : 1) || (ST_RANK[y.status] || 0) - (ST_RANK[x.status] || 0));
  return out;
}

export async function runBasketball({ root, today, log = () => {}, reuse = false }) {
  const DIR = path.join(root, 'data', 'bball'), CACHE = path.join(root, 'data', 'cache', 'bball.json'), LEARN = path.join(root, 'data', 'knowledge', 'bball-learn.json');
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
  const cache = readJson(CACHE, { games: {}, comps: {} });
  const seasonNow = seasonOfTs(Date.now() / 1000);
  await syncHistory(cache, Date.UTC(seasonNow - 2, 6, 1) / 1000, log, today); writeJson(CACHE, cache);
  const day = (await Promise.all([dayGamesBB(today), dayGamesBB(addDays(today, 1))])).flat().filter((g, i, a) => a.findIndex(x => x.id === g.id) === i && gameDayOf(g.ts) === today).sort((a, b) => a.ts - b.ts);
  const prevDoc = readJson(path.join(DIR, `${today}.json`), null);
  const all = Object.values(cache.games).filter(g => !(g.comp === 103 && g.stage === 1));   // בלי משחקי טרום עונה של NBA (לא נחשבים במאזן). ביורוליג שלב 1 הוא העונה הסדירה
  const learn = readJson(LEARN, { seen: {}, teams: {} });
  const names = {}; for (const g of all) { names[g.h] = g.hn; names[g.a] = g.an; } for (const g of day) { names[g.h] = g.hn; names[g.a] = g.an; }
  const HEB = loadNames(root);
  try { await ensureTeams(HEB, Object.keys(names)); for (const id of Object.keys(names)) if (HEB.teams[id]) names[id] = HEB.teams[id]; saveNames(root, HEB); } catch (e) { log('שמות קבוצות בעברית נכשלו: ' + e.message); }
  const models = {}, ranks = {};
  for (const comp of COMP_IDS) {
    const cur = all.filter(g => g.comp === comp && seasonOfTs(g.ts) === seasonNow);
    const prior = [1, 2].flatMap(k => all.filter(g => g.comp === comp && seasonOfTs(g.ts) === seasonNow - k).map(g => ({ ...g, pw: TB.PRIOR_W * (k === 1 ? 1 : 0.5) })));
    models[comp] = buildBB(cur, prior);
    // דירוג העונה הנוכחית לפי אחוז ניצחונות והפרש
    const st = {}; for (const g of cur) for (const [id, pf, pa] of [[g.h, g.g[0], g.g[1]], [g.a, g.g[1], g.g[0]]]) { const t = st[id] ||= { w: 0, n: 0, d: 0 }; t.n++; t.d += pf - pa; if (pf > pa) t.w++; }
    const rows = Object.entries(st).sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n || y[1].d - x[1].d);
    ranks[comp] = {}; rows.forEach(([id], i) => ranks[comp][id] = { rank: i + 1, n: rows.length });
  }
  const odds = await fetchBBOdds({ root, today, games: day, log });
  // נתוני שחקנים + RotoWire
  const PLF = path.join(root, 'data', 'cache', 'bball-players.json'), PL = readJson(PLF, { games: {}, names: {} });
  for (const g of Object.values(cache.games)) if (g.comp === 103 && g.stage === 1 && PL.games[g.id]) delete PL.games[g.id];   // יומני שחקנים בלי טרום עונה (NBA)
  try { await syncPlayers(PL, all.filter(g => g.ts > Date.now() / 1000 - 200 * 86400), 500, log); writeJson(PLF, PL); } catch (e) { log('נתוני שחקנים נכשלו: ' + e.message); }
  try { const cids = new Set(Object.keys(PL.names)); for (const g of Object.values(PL.games)) for (const c of g.c || []) if (c) cids.add(String(c[0])); await ensurePlayers(HEB, [...cids]); saveNames(root, HEB); } catch (e) { log('שמות שחקנים בעברית נכשלו: ' + e.message); }
  const logs = buildLogs(PL, HEB.players), byName = new Map([...logs.values()].map(L => [normName(L.name), L]));
  let rw = null; try { rw = await fetchRotowire({ root, today, log }); } catch (e) { log('RotoWire נכשל: ' + e.message); }
  const expertDoc = readJson(path.join(root, 'data', 'expert', `bball-${today}.json`), {});
  const fixtures = [];
  for (const g of day) {
    const prev = prevDoc && prevDoc.fixtures.find(f => f.id === g.id);
    const started = g.ts * 1000 < Date.now() - 5 * 60e3;
    if (prev && started) { fixtures.push(prev); continue; }
    const news = g.ts * 1000 > Date.now() ? await bbAvail(g, rw, byName, logs) : { items: [], nH: 0, nA: 0, checked: false, outs: { h: new Set(), a: new Set() }, doubt: { h: new Set(), a: new Set() }, ques: { h: new Set(), a: new Set() }, sources: [] };
    const bets = parseBBOdds(odds.get(String(g.id)));
    const h2h = all.filter(x => x.comp === g.comp && ((x.h === g.h && x.a === g.a) || (x.h === g.a && x.a === g.h))).sort((p, q) => q.ts - p.ts).slice(0, 4).map(x => ({ ts: x.ts, homeId: x.h, hs: x.g[0], as: x.g[1] }));
    const meta = { h2h, team: { h: { coach: coachOf(PL, g.h, HEB.players), core: coreOf(logs, g.h, g.ts, HEB.players).slice(0, 6) }, a: { coach: coachOf(PL, g.a, HEB.players), core: coreOf(logs, g.a, g.ts, HEB.players).slice(0, 6) } } };
    fixtures.push(finalizeBB(applyBBExpert(analyzeBB(g, models[g.comp], id => ranks[g.comp][id] || null, names, bets, news, learn, logs, meta), expertDoc[String(g.id)])));
  }
  // ההמלצות של היום (עד 5): אחת לכל משחק, דירוג 6 ומעלה (או 5 אם יש מעט)
  const locked = (prevDoc && prevDoc.dayPicks || []).filter(p => { const f = fixtures.find(x => x.id === p.fid); return f && f.ts * 1000 < Date.now() - 5 * 60e3 && f.markets[p.mi]; });
  const lockedIds = new Set(locked.map(p => p.fid)), cand = [];
  for (const f of fixtures) { if (lockedIds.has(f.id) || f.ts * 1000 < Date.now() - 5 * 60e3) continue; f.picks.forEach(mi => { const m = f.markets[mi]; if (m) cand.push({ fid: f.id, mi, score: m.score, ev: m.ev }); }); }
  const choose = min => { const out = [], seen = new Set(); for (const c of cand.filter(c => c.score >= min).sort((a, b) => b.score - a.score || b.ev - a.ev)) { if (out.length + locked.length >= 5) break; if (seen.has(c.fid)) continue; seen.add(c.fid); out.push({ fid: c.fid, mi: c.mi }); } return out; };
  let chosen = choose(6); if (chosen.length + locked.length < 2) chosen = choose(5);
  const dayPicks = [...locked.map(p => ({ fid: p.fid, mi: p.mi })), ...chosen].sort((a, b) => fixtures.find(x => x.id === b.fid).markets[b.mi].score - fixtures.find(x => x.id === a.fid).markets[a.mi].score);
  writeJson(path.join(DIR, `${today}.json`), { date: today, updated: new Date().toISOString(), fixtures, dayPicks });
  try { writeBBDossier(path.join(root, 'data', 'cache', `bball-dossier-${today}.md`), today, fixtures); } catch (e) { log('תיק כדורסל נכשל: ' + e.message); }
  // ---- בדיקת תוצאות + מעקב + למידה ----
  const idx = readJson(path.join(DIR, 'index.json'), { days: [], picksLog: [] });
  if (!idx.days.find(d => d.date === today)) idx.days.push({ date: today });
  idx.days.sort((a, b) => b.date.localeCompare(a.date));
  const log2 = [], pAcc = { n: 0, ae: 0, aeNaive: 0, bias: 0, aeReb: 0, aeRebN: 0, aeAst: 0, aeAstN: 0 };
  const byId = new Map(all.map(g => [String(g.id), g]));
  for (const d of idx.days) {
    const file = path.join(DIR, `${d.date}.json`), doc = readJson(file, null); if (!doc) continue;
    let changed = false;
    for (const f of doc.fixtures) {
      const rec = byId.get(String(f.id));
      if (!f.graded && rec && rec.g && rec.g[0] > 0) {
        const [hp, ap] = rec.g; f.result = { g: [hp, ap] };
        const box = PL.games[f.id];
        for (const m of f.markets) {
          if (m.group === 'prop') { if (!box) continue; const row = box.p.find(x => x[0] === m.pid); m.act = row ? row[3] : null; m.res = !row || !(row[2] > 0) ? 'push' : row[3] >= m.line ? 'win' : 'lose'; continue; }
          const r = gameOutcome(m, hp, ap); m.res = r === 1 ? 'win' : r === 0 ? 'lose' : 'push';
        }
        for (const m of f.markets) if (m.res) m.actT = bbAct(f, m);
        if (box && f.players) for (const sd of ['h', 'a']) for (const p of f.players[sd] || []) { const r = box.p.find(x => x[0] === p.id); p.act = r ? { min: r[2], pts: r[3], reb: r[4], ast: r[5] } : { min: 0 }; }
        f.graded = true; changed = true;
        // למידה: נקודות בפועל מול הצפי, לכל קבוצה
        if (!learn.seen[f.id]) {
          for (const [tid, actF, actA, expF, expA] of [[f.home.id, hp, ap, f.exp.h, f.exp.a], [f.away.id, ap, hp, f.exp.a, f.exp.h]]) {
            const T = learn.teams[String(tid)] ||= { f: { n: 0, r: 1 }, a: { n: 0, r: 1 } };
            for (const [k, act, exp] of [['f', actF, expF], ['a', actA, expA]]) { const x = T[k], ratio = clamp(act / Math.max(exp, 1), 0.8, 1.25), al = Math.max(0.12, 1 / (x.n + 1)); x.r = r2(x.n ? x.r * (1 - al) + ratio * al : ratio); x.n++; }
          }
          learn.seen[f.id] = 1;
        }
      }
    }
    for (const p of doc.dayPicks || []) { const f = doc.fixtures.find(x => x.id === p.fid), m = f && f.markets[p.mi]; if (!m) continue; log2.push({ d: d.date, id: f.id, comp: f.comp, h: f.home.name, a: f.away.name, ts: f.ts, label: m.label, group: m.group, score: m.score, price: m.odds, res: m.res || null, act: m.actT || bbAct(f, m) }); }
    for (const f of doc.fixtures) if (f.players) for (const sd of ['h', 'a']) for (const p of f.players[sd] || []) if (p.act && p.act.min >= 8) { pAcc.n++; pAcc.ae += Math.abs(p.pts.p - p.act.pts); pAcc.aeNaive += Math.abs(p.pts.season - p.act.pts); pAcc.bias += p.act.pts - p.pts.p; pAcc.aeReb += Math.abs(p.reb.p - p.act.reb); pAcc.aeRebN += Math.abs(p.reb.season - p.act.reb); pAcc.aeAst += Math.abs(p.ast.p - p.act.ast); pAcc.aeAstN += Math.abs(p.ast.season - p.act.ast); }
    d.games = doc.fixtures.length; d.graded = doc.fixtures.filter(f => f.graded).length; d.picks = (doc.dayPicks || []).length;
    if (changed) writeJson(file, doc);
  }
  idx.picksLog = log2; idx.updated = new Date().toISOString();
  const q = x => Math.round(x * 100) / 100;
  idx.playerAcc = pAcc.n >= 5 ? { n: pAcc.n, mae: q(pAcc.ae / pAcc.n), maeNaive: q(pAcc.aeNaive / pAcc.n), bias: q(pAcc.bias / pAcc.n), maeReb: q(pAcc.aeReb / pAcc.n), maeRebNaive: q(pAcc.aeRebN / pAcc.n), maeAst: q(pAcc.aeAst / pAcc.n), maeAstNaive: q(pAcc.aeAstN / pAcc.n) } : null;
  writeJson(path.join(DIR, 'index.json'), idx); writeJson(LEARN, learn);
  // ---- פרופילי קבוצות (לשונית קבוצות) ----
  const teams = { updated: idx.updated, comps: {} };
  for (const comp of COMP_IDS) {
    const arr = Object.keys(models[comp].teams).map(id => profileBB(models[comp], Number(id), id2 => ranks[comp][id2] || null, names)).filter(Boolean).map(t => { const lf = learn.teams[String(t.id)]; if (lf && lf.f.n >= 5 && Math.abs(lf.f.r - 1) >= 0.03) t.lines.push(`למדנו מהמעקב: ב-${lf.f.n} משחקים שנבדקו היא קלעה ${lf.f.r > 1 ? 'יותר' : 'פחות'} ממה שחזינו. החיזוי מתוקן.`); return t; }).sort((a, b) => (a.rank || 99) - (b.rank || 99));
    const prev = all.filter(g => g.comp === comp && seasonOfTs(g.ts) === seasonNow - 1);
    for (const t of arr) { t.coach = coachOf(PL, t.id, HEB.players); t.core = coreOf(logs, t.id, Date.now() / 1000, HEB.players); if (t.coach) t.lines.unshift(`בהדרכת ${t.coach.name}${t.coach.isNew ? ' (מאמן חדש, ' + t.coach.games + ' משחקים)' : ''}: ${t.coach.w} ניצחונות ו-${t.coach.l} הפסדים איתו במאגר.`); }
    teams.comps[comp] = { he: BB_COMPS[comp].he, profile: bbLeagueProfile(models[comp], prev, BB_COMPS[comp].he), teams: arr };
  }
  writeJson(path.join(DIR, 'teams.json'), teams);
  log(`כדורסל: ${fixtures.length} משחקים, ${dayPicks.length} המלצות, ${Object.keys(learn.seen).length} משחקים שנלמדו`);
  return { fixtures: fixtures.length };
}
