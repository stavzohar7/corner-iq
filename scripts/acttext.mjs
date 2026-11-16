// "תוצאת הסיום של ההימור": מה שקרה בפועל בדבר שעליו הימרנו (נקודות של שחקן, קרנות, בעיטות, הפרש...), ולא תוצאת המשחק.
const clean = s => String(s || '').replace(/[⁦-⁩]/g, '');
const ONE = { g: 'שער אחד', c: 'קרן אחת', c1: 'קרן אחת במחצית הראשונה', sh: 'בעיטה אחת', sot: 'בעיטה למסגרת אחת', f: 'עבירה אחת', k: 'כרטיס אחד' };
const cnt = (n, st) => n === 1 && ONE[st] ? ONE[st] : n + ' ' + (STAT_HE[st] || '');
const STAT_HE = { g: 'שערים', c: 'קרנות', c1: 'קרנות במחצית הראשונה', sh: 'בעיטות', sot: 'בעיטות למסגרת', f: 'עבירות', k: 'כרטיסים' };

export function footAct(fx, m) {
  const r = fx && fx.result; if (!r || !m) return null;
  const S = r.stats || {}, val = (st, i) => st === 'g' ? r.g[i] : (S[st] && S[st][i] != null ? S[st][i] : st === 'c' ? (i === 0 ? r.h : r.a) : null);
  if (['1x2', 'dc', 'btts'].includes(m.group) && (m.stat === 'g' || !m.stat)) return 'תוצאת המשחק ' + r.g[0] + ':' + r.g[1];
  const h = val(m.stat, 0), a = val(m.stat, 1), nm = STAT_HE[m.stat] || '';
  if (h == null || a == null) return null;
  if (m.group === 'total') return 'סיימו עם ' + cnt(h + a, m.stat) + ' בסך הכל (' + h + ':' + a + ')';
  if (m.group === 'home') return 'המארחת סיימה עם ' + cnt(h, m.stat);
  if (m.group === 'away') return 'האורחת סיימה עם ' + cnt(a, m.stat);
  return nm + ' ' + h + ':' + a;   // הנדיקאפ
}

export function bbAct(g, m) {
  const r = g && g.result; if (!r || !m) return null;
  const [hp, ap] = r.g, hn = clean(g.home && g.home.name), an = clean(g.away && g.away.name);
  if (m.group === 'prop') return m.act == null ? 'לא שיחק (ההימור מוחזר)' : 'סיים עם ' + m.act + ' נקודות';
  if (m.group === 'total') return 'סה״כ ' + (hp + ap) + ' נקודות במשחק (' + hp + ':' + ap + ')';
  if (m.group === 'th') return hn + ' קלעה ' + hp + ' נקודות';
  if (m.group === 'ta') return an + ' קלעה ' + ap + ' נקודות';
  if (m.group === 'spread') { const d = m.side === 'home' ? hp - ap : ap - hp, t = m.side === 'home' ? hn : an; return d > 0 ? t + ' ניצחה ב-' + d + ' נקודות' : d < 0 ? t + ' הפסידה ב-' + (-d) + ' נקודות' : 'תיקו'; }
  return 'תוצאת המשחק ' + hp + ':' + ap;   // מנצחת
}
