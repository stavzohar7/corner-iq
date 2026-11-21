// שרת מקומי קטן לקליטת נתונים שהדפדפן קורא מ-fivebet (בלי להעתיק טקסט ידנית). שימוש: node scripts/ingest.mjs   (פורט 8765, רק localhost)
// הדפדפן שולח: fetch('http://localhost:8765/save/bb-2026-11-22.json', { method: 'POST', mode: 'no-cors', body: JSON })
// נשמר ל-data/cache/siteodds/<שם>. מותרים רק שמות bb-YYYY-MM-DD.json או fb-YYYY-MM-DD-<ליגה>.json, וגוף שהוא JSON תקין. לעצירה: Ctrl+C או לסגור את התהליך.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'data', 'cache', 'siteodds');
const OK = /^(bb-\d{4}-\d{2}-\d{2}|fb-\d{4}-\d{2}-\d{2}-[a-z0-9]{1,6})(-new)?\.json$/;
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const m = /^\/save\/([\w.-]+)$/.exec(req.url || '');
  if (req.method !== 'POST' || !m || !OK.test(m[1])) { res.statusCode = 400; return res.end('no'); }
  let b = ''; req.on('data', d => { b += d; if (b.length > 5e6) req.destroy(); });
  req.on('end', () => { try { JSON.parse(b); fs.writeFileSync(path.join(DIR, m[1]), b); console.log('נשמר', m[1], b.length); res.end('ok'); } catch (e) { res.statusCode = 400; res.end('bad json'); } });
}).listen(8765, '127.0.0.1', () => console.log('מקשיב על 127.0.0.1:8765'));
