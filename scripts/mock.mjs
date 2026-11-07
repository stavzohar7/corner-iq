// מדמה את API-Football — לבדיקות ולתצוגת דמו בלבד (הנתונים מומצאים!)
const TEAMS = {
  39: 'Arsenal,Man City,Liverpool,Chelsea,Tottenham,Man United,Newcastle,Aston Villa,Brighton,West Ham,Crystal Palace,Fulham,Brentford,Everton,Wolves,Bournemouth,Nottm Forest,Leeds,Burnley,Sunderland',
  40: 'Leicester,Southampton,Ipswich,Norwich,Middlesbrough,West Brom,Coventry,Sheffield Utd,Hull City,Watford,Stoke City,Swansea,Bristol City,Millwall,Preston,QPR,Blackburn,Derby,Portsmouth,Oxford Utd,Wrexham,Charlton,Birmingham,Sheffield Wed',
  140: 'Real Madrid,Barcelona,Atletico Madrid,Athletic Club,Villarreal,Real Betis,Real Sociedad,Sevilla,Valencia,Girona,Celta Vigo,Osasuna,Mallorca,Rayo Vallecano,Getafe,Espanyol,Alaves,Levante,Elche,Real Oviedo',
  135: 'Inter,Napoli,AC Milan,Juventus,Atalanta,Roma,Lazio,Fiorentina,Bologna,Como,Torino,Udinese,Genoa,Cagliari,Lecce,Parma,Verona,Sassuolo,Cremonese,Pisa',
  78: 'Bayern Munich,Bayer Leverkusen,Borussia Dortmund,RB Leipzig,Eintracht Frankfurt,VfB Stuttgart,SC Freiburg,Wolfsburg,Mainz 05,Borussia Monchengladbach,Werder Bremen,Union Berlin,Augsburg,Hoffenheim,Heidenheim,St. Pauli,Hamburger SV,FC Koln',
  79: 'Schalke 04,Hertha Berlin,Hannover 96,Fortuna Dusseldorf,Karlsruher SC,Paderborn,Kaiserslautern,Nurnberg,Darmstadt,Elversberg,Magdeburg,Holstein Kiel,Bochum,Greuther Furth,Preussen Munster,Braunschweig,Arminia Bielefeld,Dynamo Dresden',
  383: 'Maccabi Tel Aviv,Hapoel Beer Sheva,Maccabi Haifa,Hapoel Tel Aviv,Beitar Jerusalem,Hapoel Haifa,Maccabi Netanya,Bnei Sakhnin,Ironi Kiryat Shmona,Hapoel Jerusalem,Ashdod,Maccabi Bnei Raina,Hapoel Petah Tikva,Ironi Tiberias',
  382: 'Hapoel Kfar Saba,Bnei Yehuda,Hapoel Raanana,Hapoel Afula,Hapoel Rishon LeZion,Maccabi Herzliya,Hapoel Ramat Gan,Kafr Qasim,Hapoel Nof HaGalil,Maccabi Kabilio Jaffa,Hapoel Akko,Hapoel Umm al-Fahm,Hapoel Hadera,Maccabi Petah Tikva,Hapoel Kfar Shalem,Hapoel Ironi Karmiel',
  61: 'Paris Saint Germain,Marseille,Monaco,Lille,Lyon,Nice,Lens,Rennes,Strasbourg,Toulouse,Brest,Nantes,Auxerre,Angers,Le Havre,Lorient,Paris FC,Metz',
  88: 'PSV,Feyenoord,Ajax,AZ Alkmaar,Twente,Utrecht,Go Ahead Eagles,NEC Nijmegen,Heerenveen,Sparta Rotterdam,Fortuna Sittard,Groningen,PEC Zwolle,Heracles,NAC Breda,Excelsior,Telstar,Volendam',
  94: 'Sporting CP,Benfica,FC Porto,Braga,Vitoria Guimaraes,Santa Clara,Famalicao,Estoril,Casa Pia,Moreirense,Rio Ave,Gil Vicente,Arouca,Nacional,Estrela,AVS,Alverca,Tondela',
};
const PLAY_TODAY = [39, 40, 140, 135, 78, 383, 382, 61, 94];
const PLAYED_ROUNDS = 11;
const ANCHOR = Date.UTC(2026, 10, 7) / 1000; // מחזור 12 בדמו = 7.11.2026

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gauss = R => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
function poisson(R, l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
const nb = (R, l) => poisson(R, l * Math.exp(0.25 * gauss(R) - 0.03)); // פואסון-גמא בקירוב

function roundRobin(ids) {
  const t = [...ids]; if (t.length % 2) t.push(null);
  const rounds = [];
  for (let r = 0; r < t.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < t.length / 2; i++) {
      const x = t[i], y = t[t.length - 1 - i];
      if (x && y) pairs.push(r % 2 ? [y, x] : [x, y]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

export function createMock(today) {
  const R = rng(20261107);
  const base = new Date(today + 'T00:00:00Z').getTime() / 1000;
  const season = 2026;
  const all = new Map(); // id -> fixture item
  const lat = {};        // id -> latent team params

  for (const [lgS, names] of Object.entries(TEAMS)) {
    const lg = Number(lgS);
    const ids = names.split(',').map((n, i) => {
      const id = lg * 1000 + i + 1;
      const q = gauss(R) * 0.9 - i * 0.04;
      lat[id] = { name: n, q, style: gauss(R) * 0.15, conc: gauss(R) * 0.12, pos: Math.round(50 + 6 * q + gauss(R) * 2) };
      return id;
    });
    const rounds = roundRobin(ids);
    for (let r = 0; r <= PLAYED_ROUNDS; r++) {
      const day = ANCHOR - (PLAYED_ROUNDS - r) * 7 * 86400;
      if (day > base) continue;
      if (day === base && !PLAY_TODAY.includes(lg)) continue;
      const isToday = day === base;
      rounds[r].forEach(([h, a], i) => {
        const id = lg * 100000 + (r + 1) * 100 + i;
        const ts = day + (13 + (i % 4) * 2) * 3600 + (i % 2) * 1800 - 7200;
        const item = {
          fixture: { id, timestamp: ts, date: new Date(ts * 1000).toISOString(), status: { short: isToday ? 'NS' : 'FT' }, venue: { name: lat[h].name + ' Stadium' } },
          league: { id: lg, season, round: `Regular Season - ${r + 1}` },
          teams: { home: { id: h, name: lat[h].name, logo: null }, away: { id: a, name: lat[a].name, logo: null } },
          goals: { home: null, away: null },
          _true: trueLambdas(lat[h], lat[a]),
        };
        const RS = rng(id); // אקראיות קבועה לכל משחק — כדי שתוצאות יהיו עקביות בין ימים
        const [lh, la] = item._true;
        const ch = nb(RS, lh), ca = nb(RS, la);
        const sh = Math.max(2, Math.round(ch * 1.6 + 4 + gauss(RS) * 3)), sa = Math.max(2, Math.round(ca * 1.6 + 3 + gauss(RS) * 3));
        const ph = Math.max(25, Math.min(75, Math.round(50 + (lat[h].pos - lat[a].pos) / 2 + 2 + gauss(RS) * 4)));
        const gl = { home: poisson(RS, 1.45 + 0.3 * (lat[h].q - lat[a].q)), away: poisson(RS, Math.max(0.3, 1.15 + 0.3 * (lat[a].q - lat[h].q))) };
        if (!isToday) {
          item.goals = gl;
          item.statistics = [
            { team: { id: h }, statistics: [{ type: 'Corner Kicks', value: ch }, { type: 'Total Shots', value: sh }, { type: 'Shots on Goal', value: Math.round(sh / 3) }, { type: 'Ball Possession', value: ph + '%' }] },
            { team: { id: a }, statistics: [{ type: 'Corner Kicks', value: ca }, { type: 'Total Shots', value: sa }, { type: 'Shots on Goal', value: Math.round(sa / 3) }, { type: 'Ball Possession', value: (100 - ph) + '%' }] },
          ];
        }
        all.set(id, item);
      });
    }
  }

  function trueLambdas(H, A) {
    const lh = 5.3 * Math.exp(0.28 * (H.q - A.q) / 1.2 + H.style + A.conc);
    const la = 4.3 * Math.exp(0.28 * (A.q - H.q) / 1.2 + A.style + H.conc);
    return [lh, la];
  }

  // יחסים מדומים בסגנון Bet365 (רווח ~7%)
  function oddsFor(item) {
    const [lh, la] = item._true;
    const sim = (f, N = 4000) => { let c = 0; for (let i = 0; i < N; i++) if (f(nb(R, lh), nb(R, la))) c++; return c / N; };
    const price = p => (Math.max(1.05, 1 / (p * 1.07) * (1 + gauss(R) * 0.03))).toFixed(2);
    const two = (pOver) => [price(pOver), price(1 - pOver)];
    const bets = [];
    const tl = Math.floor(lh + la);
    const vals = [];
    for (const l of [tl - 1.5, tl - 0.5, tl + 0.5, tl + 1.5]) { const [o, u] = two(sim((x, y) => x + y > l)); vals.push({ value: `Over ${l}`, odd: o }, { value: `Under ${l}`, odd: u }); }
    bets.push({ id: 45, name: 'Corners Over Under', values: vals });
    for (const [name, lam, idx] of [['Home Corners Over/Under', lh, 0], ['Away Corners Over/Under', la, 1]]) {
      const b = Math.floor(lam), v = [];
      for (const l of [b - 0.5, b + 0.5]) { const [o, u] = two(sim((x, y) => [x, y][idx] > l)); v.push({ value: `Over ${l}`, odd: o }, { value: `Under ${l}`, odd: u }); }
      bets.push({ id: 57 + idx, name, values: v });
    }
    const pH = sim((x, y) => x > y), pD = sim((x, y) => x === y);
    bets.push({ id: 55, name: 'Corners 1x2', values: [{ value: 'Home', odd: price(pH) }, { value: 'Draw', odd: price(pD) }, { value: 'Away', odd: price(1 - pH - pD) }] });
    const ah = lh > la ? -1.5 : 1.5, pAh = sim((x, y) => x - y + ah > 0);
    bets.push({ id: 56, name: 'Corners Asian Handicap', values: [{ value: `Home ${ah > 0 ? '+' : ''}${ah}`, odd: price(pAh) }, { value: `Away ${-ah > 0 ? '+' : ''}${-ah}`, odd: price(1 - pAh) }] });
    return bets;
  }

  const wrap = response => ({ errors: [], results: response.length, paging: { current: 1, total: 1 }, response: response.map(clean) });
  const clean = ({ _true, ...it }) => it;

  return (path, p) => {
    if (path === '/fixtures' && p.date) return wrap([...all.values()].filter(it => it.fixture.status.short === 'NS'));
    if (path === '/fixtures' && p.ids) {
      const ids = String(p.ids).split('-').map(Number);
      return wrap(ids.map(id => all.get(id)).filter(Boolean));
    }
    if (path === '/fixtures' && p.league) {
      return wrap([...all.values()].filter(it => it.league.id === Number(p.league) && it.fixture.status.short === 'FT')
        .map(({ statistics, ...it }) => it));
    }
    if (path === '/odds') {
      if (Number(p.league) === 382) return wrap([]); // ליגה לאומית — בלי יחסים בדמו
      const res = [...all.values()].filter(it => it.league.id === Number(p.league) && it.fixture.status.short === 'NS')
        .map(it => ({ league: it.league, fixture: { id: it.fixture.id }, bookmakers: [{ id: 8, name: 'Bet365', bets: oddsFor(it) }], _true: 0 }));
      return wrap(res);
    }
    throw new Error('mock: unsupported ' + path);
  };
}
