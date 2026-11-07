// לקוח ל-API-Football עם הגבלת קצב ותקציב קריאות
import { MAX_CALLS, RATE_PER_MIN } from './config.mjs';

const BASE = process.env.API_BASE || 'https://v3.football.api-sports.io';

export class BudgetExceeded extends Error {}

export function createClient({ mock = null } = {}) {
  let calls = 0;
  let lastCall = 0;
  let remainingToday = Infinity;
  const gap = Math.ceil(60000 / RATE_PER_MIN) + 150;

  async function get(path, params = {}) {
    if (calls >= MAX_CALLS || remainingToday <= 0) throw new BudgetExceeded('נגמר תקציב הקריאות');
    calls++;
    if (mock) return mock(path, params);

    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('חסר משתנה סביבה API_FOOTBALL_KEY');
    const wait = lastCall + gap - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();

    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { 'x-apisports-key': key } });
    const rem = res.headers.get('x-ratelimit-requests-remaining');
    if (rem != null) remainingToday = Number(rem);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    const body = await res.json();
    const errs = body.errors && (Array.isArray(body.errors) ? body.errors : Object.values(body.errors));
    if (errs && errs.length) {
      const msg = errs.join(' | ');
      if (/limit|requests/i.test(msg)) { remainingToday = 0; throw new BudgetExceeded(msg); }
      throw new Error(`API: ${msg} (${path} ${JSON.stringify(params)})`);
    }
    return body;
  }

  // מושך את כל העמודים של תשובה
  async function getAll(path, params = {}) {
    const first = await get(path, params);
    let out = first.response || [];
    const total = first.paging?.total || 1;
    for (let p = 2; p <= total; p++) {
      const b = await get(path, { ...params, page: p });
      out = out.concat(b.response || []);
    }
    return out;
  }

  return { get, getAll, get calls() { return calls; } };
}
