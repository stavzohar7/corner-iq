// דוחף את האתר והנתונים ל-GitHub (שם workflow מפרסם ב-Pages). רץ בסוף auto.mjs. אם אין remote או אין שינוי, לא עושה כלום.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
if (!git('remote', 'get-url', 'origin').stdout.trim()) { console.log('אין remote ל-git, מדלג על הפרסום'); process.exit(0); }
git('add', '-A', '--', 'index.html', 'manifest.webmanifest', 'assets', 'scripts', '.github', 'README.md', '.gitignore');
git('add', '-f', '--', 'data/days', 'data/fbodds', 'data/bball', 'data/latest.json', 'data/stats.json', 'data/slips.json', 'data/teams.json', 'data/lessons.json', 'data/notify-state.json');
if (git('diff', '--cached', '--quiet').status === 0) { console.log('אין שינויים לפרסום'); process.exit(0); }
const c = git('commit', '-m', 'עדכון אוטומטי ' + new Date().toISOString().slice(0, 16));
if (c.status !== 0) { console.error(c.stderr); process.exit(1); }
// אם הענן דחף בינתיים: ממזגים, ובהתנגשות בקבצי נתונים הגרסה המקומית מנצחת (הנתונים נבנים מחדש בכל שעה)
git('pull', '--no-rebase', '--autostash', '-X', 'ours', '--no-edit', 'origin', 'main');
const p = git('push', 'origin', 'HEAD:main');
if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
console.log('נדחף ל-GitHub');
