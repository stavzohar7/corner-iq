// ידע על כל קבוצה: אופי משחק, בית מול חוץ, מול גדולות / בינוניות / קטנות, מול קבוצות מתבצרות,
// ולמידה מהמעקב (השוואת החיזוי לתוצאה בפועל, לכל קבוצה).
import { teamProfile, bucketStats, oppKind, tierFromRank } from './model.mjs';
import { ARCH, classify, learnFactor } from './arch.mjs';
export { ARCH, classify, learnFactor, archMatchup } from './arch.mjs';

const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ppgOf = b => b && b.n ? (b.w * 3 + b.d) / b.n : null;

export function teamKnowledge(model, id, info, rankOf, learnEntry) {
  const T = teamProfile(model, id, 'H', info, { rankOf });
  if (T.games < 3 || !T.all || !T.all.st) return null;
  const lg = model.lg, list = model.teams[id] || [];
  const both = s => lg.avg[s] ? (lg.avg[s].h + lg.avg[s].a) / 2 : null;
  const rel = {}, st = T.all.st;
  for (const [key, s, i] of [['shF', 'sh', 0], ['shA', 'sh', 1], ['gF', 'g', 0], ['gA', 'g', 1], ['cF', 'c', 0], ['cA', 'c', 1], ['sotF', 'sot', 0]]) rel[key] = st[s] && both(s) ? r2(st[s][i] / both(s)) : 1;
  const pos = T.all.pos != null ? T.all.pos : 50;
  const arch = classify(rel, pos);
  const H = bucketStats(list, e => e.v === 'H'), A = bucketStats(list, e => e.v === 'A'), all = bucketStats(list, () => true);
  const tiers = {}, tOf = id2 => { const r = rankOf && rankOf(id2); return r ? tierFromRank(r.rank, r.n) : null; };
  for (const t of ['top', 'mid', 'bot']) tiers[t] = bucketStats(list, e => tOf(e.opp) === t);
  const blockB = bucketStats(list, e => { const k = oppKind(model, e.opp); return k && k.block; });
  const openB = bucketStats(list, e => { const k = oppKind(model, e.opp); return k && !k.block; });
  const ppg = ppgOf(all), ppg5 = (() => { const L = list.filter(e => e.g && e.g[0] != null).slice(0, 5); return L.length >= 4 ? L.reduce((s, e) => s + (e.g[0] > e.g[1] ? 3 : e.g[0] === e.g[1] ? 1 : 0), 0) / L.length : null; })();
  const sty = T.style && T.style.all || {};
  const lines = [];
  const nm = T.name;
  // בית / חוץ
  if (H && A && H.n >= 3 && A.n >= 3) {
    const d = ppgOf(H) - ppgOf(A);
    if (d >= 1) lines.push(`קבוצת בית: ${r1(ppgOf(H))} נקודות למשחק בבית מול ${r1(ppgOf(A))} בחוץ.`);
    else if (d <= -1) lines.push(`דווקא טובה יותר בחוץ: ${r1(ppgOf(A))} נקודות למשחק בחוץ מול ${r1(ppgOf(H))} בבית.`);
    else lines.push(`אותה רמה בבית ובחוץ (${r1(ppgOf(H))} ו-${r1(ppgOf(A))} נקודות למשחק).`);
    if (H.c != null && A.c != null && Math.abs(H.c - A.c) >= 1.2) lines.push(`בקרנות היא ${H.c > A.c ? 'מרוויחה יותר בבית' : 'מרוויחה יותר בחוץ'}: ${H.c} בבית מול ${A.c} בחוץ.`);
  }
  // מול גדולות / קטנות
  const tp = t => ppgOf(tiers[t]) != null && tiers[t].n >= 3 ? ppgOf(tiers[t]) : null;
  const pT = tp('top'), pB = tp('bot'), pM = tp('mid');
  if (pB != null && pT != null) {
    if (pB >= 2 && pT <= 1) lines.push(`חזקה מול קטנות (${r1(pB)} נקודות למשחק) ונחנקת מול גדולות (${r1(pT)}).`);
    else if (pT >= pB + 0.3) lines.push(`מתעוררת מול גדולות (${r1(pT)} נקודות למשחק) ומאבדת נקודות מול קטנות (${r1(pB)}): סימן לקבוצה שאוהבת משחק פתוח.`);
    else if (pB <= 1.2 && pB != null) lines.push(`מתקשה גם מול קבוצות מהתחתית (${r1(pB)} נקודות למשחק).`);
  } else if (pB != null && pB >= 2.2) lines.push(`מנצלת היטב קבוצות מהתחתית (${r1(pB)} נקודות למשחק).`);
  if (pM != null && ppg != null && Math.abs(pM - ppg) >= 0.8) lines.push(`מול קבוצות מאמצע הטבלה: ${r1(pM)} נקודות למשחק (בכל המשחקים ${r1(ppg)}).`);
  // מול קבוצות מתבצרות
  if (blockB && blockB.n >= 3 && all.gf != null && blockB.gf != null) {
    const dg = blockB.gf - all.gf;
    if (dg <= -0.5) lines.push(`מתקשה לפרוץ קבוצות שמתבצרות: ${blockB.gf} שערים למשחק מולן (בכל המשחקים ${all.gf}).`);
    else if (dg >= 0.5) lines.push(`יודעת לפרוץ קבוצות שמתבצרות: ${blockB.gf} שערים למשחק מולן (בכל המשחקים ${all.gf}).`);
  }
  // התקפה והגנה
  if (rel.gF >= 1.2) lines.push(`התקפה חזקה: ${st.g[0]} שערים למשחק (ממוצע הליגה ${r1(both('g'))}).`); else if (rel.gF <= 0.8) lines.push(`התקפה חלשה: ${st.g[0]} שערים למשחק (ממוצע הליגה ${r1(both('g'))}).`);
  if (rel.gA <= 0.8) lines.push(`הגנה חזקה: ${st.g[1]} שערים נגד למשחק.`); else if (rel.gA >= 1.2) lines.push(`הגנה רופפת: ${st.g[1]} שערים נגד למשחק.`);
  if (rel.cF >= 1.15 && st.c) lines.push(`מביאה הרבה קרנות: ${st.c[0]} למשחק (ממוצע ${r1(both('c'))}).`); else if (rel.cF <= 0.85 && st.c) lines.push(`מעט קרנות: ${st.c[0]} למשחק (ממוצע ${r1(both('c'))}).`);
  if (sty.fh != null && lg.rates && lg.rates.fh != null) { if (sty.fh >= lg.rates.fh + 0.1) lines.push('מתחילה חזק: רוב השערים שלה בחצי הראשון.'); else if (sty.fh <= lg.rates.fh - 0.1) lines.push('מתעוררת מאוחר: רוב השערים שלה בחצי השנייה.'); }
  // מגמה
  if (ppg != null && ppg5 != null) { if (ppg5 - ppg >= 0.8) lines.push(`בעלייה: ${r1(ppg5)} נקודות למשחק ב-5 האחרונים (העונה ${r1(ppg)}).`); else if (ppg5 - ppg <= -0.8) lines.push(`בירידה: ${r1(ppg5)} נקודות למשחק ב-5 האחרונים (העונה ${r1(ppg)}).`); }
  // למידה מהמעקב
  const lr = learnEntry || {}; const lnotes = [];
  for (const [s, he] of [['c', 'קרנות'], ['sh', 'בעיטות'], ['g', 'שערים']]) { const e = lr[s]; if (e && e.n >= 5 && Math.abs(e.r - 1) >= 0.08) lnotes.push(`במשחקים שכבר נבדקו (${e.n}) ${e.r > 1 ? 'יצרה יותר' : 'יצרה פחות'} ${he} ממה שחזינו`); }
  if (lnotes.length) lines.push('למדנו מהמעקב: ' + lnotes.join(', ') + '. החיזוי מתוקן בהתאם.');
  // רגעים ורצפים: מה אוהד של הקבוצה היה זוכר מהעונה
  const moments = [], LG = T.log.filter(e => e.g && e.g[0] != null);
  if (LG.length >= 4) {
    const run = (pred) => { let n = 0; for (const e of LG) { if (pred(e)) n++; else break; } return n; };
    const w = run(e => e.g[0] > e.g[1]), unb = run(e => e.g[0] >= e.g[1]), lose = run(e => e.g[0] < e.g[1]), cs = run(e => e.g[1] === 0), noW = run(e => e.g[0] <= e.g[1]);
    if (w >= 2) moments.push('הרצף הנוכחי: ' + w + ' ניצחונות ברצף.');
    else if (unb >= 4) moments.push('הרצף הנוכחי: ' + unb + ' משחקים בלי הפסד.');
    else if (lose >= 2) moments.push('הרצף הנוכחי: ' + lose + ' הפסדים ברצף.');
    else if (noW >= 4) moments.push('הרצף הנוכחי: ' + noW + ' משחקים בלי ניצחון.');
    if (cs >= 2) moments.push('לא ספגה ' + cs + ' משחקים ברצף.');
    const bw = LG.filter(e => e.g[0] > e.g[1]).sort((x, y) => (y.g[0] - y.g[1]) - (x.g[0] - x.g[1]))[0], bl = LG.filter(e => e.g[0] < e.g[1]).sort((x, y) => (y.g[1] - y.g[0]) - (x.g[1] - x.g[0]))[0];
    if (bw && bw.g[0] - bw.g[1] >= 3) moments.push('הניצחון הגדול: ' + bw.g[0] + ':' + bw.g[1] + ' ' + (bw.v === 'H' ? 'בבית' : 'בחוץ') + ' מול ' + bw.opp + '.');
    if (bl && bl.g[1] - bl.g[0] >= 3) moments.push('ההפסד הכבד: ' + bl.g[0] + ':' + bl.g[1] + ' ' + (bl.v === 'H' ? 'בבית' : 'בחוץ') + ' מול ' + bl.opp + '.');
    const HT = LG.filter(e => e.g1 && e.g1[0] != null && e.g1[1] != null);
    if (HT.length >= 6) {
      const comeback = HT.filter(e => e.g1[0] < e.g1[1] && e.g[0] >= e.g[1]).length, blown = HT.filter(e => e.g1[0] > e.g1[1] && e.g[0] <= e.g[1]).length, held = HT.filter(e => e.g1[0] > e.g1[1] && e.g[0] > e.g[1]).length;
      if (comeback >= 2) moments.push('לא מוותרת: חזרה מפיגור במחצית ל-' + comeback + ' משחקים, ובהם ניצחונות ותיקו.');
      if (blown >= 2) moments.push('מאבדת יתרונות: ב-' + blown + ' משחקים הובילה במחצית ולא ניצחה.');
      if (held >= 4 && blown === 0) moments.push('סוגרת משחקים: כל ' + held + ' המשחקים שהובילה בהם במחצית הסתיימו בניצחון.');
    }
  }
  const trim = b => b ? { n: b.n, w: b.w, d: b.d, l: b.l, gf: b.gf, ga: b.ga, c: b.c, cAg: b.cAg, sh: b.sh, shAg: b.shAg } : null;
  return {
    id, name: nm, rank: T.rank, nTeams: T.nTeams, tier: T.tier, n: T.games, arch, archHe: ARCH[arch].he, archShort: ARCH[arch].short, pos, rel,
    ppg: ppg != null ? r2(ppg) : null, ppg5: ppg5 != null ? r2(ppg5) : null, form: sty.form || '',
    all: trim(all), home: trim(H), away: trim(A), top: trim(tiers.top), mid: trim(tiers.mid), bot: trim(tiers.bot), block: trim(blockB), other: trim(openB),
    lines: lines.slice(0, 9), moments,
    last: T.log.slice(0, 8).map(e => ({ ts: e.ts, opp: e.opp, v: e.v, g: e.g, c: e.c, sh: e.sh, rank: e.rank, tier: e.tier })),
  };
}

// ---------- למידה: השוואת החיזוי לתוצאה בפועל, לכל קבוצה ----------
const LEARN_STATS = ['g', 'c', 'sh', 'sot'];
export function learnFromDays(learn, dayDocs) {
  let added = 0;
  for (const day of dayDocs) for (const fx of day.fixtures || []) {
    if (!fx.graded || !fx.result || !fx.exp || learn.seen[fx.id]) continue;
    const R = fx.result, S = R.stats || {};
    const act = (s, i) => s === 'g' ? R.g[i] : s === 'c' ? (i === 0 ? R.h : R.a) : (S[s] ? S[s][i] : null);
    for (const s of LEARN_STATS) {
      const e = fx.exp[s]; if (!e) continue;
      for (const [i, tid] of [[0, fx.home.id], [1, fx.away.id]]) {
        const a = act(s, i); if (a == null) continue;
        const lf = e.lf ? (i === 0 ? e.lf.h : e.lf.a) : 1;           // מחזירים את החיזוי לפני תיקון הלמידה
        const expected = (i === 0 ? e.h : e.a) / (lf || 1);
        const ratio = clamp((a + 0.5) / (expected + 0.5), 0.5, 2);
        const T = learn.teams[String(tid)] ||= {}, x = T[s] ||= { n: 0, r: 1 };
        const alpha = Math.max(0.15, 1 / (x.n + 1));
        x.r = r2(x.n ? x.r * (1 - alpha) + ratio * alpha : ratio); x.n++;
      }
    }
    learn.seen[fx.id] = 1; added++;
  }
  return added;
}

// ---------- אופי הליגה: מה אופייני למשחקים בליגה הזאת, ביחס לליגות האחרות ולעונה שעברה ----------
export function leagueStats(ms) {
  const L = ms.filter(m => m.g && m.g[0] != null);
  if (L.length < 20) return null;
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const both = f => mean(L.map(m => { const h = f(m, 'h'), a = f(m, 'a'); return h != null && a != null ? h + a : null; }).filter(x => x != null));
  const s = (st) => (m, sd) => m.s && m.s[sd] ? m.s[sd][st] : null;
  return { n: L.length, goals: both((m, sd) => m.g[sd === 'h' ? 0 : 1]), homeW: L.filter(m => m.g[0] > m.g[1]).length / L.length, draw: L.filter(m => m.g[0] === m.g[1]).length / L.length, awayW: L.filter(m => m.g[0] < m.g[1]).length / L.length,
    o25: L.filter(m => m.g[0] + m.g[1] > 2).length / L.length, btts: L.filter(m => m.g[0] > 0 && m.g[1] > 0).length / L.length,
    corners: both(s('c')), shots: both(s('sh')), sot: both(s('sot')), cards: both(s('k')), fouls: both(s('f')), homeGoals: mean(L.map(m => m.g[0])), awayGoals: mean(L.map(m => m.g[1])) };
}
export function leagueProfile(he, cur, prev, global, teams) {
  if (!cur) return null;
  const r1 = x => Math.round(x * 10) / 10, pc = x => Math.round(x * 100);
  const lines = [];
  const cmp = (key, name, unit, tol, hiTxt, loTxt) => { const v = cur[key], g = global[key]; if (v == null || g == null) return; const d = (v - g) / g; if (d >= tol) lines.push(`${hiTxt}: ${r1(v)} ${unit} למשחק (ממוצע כל הליגות ${r1(g)}).`); else if (d <= -tol) lines.push(`${loTxt}: ${r1(v)} ${unit} למשחק (ממוצע כל הליגות ${r1(g)}).`); };
  cmp('goals', 'שערים', 'שערים', 0.07, 'ליגה עתירת שערים', 'ליגה דלה בשערים');
  cmp('corners', 'קרנות', 'קרנות', 0.07, 'הרבה קרנות', 'מעט קרנות');
  cmp('shots', 'בעיטות', 'בעיטות', 0.06, 'הרבה בעיטות', 'מעט בעיטות');
  cmp('cards', 'כרטיסים', 'כרטיסים', 0.12, 'ליגה קשוחה, עם הרבה כרטיסים', 'ליגה נקייה, עם מעט כרטיסים');
  const adv = cur.homeW - cur.awayW, gAdv = global.homeW - global.awayW;
  if (adv - gAdv >= 0.06) lines.push('יתרון בית חזק: ניצחונות בית נפוצים הרבה יותר מניצחונות חוץ.'); else if (adv - gAdv <= -0.06) lines.push('יתרון בית חלש: ניצחונות חוץ כמעט נפוצים כמו ניצחונות בית.');
  if (cur.draw - global.draw >= 0.04) lines.push('הרבה תיקו בליגה הזאת.'); else if (cur.draw - global.draw <= -0.04) lines.push('מעט תיקו בליגה הזאת.');
  if (Math.abs(cur.o25 - global.o25) >= 0.07) lines.push(cur.o25 > global.o25 ? 'הרבה משחקים עם מעל 2.5 שערים, יותר מבשאר הליגות.' : 'מעט משחקים עם מעל 2.5 שערים, פחות מבשאר הליגות.');
  if (prev && prev.goals != null && Math.abs(cur.goals - prev.goals) >= 0.25) lines.push(`${cur.goals > prev.goals ? 'יותר' : 'פחות'} שערים מהעונה שעברה: ${r1(cur.goals)} מול ${r1(prev.goals)} למשחק.`);
  if (prev && prev.corners != null && cur.corners != null && Math.abs(cur.corners - prev.corners) >= 0.6) lines.push(`${cur.corners > prev.corners ? 'יותר' : 'פחות'} קרנות מהעונה שעברה: ${r1(cur.corners)} מול ${r1(prev.corners)} למשחק.`);
  const ext = (arr, f, hi) => arr.filter(t => f(t) != null).sort((a, b) => hi ? f(b) - f(a) : f(a) - f(b))[0];
  const T = (teams || []).filter(t => t.n >= 4 && t.all);
  const mc = ext(T, t => t.all.c, true), bd = ext(T, t => t.all.ga, false), ba = ext(T, t => t.all.gf, true);
  if (ba && bd) lines.push(`ההתקפה הטובה ביותר: ${ba.name} (${ba.all.gf} שערים למשחק). ההגנה הטובה ביותר: ${bd.name} (${bd.all.ga} נגד למשחק).${mc && mc.all.c != null ? ' הכי הרבה קרנות: ' + mc.name + ' (' + mc.all.c + ').' : ''}`);
  const arch = {}; for (const t of T) arch[t.archHe] = (arch[t.archHe] || 0) + 1;
  const top = Object.entries(arch).sort((a, b) => b[1] - a[1])[0];
  if (top && T.length >= 8) lines.push(`הסגנון הנפוץ בליגה: ${top[0]} (${top[1]} מ-${T.length} קבוצות).`);
  const o = k => cur[k] != null ? r1(cur[k]) : null;
  return { n: cur.n, goals: o('goals'), corners: o('corners'), shots: o('shots'), cards: o('cards'), homeW: pc(cur.homeW), draw: pc(cur.draw), awayW: pc(cur.awayW), o25: pc(cur.o25), btts: pc(cur.btts), lines: lines.slice(0, 9) };
}
