import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, runCli } from './lib/scenario.js';

const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const tmp = () => mkdtempSync(join(tmpdir(), 'ddl-'));
const run = (args) => {
  const [cmd, ...base] = contract.headless_cmd.split(' ');
  return spawnSync(cmd, [...base, ...args], { cwd: ROOT, encoding: 'utf8' });
};
const readLines = (p) => readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('game.contract.json has every v1.0 field', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.equal(contract.contract_version, '1.0');
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled', 'score'];
  for (const k of keys) assert.ok(k in contract.tuning, k);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) assert.ok(k in contract.tuning.score, k);
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, false);
});

test('default run: snapshot at tick 0 then every N, end line last', () => {
  const out = join(tmp(), 'o.jsonl');
  runCli(['--seed', '3', '--night', '1', '--ticks', '95', '--out', out]);
  const lines = readLines(out);
  const snaps = lines.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const s0 = snaps[0];
  for (const k of ['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s0, k);
  assert.deepEqual(s0.player, { pos: [0, 0, 0], flames: 3, carried: 0 });
  assert.equal(s0.lanterns.length, 5);
  assert.equal(s0.time_left_s, 300);
  assert.equal(snaps[6].time_left_s, 299);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 95, state: lines.at(-1).state, score: lines.at(-1).score });
  assert.equal(lines.at(-1).ticks, 95);
});

test('determinism: same seed/scenario/inputs give byte-identical output', () => {
  const d = tmp();
  const inputs = join(d, 'in.json');
  writeFileSync(inputs, JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 50, pulse: true }, { tick: 51, pulse: false }, { tick: 300, move: [-1, 0], cam_yaw_deg: 45 }] }));
  const a = join(d, 'a.jsonl');
  const b = join(d, 'b.jsonl');
  const c = join(d, 'c.jsonl');
  runCli(['--seed', '42', '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', a]);
  runCli(['--seed', '42', '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', b]);
  runCli(['--seed', '43', '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', c]);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
  assert.notEqual(readFileSync(a, 'utf8'), readFileSync(c, 'utf8'));
});

test('coordinates are rounded to 3 decimals', () => {
  const out = join(tmp(), 'o.jsonl');
  runCli(['--seed', '9', '--night', '1', '--ticks', '200', '--out', out]);
  const text = readFileSync(out, 'utf8');
  assert.equal(/\d\.\d{4,}/.test(text), false);
});

test('bad inputs or scenario file exits with code 2', () => {
  const d = tmp();
  const cases = {
    'notjson.json': '{ nope',
    'dup.json': JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }),
    'dec.json': JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] }),
    'move.json': JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }),
    'noframes.json': JSON.stringify({}),
  };
  for (const [name, body] of Object.entries(cases)) {
    writeFileSync(join(d, name), body);
    const r = run(['--seed', '1', '--night', '1', '--inputs', join(d, name), '--ticks', '5', '--out', join(d, 'o.jsonl')]);
    assert.equal(r.status, 2, name);
    assert.ok(r.stderr.length > 0, name);
  }
  writeFileSync(join(d, 'sc.json'), JSON.stringify({ motes: 'x' }));
  const r = run(['--seed', '1', '--night', '1', '--scenario', join(d, 'sc.json'), '--ticks', '5', '--out', join(d, 'o.jsonl')]);
  assert.equal(r.status, 2);
  const missing = run(['--seed', '1', '--night', '1', '--scenario', join(d, 'nope.json'), '--ticks', '5', '--out', join(d, 'o.jsonl')]);
  assert.equal(missing.status, 2);
});

test('bad command line exits non-zero with stderr message', () => {
  const d = tmp();
  for (const args of [['--night', '1', '--ticks', '5', '--out', join(d, 'o')], ['--seed', 'x', '--night', '1', '--ticks', '5', '--out', join(d, 'o')], ['--seed', '1', '--night', '1', '--ticks', '5', '--out', join(d, 'o'), '--bogus']]) {
    const r = run(args);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.length > 0);
  }
});

test('full default night with no input ends lost (shades catch idle player) and stops early', () => {
  const out = join(tmp(), 'o.jsonl');
  runCli(['--seed', '5', '--night', '1', '--ticks', '20000', '--out', out]);
  const lines = readLines(out);
  const end = lines.at(-1);
  assert.equal(end.state, 'lost');
  assert.ok(end.ticks < 18000);
  const over = lines.filter((l) => l.name === 'game_over');
  assert.equal(over.length, 1);
  assert.equal(over[0].tick, end.ticks);
});
