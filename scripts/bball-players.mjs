// שחקני כדורסל: יומן משחקים מ-365Scores (דקות, נקודות, ריבאונדים, אסיסטים, שלשות), זמינות (חיסורים), ותחזית לכל שחקן
// לפי סוג המשחק (קצב וסך נקודות צפוי), פער הנקודות (סיכון לדקות), מנוחה, וחיסורי חברים לקבוצה (שימוש גבוה יותר).
// אין קווי Bet365 לשחקנים באף מקור חינמי, ולכן מוצגים "קווי איזון": עד איזה קו אובר משתלם ומאיזה קו אנדר משתלם.
import { http, pool } from './source-365.mjs';
import { normName } from './rotowire.mjs';

const BASE = 'https://webws.365scores.com/web';
const Q = 'appTypeId=5&langId=1&timezoneName=Asia/Jerusalem&userCountryId=6';
const r1 = x => Math.round(x * 10) / 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const iso = s => '⁨' + s + '⁩';
const num = v => { const x = parseFloat(String(v == null ? '' : v).split('/')[0]); return Number.isFinite(x) ? x : 0; };
const mins = v => { const m = String(v || '').match(/^(\d+):(\d+)/); return m ? +m[1] + +m[2] / 60 : 0; };
const seasonOfTs = ts => { const d = new Date(ts * 1000); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };

// ---------- יומן משחקים ----------
async function fetchBox(id) {
  const j = await http(`${BASE}/game/?${Q}&gameId=${id}`);
  const g = j && j.game; if (!g || !g.homeCompetitor || !g.homeCompetitor.lineups) return null;
  const nm = new Map((g.members || []).map(m => [m.id, { a: m.athleteId, n: m.name }]));
  const rows = [], names = {}, coach = [];
  for (const C of [g.homeCompetitor, g.awayCompetitor]) {
    const cm = ((C.lineups && C.lineups.members) || []).find(m => m.position && /management/i.test(m.position.name || '')), cw = cm && nm.get(cm.id);
    coach.push(cw ? [cw.a, cw.n] : null);
    for (const m of (C.lineups && C.lineups.members) || []) {
      if (!m.hasStats || !m.stats) continue;
      const st = {}; for (const s of m.stats) st[s.type] = s.value;
      const min = mins(st[1]); if (min <= 0) continue;
      const who = nm.get(m.id); if (!who) continue;
      names[who.a] = who.n;
      rows.push([who.a, C.id, Math.round(min * 10) / 10, num(st[2]), num(st[17]), num(st[18]), num(st[9]), m.statusText === 'Starting' ? 1 : 0]);
    }
  }
  return rows.length >= 8 ? { rows, names, coach } : null;
}
export async function syncPlayers(pl, games, maxCalls, log = () => {}) {
  const recent = Date.now() / 1000 - 120 * 86400;
  const need = games.filter(g => !pl.games[g.id] || (pl.games[g.id].c === undefined && pl.games[g.id].p && pl.games[g.id].p.length && g.ts > recent)).sort((a, b) => b.ts - a.ts).slice(0, maxCalls);
  let n = 0;
  await pool(need, async g => {
    const b = await fetchBox(g.id);
    pl.games[g.id] = b ? { ts: g.ts, comp: g.comp, h: g.h, a: g.a, g: g.g, c: b.coach, p: b.rows } : { ts: g.ts, comp: g.comp, h: g.h, a: g.a, g: g.g, p: [] };
    if (b) Object.assign(pl.names, b.names);
    if (++n % 100 === 0) log(`כדורסל: שחקנים ${n}/${need.length}`);
  }, 4);
  if (need.length) log(`כדורסל: נטענו נתוני שחקנים ל-${need.length} משחקים`);
}
// יומן לכל שחקן: מהחדש לישן
export function buildLogs(pl, he = {}) {
  const logs = new Map();
  for (const [gid, g] of Object.entries(pl.games)) for (const r of g.p) {
    const [a, team, min, pts, reb, ast, tpm, st] = r;
    let L = logs.get(a); if (!L) logs.set(a, L = { id: a, name: pl.names[a] || String(a), he: he[a] || null, games: [] });
    L.games.push({ gid: +gid, ts: g.ts, team, v: team === g.h ? 'H' : 'A', opp: team === g.h ? g.a : g.h, min, pts, reb, ast, tpm, st });
  }
  for (const L of logs.values()) { L.games.sort((x, y) => y.ts - x.ts); L.team = L.games[0].team; }
  return logs;
}
const wmean = (xs, d) => { let s = 0, w = 0; xs.forEach((x, i) => { const wt = d ** i; s += wt * x; w += wt; }); return w ? s / w : 0; };
const sdOf = xs => { if (xs.length < 3) return null; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };

// ---------- תחזית לכל שחקני קבוצה במשחק ----------
export function projectTeam({ logs, teamId, ts, side, muTeam, teamAvg, margin, lgTotal, muTotal, b2b, outs, doubt, ques, oppName, oppDefRel }) {
  doubt = doubt || new Set();
  const roster = [...logs.values()].filter(L => L.team === teamId && ts - L.games[0].ts < 40 * 86400 && L.games.length >= 4);
  const season = seasonOfTs(ts);
  const info = roster.map(L => {
    const G = L.games.slice(0, 25), cur = L.games.filter(g => seasonOfTs(g.ts) === season);
    const minW = wmean(G.slice(0, 10).map(g => g.min), 0.85);
    const ppg = mean(G.slice(0, 10).map(g => g.pts));
    return { L, G, cur: cur.length >= 5 ? cur : G, minW, ppg, key: normName(L.name) };
  }).filter(x => x.minW >= 10).sort((a, b) => b.minW - a.minW);
  const isOut = x => outs.has(x.key), isQues = x => ques.has(x.key) || doubt.has(x.key);
  const wAbs = x => isOut(x) ? 1 : doubt.has(x.key) ? 0.75 : ques.has(x.key) ? 0.5 : 0;   // סיכוי להיעדר: לא ישחק 100%, ספק גדול 75%, ספק 50%
  const outPts = info.filter(x => x.ppg >= 8).reduce((s, x) => s + wAbs(x) * x.ppg, 0);
  const env = clamp(muTeam / teamAvg, 0.9, 1.1) ** 0.9, boostBase = clamp(0.5 * outPts / Math.max(teamAvg - outPts, 60), 0, 0.16);
  const absM = Math.abs(margin), out = [];
  for (const x of info.filter(x => !isOut(x)).slice(0, 10)) {
    const G = x.G, rate = k => { const m = wmean(G.slice(0, 20).map(g => g.min), 0.93); return m ? wmean(G.slice(0, 20).map(g => g[k]), 0.93) / m : 0; };
    const bx = clamp(0.5 * Math.max(0, outPts - wAbs(x) * x.ppg) / Math.max(teamAvg - outPts, 60), 0, 0.16);
    let minP = x.minW; const why = [], why2 = [];
    if (absM >= 9 && x.minW >= 26) { const f = 1 - clamp((absM - 8) * 0.012, 0, 0.09); minP *= f; why.push(`פער צפוי של ${Math.round(absM)} נקודות: קיים סיכון לפחות דקות בסיום`); }
    if (b2b) { minP *= 0.985; why.push('הקבוצה משחקת יום שני ברצף'); }
    const ptsFactor = env * (1 + bx), astFactor = env ** 0.7 * (1 + bx * 0.5), rebFactor = clamp(muTotal / lgTotal, 0.92, 1.08) ** 0.5 * (1 + bx * 0.25);
    if (env >= 1.03) why.push(`הקבוצה צפויה לקלוע ${r1(muTeam)} נקודות, מעל הממוצע שלה (${r1(teamAvg)}): משחק פתוח`); else if (env <= 0.97) why.push(`הקבוצה צפויה לקלוע ${r1(muTeam)} נקודות, מתחת לממוצע שלה (${r1(teamAvg)}): משחק סגור`);
    if (bx >= 0.03 && x.ppg >= 6) { const names = info.filter(y => y.key !== x.key && wAbs(y) > 0 && y.ppg >= 8).sort((u, v) => wAbs(v) * v.ppg - wAbs(u) * u.ppg).map(y => iso(y.L.he || y.L.name) + (isOut(y) ? '' : ' (בספק)')).slice(0, 3); why.push(`${names.join(', ')} חסרים או בספק (בסך ${r1(info.filter(y => y.key !== x.key && y.ppg >= 8 && wAbs(y) > 0).reduce((s, y) => s + y.ppg, 0))} נקודות למשחק): יותר שימוש לשחקנים שנשארו`); }
    if (oppDefRel && oppDefRel >= 1.03) why.push(`${iso(oppName)} סופגת יותר מהממוצע`); else if (oppDefRel && oppDefRel <= 0.97) why.push(`${iso(oppName)} מגינה טוב מהממוצע`);
    const stat = (k, f, floor) => {
      const seasonMean0 = mean(x.cur.map(g => g[k])), base = 0.5 * minP * rate(k) + 0.5 * seasonMean0 * (minP / x.minW); // שילוב שנבחר בבדיקה לאחור (bball-players-backtest.mjs)
      const proj = Math.max(floor, base * f), vals = G.slice(0, 15).map(g => g[k]), sd = clamp(sdOf(vals) || proj * 0.35, k === 'pts' ? 3.5 : 1.4, k === 'pts' ? 9.5 : 4);
      const season = mean(x.cur.map(g => g[k])), l5 = mean(G.slice(0, 5).map(g => g[k]));
      const hv = G.filter(g => g.v === side).slice(0, 8), splitV = hv.length >= 4 ? mean(hv.map(g => g[k])) : null;
      const over = Math.floor(proj - 0.2 * sd - 0.5) + 0.5, under = Math.ceil(proj + 0.2 * sd - 0.5) + 0.5;
      return { p: r1(proj), sd: r1(sd), season: r1(season), l5: r1(l5), split: splitV != null ? r1(splitV) : null, over: over >= 0.5 ? over : null, under };
    };
    const pts = stat('pts', ptsFactor, 0), reb = stat('reb', rebFactor, 0), ast = stat('ast', astFactor, 0);
    const form = pts.l5 - pts.season; if (Math.abs(form) >= Math.max(3, pts.season * 0.15)) why.push(form > 0 ? `בכושר גבוה: ${pts.l5} נקודות ב-5 האחרונים (העונה ${pts.season})` : `בירידה: ${pts.l5} נקודות ב-5 האחרונים (העונה ${pts.season})`);
    if (pts.split != null && Math.abs(pts.split - pts.season) >= 3) why.push(`${side === 'H' ? 'בבית' : 'בחוץ'} ${pts.split > pts.season ? 'יותר' : 'פחות'}: ${pts.split} נקודות למשחק (העונה ${pts.season})`);
    const z = (pts.p - pts.season) / pts.sd;
    out.push({ id: x.L.id, name: x.L.he || x.L.name, en: x.L.name, last: G.slice(0, 15).map(g => g.pts), min: r1(minP), pts, reb, ast, tpm: r1(minP * rate('tpm') * env), ques: isQues(x), z: Math.round(z * 100) / 100, why: why.sort((a, b) => (/חסר/.test(b) ? 1 : 0) - (/חסר/.test(a) ? 1 : 0)).slice(0, 4), n: x.G.length });
  }
  return { players: out.slice(0, 9), outs: info.filter(isOut).map(x => ({ name: x.L.name, ppg: r1(x.ppg), min: r1(x.minW) })) };
}

// ---------- מאמן ושחקני ליבה לקבוצה ----------
export function coachOf(pl, teamId, he = {}) {
  const G = Object.values(pl.games).filter(g => g.c && g.g && (g.h === teamId || g.a === teamId)).sort((a, b) => a.ts - b.ts);
  const segs = [];
  for (const g of G) {
    const i = g.h === teamId ? 0 : 1, c = g.c[i]; if (!c) continue;
    const win = g.g[i] > g.g[1 - i] ? 1 : 0, last = segs[segs.length - 1];
    if (last && last.id === c[0]) { last.n++; last.w += win; }
    else segs.push({ id: c[0], name: he[c[0]] || c[1], start: g.ts, n: 1, w: win });
  }
  const cur = segs[segs.length - 1]; if (!cur) return null;
  const prev = segs.length > 1 ? segs[segs.length - 2] : null;
  return { name: cur.name, since: cur.start, games: cur.n, w: cur.w, l: cur.n - cur.w, prev: prev ? { name: prev.name, games: prev.n, w: prev.w } : null, isNew: !!prev && cur.n <= 10 };
}
export function coreOf(logs, teamId, ts, he = {}) {
  const out = [];
  for (const L of logs.values()) {
    if (L.team !== teamId || ts - L.games[0].ts > 40 * 86400) continue;
    const G = L.games.slice(0, 15); if (G.length < 4) continue;
    out.push({ name: L.he || he[L.id] || L.name, min: r1(mean(G.map(g => g.min))), pts: r1(mean(G.map(g => g.pts))), reb: r1(mean(G.map(g => g.reb))), ast: r1(mean(G.map(g => g.ast))), n: G.length });
  }
  return out.sort((a, b) => b.min - a.min).slice(0, 8);
}
