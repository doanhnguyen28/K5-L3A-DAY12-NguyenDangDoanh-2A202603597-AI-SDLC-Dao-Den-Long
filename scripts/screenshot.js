import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function findBrowser() {
  return CANDIDATES.find((p) => existsSync(p));
}

export async function screenshot({ query, out, budgetMs = 4000, port = 8000 + Math.floor(Math.random() * 1000) }) {
  const browser = findBrowser();
  if (!browser) throw new Error('no Chrome/Edge found; set BROWSER=/path/to/chrome');
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  try {
    const r = spawnSync(browser, [
      '--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      `--user-data-dir=${join(ROOT, 'node_modules', '.ddl-browser')}`,
      '--window-size=1280,720', `--virtual-time-budget=${budgetMs}`, `--screenshot=${resolve(out)}`,
      `http://localhost:${port}/?${query}`,
    ], { encoding: 'utf8', timeout: 60000 });
    if (!existsSync(resolve(out))) throw new Error(`screenshot failed: ${r.stderr || r.error}`);
    return resolve(out);
  } finally {
    server.kill();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [query = 'autostart=1&seed=1', out = 'screenshot.png'] = process.argv.slice(2);
  screenshot({ query, out }).then((p) => console.log(p), (e) => {
    console.error(e.message);
    process.exit(1);
  });
}
