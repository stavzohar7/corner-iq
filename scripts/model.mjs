// מודל הקרנות: פרופיל קבוצה (בית/חוץ), צפי קרנות, הסתברויות, ודירוג 1-10
const DECAY = 0.92;      // משקל למשחקים ישנים יותר (משחק אחרון = 1)
const SHRINK_K = 3;      // כיווץ לממוצע הליגה כשיש מעט משחקים
const W_CORNERS = 0.65;  // משקל מודל הקרנות מול מודל הבעיטות
const W_MARKET = 0.5;   // משקל ההסתברות של Bet365 (ללא עמלה) בהסתברות הסופית
const MAXK = 30;

const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const iso = s => '⁨' + s + '⁩'; // בידוד כיווניות לשמות באנגלית
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- המרת תשובת API לרשומה קומפקטית ----------
const STAT = { 'Corner Kicks': 'c', 'Total Shots': 'sh', 'Shots on Goal': 'sot', 'Ball Possession': 'pos' };
export function compactFixture(it) {
  const st = it.statistics;
  if (!Array.isArray(st) || st.length < 2) return null;
  const side = {};
  for (const t of st) {
    const o = {};
    for (const s of t.statistics || []) {
      const k = STAT[s.type];
      if (k) o[k] = s.value == null ? 0 : parseFloat(String(s.value));
    }
    if (o.c == null) return null;
    side[t.team.id === it.teams.home.id ? 'h' : 'a'] = o;
  }
  if (!side.h || !side.a) return null;
  return {
    id: it.fixture.id, ts: it.fixture.timestamp, lg: it.league.id, season: it.league.season,
    h: it.teams.home.id, a: it.teams.away.id,
    g: [it.goals.home, it.goals.away], s: side,
  };
}

// ---------- ממוצעי ליגה ופרופילי קבוצות ----------
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const variance = a => { const m = mean(a); return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0; };
function wmean(arr, f) {
  let s = 0, w = 0;
  arr.forEach((x, i) => { const wt = DECAY ** i; s += wt * f(x); w += wt; });
  return w ? s / w : null;
}

export function buildLeagueModel(matches) {
  const ms = [...matches].sort((x, y) => y.ts - x.ts);
  const hc = ms.map(m => m.s.h.c), ac = ms.map(m => m.s.a.c);
  const n = ms.length;
  const lg = {
    n,
    hc: n >= 8 ? mean(hc) : 5.4, ac: n >= 8 ? mean(ac) : 4.4,
    hs: n >= 8 ? mean(ms.map(m => m.s.h.sh || 0)) : 13, as: n >= 8 ? mean(ms.map(m => m.s.a.sh || 0)) : 10.5,
  };
  lg.total = lg.hc + lg.ac;
  // פיזור (overdispersion) של קרנות לקבוצה
  const phiObs = n >= 20 ? (variance(hc) / (mean(hc) || 1) + variance(ac) / (mean(ac) || 1)) / 2 : 1.5;
  lg.phi = clamp(1 + 0.5 * (phiObs - 1), 1.05, 1.6);

  // רשימות משחקים לכל קבוצה (מהחדש לישן)
  const teams = {};
  const push = (id, e) => (teams[id] ||= []).push(e);
  for (const m of ms) {
    push(m.h, { id: m.id, ts: m.ts, opp: m.a, v: 'H', cf: m.s.h.c, ca: m.s.a.c, sf: m.s.h.sh || 0, sa: m.s.a.sh || 0, pos: m.s.h.pos || 50, g: m.g });
    push(m.a, { id: m.id, ts: m.ts, opp: m.h, v: 'A', cf: m.s.a.c, ca: m.s.h.c, sf: m.s.a.sh || 0, sa: m.s.h.sh || 0, pos: m.s.a.pos || 50, g: [m.g[1], m.g[0]] });
  }
  return { lg, teams, matches: ms };
}

// ממוצע הליגה של מדד מסוים לפי מיקום (בית/חוץ)
function lgAvg(lg, metric, v) {
  const home = { cf: lg.hc, ca: lg.ac, sf: lg.hs, sa: lg.as };
  const away = { cf: lg.ac, ca: lg.hc, sf: lg.as, sa: lg.hs };
  return (v === 'H' ? home : away)[metric] || 1;
}

// חוזק יחסי (1 = ממוצע ליגה), משלב משחקי אותו מיקום + כל המשחקים, עם כיווץ
function strength(list, v, metric, lg) {
  const venue = list.filter(e => e.v === v);
  const nV = venue.length, nA = list.length;
  if (!nA) return { val: 1, n: 0 };
  const rV = nV ? wmean(venue, e => e[metric]) / lgAvg(lg, metric, v) : 1;
  const rA = wmean(list, e => e[metric] / lgAvg(lg, metric, e.v));
  const neff = nV + 0.5 * nA;
  const comb = (nV * rV + 0.5 * nA * rA) / neff;
  return { val: (neff * comb + SHRINK_K) / (neff + SHRINK_K), n: nA };
}

function venueStats(list) {
  if (!list.length) return { n: 0 };
  return {
    n: list.length,
    cf: r1(mean(list.map(e => e.cf))), ca: r1(mean(list.map(e => e.ca))),
    sf: r1(mean(list.map(e => e.sf))), sa: r1(mean(list.map(e => e.sa))),
    pos: Math.round(mean(list.map(e => e.pos))),
    tot: r1(mean(list.map(e => e.cf + e.ca))),
  };
}

export function teamProfile(model, teamId, v, teamsInfo) {
  const { lg } = model;
  const list = model.teams[teamId] || [];
  const all = venueStats(list), home = venueStats(list.filter(e => e.v === 'H')), away = venueStats(list.filter(e => e.v === 'A'));
  const att = strength(list, v, 'cf', lg).val, def = strength(list, v, 'ca', lg).val;
  const sAtt = strength(list, v, 'sf', lg).val, sDef = strength(list, v, 'sa', lg).val;
  const last5 = list.slice(0, 5).map(e => ({ ts: e.ts, opp: teamsInfo[e.opp]?.n || '?', v: e.v, cf: e.cf, ca: e.ca, g: e.g }));
  const l5 = list.slice(0, 5);
  const totals = list.map(e => e.cf + e.ca);
  const cv = totals.length > 2 ? Math.sqrt(variance(totals)) / (mean(totals) || 1) : 0.5;

  // תגיות סגנון משחק
  const tags = [];
  if (all.n >= 3) {
    if (all.pos >= 56) tags.push({ t: `שליטה בכדור (${all.pos}%)`, k: 'up' });
    else if (all.pos <= 44) tags.push({ t: `משחק בלי כדור / קונטרות (${all.pos}%)`, k: 'down' });
    const shotRatio = strength(list, v, 'sf', lg).val;
    if (shotRatio >= 1.15) tags.push({ t: 'נפח בעיטות גבוה', k: 'up' });
    else if (shotRatio <= 0.85) tags.push({ t: 'מעט בעיטות', k: 'down' });
    if (att >= 1.15) tags.push({ t: 'מייצרת הרבה קרנות', k: 'up' });
    else if (att <= 0.85) tags.push({ t: 'מייצרת מעט קרנות', k: 'down' });
    if (def >= 1.15) tags.push({ t: 'סופגת הרבה קרנות', k: 'up' });
    else if (def <= 0.85) tags.push({ t: 'מגבילה קרנות ליריבה', k: 'down' });
    if (home.n >= 2 && away.n >= 2 && Math.abs(home.cf - away.cf) >= 2)
      tags.push({ t: home.cf > away.cf ? 'הרבה יותר קרנות בבית מבחוץ' : 'יותר קרנות בחוץ מבבית', k: 'info' });
    if (l5.length >= 4 && all.n >= 8) {
      const recent = mean(l5.map(e => e.cf)), season = mean(list.map(e => e.cf));
      if (recent >= season * 1.2) tags.push({ t: 'מגמת עלייה בקרנות (5 אחרונים)', k: 'up' });
      else if (recent <= season * 0.8) tags.push({ t: 'מגמת ירידה בקרנות (5 אחרונים)', k: 'down' });
    }
  }
  return {
    id: teamId, name: teamsInfo[teamId]?.n || String(teamId), logo: teamsInfo[teamId]?.l || null,
    games: list.length, all, home, away, att: r2(att), def: r2(def), sAtt: r2(sAtt), sDef: r2(sDef), cv: r2(cv), last5, tags,
  };
}

// ---------- התפלגויות ----------
function nbPmf(lambda, phi) {
  const out = new Array(MAXK + 1).fill(0);
  if (phi <= 1.0001) { // פואסון
    out[0] = Math.exp(-lambda);
    for (let k = 1; k <= MAXK; k++) out[k] = out[k - 1] * lambda / k;
  } else {
    const r = lambda / (phi - 1), q = lambda / (r + lambda);
    out[0] = Math.pow(r / (r + lambda), r);
    for (let k = 1; k <= MAXK; k++) out[k] = out[k - 1] * (k - 1 + r) / k * q;
  }
  const s = out.reduce((a, b) => a + b, 0);
  return out.map(x => x / s);
}
export const oneHot = k => { const a = new Array(MAXK + 1).fill(0); a[Math.min(k, MAXK)] = 1; return a; };

function joint(dh, da) {
  const tot = new Array(2 * MAXK + 1).fill(0), diff = new Map();
  for (let i = 0; i <= MAXK; i++) for (let j = 0; j <= MAXK; j++) {
    const p = dh[i] * da[j]; if (!p) continue;
    tot[i + j] += p; diff.set(i - j, (diff.get(i - j) || 0) + p);
  }
  return { tot, diff };
}

// ---------- סליקת שוק (משמש גם להסתברות וגם לבדיקת תוצאה) ----------
// מחזיר {win, push, lose}
function settleOn(values, pass) { // values: [[x, p]...], pass(x) => 1 win, 0 push, -1 lose
  const o = { win: 0, push: 0, lose: 0 };
  for (const [x, p] of values) { const r = pass(x); if (r > 0) o.win += p; else if (r < 0) o.lose += p; else o.push += p; }
  return o;
}
function splitQuarter(line, fn) { // קווים אסייתיים של רבע (9.25 / 9.75)
  const frac = Math.round((line % 1 + 1) % 1 * 100);
  if (frac === 25 || frac === 75) {
    const a = fn(line - 0.25), b = fn(line + 0.25);
    return { win: (a.win + b.win) / 2, push: (a.push + b.push) / 2, lose: (a.lose + b.lose) / 2 };
  }
  return fn(line);
}
const sgn = x => (Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1);

export function settle(mk, dh, da) {
  const { tot, diff } = joint(dh, da);
  const totV = tot.map((p, i) => [i, p]);
  const diffV = [...diff.entries()];
  const hV = dh.map((p, i) => [i, p]), aV = da.map((p, i) => [i, p]);
  const ou = (vals, side, line) => splitQuarter(line, l => settleOn(vals, x => side === 'over' ? sgn(x - l) : sgn(l - x)));
  switch (mk.group) {
    case 'total': return ou(totV, mk.side, mk.line);
    case 'home': return ou(hV, mk.side, mk.line);
    case 'away': return ou(aV, mk.side, mk.line);
    case 'total3': return settleOn(totV, x => (mk.side === 'over' ? x > mk.line : mk.side === 'under' ? x < mk.line : x === mk.line) ? 1 : -1);
    case '1x2': return settleOn(diffV, d => (mk.side === 'home' ? d > 0 : mk.side === 'away' ? d < 0 : d === 0) ? 1 : -1);
    case 'ah': return splitQuarter(mk.line, l => settleOn(diffV, d => sgn((mk.side === 'home' ? d : -d) + l)));
  }
  throw new Error('unknown market ' + mk.group);
}

// ---------- קריאת שווקי הקרנות של Bet365 ----------
export function parseCornerOdds(bets) {
  const out = [];
  for (const b of bets || []) {
    const name = b.name || '';
    if (!/corner/i.test(name) || /1st|2nd|first|second|half/i.test(name)) continue;
    const vals = b.values || [];
    const has3 = vals.some(v => /^exactly/i.test(String(v.value)));
    for (const v of vals) {
      const val = String(v.value).trim(), odds = parseFloat(v.odd);
      if (!(odds > 1)) continue;
      let m;
      if (/asian|handicap/i.test(name) && (m = val.match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)$/i))) {
        out.push({ group: 'ah', side: m[1].toLowerCase(), line: parseFloat(m[2]), odds });
      } else if (/1x2|3[\s-]?way|three|most/i.test(name) && !has3 && /^(home|draw|away|1|x|2)$/i.test(val)) {
        const side = { '1': 'home', 'x': 'draw', '2': 'away' }[val.toLowerCase()] || val.toLowerCase();
        out.push({ group: '1x2', side, odds });
      } else if ((m = val.match(/^(over|under|exactly)\s*(\d+(?:\.\d+)?)$/i))) {
        const side = m[1].toLowerCase(), line = parseFloat(m[2]);
        let group = 'total';
        if (/home/i.test(name)) group = 'home'; else if (/away/i.test(name)) group = 'away';
        else if (has3) group = 'total3';
        if (side === 'exactly' && group !== 'total3') continue;
        out.push({ group, side, line, odds });
      }
    }
  }
  // הסרת כפילויות
  const seen = new Set();
  return out.filter(o => { const k = `${o.group}|${o.side}|${o.line}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// הסתברות שוק ללא עמלה (לפי הצד הנגדי)
function marketProbs(list) {
  const key = o => `${o.group}|${o.group === 'ah' ? Math.abs(o.line) : o.line ?? ''}`;
  const groups = new Map();
  for (const o of list) {
    const k = o.group === '1x2' ? '1x2' : key(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  for (const g of groups.values()) {
    let sel = g;
    if (g[0].group === 'ah') { // זוג: home -x מול away +x
      for (const o of g) {
        const opp = g.find(p => p.side !== o.side && Math.abs(p.line + o.line) < 1e-9);
        o.pMarket = opp ? (1 / o.odds) / (1 / o.odds + 1 / opp.odds) : 0.95 / o.odds;
      }
      continue;
    }
    const inv = sel.reduce((s, o) => s + 1 / o.odds, 0);
    const complete = (g[0].group === '1x2' || g[0].group === 'total3') ? sel.length === 3 : sel.length === 2;
    for (const o of sel) o.pMarket = complete ? (1 / o.odds) / inv : 0.95 / o.odds;
  }
}

// ---------- ניתוח משחק ----------
const LBL = {
  total: (m) => `${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} קרנות במשחק`,
  total3: (m) => m.side === 'exactly' ? `בדיוק ${m.line} קרנות` : `${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} קרנות (3 אפשרויות)`,
  home: (m, H) => `${H} – ${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} קרנות`,
  away: (m, H, A) => `${A} – ${m.side === 'over' ? 'מעל ' : 'מתחת ל-'}${m.line} קרנות`,
  '1x2': (m, H, A) => m.side === 'home' ? `${H} תיקח יותר קרנות` : m.side === 'away' ? `${A} תיקח יותר קרנות` : 'שוויון בקרנות',
  ah: (m, H, A) => `${m.side === 'home' ? H : A} ${m.line > 0 ? '+' : ''}${m.line} הנדיקאפ קרנות`,
};

function scoreMarket(m, conf) {
  const pe = m.pFinal;
  let base;
  if (m.odds) {
    base = 3.5 + 35 * Math.min(m.ev, 0.15);       // ערך מול היחס של Bet365
    if (pe >= 0.55) base += 1;                     // סיכוי גבוה = הימור יציב יותר
    if (pe >= 0.65) base += 0.5;
    if (pe < 0.4) base -= 1;                       // הימורים "רחוקים" מסוכנים יותר
    if (pe < 0.3) base -= 1.5;
    const d = Math.abs(m.pModel - m.pMarket);      // פער חשוד מול השוק = כנראה המודל טועה
    if (d > 0.15) base -= (d - 0.15) * 15;
  } else {
    base = Math.min(7, 2 + (pe - 0.5) * 25);
  }
  return clamp(Math.round(1 + (base - 1) * (0.55 + 0.45 * conf)), 1, 10);
}

function defaultLines(exp) {
  const out = [];
  const t = Math.floor(exp.total);
  for (let l = t - 2.5; l <= t + 2.5; l += 1) if (l > 0) for (const side of ['over', 'under']) out.push({ group: 'total', side, line: l });
  for (const [g, lam] of [['home', exp.h], ['away', exp.a]]) {
    const b = Math.floor(lam);
    for (let l = b - 1.5; l <= b + 1.5; l += 1) if (l > 0) for (const side of ['over', 'under']) out.push({ group: g, side, line: l });
  }
  for (const side of ['home', 'away']) out.push({ group: '1x2', side });
  for (const l of [-2.5, -1.5, 1.5, 2.5]) for (const side of ['home', 'away']) out.push({ group: 'ah', side, line: l });
  return out;
}

export function analyzeFixture(fx, model, teamsInfo, bets) {
  const { lg } = model;
  const H = teamProfile(model, fx.h, 'H', teamsInfo);
  const A = teamProfile(model, fx.a, 'A', teamsInfo);

  // צפי לפי קרנות ולפי בעיטות
  const hc = lg.hc * H.att * A.def, ac = lg.ac * A.att * H.def;
  const hs = lg.hc * H.sAtt * A.sDef, as = lg.ac * A.sAtt * H.sDef;
  const eh = W_CORNERS * hc + (1 - W_CORNERS) * hs;
  const ea = W_CORNERS * ac + (1 - W_CORNERS) * as;
  const exp = { h: r2(eh), a: r2(ea), total: r2(eh + ea), hc: r2(hc), ac: r2(ac), hs: r2(hs), as: r2(as) };

  const dh = nbPmf(eh, lg.phi), da = nbPmf(ea, lg.phi);

  // רמת ביטחון
  const n = Math.min(H.games, A.games);
  const c1 = clamp(n / 12, 0.25, 1);
  const dev = Math.abs((hc + ac) - (hs + as)) / (eh + ea);
  const c2 = clamp(1 - 2 * dev, 0.3, 1);
  const c3 = clamp(1.4 - (H.cv + A.cv) / 2, 0.4, 1);
  const conf = r2(clamp(0.5 * c1 + 0.3 * c2 + 0.2 * c3, 0.3, 1));

  const odds = parseCornerOdds(bets);
  const hasOdds = odds.length > 0;
  if (hasOdds) marketProbs(odds);
  const cands = hasOdds ? odds : defaultLines(exp);

  const markets = [];
  for (const c of cands) {
    const s = settle(c, dh, da);
    const decided = s.win + s.lose || 1e-9;
    const pModel = s.win / decided;
    const pFinal = c.pMarket != null ? (1 - W_MARKET) * pModel + W_MARKET * c.pMarket : pModel;
    const m = {
      ...c, label: LBL[c.group](c, iso(H.name), iso(A.name)),
      pModel: r2(pModel), pMarket: c.pMarket != null ? r2(c.pMarket) : null, pFinal: r2(pFinal),
      push: r2(s.push), fair: r2(1 / Math.max(pModel, 0.01)),
    };
    if (c.odds) m.ev = r2(pFinal * (1 - s.push) * (c.odds - 1) - (1 - pFinal) * (1 - s.push));
    if (!hasOdds && (pModel < 0.5 || pModel > 0.72)) continue; // בלי יחסים: רק קווים "אמיתיים"
    m.score = scoreMarket(m, conf);
    m.reason = reasonFor(m, H, A, exp, lg);
    markets.push(m);
  }
  markets.sort((x, y) => y.score - x.score || (y.ev ?? y.pFinal) - (x.ev ?? x.pFinal));

  // בחירות: עד 3, כל אחת מקבוצת שוק שונה
  const picks = [], used = new Set();
  for (const m of markets) {
    const grp = m.group === 'total3' ? 'total' : m.group === 'ah' ? '1x2' : m.group;
    if (used.has(grp)) continue;
    used.add(grp); picks.push(m);
    if (picks.length === 3) break;
  }

  for (const m of markets) if (!picks.includes(m)) delete m.reason;
  return {
    id: fx.id, ts: fx.ts, status: fx.status, round: fx.round, venue: fx.venue,
    lg: fx.lg, lgAvg: { h: r1(lg.hc), a: r1(lg.ac), total: r1(lg.total), n: lg.n },
    home: H, away: A, exp, conf, hasOdds,
    dist: dh.slice(0, 16).map(r2).map((x, i) => [x, r2(da[i])]),
    totalDist: joint(dh, da).tot.slice(0, 25).map(x => Math.round(x * 1000) / 1000),
    h2h: (model.teams[fx.h] || []).filter(e => e.opp === fx.a).map(e => ({ ts: e.ts, v: e.v, cf: e.cf, ca: e.ca })),
    notes: notesFor(H, A, exp, lg),
    markets, picks: picks.map(p => markets.indexOf(p)),
  };
}

// ---------- הסברים בעברית ----------
function notesFor(H, A, exp, lg) {
  const out = [];
  if (H.home.n) out.push(`${iso(H.name)} בבית: ${H.home.cf} קרנות למשחק בממוצע וסופגת ${H.home.ca} (ממוצע ליגה למארחת: ${r1(lg.hc)} / ${r1(lg.ac)}).`);
  if (A.away.n) out.push(`${iso(A.name)} בחוץ: ${A.away.cf} קרנות למשחק בממוצע וסופגת ${A.away.ca} (ממוצע ליגה לאורחת: ${r1(lg.ac)} / ${r1(lg.hc)}).`);
  const diff = (exp.total - lg.total) / lg.total;
  out.push(`צפי קרנות: ${r1(exp.h)} – ${r1(exp.a)}, סה״כ ${r1(exp.total)} — ${Math.abs(diff) < 0.05 ? 'בדומה לממוצע' : diff > 0 ? `גבוה ב-${Math.round(diff * 100)}% מהממוצע` : `נמוך ב-${Math.round(-diff * 100)}% מהממוצע`} בליגה (${r1(lg.total)}).`);
  if (Math.abs(exp.hc - exp.hs) / exp.h > 0.2) out.push(`שימו לב: לפי הבעיטות ${iso(H.name)} צפויה ל-${r1(exp.hs)} קרנות, ולפי הקרנות עצמן ${r1(exp.hc)} — אי-התאמה שמורידה ביטחון.`);
  if (exp.h - exp.a >= 2.5) out.push(`${iso(H.name)} צפויה לשלוט בשטח — רוב הקרנות צפויות להגיע ממנה.`);
  else if (exp.a - exp.h >= 1.5) out.push(`${iso(A.name)} צפויה ללחוץ יותר למרות שהיא אורחת.`);
  if (Math.min(H.games, A.games) < 5) out.push('מעט משחקים במאגר עדיין — הדירוג נזהר יותר.');
  return out;
}

function reasonFor(m, H, A, exp, lg) {
  const parts = [];
  const hi = 1.12, lo = 0.88;
  const upTot = m.group.startsWith('total') && m.side === 'over';
  const dnTot = m.group.startsWith('total') && m.side === 'under';
  if (m.group.startsWith('total')) parts.push(`צפי ${r1(exp.total)} קרנות מול קו ${m.line}`);
  if (m.group === 'home') parts.push(`צפי עבור ${iso(H.name)}: ${r1(exp.h)} מול קו ${m.line}`);
  if (m.group === 'away') parts.push(`צפי עבור ${iso(A.name)}: ${r1(exp.a)} מול קו ${m.line}`);
  if (m.group === '1x2' || m.group === 'ah') parts.push(`צפי ${r1(exp.h)} מול ${r1(exp.a)}`);
  const wantHomeUp = upTot || (m.group === 'home' && m.side === 'over') || ((m.group === '1x2' || m.group === 'ah') && m.side === 'home');
  const wantAwayUp = upTot || (m.group === 'away' && m.side === 'over') || ((m.group === '1x2' || m.group === 'ah') && m.side === 'away');
  const wantHomeDn = dnTot || (m.group === 'home' && m.side === 'under');
  const wantAwayDn = dnTot || (m.group === 'away' && m.side === 'under');
  if (wantHomeUp && H.att >= hi) parts.push(`${iso(H.name)} מייצרת הרבה קרנות בבית`);
  if (wantHomeUp && A.def >= hi) parts.push(`${iso(A.name)} סופגת הרבה קרנות בחוץ`);
  if (wantAwayUp && A.att >= hi) parts.push(`${iso(A.name)} מייצרת הרבה קרנות בחוץ`);
  if (wantAwayUp && H.def >= hi) parts.push(`${iso(H.name)} סופגת הרבה קרנות בבית`);
  if (wantHomeDn && H.att <= lo) parts.push(`${iso(H.name)} מייצרת מעט קרנות`);
  if (wantHomeDn && A.def <= lo) parts.push(`${iso(A.name)} מגבילה קרנות ליריבות`);
  if (wantAwayDn && A.att <= lo) parts.push(`${iso(A.name)} מייצרת מעט קרנות בחוץ`);
  if (wantAwayDn && H.def <= lo) parts.push(`${iso(H.name)} כמעט לא נותנת קרנות בבית`);
  if (m.odds && m.ev > 0) parts.push(`יחס ${m.odds} מול יחס הוגן ${m.fair}`);
  return parts.join(' · ');
}
