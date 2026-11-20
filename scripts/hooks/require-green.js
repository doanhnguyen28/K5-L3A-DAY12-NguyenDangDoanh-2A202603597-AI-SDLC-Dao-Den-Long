import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mode = process.argv[2] || 'stop';

let payload = {};
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  payload = JSON.parse(Buffer.concat(chunks).toString() || '{}');
} catch {
  payload = {};
}

if (mode === 'edit') {
  const file = payload?.tool_input?.file_path || '';
  if (!/[\\/](src|tests)[\\/]|game\.contract\.json$/.test(file)) process.exit(0);
}
if (mode === 'stop' && payload.stop_hook_active) process.exit(0);

const r = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8' });
if (r.status === 0) process.exit(0);
const fails = (r.stdout + r.stderr).split('\n').filter((l) => /^\s*✖|not ok|AssertionError/.test(l)).slice(0, 15).join('\n');
process.stderr.write(`npm test is RED. Fix before continuing:\n${fails}\n`);
process.exit(2);
