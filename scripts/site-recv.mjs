// מקלט זמני בלבד (פורט 8099, רק localhost): מקבל מהדפדפן את היחסים שנקראו מהאתר ושומר ב-data/cache/siteodds/.
// מקבל רק שמות [a-z0-9_-], עד 2MB, ורק לתיקייה הזאת. מפעילים כשצריך ועוצרים אחר כך.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'data', 'cache', 'siteodds');
fs.mkdirSync(DIR, { recursive: true });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-allow-private-network': 'true' };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  if (req.method !== 'POST' || u.pathname !== '/save') { res.writeHead(404, cors); return res.end('no'); }
  const name = u.searchParams.get('name') || '';
  if (!/^[a-z0-9_-]{1,60}$/.test(name)) { res.writeHead(400, cors); return res.end('bad name'); }
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 2e6) req.destroy(); else chunks.push(c); });
  req.on('end', () => { try { const body = Buffer.concat(chunks).toString('utf8'); JSON.parse(body); fs.writeFileSync(path.join(DIR, name + '.json'), body); res.writeHead(200, cors); res.end('ok ' + name); } catch (e) { res.writeHead(400, cors); res.end('bad json'); } });
}).listen(8099, '127.0.0.1', () => console.log('listening 8099 -> ' + DIR));
