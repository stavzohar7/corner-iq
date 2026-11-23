// פקודה אחת לסיום ריצה של משימה: כתיבת הטפסים, עדכון האתר ופרסום. שימוש: node scripts/finish.mjs <קובץ-spec> <DATE>
// במקום שרשרת פקודות עם ; וצינורות (שמבקשת אישור בכל פעם), זו פקודה קבועה אחת שאפשר לאשר "תמיד".
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [spec, date] = process.argv.slice(2);
if (!spec || !date) { console.error('שימוש: node scripts/finish.mjs <spec> <DATE>'); process.exit(1); }
const run = (args, env = {}) => { const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, windowsHide: true, maxBuffer: 1 << 26 }); const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n'); console.log(out.slice(-8).join('\n')); return r.status; };
console.log('--- כתיבת טפסים');
const w = run(['scripts/fivebet-write.mjs', spec]);
console.log('--- עדכון אתר');
run(['scripts/update.mjs'], { DATE: date, REUSE_INPUTS: '1' });
console.log('--- פרסום');
run(['scripts/publish-git.mjs']);
process.exit(w === 0 ? 0 : 1);
