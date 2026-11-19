// סגנון משחק של כל קבוצה: מבנה פרופיל מהנתונים של קובץ היום (ממוצעים בבית/בחוץ מול ממוצע הליגה), ובדיקת התאמה בין סגנון הקבוצות לבין הימור.
// הצפי של המודל כבר משתמש בנתונים האלה. כאן בודקים שהסגנון של שתי הקבוצות תומך בהימור ולא סותר אותו (תוספת או הורדה קטנה בלבד).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const shrink = (r, n) => 1 + (r - 1) * (n / (n + 4));   // מעט משחקים: מקרבים לממוצע
const sg = (st, k, i) => (st && st[k] && typeof st[k][i] === 'number') ? st[k][i] : null;

export function profile(team, isHome, lg) {
  if (!team || !lg) return null;
  const sp = team.splits || {}, role = sp.role && sp.role.n >= 3 ? sp.role : sp.all; if (!role || !role.st || !(role.n >= 3)) return null;
  const n = role.n, st = role.st, L = k => lg[k] ? (isHome ? [lg[k].h, lg[k].a] : [lg[k].a, lg[k].h]) : null;
  const r = (k, i) => { const v = sg(st, k, i), ref = L(k); if (v == null || !ref || !(ref[i] > 0)) return 1; return shrink(v / ref[i], n); };
  const gf = sg(st, 'g', 0), ga = sg(st, 'g', 1);
  const P = { n, isHome, gf, ga, atk: r('g', 0), def: r('g', 1), open: 0, shVol: r('sh', 0), shAllow: r('sh', 1), cVol: r('c', 0), cAllow: r('c', 1), sotVol: r('sot', 0), sotAllow: r('sot', 1) };
  P.open = (P.atk + P.def) / 2;
  const tags = [];
  if (P.atk >= 1.25) tags.push(`התקפה חזקה (${gf} שערים למשחק ${isHome ? 'בבית' : 'בחוץ'})`); else if (P.atk <= 0.75) tags.push(`התקפה חלשה (${gf} שערים למשחק ${isHome ? 'בבית' : 'בחוץ'})`);
  if (P.def <= 0.75) tags.push(`מתבצרת, סופגת מעט (${ga} למשחק)`); else if (P.def >= 1.3) tags.push(`מגננה רופפת, סופגת הרבה (${ga} למשחק)`);
  if (P.shVol >= 1.2) tags.push('בעיטות רבות'); else if (P.shVol <= 0.8) tags.push('מעט בעיטות');
  if (P.cVol >= 1.2) tags.push('הרבה קרנות'); else if (P.cVol <= 0.8) tags.push('מעט קרנות');
  P.tags = tags; return P;
}

// התאמת סגנון להימור: מחזיר { d, note }. d חיובי = הסגנון תומך, שלילי = סותר. תמיד קטן (עד 0.06).
export function styleFit(key, nameH, nameA, PH, PA) {
  if (!PH || !PA) return { d: 0, note: '' };
  const [stat, grp, side] = key.split('|'), dir = side === 'over' ? 1 : side === 'under' ? -1 : 0;
  const sd = x => x < 0 ? clamp(x * 2, -0.1, 0) : clamp(x, 0, 0.06);   // סתירה בין הסגנון להימור נענשת בכפול
  const line = (P, nm) => P.tags.length ? `${nm}: ${P.tags.slice(0, 2).join(', ')}` : '';
  const both = (a, b) => [a, b].filter(Boolean).join('. ');
  const openAvg = (PH.open + PA.open) / 2;
  if (stat === 'g') {
    if (grp === 'total' && dir) return { d: sd(dir * (openAvg - 1) * 0.25), note: both(line(PH, nameH), line(PA, nameA)) };
    if ((grp === 'home' || grp === 'away') && dir) { const T = grp === 'home' ? PH : PA, O = grp === 'home' ? PA : PH, nm = grp === 'home' ? nameH : nameA, x = T.atk * O.def; return { d: sd(dir * (x - 1) * 0.15), note: both(line(T, nm), O.def >= 1.3 || O.def <= 0.75 ? line(O, grp === 'home' ? nameA : nameH) : '') }; }
    if (grp === 'btts') { const x = Math.min(PH.atk * PA.def, PA.atk * PH.def); return { d: sd((side === 'yes' ? 1 : -1) * (x - 1) * 0.15), note: both(line(PH, nameH), line(PA, nameA)) }; }
    if (grp === 'combo') { const ou = (side.split('_')[1] === 'over') ? 1 : -1; return { d: sd(ou * (openAvg - 1) * 0.15), note: both(line(PH, nameH), line(PA, nameA)) }; }
    return { d: 0, note: both(line(PH, nameH), line(PA, nameA)) };   // הנדיקאפ, כפולה ותוצאה: רק הסבר על אופי הקבוצות
  }
  const vol = { sh: ['shVol', 'shAllow'], sot: ['sotVol', 'sotAllow'], c: ['cVol', 'cAllow'] }[stat]; if (!vol || !dir) return { d: 0, note: '' };
  const [V, A] = vol;
  if (grp === 'total') { const x = (PH[V] * PA[A] + PA[V] * PH[A]) / 2; return { d: sd(dir * (x - 1) * 0.15), note: both(line(PH, nameH), line(PA, nameA)) }; }
  if (grp === 'home' || grp === 'away') { const T = grp === 'home' ? PH : PA, O = grp === 'home' ? PA : PH, x = T[V] * O[A]; return { d: sd(dir * (x - 1) * 0.15), note: line(T, grp === 'home' ? nameH : nameA) }; }
  return { d: 0, note: '' };
}
