// הרחבת בחירת כדורסל: רבעים, מחציות, סטטיסטיקות קבוצה (שלשות, ריבאונדים, אסיסטים) ושחקנים, מקווי fivebet (G.ext) מול המודל.
// מקורות המודל: data/cache/bball-players.json (משחקים עם שחקנים ורבעים) + תחזית שחקנים של המשחק (g.players) + הצפי הכללי של המשחק (g.exp).
import fs from 'node:fs';
import path from 'node:path';

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const sd = a => { if (a.length < 3) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
const fair = (a, b) => (1 / a) / (1 / a + 1 / b);
const r1 = x => Math.round(x * 10) / 10;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
const poissonCdf = (k, lam) => { let s = 0, t = Math.exp(-lam); for (let i = 0; i <= k; i++) { s += t; t *= lam / (i + 1); } return s; };   // P(X <= k)

export function loadBox(ROOT) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cache', 'bball-players.json'), 'utf8')); } catch (e) { return { games: {}, names: {} }; } }

// ---- נתוני קבוצות מהיומן: לכל קבוצה, 15 משחקים אחרונים (עד לפני התאריך) ----
function teamLogs(PL, beforeTs) {
  const T = new Map();
  const put = (t, o) => { let L = T.get(t); if (!L) T.set(t, L = []); L.push(o); };
  for (const g of Object.values(PL.games)) {
    if (!g.p || !g.p.length || g.ts >= beforeTs) continue;
    const sum = tid => { const r = g.p.filter(x => x[1] === tid); return { reb: r.reduce((s, x) => s + x[4], 0), ast: r.reduce((s, x) => s + x[5], 0), tpm: r.reduce((s, x) => s + x[6], 0) }; };
    const H = sum(g.h), A = sum(g.a);
    put(g.h, { ts: g.ts, v: 'H', for: H, ag: A, q: g.q ? g.q.map(x => [x[0], x[1]]) : null });
    put(g.a, { ts: g.ts, v: 'A', for: A, ag: H, q: g.q ? g.q.map(x => [x[1], x[0]]) : null });
  }
  for (const L of T.values()) L.sort((a, b) => b.ts - a.ts);
  return T;
}

// ---- התפלגות רבעים בליגה: ממוצע וסטיית תקן של סך נקודות והפרש לכל תקופה ----
function leagueQ(PL, comp) {
  const per = { q1: [0], q2: [1], q3: [2], q4: [3], h1: [0, 1], h2: [2, 3] }, out = {};
  for (const [k, idx] of Object.entries(per)) {
    const tot = [], mar = [];
    for (const g of Object.values(PL.games)) { if (g.comp !== comp || !g.q) continue; let t = 0, m = 0; for (const i of idx) { t += g.q[i][0] + g.q[i][1]; m += g.q[i][0] - g.q[i][1]; } tot.push(t); mar.push(m); }
    if (tot.length >= 30) out[k] = { n: tot.length, mean: mean(tot), sd: sd(tot), msd: sd(mar), idx };
  }
  return out;
}

export function extCands(ctx) {
  const { g, G, e, nba, hN, aN, PL, add, logs } = ctx;
  const ext = G.ext; if (!ext) return;
  const homeFirst = !nba;     // יורוליג: קבוצה 1 = מארחת. NBA: קבוצה 1 = אורחת
  const half = ln => Math.abs(ln * 2 - Math.round(ln * 2)) < 1e-9 && Math.round(ln * 2) % 2 === 1;
  const TL = logs.T, hid = g.home.id, aid = g.away.id, HL = (TL.get(hid) || []).slice(0, 15), AL = (TL.get(aid) || []).slice(0, 15);
  const LQ = logs.LQ[g.comp] || {};

  // ===== רבעים ומחציות =====
  const PN = { q1: 'הרבע הראשון', q2: 'הרבע השני', q3: 'הרבע השלישי', q4: 'הרבע הרביעי', h1: 'המחצית הראשונה', h2: 'המחצית השנייה' };
  const qHL = HL.filter(x => x.q), qAL = AL.filter(x => x.q);
  if (qHL.length >= 6 && qAL.length >= 6) {
    const m = (L, i, side) => mean(L.map(x => x.q[i][side]));
    const raw = []; for (let i = 0; i < 4; i++) raw.push({ tot: (m(qHL, i, 0) + m(qAL, i, 1)) / 2 + (m(qAL, i, 0) + m(qHL, i, 1)) / 2, mar: (m(qHL, i, 0) + m(qAL, i, 1)) / 2 - (m(qAL, i, 0) + m(qHL, i, 1)) / 2 });
    const rawTot = raw.reduce((s, x) => s + x.tot, 0), k = e.total / rawTot;
    for (const [pk, P] of Object.entries(LQ)) {
      if (pk !== 'q1' && pk !== 'h1') continue;   // לפי בקשת המשתמש: רק רבע ראשון או מחצית ראשונה (לא רבע שני, שלישי, רביעי או מחצית שנייה)
      const idx = P.idx, mu = idx.reduce((s, i) => s + raw[i].tot * k, 0), frac = idx.length / 4;
      const muM = 0.5 * idx.reduce((s, i) => s + raw[i].mar, 0) + 0.5 * e.margin * frac, sdT = (P.sd || 8) * 0.95, sdM = (P.msd || 6) * 0.95;
      const X = ext[pk]; if (!X) continue;
      const detail = `${PN[pk]}: בממוצע בליגה הוא מסתיים ב-${r1(P.mean)} נקודות בסך הכל. לפי הקצב של ${hN} ו-${aN} ברבעים האחרונים הצפי שלנו הוא ${r1(mu)}.`;
      for (const [ln, o, u] of X.tot || []) {
        if (!half(ln)) continue;
        const pOver = 1 - cdf((ln - mu) / sdT), ps = fair(o, u);
        if (ln <= mu - 2.5) add(`${pk}|total|over|${ln}`, `${PN[pk]}: מעל ${ln} נקודות`, o, pOver, ps, 'q-total-over', `${detail} הקו באתר הוא ${ln}, נמוך בערך ב-${r1(mu - ln)} נקודות מהצפי.`, false, 0, 'prop');
        if (ln >= mu + 2.5) add(`${pk}|total|under|${ln}`, `${PN[pk]}: מתחת ל-${ln} נקודות`, u, 1 - pOver, 1 - ps, 'q-total-under', `${detail} הקו באתר הוא ${ln}, גבוה בערך ב-${r1(ln - mu)} נקודות מהצפי.`, false, 0, 'prop');
      }
      for (const [ln, o1, o2] of X.hc || []) {
        const homeLine = nba ? -ln : ln, homeOdds = nba ? o2 : o1, awayOdds = nba ? o1 : o2; if (!half(homeLine)) continue;
        const pHome = 1 - cdf((-homeLine - muM) / sdM), ps = fair(homeOdds, awayOdds);
        if (pHome >= 0.58) add(`${pk}|spread|home|${homeLine}`, `${PN[pk]}: ${hN} ${homeLine > 0 ? '+' : ''}${homeLine} הנדיקאפ`, homeOdds, pHome, ps, 'q-spread-home', `${PN[pk]}: הצפי שלנו ל${hN} מול ${aN} הוא ${muM >= 0 ? 'יתרון' : 'פיגור'} של ${r1(Math.abs(muM))} נקודות, והקו באתר הוא ${homeLine > 0 ? '+' : ''}${homeLine} ל${hN}.`, false, 0, 'prop');
        else if (1 - pHome >= 0.58) add(`${pk}|spread|away|${-homeLine}`, `${PN[pk]}: ${aN} ${-homeLine > 0 ? '+' : ''}${-homeLine} הנדיקאפ`, awayOdds, 1 - pHome, 1 - ps, 'q-spread-away', `${PN[pk]}: הצפי שלנו הוא ${muM >= 0 ? `יתרון של ${r1(muM)} ל${hN}` : `יתרון של ${r1(-muM)} ל${aN}`}, והקו באתר נותן ל${aN} ${-homeLine > 0 ? '+' : ''}${-homeLine}.`, false, 0, 'prop');
      }
    }
  }

  // ===== סטטיסטיקות קבוצה: שלשות, ריבאונדים, אסיסטים =====
  const TS = { tp3: ['tpm', 'שלשות קלועות', 3.2], reb: ['reb', 'ריבאונדים', 5], ast: ['ast', 'אסיסטים', 4.5] };
  for (const [ek, [st, he, sdT]] of Object.entries(TS)) {
    const X = ext[ek]; if (!X || HL.length < 6 || AL.length < 6) continue;
    const hFor = mean(HL.map(x => x.for[st])), hAg = mean(HL.map(x => x.ag[st])), aFor = mean(AL.map(x => x.for[st])), aAg = mean(AL.map(x => x.ag[st]));
    const muH = (hFor + aAg) / 2, muA = (aFor + hAg) / 2, muT = muH + muA, sdTot = sdT * 1.35;
    const line = (scope, ln, o, u, mu, sdv, who) => {
      if (!half(ln)) return; const pOver = 1 - cdf((ln - mu) / sdv), ps = fair(o, u);
      const lg = `${who}: ${hN} ${r1(hFor)} ${he} למשחק בממוצע (${r1(hAg)} נגדה), ${aN} ${r1(aFor)} (${r1(aAg)} נגדה). הצפי שלנו ${scope === 'total' ? 'לשתיהן יחד' : 'לקבוצה'} הוא ${r1(mu)}, והקו באתר הוא ${ln}.`;
      if (ln <= mu - 1.5) add(`ts|${st}|${scope}|over|${ln}`, `${scope === 'total' ? 'סך ' : ''}${he}${scope === 'home' ? ' של ' + hN : scope === 'away' ? ' של ' + aN : ''}: מעל ${ln}`, o, pOver, ps, 'ts-over', lg, false, 0, 'prop');
      if (ln >= mu + 1.5) add(`ts|${st}|${scope}|under|${ln}`, `${scope === 'total' ? 'סך ' : ''}${he}${scope === 'home' ? ' של ' + hN : scope === 'away' ? ' של ' + aN : ''}: מתחת ל-${ln}`, u, 1 - pOver, 1 - ps, 'ts-under', lg, false, 0, 'prop');
    };
    for (const [ln, o, u] of X.tot || []) line('total', ln, o, u, muT, sdTot, 'סך המשחק');
    for (const [ln, o, u] of X.t1 || []) line(homeFirst ? 'home' : 'away', ln, o, u, homeFirst ? muH : muA, sdT, homeFirst ? hN : aN);
    for (const [ln, o, u] of X.t2 || []) line(homeFirst ? 'away' : 'home', ln, o, u, homeFirst ? muA : muH, sdT, homeFirst ? aN : hN);
  }

  // ===== שחקנים =====
  const P = ext.pl; if (P && g.players) {
    const roster = [...(g.players.h || []), ...(g.players.a || [])].filter(x => x && x.en && !x.ques && x.min >= 20), byName = new Map(roster.map(x => [norm(x.en), x]));
    const TEAMN = x => (g.players.h || []).includes(x) ? hN : aN;
    for (const [stt, rows] of Object.entries(P)) for (const [name, ln, o, u] of rows) {
      const pl = byName.get(norm(name)); if (!pl || !half(ln)) continue;
      let mu, sdv, he, pm;
      if (stt === 'pts' || stt === 'reb' || stt === 'ast') { const S = pl[stt]; if (!S || !(S.sd > 0)) continue; mu = S.p; sdv = S.sd * 1.05; he = { pts: 'נקודות', reb: 'ריבאונדים', ast: 'אסיסטים' }[stt]; }
      else if (stt === 'pra') { if (!pl.pts || !pl.reb || !pl.ast) continue; mu = pl.pts.p + pl.reb.p + pl.ast.p; sdv = Math.sqrt(pl.pts.sd ** 2 + pl.reb.sd ** 2 + pl.ast.sd ** 2) * 1.15; he = 'נקודות+ריבאונדים+אסיסטים'; }
      else if (stt === 'tpm') { if (!(pl.tpm >= 0)) continue; mu = pl.tpm; he = 'שלשות'; }
      else continue;
      const ps = fair(o, u), pOver = stt === 'tpm' ? 1 - poissonCdf(Math.floor(ln), mu) : 1 - cdf((ln - mu) / sdv);
      const L5 = pl.last ? r1(mean(pl.last.slice(0, 5))) : null;
      const ctxLine = (pl.why && pl.why[0]) ? pl.why[0] : '';
      const base = `${pl.name} (${TEAMN(pl)}) משחק בממוצע ${r1(pl.min)} דקות. הצפי שלנו לפי 15 המשחקים האחרונים ולפי סוג המשחק הוא ${r1(mu)} ${he}${stt === 'pts' && L5 != null ? `, ובחמשת האחרונים ${L5}` : ''}, והקו באתר הוא ${ln}.`;
      const nm = pl.name, id = pl.id;
      if (ln <= mu - (stt === 'tpm' ? 0.6 : 1.5)) add(`pst|${id}|${stt}|over|${ln}`, `${nm} מעל ${ln} ${he}`, o, pOver, ps, 'pl-over', `${base} ${ctxLine}`, false, 0, 'prop');
      if (ln >= mu + (stt === 'tpm' ? 0.6 : 1.5)) add(`pst|${id}|${stt}|under|${ln}`, `${nm} מתחת ל-${ln} ${he}`, u, 1 - pOver, 1 - ps, 'pl-under', `${base} ${ctxLine}`, false, 0, 'prop');
    }
  }
}

export function buildLogs(PL, beforeTs) { const T = teamLogs(PL, beforeTs); return { T, LQ: { 103: leagueQ(PL, 103), 569: leagueQ(PL, 569) } }; }
