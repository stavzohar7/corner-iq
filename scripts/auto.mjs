// הרצה אוטומטית בלי Claude (מתזמן של Windows, כל שעה): מעדכן תוצאות, בודק הימורים, ובונה ניתוח וטפסים להיום ולמחר.
// שימוש: node scripts/auto.mjs        יומן: data/cache/auto.log
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, 'data', 'cache', 'auto.log'), LOCK = path.join(ROOT, 'data', 'cache', 'auto.lock');
fs.mkdirSync(path.dirname(LOG), { recursive: true });
const note = m => { const l = `[${new Date().toISOString()}] ${m}\n`; process.stdout.write(l); fs.appendFileSync(LOG, l); };
const ilDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms));

// נעילה נחשבת פעילה רק אם התהליך שיצר אותה עדיין חי (נעילה יתומה אחרי קריסה לא חוסמת)
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
try { if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 20 * 60e3 && alive(Number(fs.readFileSync(LOCK, 'utf8')))) { note('הרצה קודמת עדיין פעילה, מדלג'); process.exit(0); } } catch { /* */ }
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch { /* */ } });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, () => { note('הופסקה על ידי ' + sig); process.exit(1); });
note('התחלה');

const today = ilDate(Date.now()), tomorrow = ilDate(Date.now() + 86400e3);
let failed = 0;
for (const date of [tomorrow, today]) {   // היום אחרון, כדי ש-last-run.json ישקף את היום
  const reuse = fs.existsSync(path.join(ROOT, 'data', 'cache', `inputs-${date}.json`));
  const env = { ...process.env, DATE: date }; if (reuse) env.REUSE_INPUTS = '1'; else delete env.REUSE_INPUTS;
  const r = spawnSync(process.execPath, ['scripts/update.mjs'], { cwd: ROOT, env, encoding: 'utf8', timeout: 12 * 60e3, windowsHide: true });
  const out = (r.stdout || '').trim().split('\n').pop();
  if (r.status === 0) note(`${date} ${reuse ? '(רענון)' : '(מלא)'} הצליח: ${out}`);
  else { failed++; note(`${date} נכשל: ${(r.stderr || r.error || '').toString().trim().split('\n').pop()}`); }
}
{ const r = spawnSync(process.execPath, ['scripts/publish-git.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 3 * 60e3, windowsHide: true }); note('פרסום ל-GitHub: ' + ((r.stdout || '') + (r.stderr || '')).trim().split(String.fromCharCode(10)).pop()); }
process.exit(failed === 2 ? 1 : 0);
