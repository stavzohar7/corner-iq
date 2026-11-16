// שכבת "המנתח": תיק משחק מלא לקריאה (dossier) + החלת הדעה שנכתבה על המשחק (expert) על הניתוח.
// הקוד מכין את התיק, מנתח (אני, במשימת הבוקר) קורא ומחליט, והתוצאה נשמרת ב-data/expert/DATE.json:
//   { "<fid>": { "head": "כותרת קצרה", "take": ["פסקה", ...], "adj": { "<מפתח הימור>": { "d": -2, "why": "הסבר קצר" } } } }
// מפתח הימור = stat|group|side|line, למשל c|total|over|9.5  (מופיע בתיק בסוגריים מרובעים)
import fs from 'node:fs';
import path from 'node:path';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = x => Math.round(x * 10) / 10;
export const mkey = m => [m.stat, m.group, m.side, m.line ?? ''].join('|');
const plain = s => String(s || '').replace(/[⁦-⁩]/g, '');

export function applyExpert(f, ex) {
  if (!ex || !f) return f;
  const take = (ex.take || []).map(String).filter(Boolean).slice(0, 6);
  if (take.length) f.expert = { head: ex.head ? String(ex.head) : null, take };
  const byKey = new Map(f.markets.map((m, i) => [mkey(m), i]));
  for (const [k, a] of Object.entries(ex.adj || {})) {
    const i = byKey.get(k), m = i != null ? f.markets[i] : null;
    if (!m || !a || typeof a.d !== 'number') continue;
    const d = clamp(a.d, -6, 2);
    m.score = clamp(Math.round(m.score + d), 1, 10);
    m.expert = String(a.why || '').slice(0, 220);
    if (m.expert) m.checks = [{ k: d > 0 ? 'ok' : 'bad', t: 'הערכת המנתח: ' + m.expert }, ...(m.checks || [])].slice(0, 7);
  }
  f.picks = f.picks.slice().sort((x, y) => f.markets[y].score - f.markets[x].score);
  const top = f.picks.slice(0, 2).map(i => f.markets[i].score);
  if (top.length) f.quality = r1(top.reduce((s, x) => s + x, 0) / top.length * (0.7 + 0.3 * f.conf));
  return f;
}

const fmtDay = ts => new Date(ts * 1000).toISOString().slice(5, 10);
const num = x => x == null ? '?' : x;
const rec = b => b ? `${b.w}-${b.d}-${b.l} (${b.n} מש׳) שערים ${num(b.gf)}:${num(b.ga)} · קרנות ${num(b.c)}:${num(b.cAg)} · בעיטות ${num(b.sh)}:${num(b.shAg)}` : '—';
function logLines(T, n = 8) {
  return T.log.slice(0, n).map(e => `  ${fmtDay(e.ts)} ${e.v === 'H' ? 'בית ' : 'חוץ '} מול ${plain(e.opp)}${e.rank ? ` (#${e.rank}${e.tier ? ' ' + e.tier : ''})` : ''}  ${e.g[0]}-${e.g[1]} | קרנות ${num(e.c[0])}-${num(e.c[1])} | בעיטות ${num(e.sh[0])}-${num(e.sh[1])} | למסגרת ${num(e.sot[0])}-${num(e.sot[1])}`).join('\n');
}

export function writeDossier(file, { date, fixtures, leagueName, max = 14 }) {
  const now = Date.now();
  const cand = fixtures.filter(f => f.enough && f.ts * 1000 > now - 5 * 60e3).sort((a, b) => (b.quality || 0) - (a.quality || 0)).slice(0, max).sort((a, b) => a.ts - b.ts);
  const out = [`# תיקי משחק ל-${date}`, '',
    'הוראות למנתח: לכל משחק כאן קראו את התיק (איך כל קבוצה שיחקה בבית/בחוץ, מול גדולות/בינוניות/קטנות, מול קבוצות שמתבצרות, ראש בראש, חיסורים) וכתבו ב-data/expert/' + date + '.json דעה ספציפית למשחק.',
    'מבנה: { "<fid>": { "head": "כותרת קצרה", "take": ["3-5 פסקאות קצרות בעברית פשוטה"], "adj": { "<מפתח הימור>": { "d": -2..+2, "why": "משפט אחד" } } } }', ''];
  for (const f of cand) {
    const H = f.home, A = f.away, e = f.exp || {}, mo = f.character && f.character.mwOdds, ou = f.character && f.character.ouOdds;
    out.push(`## [${f.id}] ${leagueName(f.lg)} · ${plain(H.name)} (#${H.rank}/${H.nTeams}) נגד ${plain(A.name)} (#${A.rank}/${A.nTeams}) · ${new Date(f.ts * 1000).toISOString().slice(11, 16)} UTC`);
    out.push(`יחסי Bet365: ${mo ? `בית ${mo.h} · תיקו ${mo.d} · חוץ ${mo.a}` : 'אין'}${ou ? ` · מעל 2.5 ${ou.over} · מתחת ${ou.under}` : ''}`);
    out.push('צפי (בית:חוץ, סה״כ, ממוצע ליגה): ' + ['g', 'c', 'c1', 'sh', 'sot'].filter(k => e[k]).map(k => `${k} ${e[k].h}:${e[k].a} (${e[k].total}, ליגה ${e[k].lg.total})`).join(' · '));
    out.push(`כושר: ${plain(H.name)} ${H.form || '-'} · ${plain(A.name)} ${A.form || '-'}`);
    out.push(`${plain(H.name)} — 8 אחרונים (חדש לישן):\n${logLines(H)}`);
    out.push(`${plain(A.name)} — 8 אחרונים:\n${logLines(A)}`);
    const sc = f.scout;
    if (sc && sc.data) {
      for (const k of ['h', 'a']) {
        const d = sc.data[k], T = k === 'h' ? H : A; if (!d) continue;
        out.push(`${plain(T.name)} — פילוח: כל המשחקים ${rec(d.all)} | ${k === 'h' ? 'בבית' : 'בחוץ'} ${rec(d.venue)}${d.tier ? ` | מול ${d.tier.key} ${rec(d.tier)}` : ''}${d.block ? ` | מול מתבצרות ${rec(d.block)}` : ''}`);
      }
      const kk = sc.kind || {};
      if (kk.h || kk.a) out.push(`סוג יריבה: ${plain(H.name)} החזקה ${kk.h ? kk.h.pos + '% מרשה ' + kk.h.shAabs + ' בעיטות' + (kk.h.block ? ' (מתבצרת)' : '') : '?'} · ${plain(A.name)} ${kk.a ? kk.a.pos + '% מרשה ' + kk.a.shAabs + ' בעיטות' + (kk.a.block ? ' (מתבצרת)' : '') : '?'}`);
      if (sc.lines && sc.lines.length) out.push('קריאה אוטומטית:\n' + sc.lines.map(l => '  - ' + plain(l)).join('\n'));
    }
    const rv = f.character && f.character.rivalry;
    if (rv && rv.meetings && rv.meetings.length) out.push('ראש בראש (חדש לישן): ' + rv.meetings.slice(0, 5).map(m => `${fmtDay(m.ts)} ${m.g ? m.g.join('-') : '?'} קרנות ${m.c ? m.c.join('-') : '?'}`).join(' | ') + (rv.derby ? ` · דרבי: ${rv.derby}` : ''));
    const items = (f.news && f.news.items) || [];
    out.push('חיסורים/הרכבים: ' + (items.length ? items.slice(0, 8).map(i => `${i.side === 'h' ? plain(H.name) : plain(A.name)}: ${plain(i.text)} [${i.impact}]`).join(' · ') : 'אין מידע') + (f.news && f.news.uncertain ? ' (הרכבים לא סופיים)' : ''));
    out.push('הימורים מובילים (מפתח | יחס | דירוג | בית | חוץ | מול סוג יריבה):');
    for (const m of f.markets.filter(x => x.score >= 4).slice(0, 12)) {
      const h = m.hist || {}, fr = x => x ? `${Math.round(x[0] * x[1])}/${x[1]}` : '-';
      out.push(`  [${mkey(m)}] ${plain(m.label)} | ${m.odds || '~' + m.estOdds} | ${m.score}${m.expert ? ' (אחרי התאמת מנתח)' : ''} | ${fr(h.hv)} | ${fr(h.av)} | ${h.t != null ? Math.round(h.t * 100) + '%' : '-'}`);
    }
    out.push('');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'));
  return cand.length;
}
