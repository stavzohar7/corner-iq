// "מה על הכף ואיך הקבוצה מגיעה": מצב בבית (ליגת האומות), ימי מנוחה, ורצף עומס. מחושב רק מנתונים שכבר יש לנו, בלי להמציא.
const DAY = 86400;

// אינדקס משחקי עבר לכל קבוצה (מזהה → ts ממוין), לחישוב ימי מנוחה
export function buildRestIndex(records) {
  const idx = new Map();
  for (const r of records) for (const id of [r.h, r.a]) { const k = String(id); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r.ts); }
  for (const a of idx.values()) a.sort((x, y) => x - y);
  return idx;
}
export function restInfo(idx, id, ts) {
  const a = idx.get(String(id)); if (!a) return null;
  const before = a.filter(t => t < ts - 3600);
  if (!before.length) return null;
  const days = Math.round((ts - before[before.length - 1]) / DAY);
  const last14 = before.filter(t => t > ts - 14 * DAY).length;
  return { days, last14 };
}

// מצב בבית: לפי נקודות בלבד (שוויון נקודות נפרד לפי יחס שערים לא מחושב כאן, ולכן הניסוח זהיר)
export function groupStake(map, id) {
  const me = map && map[id]; if (!me || !me.grp) return null;
  const members = Object.entries(map).filter(([, r]) => r.grp === me.grp).map(([k, r]) => ({ id: k, pts: r.points, played: r.played }));
  if (members.length < 3) return null;
  const total = 2 * (members.length - 1);
  members.forEach(m => { m.max = m.pts + 3 * Math.max(0, total - m.played); });
  const t = members.find(m => String(m.id) === String(id)), others = members.filter(m => m !== t);
  const clinched1 = others.every(o => t.pts > o.max);
  const canBe1 = others.every(o => t.max >= o.pts);
  const safeLast = others.some(o => o.max < t.pts);
  const sureLast = others.every(o => t.max < o.pts);
  const remaining = Math.max(0, total - t.played);
  const league = String(me.grp)[0];
  const top = league === 'A' ? 'רבע הגמר' : 'העלייה ליגה';
  const bottom = league === 'A' ? 'הירידה' : league === 'D' ? 'המקום האחרון' : 'הירידה / פלייאוף';
  let state, text;
  if (remaining === 0) { state = 'done'; text = 'סיימה את משחקי הבית'; }
  else if (clinched1) { state = 'clinched'; text = `כבר מובטח לה המקום הראשון בבית (${top}). אין מה להפסיד, אפשר רוטציה`; }
  else if (canBe1 && !safeLast) { state = 'open'; text = `הכול פתוח: עדיין יכולה לסיים ראשונה (${top}) אבל גם אחרונה (${bottom})`; }
  else if (canBe1) { state = 'fight1'; text = `נלחמת על המקום הראשון בבית (${top}); אחרונה כבר לא תהיה`; }
  else if (sureLast) { state = 'bottom'; text = `בתחתית הבית, כנראה לא תצליח לצאת ממנה (${bottom})`; }
  else if (!safeLast) { state = 'relegation'; text = `בסכנה לסיים אחרונה (${bottom}); הראשון כבר רחוק`; }
  else { state = 'dead'; text = 'מקום באמצע הבית: אין הרבה מה להרוויח או להפסיד, והמוטיבציה פחות ברורה'; }
  return { state, text, pts: t.pts, played: t.played, remaining, grp: me.grp };
}

const HIGH = new Set(['open', 'fight1', 'relegation']);
export function stakesOf({ standMap, restIdx, hId, aId, ts }) {
  const out = { rest: {}, stakes: {} };
  for (const [side, id] of [['h', hId], ['a', aId]]) {
    out.rest[side] = restInfo(restIdx, id, ts);
    const g = groupStake(standMap, id); if (g) out.stakes[side] = g;
  }
  const sh = out.stakes.h, sa = out.stakes.a;
  if (sh && sa) {
    const h = HIGH.has(sh.state), a = HIGH.has(sa.state);
    out.tension = h && a ? 'high' : (!h && !a && sh.state !== 'fight1' && sa.state !== 'fight1') ? 'low' : 'mixed';
  }
  const rh = out.rest.h, ra = out.rest.a;
  if (rh && ra && Math.abs(rh.days - ra.days) >= 2) out.restEdge = rh.days > ra.days ? 'h' : 'a';
  return out;
}

// שורות טקסט (לתיק המנתח ולאתר), בעברית, רק מה שמחושב באמת
export function stakesLines(ctx, names) {
  const L = [];
  if (!ctx) return L;
  for (const [side, nm] of [['h', names.h], ['a', names.a]]) {
    const s = ctx.stakes && ctx.stakes[side];
    if (s) L.push(`${nm}: ${s.text} (${s.pts} נקודות אחרי ${s.played} משחקים, ${s.remaining} משחקים נשארו לה בבית)`);
  }
  if (ctx.tension === 'high') L.push('שתי הקבוצות עם הרבה על הכף: משחק רציני משני הצדדים.');
  else if (ctx.tension === 'low') L.push('לשתי הקבוצות אין הרבה על הכף: סיכוי גבוה לרוטציה ולמשחק פחות לוחץ.');
  const r = ctx.rest || {};
  if (r.h && r.a) L.push(`ימי מנוחה מהמשחק הקודם: ${names.h} ${r.h.days}, ${names.a} ${r.a.days}` + (ctx.restEdge ? `. יתרון מנוחה ל${ctx.restEdge === 'h' ? names.h : names.a}.` : '.'));
  else for (const [side, nm] of [['h', names.h], ['a', names.a]]) if (r[side]) L.push(`${nm}: ${r[side].days} ימי מנוחה, ${r[side].last14} משחקים ב-14 הימים האחרונים.`);
  return L;
}

// הימור "בעד" קבוצה שכבר הבטיחה את מקומה (רוטציה אפשרית) מקבל אזהרה בלבד, בלי לשנות את הציון (אין עדיין מספיק נתונים כדי לכייל)
export function addStakeWarnings(f) {
  const c = f.ctx; if (!c || !c.stakes) return 0;
  let n = 0;
  const calm = side => c.stakes[side] && (c.stakes[side].state === 'clinched');
  for (const m of f.markets || []) {
    let side = null;
    if ((m.group === '1x2' || m.group === 'ah') && (m.side === 'home' || m.side === 'away')) side = m.side === 'home' ? 'h' : 'a';
    else if (m.group === 'dc' && m.side === '1x') side = 'h';
    else if (m.group === 'dc' && m.side === 'x2') side = 'a';
    else if ((m.group === 'home' || m.group === 'away') && m.side === 'over') side = m.group === 'home' ? 'h' : 'a';
    if (!side || !calm(side)) continue;
    (m.checks ||= []).push({ k: 'warn', t: 'הקבוצה הזאת כבר הבטיחה את מקומה בבית: סיכוי לרוטציה ולמשחק רגוע, ולכן ההימור הזה פחות בטוח' });
    n++;
  }
  return n;
}
