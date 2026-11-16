// מקור חינמי: football-data.co.uk — כל משחקי העונה עם קרנות, בעיטות, xG ויחסי Bet365 (1X2 / שערים)
// מכסה 9 ליגות. אין בו את ליגות ישראל ואין יחסי קרנות.
const BASE = 'https://www.football-data.co.uk';
export const FD_DIVS = { E0: 39, E1: 40, SP1: 140, I1: 135, D1: 78, D2: 79, F1: 61, N1: 88, P1: 94, B1: 144, T1: 203, G1: 197, SC0: 179 };
import { LEAGUE_IDS } from './config.mjs';

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const head = split(lines[0]);
  return lines.slice(1).map(l => { const v = split(l); const o = {}; head.forEach((h, i) => o[h] = v[i]); return o; });
}

async function getCsv(path) {
  const r = await fetch(BASE + path, { redirect: 'follow' });
  if (!r.ok) throw new Error(`football-data ${r.status} ${path}`);
  return parseCsv(await r.text());
}

// השעות בקבצים הן לפי שעון בריטניה
function londonTs(date, time) {
  const [d, m, y] = date.split('/').map(Number);
  const [hh, mm] = (time || '15:00').split(':').map(Number);
  const year = y < 100 ? 2000 + y : y;
  const guess = Date.UTC(year, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const lh = +parts.find(p => p.type === 'hour').value, lm = +parts.find(p => p.type === 'minute').value;
  let off = (lh * 60 + lm) - (hh * 60 + mm); if (off > 720) off -= 1440; if (off < -720) off += 1440;
  return Math.round((guess - off * 60000) / 1000);
}

const num = v => (v === undefined || v === '' ? null : Number(v));
const cards = (y, r) => (num(y) == null ? null : num(y) + (num(r) || 0));
const teamId = (div, name) => `${div}:${name}`;
const fixId = (div, date, home) => `${div}|${date}|${home}`;
const ilDate = ts => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ts * 1000));

export function seasonCode(today) {
  const [y, m] = today.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return { start, code: String(start % 100).padStart(2, '0') + String((start + 1) % 100).padStart(2, '0') };
}

// טבלה מחושבת מתוצאות (מיקום, נקודות, כושר)
export function standingsFromRecords(records) {
  const tbl = {};
  for (const m of [...records].sort((a, b) => a.ts - b.ts)) {
    if (m.g?.[0] == null) continue;
    for (const [t, gf, ga] of [[m.h, m.g[0], m.g[1]], [m.a, m.g[1], m.g[0]]]) {
      const r = tbl[t] ||= { points: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, played: 0, form: '' };
      r.played++; r.gd += gf - ga; r.gf += gf; r.ga += ga; if (gf > ga) r.w++; else if (gf === ga) r.d++; else r.l++;
      const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
      r.points += res === 'W' ? 3 : res === 'D' ? 1 : 0; r.form += res;
    }
  }
  const rows = Object.entries(tbl).sort((x, y) => y[1].points - x[1].points || y[1].gd - x[1].gd || y[1].gf - x[1].gf);
  const map = {};
  rows.forEach(([id, r], i) => map[id] = { rank: i + 1, points: r.points, played: r.played, form: r.form.slice(-5), w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga });
  return { map, n: rows.length };
}

const bet = (name, values) => ({ name, values: values.filter(v => v.odd > 1).map(v => ({ value: v.value, odd: String(v.odd) })) });

function toRecord(div, lg, season, r) {
  return {
    id: fixId(div, r.Date, r.HomeTeam), ts: londonTs(r.Date, r.Time), lg, season, h: teamId(div, r.HomeTeam), a: teamId(div, r.AwayTeam),
    g: [num(r.FTHG), num(r.FTAG)], ht: [num(r.HTHG), num(r.HTAG)], ref: r.Referee || null,
    s: { h: { c: num(r.HC), sh: num(r.HS), sot: num(r.HST), xg: num(r.HxG), f: num(r.HF), k: cards(r.HY, r.HR), pos: null },
         a: { c: num(r.AC), sh: num(r.AS), sot: num(r.AST), xg: num(r.AxG), f: num(r.AF), k: cards(r.AY, r.AR), pos: null } },
  };
}
const valid = r => r.HomeTeam && r.AwayTeam && r.HC !== undefined && r.HC !== '' && r.FTHG !== '' && r.FTHG !== undefined;

// history: { "2526": { E0: [records...] }, ... } — עונות קודמות נשמרות במטמון ולא נמשכות שוב
export async function gatherFootballData(today, log = () => {}, history = {}) {
  const { start, code } = seasonCode(today);
  const records = [], teams = {}, standings = new Map(), odds = new Map(), dayItems = [];

  for (const [div, lg] of Object.entries(FD_DIVS)) {
    let rows;
    try { rows = await getCsv(`/mmz4281/${code}/${div}.csv`); } catch (e) { log(`לא נמצא קובץ ${div}: ${e.message}`); continue; }
    const recs = [];
    for (const r of rows) {
      if (!valid(r)) continue;
      teams[teamId(div, r.HomeTeam)] = { n: r.HomeTeam, l: null }; teams[teamId(div, r.AwayTeam)] = { n: r.AwayTeam, l: null };
      recs.push(toRecord(div, lg, start, r));
    }
    records.push(...recs);
    standings.set(lg, standingsFromRecords(recs));
    log(`${div}: ${recs.length} משחקים`);
  }

  // שתי עונות קודמות — להיסטוריית מפגשים (דרבי / "כבשה שחורה")
  let histAdded = 0;
  for (const back of [1, 2]) {
    const c = String((start - back) % 100).padStart(2, '0') + String((start - back + 1) % 100).padStart(2, '0');
    history[c] ||= {};
    for (const [div, lg] of Object.entries(FD_DIVS)) {
      if (history[c][div]) continue;
      try {
        const rows = await getCsv(`/mmz4281/${c}/${div}.csv`);
        history[c][div] = rows.filter(valid).map(r => { const rec = toRecord(div, lg, start - back, r); return rec; });
        histAdded++;
      } catch { history[c][div] = []; }
    }
  }
  if (histAdded) log(`נטענו ${histAdded} קבצי היסטוריה (עונות קודמות)`);
  const histRecords = Object.values(history).flatMap(d => Object.values(d).flat());

  // משחקים קרובים + יחסי Bet365 (1X2, מעל/מתחת 2.5)
  const fx = await getCsv('/fixtures.csv');
  for (const r of fx) {
    const lg = FD_DIVS[r.Div];
    if (!lg || !r.HomeTeam || !LEAGUE_IDS.has(lg)) continue;
    const ts = londonTs(r.Date, r.Time);
    if (ilDate(ts) !== today) continue;
    const id = fixId(r.Div, r.Date, r.HomeTeam);
    const h = teamId(r.Div, r.HomeTeam), a = teamId(r.Div, r.AwayTeam);
    teams[h] ||= { n: r.HomeTeam, l: null }; teams[a] ||= { n: r.AwayTeam, l: null };
    dayItems.push({
      fixture: { id, timestamp: ts, status: { short: 'NS' }, venue: {}, referee: r.Referee || null },
      league: { id: lg, season: start, round: '' },
      teams: { home: { id: h, name: r.HomeTeam }, away: { id: a, name: r.AwayTeam } },
    });
    odds.set(id, [
      bet('Match Winner', [{ value: 'Home', odd: num(r.B365H) }, { value: 'Draw', odd: num(r.B365D) }, { value: 'Away', odd: num(r.B365A) }]),
      bet('Goals Over/Under', [{ value: 'Over 2.5', odd: num(r['B365>2.5']) }, { value: 'Under 2.5', odd: num(r['B365<2.5']) }]),
    ]);
  }
  return { records, histRecords, teams, standings, odds, dayItems, history };
}
