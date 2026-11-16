// סגנונות משחק ופונקציות עזר משותפות (נפרד כדי למנוע תלות מעגלית בין model ל-knowledge)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const ARCH = {
  dominant: { he: 'שולטת בכדור', short: 'מנהלת את המשחק, יוצרת הרבה ומרשה מעט' },
  strong:   { he: 'חזקה משני הצדדים', short: 'כובשת הרבה וסופגת מעט' },
  compact:  { he: 'מתבצרת וסגורה', short: 'קשה לשבור, מרשה מעט בעיטות ומשחקת על טעות' },
  counter:  { he: 'משחקת מעברים', short: 'מוותרת על הכדור ומחכה למתפרצות' },
  open:     { he: 'משחקת פתוח', short: 'הרבה שערים בשני הצדדים' },
  weak:     { he: 'חלשה משני הצדדים', short: 'מתקשה לכבוש ומרשה הרבה' },
  balanced: { he: 'מאוזנת', short: 'בלי קיצוניות בסגנון' },
};

export function classify(rel, pos) {
  const { shF, shA, gF, gA } = rel;
  if ((pos >= 54 && shF >= 1.08) || (pos >= 56 && shF >= 0.98)) return 'dominant';
  if (gF >= 1.2 && gA <= 0.8) return 'strong';
  if (shA <= 0.93 && gA <= 0.95 && pos <= 50) return 'compact';
  if (pos <= 47 && gF >= 0.95) return 'counter';
  if (gF + gA >= 2.25) return 'open';
  if (gF <= 0.85 && gA >= 1.1) return 'weak';
  return 'balanced';
}

// תיאור הפגישה בין שני סגנונות
export function archMatchup(a, b, An, Bn) {
  const k = [a, b].sort().join('+');
  const dom = a === 'dominant' ? An : b === 'dominant' ? Bn : null, oth = dom === An ? Bn : An;
  const L = [];
  if (k === 'compact+dominant') L.push(`${dom} רוצה את הכדור ו-${oth} תתבצר: צפויים הרבה קרנות ובעיטות ל${dom}, והשאלה אם היא תפרוץ.`);
  else if (k === 'counter+dominant') L.push(`${dom} תחזיק בכדור ו-${oth} תחכה למתפרצות: משחק של שליטה מול מעברים, וכל טעות בהחזקה עולה בשער.`);
  else if (k === 'dominant+dominant') L.push('שתי הקבוצות רוצות את הכדור, ולכן צפוי קרב על השליטה.');
  else if (k === 'compact+compact') L.push('שתי הקבוצות זהירות וסגורות: צפוי משחק צפוף עם מעט מצבים ופחות שערים.');
  else if (k === 'open+open') L.push('שתי הקבוצות משחקות פתוח וסופגות: צפוי משחק עם שערים משני הצדדים.');
  else if (k === 'counter+counter') L.push('אף אחת לא מתאמצת לקחת את הכדור, ולכן המשחק עלול להיות איטי עד שמישהי תיפתח.');
  else if (k === 'compact+open') L.push('קבוצה פתוחה מול קבוצה סגורה: הסגנון של הסגורה עשוי לצמצם את מספר השערים.');
  else if (k === 'strong+weak') L.push(`${a === 'strong' ? An : Bn} חזקה משני הצדדים ומולה ${a === 'strong' ? Bn : An}, שמתקשה: על הנייר משחק חד-צדדי.`);
  else if (k === 'dominant+strong' || k === 'strong+strong') L.push('מפגש של שתי קבוצות חזקות: צפוי משחק צמוד ברמה גבוהה.');
  else if (k === 'dominant+weak') L.push(`${dom} שולטת מול קבוצה שמתקשה גם להגן וגם לכבוש: על הנייר משחק חד-צדדי.`);
  return L;
}


export function learnFactor(e) {
  if (!e || e.n < 5) return 1;
  return 1 + clamp((e.r - 1) * 0.5 * Math.min(1, e.n / 12), -0.1, 0.1);
}
