import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGame } from '../src/sim/game.js';
import { createRng } from '../src/sim/rng.js';
import { TICK_RATE } from '../src/sim/constants.js';
import { MAPS } from '../src/sim/maps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!(k in out)) throw new Error(`unknown argument: ${argv[i]}`);
    out[k] = k === 'out' ? argv[i + 1] : Number(argv[i + 1]);
    if (k !== 'out' && !Number.isInteger(out[k])) throw new Error(`--${k} expects an integer`);
  }
  return out;
}

const rssMb = () => {
  if (globalThis.gc) {
    globalThis.gc();
    globalThis.gc();
  }
  const u = process.memoryUsage();
  return { rss: Math.round((u.rss / 1048576) * 10) / 10, heap: Math.round((u.heapUsed / 1048576) * 10) / 10 };
};

export function playNight({ tuning, night, seed }) {
  const game = createGame({ tuning, seed, night });
  const rng = createRng(seed ^ 0x5eed);
  const maxTicks = Math.round(tuning[MAPS[night].durationKey] * TICK_RATE) + 10;
  let move = [0, 0];
  let lines = 0;
  for (let k = 0; k < maxTicks && game.state === 'playing'; k++) {
    if (k % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    const input = {
      move,
      cam_yaw_deg: 0,
      jump: rng() < 0.05,
      dash: rng() < 0.03,
      pulse: rng() < 0.02,
      interact: rng() < 0.1,
    };
    game.step(input);
    if (game.tick % 10 === 0) lines += JSON.stringify(game.snapshot()).length;
  }
  return { game, lines };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tuning = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
  const t0 = Date.now();
  const results = [];
  let crashes = 0;
  let memStart = null;
  let current = null;
  for (let i = 0; i < args.nights; i++) {
    const night = (i % 3) + 1;
    const seed = args.seed + i;
    try {
      if (i === 0) {
        current = createGame({ tuning, seed, night });
        memStart = rssMb();
        current = null;
      }
      const { game } = playNight({ tuning, night, seed });
      results.push(game.state === 'won' ? 'won' : 'lost');
    } catch (e) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`night ${i} crashed: ${e.stack}\n`);
    }
  }
  current = null;
  const memEnd = rssMb();
  const jitless = process.execArgv.includes('--jitless');
  const out = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStart.rss,
    mem_end_mb: memEnd.rss,
    mem_ratio: Math.round((memEnd.rss / memStart.rss) * 1000) / 1000,
    heap_used_start_mb: memStart.heap,
    heap_used_end_mb: memEnd.heap,
    jitless,
    duration_s: Math.round((Date.now() - t0) / 100) / 10,
    gc_exposed: Boolean(globalThis.gc),
    node: process.version,
  };
  writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
  process.exit(crashes === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
