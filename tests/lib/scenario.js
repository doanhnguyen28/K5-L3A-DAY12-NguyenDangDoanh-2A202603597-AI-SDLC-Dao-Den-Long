import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCENARIO_DIR = join(ROOT, 'tests', 'scenarios');

export function listScenarios() {
  return readdirSync(SCENARIO_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(SCENARIO_DIR, f), 'utf8')));
}

export function runCli(args) {
  const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  const [cmd, ...base] = contract.headless_cmd.split(' ');
  return execFileSync(cmd, [...base, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function runScenarioCli(s, outPath) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const args = ['--seed', String(s.seed), '--night', String(s.night || 1), '--ticks', String(s.ticks), '--out', outPath || join(dir, 'out.jsonl')];
  if (s.scenario) {
    writeFileSync(join(dir, 'scenario.json'), JSON.stringify(s.scenario));
    args.push('--scenario', join(dir, 'scenario.json'));
  }
  if (s.inputs) {
    writeFileSync(join(dir, 'inputs.json'), JSON.stringify(s.inputs));
    args.push('--inputs', join(dir, 'inputs.json'));
  }
  if (s.snapshot_every) args.push('--snapshot-every', String(s.snapshot_every));
  runCli(args);
  const text = readFileSync(args[args.indexOf('--out') + 1], 'utf8');
  return { text, lines: text.trim().split('\n').map((l) => JSON.parse(l)) };
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const partialMatch = (actual, expected) =>
  Object.entries(expected).every(([k, v]) => isDeepStrictEqual(actual?.[k], v));

export function checkExpectations(lines, expect) {
  const events = lines.filter((l) => l.type === 'event');
  const end = lines[lines.length - 1];
  return expect.map((e) => {
    let ok = false;
    let got;
    if (e.event) {
      const m = events.filter((ev) => ev.name === e.event && (e.tick === undefined || ev.tick === e.tick) && (!e.data || partialMatch(ev.data, e.data)));
      ok = m.length > 0;
      got = events.filter((ev) => ev.name === e.event).slice(0, 5);
    } else if (e.no_event) {
      got = events.filter((ev) => ev.name === e.no_event);
      ok = got.length === 0;
    } else if (e.event_count) {
      got = events.filter((ev) => ev.name === e.event_count).length;
      ok = got === e.equals;
    } else if (e.end) {
      got = end;
      ok = end.type === 'end' && partialMatch(end, e.end);
    } else if (e.at !== undefined) {
      const snap = lines.find((l) => l.type === 'snapshot' && l.tick === e.at);
      got = snap ? getPath(snap, e.path) : '(no snapshot)';
      if (snap) {
        if ('equals' in e) ok = isDeepStrictEqual(got, e.equals);
        else if ('gt' in e) ok = got > e.gt;
        else if ('lt' in e) ok = got < e.lt;
        else if ('between' in e) ok = got >= e.between[0] && got <= e.between[1];
        else if ('in' in e) ok = e.in.some((v) => isDeepStrictEqual(got, v));
        else if ('ne' in e) ok = !isDeepStrictEqual(got, e.ne);
      }
    }
    return { expect: e, ok, got };
  });
}
