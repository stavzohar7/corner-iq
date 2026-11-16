// קוד לדפדפן (sport.fivebet.vip): מעריך את יחסי האתר מול צפי המודל. ראו fivebet-howto.md
// שימוש: window.__evalF(E) כש-E = { 'Site-Game-Key': { g:[home,away], c:[..], sh:[..], sot:[..] }, ... } מצפי היום (data/days/DATE.json, שדה exp: h, a).
// הנתונים של האתר נקראים מ-localStorage.__F2 (נשמר ע"י window.__grab2). מחזיר טקסט: הרגליים המובילות בכל משחק.
// כללים: יחס 1.45–3.0, סיכוי משולב (חצי מודל וחצי יחס האתר ההוגן) לפחות 0.58, פער מודל/אתר קטן מ-0.15 (אחרת סומנו כחשודים).
window.__evalF = (E, minP = 0.58, top = 7) => {
  const nb = (m, phi, n = 80) => { const p = []; if (phi <= 1.01) { let v = Math.exp(-m); p.push(v); for (let k = 0; k < n; k++) { v = v * m / (k + 1); p.push(v); } return p; } const q = (phi - 1) / phi, r = m / (phi - 1); let v = Math.pow(1 - q, r); p.push(v); for (let k = 0; k < n; k++) { v = v * (k + r) / (k + 1) * q; p.push(v); } return p; };
  const conv = (a, b) => { const o = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => o[i + j] += x * y)); return o; };
  const PHI = { g: 1.15, c: 1.45, sh: 1.5, sot: 1.4 };
  const F = JSON.parse(localStorage.__F2 || '{}'), res = [];
  for (const [gm, ex] of Object.entries(E)) {
    const D = F[gm]; if (!D) { res.push('חסר ' + gm); continue; }
    const c = [], tabs = { g: D.g, c: D.c, sh: D.sh, sot: D.sot };
    for (const st of ['g', 'c', 'sh', 'sot']) {
      const L = tabs[st], e = ex[st]; if (!L || !e) continue;
      const ph = nb(e[0], PHI[st]), pa = nb(e[1], PHI[st]), pt = conv(ph, pa), diff = {};
      ph.forEach((x, i) => pa.forEach((y, j) => { diff[i - j] = (diff[i - j] || 0) + x * y; }));
      const ev = (kind, pw, pl, odds, site) => { const push = 1 - pw - pl, pc = pw / (pw + pl), gap = Math.abs(pc - site), pb = 0.5 * pc + 0.5 * site, e2 = (1 - push) * (pb * odds - 1); if (odds >= 1.45 && odds <= 3 && pb >= minP && gap < 0.15) c.push({ k: st + ' ' + kind, odds, pb: +pb.toFixed(2), ev: +e2.toFixed(2), m: +pc.toFixed(2), s: +site.toFixed(2), push: +push.toFixed(2) }); };
      const cmp = (arr, x) => { let w = 0, l = 0; arr.forEach((p, i) => { if (i > x) w += p; else if (i < x) l += p; }); return [w, l]; };
      for (const [ln, o, u] of (L.tot || [])) { const [w, l] = cmp(pt, ln), so = (1 / o) / (1 / o + 1 / u); ev('over ' + ln, w, l, o, so); ev('under ' + ln, l, w, u, 1 - so); }
      for (const [ln, o, u] of (L.t1 || [])) { const [w, l] = cmp(ph, ln), so = (1 / o) / (1 / o + 1 / u); ev('home over ' + ln, w, l, o, so); ev('home under ' + ln, l, w, u, 1 - so); }
      for (const [ln, o, u] of (L.t2 || [])) { const [w, l] = cmp(pa, ln), so = (1 / o) / (1 / o + 1 / u); ev('away over ' + ln, w, l, o, so); ev('away under ' + ln, l, w, u, 1 - so); }
      for (const [ln, a, b] of (L.hc || [])) { let w = 0, l = 0; for (const [d, x] of Object.entries(diff)) { const v = +d + ln; if (v > 0) w += x; else if (v < 0) l += x; } const so = (1 / a) / (1 / a + 1 / b); ev('home ' + (ln > 0 ? '+' : '') + ln, w, l, a, so); ev('away ' + (-ln > 0 ? '+' : '') + (-ln), l, w, b, 1 - so); }
      if (st === 'g' && L.btts) { const pb0 = (1 - ph[0]) * (1 - pa[0]), so = (1 / L.btts[0]) / (1 / L.btts[0] + 1 / L.btts[1]); ev('btts yes', pb0, 1 - pb0, L.btts[0], so); ev('btts no', 1 - pb0, pb0, L.btts[1], 1 - so); }
    }
    c.sort((a, b) => b.pb - a.pb);
    res.push(gm + ' 1X2 ' + JSON.stringify((D.g || {}).r) + '\n  ' + c.slice(0, top).map(x => x.k + ' @' + x.odds + ' p' + x.pb + ' (מודל ' + x.m + ' אתר ' + x.s + ') ev' + x.ev + (x.push > 0.02 ? ' החזר' + x.push : '')).join('\n  '));
  }
  return res.join('\n');
};

// ---- שוקי צירוף: "1X and Under (3.5)", "Win1 and Over (1.5)", Double chance, Draw no bet ----
// טופס חזק מורכב מרגליים סבירות, ולעיתים הרגל החזקה ביותר היא צירוף (למשל "קוסובו לא מפסידה וגם מתחת ל-3.5 שערים") שביחס 1.68 עובר את רף 1.45 ואילו כל חצי שלו לבד לא.
// איסוף: window.__gcombo(k) (שומר ב-localStorage.__C). הערכה: window.__evalC(E) עם E כמו ב-__evalF (נדרש רק g:[בית,חוץ]).
window.__evalC = (E, minP = 0.58, top = 6) => {
  const pois = (m, n = 25) => { const p = []; let v = Math.exp(-m); p.push(v); for (let k = 0; k < n; k++) { v = v * m / (k + 1); p.push(v); } return p; };
  const C = JSON.parse(localStorage.__C || '{}'), res = [];
  for (const [gm, ex] of Object.entries(E)) {
    const D = C[gm]; if (!D) { res.push('missing ' + gm); continue; }
    const H = pois(ex.g[0]), A = pois(ex.g[1]), c = [];
    for (const [key, odds] of Object.entries(D)) {
      if (odds < 1.45 || odds > 3.2) continue;
      const [grp, lab] = key.split('|');
      const m = lab.match(/^(Win1|Win2|Draw|1X|12|X2|Team 1|Team 2)(?: and (Over|Under) \(([\d.]+)\))?$/); if (!m) continue;
      const rs = m[1], ou = m[2], L = ou ? +m[3] : null;
      let p = 0, dnbBase = 0;
      H.forEach((ph, i) => A.forEach((pa, j) => {
        const w = ph * pa, d = i - j;
        const rok = rs === 'Win1' || rs === 'Team 1' ? d > 0 : rs === 'Win2' || rs === 'Team 2' ? d < 0 : rs === 'Draw' ? d === 0 : rs === '1X' ? d >= 0 : rs === 'X2' ? d <= 0 : d !== 0;
        if (grp === 'Draw no bet') { if (d !== 0) { dnbBase += w; if (rok) p += w; } return; }
        const tok = !ou || (ou === 'Over' ? i + j > L : i + j < L);
        if (rok && tok) p += w;
      }));
      if (grp === 'Draw no bet') p = p / dnbBase;
      const ps = 1 / odds / 1.1, pb = 0.6 * p + 0.4 * ps, ev = pb * odds - 1;
      if (pb >= minP && Math.abs(p - ps) < 0.2) c.push({ k: lab + (grp === 'Double chance' ? ' (DC)' : grp === 'Draw no bet' ? ' (DNB)' : ''), odds, pb: +pb.toFixed(2), m: +p.toFixed(2), s: +ps.toFixed(2), ev: +ev.toFixed(2) });
    }
    c.sort((a, b) => b.pb - a.pb);
    res.push(gm + '\n  ' + c.slice(0, top).map(x => x.k + ' @' + x.odds + ' p' + x.pb + ' (m' + x.m + ' s' + x.s + ') ev' + x.ev).join('\n  '));
  }
  return res.join('\n');
};
