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

test('game.contract.json has every v1.3 field with the standard numbers', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.equal(contract.contract_version, '1.3');
  for (const k of ['bench_cmd', 'soak_cmd']) assert.equal(typeof contract[k], 'string', k);
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled', 'score', 'dash_speed', 'dash_duration_s', 'dash_cooldown_s', 'night2_duration_s', 'night3_duration_s', 'fuel_max', 'fuel_decay_per_s', 'fuel_per_mote', 'relight_cost', 'win_ratio', 'drain_per_s', 'low_fuel_threshold', 'capacity_max'];
  for (const k of keys) assert.ok(k in contract.tuning, k);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) assert.ok(k in contract.tuning.score, k);
  const standard = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, flames: 3, invuln_s: 1.5,
    hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true,
    fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20,
  };
  for (const [k, v] of Object.entries(standard)) assert.equal(contract.tuning[k], v, k);
  assert.deepEqual(contract.tuning.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_second_left: 0, per_lit_at_dawn: 50, per_flame_left: 50 });
});

test('default run: snapshot at tick 0 then every N, end line last', () => {
  const out = join(tmp(), 'o.jsonl');
  runCli(['--seed', '3', '--night', '1', '--ticks', '95', '--out', out]);
  const lines = readLines(out);
  const snaps = lines.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const s0 = snaps[0];
  for (const k of ['type', 'tick', 'sim_tick', 'night', 'wind', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']) assert.ok(k in s0, k);
  assert.deepEqual(s0.player, { pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0, invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0, capacity: 10 });
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  for (const m of s0.motes) assert.deepEqual(Object.keys(m), ['id', 'pos', 'kind', 'ttl_s']);
  assert.equal(s0.lanterns.length, 5);
  assert.equal(s0.time_left_s, 240);
  assert.equal(snaps[6].time_left_s, 239);
  assert.deepEqual(Object.keys(s0.lanterns[0]), ['id', 'pos', 'lit', 'deposited', 'fuel', 'ever_lit', 'relit_count']);
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
    'pause.json': JSON.stringify({ frames: [{ tick: 0, pause: 'yes' }] }),
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

for (const night of [1, 2, 3]) {
  test(`night ${night}: full night (21600 ticks) finishes in < 30 s, idle player loses, shade states use v1.1 names`, () => {
    const out = join(tmp(), 'o.jsonl');
    const t0 = Date.now();
    runCli(['--seed', '5', '--night', String(night), '--ticks', '21600', '--out', out]);
    const ms = Date.now() - t0;
    assert.ok(ms < 30000, `${ms} ms`);
    const lines = readLines(out);
    const end = lines.at(-1);
    assert.equal(end.state, 'lost');
    const over = lines.filter((l) => l.name === 'game_over');
    assert.equal(over.length, 1);
    assert.equal(over[0].tick, end.ticks);
    assert.equal(lines[0].name, 'night_start');
    const states = new Set(lines.filter((l) => l.type === 'snapshot').flatMap((l) => l.shades.map((s) => s.state)));
    for (const st of states) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(st), st);
    assert.ok(!lines.some((l) => l.name === 'game_over' && l.data.reason === 'all_lit'));
  });
}

test('--night 4 is rejected', () => {
  const r = run(['--seed', '1', '--night', '4', '--ticks', '5', '--out', join(tmp(), 'o.jsonl')]);
  assert.notEqual(r.status, 0);
});
