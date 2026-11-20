import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, tmpdir, totalmem, type } from 'node:os';
import { join, resolve } from 'node:path';
import { benchStats } from '../src/benchstats.js';
import { onPost, startServer } from './serve.js';
import { findBrowser } from './screenshot.js';

const processStart = Date.now() - process.uptime() * 1000;

function parseArgs(argv) {
  const out = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!(k in out)) throw new Error(`unknown argument: ${argv[i]}`);
    out[k] = k === 'out' ? argv[i + 1] : Number(argv[i + 1]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = process.env.BROWSER || findBrowser();
  if (!browser) throw new Error('Chrome/Edge/Chromium not found; set BROWSER=/path/to/chrome');
  let firstAt = null;
  let result = null;
  onPost('/bench/first', (b) => {
    if (firstAt === null) firstAt = b.at || Date.now();
    process.stderr.write('bench: first frame rendered\n');
  });
  onPost('/bench/result', (b) => {
    result = b;
  });
  const server = await startServer(Number(process.env.PORT) || 8000 + Math.floor(Math.random() * 1000));
  const port = server.address().port;
  const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
  const url = `http://localhost:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;
  const flags = [
    `--app=${url}`, '--window-size=1280,720', '--window-position=40,40', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ];
  process.stderr.write(`bench: launching ${browser} \n  ${url}\n`);
  const child = spawn(browser, flags, { stdio: 'ignore', detached: false });
  child.on('exit', (code) => process.stderr.write(`bench: browser launcher exited (${code})\n`));
  const deadline = Date.now() + (args.duration + 3 + 90) * 1000;
  while (!result && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  try {
    child.kill();
  } catch {}
  server.close();
  setTimeout(() => {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }, 1500);
  if (!result) throw new Error('bench page did not report a result (is a display available?)');
  const stats = benchStats(result.dts);
  const out = {
    contract_version: '1.3',
    ...stats,
    load_ms: firstAt ? Math.round(firstAt - processStart) : null,
    peak_mem_mb: null,
    peak_mem_note: 'Web build: the browser does not expose process RSS to the page. js_heap_peak_mb is the page JS heap (Chromium performance.memory), not RSS.',
    js_heap_peak_mb: result.js_heap_peak_mb,
    vsync_off: true,
    vsync_note: 'Chromium flags --disable-gpu-vsync --disable-frame-rate-limit',
    renderer: result.renderer,
    os: `${type()} ${release()} (${platform()}), ${(cpus()[0]?.model || 'cpu').trim()} x${cpus().length}, ${Math.round(totalmem() / 1073741824)} GB RAM`,
    canvas: result.canvas,
    scene: { shades: result.shades, motes: result.motes, seed: args.seed, warmup_s: 3, duration_s: args.duration },
    browser,
  };
  writeFileSync(resolve(args.out), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ avg_fps: out.avg_fps, p1_low_fps: out.p1_low_fps, frame_ms_p95: out.frame_ms_p95, frames: out.frames, load_ms: out.load_ms }));
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
});
