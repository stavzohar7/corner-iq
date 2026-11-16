// "התיק של הקבוצה": מאמן ותקופת הכהונה שלו, מערכים, שחקני הליבה, כובשים ומבשלים, רוטציה, והסיפור שלה בעברית.
// הנתונים מגיעים מדף המשחק של 365Scores (הרכבים, מערך, דקות, שערים ובישולים), משחק אחרי משחק, ולכן המאמן והמערכים נלמדים מהמשחקים עצמם.
import fs from 'node:fs';
import path from 'node:path';
import { http, pool } from './source-365.mjs';

const BASE = 'https://webws.365scores.com/web';
const Q2 = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const r1 = x => Math.round(x * 10) / 10;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const mins = v => { const m = String(v || '').match(/(\d+)/); return m ? +m[1] : 0; };
const num = v => { const x = parseFloat(String(v == null ? '' : v)); return Number.isFinite(x) ? x : 0; };

export const loreFile = root => path.join(root, 'data', 'cache', 'lore.json');
export const loadLore = root => { try { return JSON.parse(fs.readFileSync(loreFile(root), 'utf8')); } catch { return { games: {}, names: {} }; } };
export const saveLore = (root, s) => { fs.mkdirSync(path.dirname(loreFile(root)), { recursive: true }); fs.writeFileSync(loreFile(root), JSON.stringify(s)); };

// ---------- משיכת הרכבים ----------
async function fetchBox(id) {
  const j = await http(`${BASE}/game/?${Q2}&gameId=${id}`);
  const g = j && j.game; if (!g || !g.homeCompetitor || !g.homeCompetitor.lineups || !g.awayCompetitor.lineups) return null;
  const nm = new Map((g.members || []).map(m => [m.id, m]));
  const names = {}, coach = [], form = [], rows = [];
  [g.homeCompetitor, g.awayCompetitor].forEach((C, idx) => {
    const L = C.lineups, ms = L.members || [];
    form.push(L.formation || null);
    const cm = ms.find(m => m.position && m.position.id === 0 && nm.get(m.id));
    const cw = cm && nm.get(cm.id); coach.push(cw ? [cw.athleteId, cw.name] : null); if (cw) names[cw.athleteId] = cw.name;
    for (const m of ms) {
      if (!m.hasStats || !m.stats || !m.position || m.position.id === 0) continue;
      const st = {}; for (const s of m.stats) st[s.type] = s.value;
      const min = mins(st[30]); if (min <= 0) continue;
      const w = nm.get(m.id); if (!w) continue;
      names[w.athleteId] = w.name;
      rows.push([w.athleteId, idx, m.statusText === 'Starting' ? 1 : 0, m.position.id, min, num(st[27]), num(st[26]), num(st[23])]);
    }
  });
  return rows.length >= 12 ? { f: form, c: coach, p: rows, names } : null;
}
export async function syncLore(store, games, maxCalls, log = () => {}) {
  const need = games.filter(g => !store.games[g.id]).sort((a, b) => b.ts - a.ts).slice(0, maxCalls);
  let n = 0, ok = 0;
  await pool(need, async g => {
    const b = await fetchBox(g.id);
    store.games[g.id] = b ? { ts: g.ts, comp: g.comp, h: g.h, a: g.a, g: g.g, f: b.f, c: b.c, p: b.p } : { ts: g.ts, comp: g.comp, h: g.h, a: g.a, g: g.g, p: [] };
    if (b) { Object.assign(store.names, b.names); ok++; }
    if (++n % 100 === 0) log(`הרכבים: ${n}/${need.length}`);
  }, 4);
  if (need.length) log(`הרכבים ומאמנים: נטענו ${ok} מתוך ${need.length} משחקים`);
}

// ---------- בניית התיק ----------
const pts = (gf, ga) => gf > ga ? 3 : gf === ga ? 1 : 0;
export function buildLore(store, teamId, names = store.names) {
  const G = Object.entries(store.games).map(([gid, g]) => ({ gid, ...g })).filter(g => g.p && g.p.length && (g.h === teamId || g.a === teamId)).sort((a, b) => a.ts - b.ts);
  if (G.length < 3) return null;
  const side = g => g.h === teamId ? 0 : 1;
  // מאמנים: רצף משחקים לפי מאמן
  const segs = [];
  for (const g of G) {
    const c = g.c && g.c[side(g)]; if (!c) continue;
    const res = side(g) === 0 ? pts(g.g[0], g.g[1]) : pts(g.g[1], g.g[0]);
    const last = segs[segs.length - 1];
    if (last && last.id === c[0]) { last.n++; last.pts += res; last.w += res === 3 ? 1 : 0; last.d += res === 1 ? 1 : 0; last.l += res === 0 ? 1 : 0; last.end = g.ts; }
    else segs.push({ id: c[0], name: names[c[0]] || c[1], start: g.ts, end: g.ts, n: 1, pts: res, w: res === 3 ? 1 : 0, d: res === 1 ? 1 : 0, l: res === 0 ? 1 : 0 });
  }
  const cur = segs[segs.length - 1] || null, prev = segs.length > 1 ? segs[segs.length - 2] : null;
  const coach = cur ? { name: cur.name, since: cur.start, games: cur.n, w: cur.w, d: cur.d, l: cur.l, ppg: r1(cur.pts / cur.n), prev: prev ? { name: prev.name, games: prev.n, ppg: r1(prev.pts / prev.n) } : null, isNew: !!prev && cur.n <= 10, firstSeen: segs.length === 1 } : null;
  // מערכים
  const fc = {}; for (const g of G) { const f = g.f && g.f[side(g)]; if (f) fc[f] = (fc[f] || 0) + 1; }
  const fTot = Object.values(fc).reduce((s, x) => s + x, 0);
  const formations = Object.entries(fc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => ({ f, n, pct: Math.round(n / fTot * 100) }));
  // שחקנים
  const P = new Map(); const startersByGame = [];
  for (const g of G) {
    const s = side(g), xi = [];
    for (const r of g.p) { if (r[1] !== s) continue; const [id, , st, pos, min, goals, ast, saves] = r; const p = P.get(id) || { id, pos, apps: 0, starts: 0, min: 0, goals: 0, ast: 0, saves: 0 }; p.apps++; p.starts += st; p.min += min; p.goals += goals; p.ast += ast; p.saves += saves; p.pos = pos; P.set(id, p); if (st) xi.push(id); }
    startersByGame.push(xi);
  }
  const players = [...P.values()].map(p => ({ ...p, name: names[p.id] || '?' }));
  const core = players.filter(p => p.pos !== 1).sort((a, b) => b.min - a.min).slice(0, 8);
  const scorers = players.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || a.apps - b.apps).slice(0, 3);
  const creators = players.filter(p => p.ast > 0).sort((a, b) => b.ast - a.ast).slice(0, 3);
  const gk = players.filter(p => p.pos === 1).sort((a, b) => b.min - a.min)[0] || null;
  let chg = 0, cn = 0; for (let i = 1; i < startersByGame.length; i++) { const a = new Set(startersByGame[i - 1]); chg += startersByGame[i].filter(x => !a.has(x)).length; cn++; }
  const slim = p => ({ name: p.name, pos: p.pos, apps: p.apps, starts: p.starts, min: Math.round(p.min), goals: p.goals, ast: p.ast });
  return { games: G.length, coach, formations, core: core.map(slim), scorers: scorers.map(slim), creators: creators.map(slim), gk: gk ? { name: gk.name, apps: gk.apps } : null, rotation: cn ? r1(chg / cn) : null };
}

const rec3 = (w, d, l) => (w === 1 ? 'ניצחון אחד' : w + ' ניצחונות') + ', ' + (d === 1 ? 'תיקו אחד' : d + ' תיקו') + ' ו' + (l === 1 ? 'הפסד אחד' : '-' + l + ' הפסדים');
const dateHe = ts => new Date(ts * 1000).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' });
// שורה קצרה (לניתוח המשחק) ו"סיפור" מלא (לעמוד הקבוצה)
export function loreBrief(name, lore) {
  if (!lore || !lore.coach) return null;
  const c = lore.coach, f = lore.formations[0];
  return `${name}: בהדרכת ${c.name}${c.firstSeen ? '' : ' (מאז ' + dateHe(c.since) + ')'}${f ? ', משחקת בדרך כלל ' + f.f : ''}${c.isNew ? ' — מאמן חדש, ' + c.games + ' משחקים בלבד' : ''}.`;
}
export function teamStory(K, lore) {
  const out = [], nm = K.name;
  out.push(`${nm} היא קבוצה ${K.archHe}: ${K.archShort}.`);
  if (lore && lore.coach) {
    const c = lore.coach;
    let t = `בהדרכת ${c.name}: ${c.games} משחקים במאגר: ${rec3(c.w, c.d, c.l)} (${c.ppg} נקודות למשחק).`;
    if (c.prev) t += ` לפניו אימן ${c.prev.name} (${c.prev.games} משחקים, ${c.prev.ppg} נקודות למשחק)` + (c.isNew ? `, והקבוצה בתקופת התאקלמות תחת המאמן החדש.` : c.ppg - c.prev.ppg >= 0.4 ? `, ומאז המעבר הקבוצה טובה יותר.` : c.ppg - c.prev.ppg <= -0.4 ? `, ומאז המעבר הקבוצה חלשה יותר.` : '.');
    out.push(t);
    if (lore.formations.length) {
      const f = lore.formations, flex = f.length > 1 && f[1].pct >= 25;
      out.push(`המערך המועדף ${f[0].f} (${f[0].pct >= 70 ? 'כמעט תמיד' : 'ברוב המשחקים'})` + (flex ? ` וגם ${f[1].f}: מאמן שמתאים את המערך ליריבה.` : f[0].pct >= 70 ? ': קבוצה עם זהות קבועה.' : '.') + (lore.rotation != null ? (lore.rotation <= 1.3 ? ` ההרכב יציב: בממוצע ${lore.rotation} שינויים בין משחק למשחק.` : lore.rotation >= 3 ? ` יש הרבה רוטציה: בממוצע ${lore.rotation} שינויים בהרכב בין משחק למשחק.` : '') : ''));
    }
  }
  if (lore && lore.core && lore.core.length) {
    const s = lore.scorers[0], a = lore.creators[0];
    const bits = [];
    if (s) bits.push(`${s.name} הכובש המוביל (${s.goals} שערים ב-${s.apps} משחקים)`);
    if (a && (!s || a.name !== s.name)) bits.push(`${a.name} המבשל המוביל (${a.ast} בישולים)`);
    if (lore.gk) bits.push(`${lore.gk.name} בשער`);
    if (bits.length) out.push(bits.join(', ') + '.');
    out.push('שחקני הליבה לפי דקות: ' + lore.core.slice(0, 5).map(p => p.name).join(', ') + '.');
  }
  for (const m of (K.moments || []).slice(0, 3)) out.push(m);
  for (const l of (K.lines || []).slice(0, 4)) out.push(l);
  return out;
}
