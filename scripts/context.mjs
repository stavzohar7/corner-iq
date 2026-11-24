// הקשר למשחק: זיהוי קבוצות בין מקורות, היסטוריית מפגשים, דרבי ו"כבשה שחורה"
import { DERBIES } from './config.mjs';

const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ss', 'ssc', 'us', 'sv', 'fk', 'cd', 'ud', 'rc', 'rcd', 'ca', 'club', 'de', 'the', 'fsv', 'tsg', 'vfl', 'vfb', 'sk', 'nk', 'if', 'bk', 'ifk', 'calcio', 'ssd', 'and', 'ho', 'bsc', 'kv', 'krc', 'rsc', 'cs', 'ksv', 'sd', 'fb', 'ik', 'bv', 'sl', 'ec', 'gd']);
export function norm(s) {
  return String(s || '').replace(/ı/g, 'i').replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' ').replace(/[.'’`\-_/]/g, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(t => t && !STOP.has(t) && !/^\d+$/.test(t)).join(' ');
}

// שמות שהשוואה אוטומטית לא תתפוס (API-Football → football-data)
const ALIAS = {
  'inter milan': 'inter', 'olympique de marseille': 'marseille', 'karlsruher': 'karlsruhe',
  'kasimpasa': 'kasimpasa', 'hamburger sv': 'hamburg', 'bayern munchen': 'bayern munich', 'sheffield utd': 'sheffield united', 'fortuna sittard': 'for sittard', 'fortuna s': 'for sittard', 'manchester utd': 'man united', 'sparta r': 'sparta rotterdam',
  'amed': 'amedspor', 'goztepe': 'goztep', 'basaksehir': 'buyuksehyr', 'istanbul basaksehir': 'buyuksehyr', 'oh leuven': 'oud heverlee leuven', 'athletic club': 'ath bilbao',
  'paris saint germain': 'paris sg', 'paris saint germain fc': 'paris sg', 'psg': 'paris sg', 'borac banja luka': 'borac banjaluka', 'univ craiova': 'cs universitatea craiova', 'fc nordsjalland': 'fc nordsjælland', 'heart of midlothian': 'hearts', 'sint truidense': 'st truiden', 'sint truiden': 'st truiden', 'stvv': 'st truiden', 'sparta prague': 'sparta praha', 'slavia prague': 'slavia praha', 'sabah baku': 'sabah', 'inter m': 'inter milan', 'brugge': 'club brugge', 'viking fc': 'viking',
  'manchester city': 'man city', 'manchester united': 'man united', 'nottingham forest': 'nott m forest', 'wolverhampton wanderers': 'wolves',
  'brighton hove albion': 'brighton', 'sheffield wednesday': 'sheffield weds', 'west bromwich albion': 'west brom', 'queens park rangers': 'qpr',
  'atletico madrid': 'ath madrid', 'athletic club': 'ath bilbao', 'real sociedad': 'sociedad', 'celta vigo': 'celta', 'rayo vallecano': 'vallecano',
  'real betis': 'betis', 'espanyol': 'espanol', 'deportivo alaves': 'alaves', 'ac milan': 'milan', 'hellas verona': 'verona', 'internazionale': 'inter',
  'borussia dortmund': 'dortmund', 'borussia monchengladbach': 'm gladbach', 'bayer leverkusen': 'leverkusen', 'eintracht frankfurt': 'ein frankfurt',
  'vfb stuttgart': 'stuttgart', 'hamburger sv': 'hamburg', 'st pauli': 'st pauli', 'fortuna dusseldorf': 'fortuna dusseldorf', 'hertha berlin': 'hertha',
  'paris saint germain': 'paris sg', 'olympique marseille': 'marseille', 'olympique lyonnais': 'lyon', 'as monaco': 'monaco', 'stade rennais': 'rennes',
  'stade brestois 29': 'brest', 'saint etienne': 'st etienne', 'psv': 'psv eindhoven', 'psv eindhoven': 'psv eindhoven', 'fc twente': 'twente',
  'sporting cp': 'sp lisbon', 'sporting lisbon': 'sp lisbon', 'porto': 'porto', 'sporting braga': 'sp braga', 'sc braga': 'sp braga', 'vitoria guimaraes': 'guimaraes',
  'club brugge': 'club brugge', 'royal antwerp': 'antwerp', 'union saint gilloise': 'st gilloise', 'union st gilloise': 'st gilloise',
  'olympiacos': 'olympiakos', 'olympiakos piraeus': 'olympiakos', 'paok': 'paok', 'aek athens': 'aek', 'panathinaikos': 'panathinaikos',
  'galatasaray': 'galatasaray', 'fenerbahce': 'fenerbahce', 'besiktas': 'besiktas', 'celtic': 'celtic', 'rangers': 'rangers',
  'wolverhampton wandearers': 'wolves', 'swansea city': 'swansea', 'west bromwich': 'west brom', 'west ham utd': 'west ham', 'wolverhampton wanderers': 'wolves',
  'maccabi tel aviv': 'maccabi tel aviv', 'hapoel beer sheva': 'hapoel beer sheva', 'maccabi haifa': 'maccabi haifa',
};

const ALIAS_N = Object.fromEntries(Object.entries(ALIAS).map(([k, v]) => [norm(k), norm(v)]));
// בונה אינדקס מכל הקבוצות הידועות (מזהה → שם) ומאפשר לזהות שם מ-API אחר
export function buildResolver(teamsById) {
  const entries = Object.entries(teamsById).map(([id, t]) => ({ id, n: norm(t.n), tok: new Set(norm(t.n).split(' ').filter(Boolean)) }));
  const byNorm = new Map(); for (const e of entries) if (!byNorm.has(e.n)) byNorm.set(e.n, e.id);   // בהתנגשות שמות (CSKA Sofia / CSKA 1948 Sofia) הראשון מנצח
  const cache = new Map();
  return function resolve(name) {
    if (cache.has(name)) return cache.get(name);
    const n = norm(name);
    let hit = byNorm.get(n) || byNorm.get(ALIAS_N[n] || '') || null;
    if (!hit && n) {
      const tk = new Set(n.split(' '));
      const cand = entries.filter(e => e.tok.size && (subset(e.tok, tk) || subset(tk, e.tok)) && Math.min(e.tok.size, tk.size) >= 1 && (e.tok.size > 1 || tk.size > 1 || e.n === n));
      if (cand.length === 1) hit = cand[0].id;
      else if (cand.length > 1) { // הכי קרוב באורך
        cand.sort((a, b) => Math.abs(a.tok.size - tk.size) - Math.abs(b.tok.size - tk.size));
        if (Math.abs(cand[0].tok.size - tk.size) < Math.abs(cand[1].tok.size - tk.size)) hit = cand[0].id;
      }
    }
    if (!hit && n) { // התאמת קידומת (למשל Karlsruher ↔ Karlsruhe): כל מילה בצד אחד מתאימה למילה בצד השני
      const tk = [...new Set(n.split(' '))];
      const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));
      const cand = entries.filter(e => e.tok.size && [...e.tok].every(t => tk.some(u => same(t, u))) && tk.every(u => [...e.tok].some(t => same(t, u))));
      if (cand.length === 1) hit = cand[0].id;
    }
    cache.set(name, hit);
    return hit;
  };
}
const subset = (a, b) => { for (const x of a) if (!b.has(x)) return false; return true; };

// ---------- דרבי ----------
export function derbyOf(nameH, nameA) {
  const h = norm(nameH), a = norm(nameA);
  const same = (x, y) => { const nx = norm(x); return nx === y || (nx.length > 3 && (y.includes(nx) || nx.includes(y))); };
  for (const [x, y, label] of DERBIES) if ((same(x, h) && same(y, a)) || (same(x, a) && same(y, h))) return label;
  return null;
}

// ---------- היסטוריית מפגשים ו"כבשה שחורה" ----------
const pts = (gf, ga) => gf > ga ? 3 : gf === ga ? 1 : 0;

// meetings: כל המפגשים בין שתי קבוצות (3 עונות), מהחדש לישן
export function meetingsOf(allRecords, hId, aId) {
  return allRecords.filter(m => (m.h === hId && m.a === aId) || (m.h === aId && m.a === hId))
    .filter(m => m.g?.[0] != null).sort((x, y) => y.ts - x.ts);
}

// ppg כללי של קבוצה (בכל המשחקים שבידינו) — בסיס להשוואה
function ppgOf(allRecords, id) {
  let p = 0, n = 0;
  for (const m of allRecords) {
    if (m.g?.[0] == null) continue;
    if (m.h === id) { p += pts(m.g[0], m.g[1]); n++; } else if (m.a === id) { p += pts(m.g[1], m.g[0]); n++; }
  }
  return n ? { ppg: p / n, n } : { ppg: 1.35, n: 0 };
}

export function rivalryOf(allRecords, hId, aId, nameH, nameA) {
  const ms = meetingsOf(allRecords, hId, aId);
  const derby = derbyOf(nameH, nameA);
  const orient = (m, st) => m.h === hId ? [m.s?.h?.[st] ?? null, m.s?.a?.[st] ?? null] : [m.s?.a?.[st] ?? null, m.s?.h?.[st] ?? null];
  const out = { derby, n: ms.length, meetings: ms.slice(0, 6).map(m => ({ ts: m.ts, h: m.h === hId ? 'H' : 'A', g: m.h === hId ? m.g : [m.g[1], m.g[0]], c: orient(m, 'c'), sh: orient(m, 'sh'), sot: orient(m, 'sot'), f: orient(m, 'f'), k: orient(m, 'k') })), bogey: null, avg: null, rec: null };
  let w = 0, d = 0, l = 0;
  for (const m of ms) { const gf = m.h === hId ? m.g[0] : m.g[1], ga = m.h === hId ? m.g[1] : m.g[0]; if (gf > ga) w++; else if (gf === ga) d++; else l++; }
  out.rec = { w, d, l };
  if (!ms.length) return out;
  // ממוצעי המפגשים (כל המדדים הזמינים)
  const avgOf = f => { const v = ms.map(f).filter(x => x != null); return v.length >= 2 ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null; };
  out.avg = { g: avgOf(m => m.g[0] + m.g[1]), c: avgOf(m => m.s?.h?.c != null ? m.s.h.c + m.s.a.c : null), k: avgOf(m => m.s?.h?.k != null ? m.s.h.k + m.s.a.k : null), sh: avgOf(m => m.s?.h?.sh != null ? m.s.h.sh + m.s.a.sh : null), f: avgOf(m => m.s?.h?.f != null ? m.s.h.f + m.s.a.f : null) };
  // "כבשה שחורה": קבוצה שמשיגה הרבה פחות מהרגיל מול יריבה מסוימת (לפחות 4 מפגשים)
  if (ms.length >= 4) {
    const rec = id => { let w = 0, d = 0, l = 0, p = 0; for (const m of ms) { const gf = m.h === id ? m.g[0] : m.g[1], ga = m.h === id ? m.g[1] : m.g[0]; p += pts(gf, ga); if (gf > ga) w++; else if (gf === ga) d++; else l++; } return { w, d, l, ppg: p / ms.length }; };
    const rH = rec(hId), rA = rec(aId), bH = ppgOf(allRecords, hId), bA = ppgOf(allRecords, aId);
    const dH = rH.ppg - bH.ppg, dA = rA.ppg - bA.ppg;
    for (const [side, r, base, d, id] of [['H', rH, bH, dH, hId], ['A', rA, bA, dA, aId]]) {
      if (d <= -0.7 && r.w <= 1 && base.n >= 8) { out.bogey = { victim: side, w: r.w, d: r.d, l: r.l, n: ms.length, ppg: Math.round(r.ppg * 10) / 10, base: Math.round(base.ppg * 10) / 10 }; break; }
      if (r.l === 0 && r.w >= 3 && ms.length >= 4 && d >= 0.7 && false) { /* שמור להרחבה */ }
    }
  }
  return out;
}
