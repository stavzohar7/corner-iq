// חיסורים והרכבים צפויים מ-RotoWire (דפים ציבוריים: Daily Lineups ו-Injury News של NBA ושל יורוליג).
// הדף המלא של "Injury Report" דורש הרשמה, ולכן לא משתמשים בו. בקשות מעטות, עם מטמון, ובלי לעקוף שום חסימה.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; personal football-analysis script)';
const PAGES = {
  nba: { lineups: 'https://www.rotowire.com/basketball/nba-lineups.php', news: 'https://www.rotowire.com/basketball/news.php' },
  euro: { lineups: 'https://www.rotowire.com/euro/daily-lineups.php', news: 'https://www.rotowire.com/euro/news.php?view=injuries' },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#039;|&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
export const normName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const STATUS = { ofs: 'out', out: 'out', ques: 'questionable', gtd: 'questionable', doub: 'doubtful', prob: 'probable', susp: 'out', 'day-to-day': 'questionable' };
const statusOf = t => { const k = String(t || '').toLowerCase().replace(/[^a-z-]/g, ''); return STATUS[k] || (k.startsWith('ques') ? 'questionable' : k.startsWith('doub') ? 'doubtful' : k.startsWith('prob') ? 'probable' : k.startsWith('out') ? 'out' : k || null); };

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.text();
}

// הרכבים צפויים לכל משחק: חמישייה צפויה + רשימת "עלולים לא לשחק" עם סטטוס
export function parseLineups(html) {
  const games = [];
  const parts = html.split('class="lineup is-').slice(1);
  for (const blk of parts) {
    const abbr = [...blk.matchAll(/class="lineup__abbr">([^<]*)</g)].map(m => clean(m[1]));
    const names = [...blk.matchAll(/class="lineup__mteam[^"]*"[^>]*>\s*([^<]*?)\s*(?:<span class="lineup__wl">|<\/a>)/g)].map(m => clean(m[1]));
    const time = clean((blk.match(/class="lineup__time">([\s\S]*?)<\/div>/) || [])[1]);
    const side = {};
    for (const [key, cls] of [['vis', 'is-visit'], ['home', 'is-home']]) {
      const ul = blk.match(new RegExp('<ul class="lineup__list ' + cls + '">([\\s\\S]*?)</ul>'));
      if (!ul) continue;
      const lis = ul[1].split('<li');
      let may = false; const starters = [], doubt = [];
      for (const li of lis) {
        if (/lineup__title/.test(li)) { may = true; continue; }
        const m = li.match(/class="lineup__player([^"]*)"[^>]*title="([^"]*)"[\s\S]*?<a title="([^"]*)"/);
        if (!m) continue;
        const pct = (m[1].match(/is-pct-play-(\d+)/) || [])[1], inj = (li.match(/class="lineup__inj">([^<]*)</) || [])[1];
        const p = { name: clean(m[3]), pct: pct != null ? +pct : null, status: inj ? statusOf(inj) : null, raw: inj ? clean(inj) : null };
        if (may) doubt.push(p); else starters.push(p);
      }
      side[key] = { starters, may: doubt };
    }
    if (abbr.length >= 2) games.push({ visT: { abbr: abbr[0], nick: names[0] || abbr[0] }, homeT: { abbr: abbr[1], nick: names[1] || abbr[1] }, time, ...side });
  }
  return games;
}

// חדשות פציעה אחרונות לכל שחקן (הידיעה האחרונה בלבד), עד 10 ימים אחורה
export function parseNews(html, today) {
  const out = new Map(), heads = [...html.matchAll(/<div class="news-update(\s[^"]*)?">/g)];
  const parts = heads.map((h, i) => ({ flags: h[1] || '', blk: html.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : h.index + 6000) }));
  const limit = new Date(today + 'T12:00:00Z').getTime() - 10 * 86400e3;
  for (const { flags, blk } of parts) {
    const name = clean((blk.match(/news-update__player-link[^>]*>([^<]*)</) || [])[1]);
    if (!name || out.has(normName(name))) continue;
    const injured = /is-injured/.test(flags) || /news-update__inj/.test(blk);
    if (!injured) continue;
    const headline = clean((blk.match(/news-update__headline[^>]*>([^<]*)</) || [])[1]), text = clean((blk.match(/class="news-update__news">([\s\S]*?)<\/div>/) || [])[1]);
    const inj = clean((blk.match(/news-update__inj">([^<]*)</) || [])[1]), team = clean((blk.match(/<\/b>([^<]*)<\/div>/) || [])[1]);
    const ts = Date.parse((blk.match(/news-update__timestamp">([^<]*)</) || [])[1] + ' 12:00 UTC');
    if (!Number.isNaN(ts) && ts < limit) continue;
    const all = (headline + ' ' + text).toLowerCase();
    let status = /\b(returns?|returned|cleared|available|will play|active|upgraded|back in|probable)\b/.test(all) && !/\bout\b|ruled out|will not play/.test(all) ? 'probable' : /\bdoubtful\b/.test(all) ? 'doubtful' : /\bquestionable|game-time|day-to-day|gtd\b/.test(all) ? 'questionable' : /\bout\b|ruled out|will not play|not on the roster|sidelined|miss|surgery|remains out/.test(all) ? 'out' : 'questionable';
    out.set(normName(name), { name, team, injury: inj || null, status, headline, text: text.slice(0, 180), date: Number.isNaN(ts) ? null : new Date(ts).toISOString().slice(0, 10) });
  }
  return out;
}

// מביא את כל המקורות (עם מטמון של 60 דקות). מחזיר { nba: {games, news: [...]}, euro: {...} }
export async function fetchRotowire({ root, today, log = () => {}, maxAgeMin = 60 }) {
  const file = path.join(root, 'data', 'cache', 'rotowire.json');
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.at && Date.now() - c.at < maxAgeMin * 60e3 && c.date === today) return c; } catch { /* אין מטמון */ }
  const out = { at: Date.now(), date: today, nba: { games: [], news: [] }, euro: { games: [], news: [] } };
  for (const lg of ['nba', 'euro']) {
    try { out[lg].games = parseLineups(await get(PAGES[lg].lineups)); await sleep(1500); } catch (e) { log('RotoWire הרכבים ' + lg + ': ' + e.message); }
    try { out[lg].news = [...parseNews(await get(PAGES[lg].news), today).values()]; await sleep(1500); } catch (e) { log('RotoWire חדשות ' + lg + ': ' + e.message); }
  }
  log(`RotoWire: NBA ${out.nba.games.length} משחקים ו-${out.nba.news.length} ידיעות פציעה, יורוליג ${out.euro.games.length} משחקים ו-${out.euro.news.length} ידיעות`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out));
  return out;
}
