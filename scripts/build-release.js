import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'package.json'), 'utf8'));
const name = `dao-den-long-v${pkg.version}`;
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, name);
if (!existsSync(join(ROOT, 'node_modules', 'three', 'build', 'three.module.js'))) {
  console.error('run "npm install" first');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const p of ['src', 'scripts', 'game.contract.json', 'package.json', 'README.md', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md']) {
  cpSync(join(ROOT, p), join(OUT, p), { recursive: true });
}
mkdirSync(join(OUT, 'node_modules', 'three', 'build'), { recursive: true });
cpSync(join(ROOT, 'node_modules', 'three', 'build', 'three.module.js'), join(OUT, 'node_modules', 'three', 'build', 'three.module.js'));
cpSync(join(ROOT, 'node_modules', 'three', 'LICENSE'), join(OUT, 'node_modules', 'three', 'LICENSE'));
writeFileSync(join(OUT, 'RUN.txt'), [
  `Đảo Đèn Lồng v${pkg.version} — bản chạy được (không cần npm install)`,
  '',
  'Yêu cầu: Node.js >= 18 và Chrome / Edge / Firefox có WebGL.',
  '',
  '1. Giải nén, mở terminal trong thư mục này.',
  '2. node scripts/serve.js',
  '3. Mở http://localhost:8080',
  '',
  'Headless: node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  'Benchmark (cần Chrome/Edge): node scripts/bench.js --seed 42 --duration 30 --out bench.json',
  'Soak: node --expose-gc --jitless scripts/soak.js --seed 7 --nights 10 --out soak.json',
  'Bảng xếp hạng: node scripts/serve.js --export-leaderboard out.json',
  '',
].join('\n'));
const archive = join(DIST, `${name}.tar.gz`);
const r = spawnSync('tar', ['-czf', archive, '-C', DIST, name], { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('tar failed; the folder is still at', OUT);
  process.exit(1);
}
const zip = join(DIST, `${name}.zip`);
const z = spawnSync('tar', ['-a', '-cf', zip, '-C', DIST, name]);
console.log(`built ${OUT}\n  ${archive}${z.status === 0 && existsSync(zip) ? `\n  ${zip}` : ''}`);
