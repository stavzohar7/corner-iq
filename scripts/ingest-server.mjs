// שרת קליטה מקומי לייצוא יחסי fivebet מהדפדפן (במקום להעתיק ידנית).
// שימוש: node scripts/ingest-server.mjs   (מאזין על 127.0.0.1:8777)
// בדפדפן (בעמוד fivebet): location.href = 'http://127.0.0.1:8777/ingest#' + שם-קובץ + '|' + btoa(JSON)  -> הדף מעביר את התוכן לשרת, והשרת שומר ב-data/cache/siteodds/<שם>.
// ניווט עליון (לא fetch) ולכן לא נחסם. השרת מקבל רק שמות קבצים בטוחים (fb-/bb-DATE...json) ושומר רק לתוך siteodds.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'data', 'cache', 'siteodds');
const PAGE = `<!doctype html><meta charset=utf-8><body style="font:16px sans-serif;padding:20px"><div id=m>...</div><script>
(async()=>{const h=decodeURIComponent(location.hash.slice(1)),i=h.indexOf('|'),name=h.slice(0,i),b=h.slice(i+1);
try{const txt=decodeURIComponent(escape(atob(b)));const r=await fetch('/save?name='+encodeURIComponent(name),{method:'POST',body:txt});document.getElementById('m').textContent=await r.text()}catch(e){document.getElementById('m').textContent='ERR '+e}})()</script>`;
http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/ingest') { r.setHeader('content-type', 'text/html; charset=utf-8'); return r.end(PAGE); }
  if (u.pathname === '/save' && q.method === 'POST') {
    const name = u.searchParams.get('name') || ''; if (!/^(fb|bb)-\d{4}-\d{2}-\d{2}[\w-]*\.json$/.test(name)) { r.statusCode = 400; return r.end('bad name'); }
    let body = ''; q.on('data', d => { body += d; if (body.length > 20e6) q.destroy(); });
    q.on('end', () => { try { JSON.parse(body); } catch (e) { r.statusCode = 400; return r.end('bad json'); } fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), body); r.end('OK saved ' + name + ' ' + body.length); });
    return;
  }
  r.statusCode = 404; r.end('no');
}).listen(8777, '127.0.0.1', () => console.log('ingest on 8777'));
