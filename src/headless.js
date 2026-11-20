#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHeadless } from './sim/run.js';
import { InputError, validateInputs, validateScenario } from './sim/inputs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

class UsageError extends Error {}

function parseArgs(argv) {
  const out = { snapshotEvery: 10 };
  const intArg = (name, v) => {
    if (v === undefined || !/^-?\d+$/.test(v)) throw new UsageError(`${name} expects an integer`);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--seed': out.seed = intArg(a, v); i++; break;
      case '--night': out.night = intArg(a, v); i++; break;
      case '--ticks': out.ticks = intArg(a, v); i++; break;
      case '--snapshot-every': out.snapshotEvery = intArg(a, v); i++; break;
      case '--scenario': out.scenario = v; i++; break;
      case '--inputs': out.inputs = v; i++; break;
      case '--out': out.out = v; i++; break;
      default: throw new UsageError(`unknown argument: ${a}`);
    }
  }
  for (const k of ['seed', 'night', 'ticks', 'out']) if (out[k] === undefined) throw new UsageError(`missing --${k}`);
  if (![1, 2, 3].includes(out.night)) throw new UsageError(`unsupported --night ${out.night} (1, 2 or 3)`);
  if (out.ticks < 0) throw new UsageError('--ticks must be >= 0');
  if (out.snapshotEvery < 1) throw new UsageError('--snapshot-every must be >= 1');
  return out;
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new InputError(`${label}: cannot read ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new InputError(`${label}: invalid JSON in ${path}: ${e.message}`);
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
    const scenario = args.scenario ? validateScenario(readJson(args.scenario, 'scenario')) : null;
    const inputs = args.inputs ? validateInputs(readJson(args.inputs, 'inputs')) : null;
    const lines = runHeadless({
      tuning: contract.tuning,
      seed: args.seed,
      scenario,
      inputs,
      ticks: args.ticks,
      night: args.night,
      snapshotEvery: args.snapshotEvery,
    });
    writeFileSync(args.out, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(e instanceof InputError ? 2 : 1);
  }
}

main();
