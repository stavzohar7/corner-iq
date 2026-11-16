// שמות בעברית מ-365Scores (langId=2): קבוצות ושחקנים. נשמרים ב-data/names-he.json, ונמשכים רק לשמות שחסרים.
// הנתונים הפנימיים (זיהוי קבוצות בין מקורות, התאמת חדשות) נשארים באנגלית; בעברית רק מה שמוצג.
import fs from 'node:fs';
import path from 'node:path';
import { http } from './source-365.mjs';

const BASE = 'https://webws.365scores.com/web';
const Q2 = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const file = root => path.join(root, 'data', 'names-he.json');

// התאמות ידניות בין שמות football-data לבין מזהי 365Scores, לקבוצות שהמתאם האוטומטי לא מזהה
export const MANUAL_FD = { 'SP1:La Coruna': 148, 'SP1:Ath Bilbao': 144, 'F1:Paris SG': 480, 'B1:St Truiden': 1185, 'B1:RAAL La Louviere': 21273, 'G1:Levadeiakos': 1034 };
export function loadNames(root) {
  try { const j = JSON.parse(fs.readFileSync(file(root), 'utf8')); return { teams: j.teams || {}, players: j.players || {}, fd: { ...MANUAL_FD, ...(j.fd || {}) } }; } catch { return { teams: {}, players: {}, fd: { ...MANUAL_FD } }; }
}
export function saveNames(root, store) { fs.mkdirSync(path.dirname(file(root)), { recursive: true }); fs.writeFileSync(file(root), JSON.stringify(store)); }

const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
export async function ensureTeams(store, ids) {
  const need = [...new Set(ids.map(String))].filter(i => /^\d+$/.test(i) && !store.teams[i]);
  for (const c of chunks(need, 40)) {
    const j = await http(`${BASE}/competitors/?${Q2}&competitors=${c.join(',')}`);
    for (const t of (j && j.competitors) || []) if (t.name) store.teams[String(t.id)] = t.name;
  }
  return need.length;
}
export async function ensurePlayers(store, ids) {
  const need = [...new Set(ids.map(String))].filter(i => /^\d+$/.test(i) && !store.players[i]);
  for (const c of chunks(need, 60)) {
    const j = await http(`${BASE}/athletes/?${Q2}&athletes=${c.join(',')}`);
    for (const a of (j && j.athletes) || []) if (a.name) store.players[String(a.id)] = a.name;
  }
  return need.length;
}
// שם קבוצה בעברית לפי המפתח שלנו (מזהה 365 או מזהה football-data), או null
export const heTeam = (store, key) => store.teams[String(store.fd[key] || key)] || null;
// עותק של מידע הקבוצות עם שמות בעברית (לתצוגה)
export function heInfo(store, base) {
  const out = {};
  for (const [k, v] of Object.entries(base)) { const n = heTeam(store, k); out[k] = n ? { ...v, n } : v; }
  return out;
}
