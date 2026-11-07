// הגדרות כלליות של המערכת
// מזהי הליגות לפי API-Football (https://www.api-football.com)
export const LEAGUES = [
  { id: 39,  he: 'פרמייר ליג',          country: 'אנגליה',   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 40,  he: 'צ׳מפיונשיפ',          country: 'אנגליה',   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, he: 'לה ליגה',             country: 'ספרד',     flag: '🇪🇸' },
  { id: 135, he: 'סרייה A',             country: 'איטליה',   flag: '🇮🇹' },
  { id: 78,  he: 'בונדסליגה',           country: 'גרמניה',   flag: '🇩🇪' },
  { id: 79,  he: 'בונדסליגה 2',         country: 'גרמניה',   flag: '🇩🇪' },
  { id: 383, he: 'ליגת העל',            country: 'ישראל',    flag: '🇮🇱' },
  { id: 382, he: 'ליגה לאומית',         country: 'ישראל',    flag: '🇮🇱' },
  { id: 61,  he: 'ליג 1',               country: 'צרפת',     flag: '🇫🇷' },
  { id: 88,  he: 'ארדיביזי',            country: 'הולנד',    flag: '🇳🇱' },
  { id: 94,  he: 'ליגה פורטוגל',        country: 'פורטוגל',  flag: '🇵🇹' },
];

export const LEAGUE_IDS = new Set(LEAGUES.map(l => l.id));
export const BET365_ID = 8;
export const TIMEZONE = 'Asia/Jerusalem';

// תקציב קריאות ל-API בהרצה אחת (התוכנית החינמית = 100 ביום)
export const MAX_CALLS = Number(process.env.MAX_CALLS || 95);
// מגבלת קריאות לדקה (בתוכנית החינמית 10 לדקה)
export const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 10);
