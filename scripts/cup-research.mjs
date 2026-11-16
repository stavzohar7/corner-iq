// מרענן ידנית את היסטוריית הגביעים (גם מתרענן אוטומטית ב-update.mjs כשיש משחקי גביע):  node scripts/cup-research.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshCups } from './cup-mismatch.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await refreshCups(ROOT, console.log);
