// הגדרות כלליות של המערכת
// מזהי הליגות לפי API-Football (https://www.api-football.com)
export const LEAGUES = [
  { id: 2,   he: 'ליגת האלופות',        country: 'אירופה' },
  { id: 3,   he: 'הליגה האירופית',      country: 'אירופה' },
  { id: 848, he: 'קונפרנס ליג',         country: 'אירופה' },
  { id: 5,   he: 'ליגת האומות',         country: 'נבחרות אירופה' },
  { id: 45,  he: 'גביע ה-FA',           country: 'אנגליה' },
  { id: 48,  he: 'גביע הליגה האנגלי',   country: 'אנגליה' },
  { id: 137, he: 'קופה איטליה',         country: 'איטליה' },
  { id: 143, he: 'גביע המלך (קופה דל ריי)', country: 'ספרד' },
  { id: 81,  he: 'גביע גרמניה',         country: 'גרמניה' },
  { id: 384, he: 'גביע המדינה',         country: 'ישראל' },
  { id: 39,  he: 'פרמייר ליג',          country: 'אנגליה' },
  { id: 40,  he: 'צ׳מפיונשיפ',          country: 'אנגליה' },
  { id: 140, he: 'לה ליגה',             country: 'ספרד' },
  { id: 135, he: 'סרייה A',             country: 'איטליה' },
  { id: 78,  he: 'בונדסליגה',           country: 'גרמניה' },
  { id: 79,  he: 'בונדסליגה 2',         country: 'גרמניה' },
  { id: 383, he: 'ליגת העל',            country: 'ישראל' },
  { id: 382, he: 'ליגה לאומית',         country: 'ישראל' },
  { id: 61,  he: 'ליג 1',               country: 'צרפת' },
  { id: 88,  he: 'ארדיביזי',            country: 'הולנד' },
  { id: 94,  he: 'ליגה פורטוגל',        country: 'פורטוגל' },
];
// מפעלים של הכרעה: אירופה וגביעים מקומיים. הקבוצות מזוהות לפי הליגה שלהן, ומנתחים בין-ליגות (כמו באירופה)
export const EURO = [2, 3, 848, 45, 48, 137, 143, 81, 384];
export const ISRAEL = [383, 382];

export const LEAGUE_IDS = new Set(LEAGUES.map(l => l.id));
export const BET365_ID = 8;
export const TIMEZONE = 'Asia/Jerusalem';

// עוצמת ליגה (בערך לפי מקדמי אופ״א) — לניתוח משחקים בין ליגות במסגרות האירופיות
export const LEAGUE_COEF = {
  39: 1.0, 140: 0.97, 135: 0.95, 78: 0.95, 61: 0.86, 94: 0.78, 88: 0.78,
  144: 0.72, 203: 0.70, 197: 0.62, 179: 0.62, 40: 0.72, 79: 0.68, 383: 0.52, 382: 0.40,
};
export const LEAGUE_NAME_HE = {
  39: 'הפרמייר ליג', 140: 'לה ליגה', 135: 'הסרייה A', 78: 'הבונדסליגה', 61: 'ליג 1', 94: 'הליגה הפורטוגלית', 88: 'הארדיביזי',
  144: 'הליגה הבלגית', 203: 'הליגה הטורקית', 197: 'הליגה היוונית', 179: 'הליגה הסקוטית', 40: 'הצ׳מפיונשיפ', 79: 'הבונדסליגה 2', 383: 'ליגת העל', 382: 'הליגה הלאומית',
};

// דרבי ויריבויות מסורתיות (שמות כמו ב-football-data / API-Football; ההשוואה גמישה)
export const DERBIES = [
  ['Arsenal', 'Tottenham', 'דרבי צפון לונדון'], ['Liverpool', 'Everton', 'דרבי מרסיסייד'], ['Man United', 'Man City', 'דרבי מנצ׳סטר'],
  ['Man United', 'Liverpool', 'הקלאסיקו האנגלי'], ['Chelsea', 'Tottenham', 'דרבי לונדון'], ['Arsenal', 'Chelsea', 'דרבי לונדון'],
  ['Newcastle', 'Sunderland', 'דרבי טיין-וור'], ['Aston Villa', 'Birmingham', 'דרבי השני הערים'], ['West Ham', 'Millwall', 'דרבי מזרח לונדון'],
  ['Leeds', 'Man United', 'יריבות הוורדים'], ['Nott\'m Forest', 'Derby', 'דרבי איסט מידלנדס'], ['Sheffield United', 'Sheffield Weds', 'דרבי שפילד'],
  ['Real Madrid', 'Barcelona', 'אל קלאסיקו'], ['Real Madrid', 'Ath Madrid', 'דרבי מדריד'], ['Barcelona', 'Espanol', 'דרבי ברצלונה'],
  ['Sevilla', 'Betis', 'דרבי סביליה'], ['Ath Bilbao', 'Sociedad', 'דרבי הבאסקים'], ['Valencia', 'Villarreal', 'דרבי ולנסיה'],
  ['Inter', 'Milan', 'דרבי מילאנו'], ['Roma', 'Lazio', 'דרבי רומא'], ['Juventus', 'Torino', 'דרבי טורינו'], ['Juventus', 'Inter', 'דרבי איטליה'],
  ['Genoa', 'Sampdoria', 'דרבי ג׳נובה'], ['Napoli', 'Roma', 'דרבי השמש'],
  ['Dortmund', 'Schalke 04', 'דרבי הרוהר'], ['Bayern Munich', 'Dortmund', 'דר קלאסיקר'], ['Hamburg', 'Werder Bremen', 'דרבי הצפון'],
  ['FC Koln', "M'gladbach", 'דרבי הריין'], ['Hertha', 'Union Berlin', 'דרבי ברלין'], ['St Pauli', 'Hamburg', 'דרבי המבורג'],
  ['Paris SG', 'Marseille', 'לה קלאסיק'], ['Lyon', 'St Etienne', 'דרבי הרון'], ['Nice', 'Monaco', 'דרבי הריביירה'], ['Lens', 'Lille', 'דרבי הצפון'],
  ['Ajax', 'Feyenoord', 'דה קלאסיקר'], ['Ajax', 'PSV Eindhoven', 'יריבות הצמרת'], ['PSV Eindhoven', 'Feyenoord', 'יריבות הצמרת'],
  ['Benfica', 'Sp Lisbon', 'דרבי ליסבון'], ['Porto', 'Benfica', 'או קלאסיקו'], ['Porto', 'Sp Lisbon', 'יריבות הגדולות'], ['Sp Braga', 'Guimaraes', 'דרבי מיניו'],
  ['Celtic', 'Rangers', 'האולד פירם'], ['Galatasaray', 'Fenerbahce', 'הדרבי הבין-יבשתי'], ['Olympiakos', 'Panathinaikos', 'דרבי הנצחי'],
  ['Club Brugge', 'Anderlecht', 'הקלאסיקו הבלגי'],
  ['Maccabi Tel Aviv', 'Hapoel Tel Aviv', 'דרבי תל אביב'], ['Maccabi Haifa', 'Hapoel Haifa', 'דרבי חיפה'], ['Maccabi Haifa', 'Maccabi Tel Aviv', 'הקלאסיקו הישראלי'],
  ['Beitar Jerusalem', 'Hapoel Jerusalem', 'דרבי ירושלים'], ['Beitar Jerusalem', 'Maccabi Tel Aviv', 'יריבות היסטורית'], ['Hapoel Beer Sheva', 'Maccabi Tel Aviv', 'יריבות הצמרת'],
  ['Hapoel Petah Tikva', 'Maccabi Petah Tikva', 'דרבי פתח תקווה'],
];

// תקציב קריאות ל-API בהרצה אחת (התוכנית החינמית = 100 ביום)
export const MAX_CALLS = Number(process.env.MAX_CALLS || 90);
// מגבלת קריאות לדקה (בתוכנית החינמית 10 לדקה)
export const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 10);
