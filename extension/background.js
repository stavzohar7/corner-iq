// קורא כל יום את יחסי fivebet (בדפדפן שלך, בלי כניסה לחשבון) ושולח לריפו קורנר IQ, שם GitHub Actions בונה את הטפסים.
const REPO = 'stavzohar7/corner-iq';
const LEAGUES = [
  [4485, 'England. Barclays Premier League', 'pl'], [4261, 'Germany. Bundesliga', 'bl'], [4486, 'Spain. LaLiga', 'll'],
  [4484, 'Italy. Seria A', 'sa'], [4610, 'France. Ligue 1', 'l1'], [4584, 'UEFA Champions League', 'ucl'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = async s => { await chrome.storage.local.set({ status: new Date().toLocaleTimeString('he-IL') + ' ' + s }); };
const ilDate = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date()).map(x => [x.type, x.value])); return { dd: p.day + '.' + p.month, iso: p.year + '-' + p.month + '-' + p.day }; };
let running = false;

async function ghPut(path, text, token) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`, h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  let sha; const g = await fetch(url, { headers: h }); if (g.ok) sha = (await g.json()).sha;
  const body = { message: 'fivebet ' + path, content: btoa(unescape(encodeURIComponent(text))), ...(sha ? { sha } : {}) };
  const r = await fetch(url, { method: 'PUT', headers: h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('GitHub ' + r.status + ' ' + (await r.text()).slice(0, 120));
}
const inTab = (tabId, func, args = []) => chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args }).then(r => r[0] && r[0].result);

async function readLeague(win, [id, name, tag], dd) {
  const url = `https://sport.fivebet.vip/SportsBook/Upcoming?championshipId=${id}&championship=${encodeURIComponent(name)}`;
  const tabId = win.tabs[0].id; await chrome.tabs.update(tabId, { url }); await sleep(9000);
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['fivebet-fb.js'] });
  for (let w = 0; w < 15; w++) { const n = await inTab(tabId, () => (window.__rowSel ? window.__rowSel().length : -1)); if (n > 0) break; await sleep(2000); }
  const started = await inTab(tabId, d => window.__fbRun(d), [dd]);
  if (!started || /started 0/.test(started)) return null;
  for (let w = 0; w < 120; w++) { await sleep(15000); const st = await inTab(tabId, () => window.__fbStatus()); await say(`${tag}: ${st.done}/${st.total}`); if (st && !st.running) break; }
  const txt = await inTab(tabId, () => window.__fbExport());
  return txt && txt.length > 5 ? txt : null;
}

async function runAll() {
  if (running) return; running = true;
  try {
    const { token } = await chrome.storage.local.get('token'); if (!token) { await say('חסר מפתח GitHub (פתח את התוסף ושמור אותו)'); return; }
    const { dd, iso } = ilDate(); await say('מתחיל ' + dd);
    const win = await chrome.windows.create({ url: 'about:blank', type: 'popup', focused: false, width: 520, height: 420, left: 20, top: 20 });
    let sent = 0, lines = [];
    try {
      for (const L of LEAGUES) {
        try { const txt = await readLeague(win, L, dd); if (txt && JSON.parse(txt).length) { await ghPut(`inbox/fb-${iso}-${L[2]}.json`, txt, token); sent++; lines.push(L[2] + ' ' + JSON.parse(txt).length); } }
        catch (e) { lines.push(L[2] + ' שגיאה ' + String(e).slice(0, 60)); }
      }
      if (sent) await ghPut(`inbox/done-${iso}.txt`, new Date().toISOString() + ' ' + lines.join(', '), token);
    } finally { chrome.windows.remove(win.id).catch(() => {}); }
    await say(sent ? 'נשלח: ' + lines.join(', ') : 'לא נמצאו משחקים להיום ' + lines.join(', '));
  } catch (e) { await say('שגיאה: ' + String(e).slice(0, 150)); } finally { running = false; }
}

function schedule() { for (const [name, h, m] of [['am', 10, 30]]) { const d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); chrome.alarms.create(name, { when: d.getTime(), periodInMinutes: 1440 }); } }
chrome.runtime.onInstalled.addListener(schedule); chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener(runAll);
chrome.runtime.onMessage.addListener(m => { if (m.cmd === 'run') runAll(); });
