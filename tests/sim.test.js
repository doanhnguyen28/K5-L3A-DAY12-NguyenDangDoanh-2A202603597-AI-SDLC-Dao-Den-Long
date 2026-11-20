import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGame, defaultLanterns, moveToWorld, round3 } from '../src/sim/game.js';
import { createInputTimeline } from '../src/sim/inputs.js';
import { ROOT } from './lib/scenario.js';

const tuning = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('moveToWorld follows the contract rotation formula', () => {
  const [x, z] = moveToWorld([1, 0], 90);
  assert.ok(close(x, 0) && close(z, -1));
  const [x2, z2] = moveToWorld([0, 1], 0);
  assert.ok(close(x2, 0) && close(z2, 1));
  const [x3, z3] = moveToWorld([1, 1], 0);
  assert.ok(close(Math.hypot(x3, z3), 1));
  const [x4, z4] = moveToWorld([0.5, 0], 0);
  assert.ok(close(x4, 0.5) && close(z4, 0));
});

test('default lanterns: 5 on a ring of radius 25, L1 at (0,0,25)', () => {
  const ls = defaultLanterns(5);
  assert.deepEqual(ls.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(ls[0].pos, [0, 0, 25]);
  for (const l of ls) assert.ok(close(Math.hypot(l.pos[0], l.pos[2]), 25, 1e-3));
});

test('round3 rounds and never emits -0', () => {
  assert.equal(round3(1.23456), 1.235);
  assert.ok(Object.is(round3(-0.0001), 0));
});

test('input timeline: fields persist until changed, defaults before first frame', () => {
  const at = createInputTimeline({ frames: [{ tick: 2, move: [0, 1] }, { tick: 4, jump: true }] });
  assert.deepEqual(at(0).move, [0, 0]);
  assert.deepEqual(at(2).move, [0, 1]);
  assert.equal(at(3).jump, false);
  const s4 = at(4);
  assert.equal(s4.jump, true);
  assert.deepEqual(s4.move, [0, 1]);
});

test('action triggers only on false->true edge (holding interact deposits once)', () => {
  const g = createGame({ tuning, seed: 1, scenario: { random_motes: false, random_shades: false, player: { pos: [0, 0, 23], carried: 3 } } });
  let deposits = 0;
  for (let i = 0; i < 30; i++) deposits += g.step({ interact: true }).filter((e) => e.name === 'deposit').length;
  assert.equal(deposits, 1);
});

test('random default night: 30 motes, 2 shades, ids deterministic per seed', () => {
  const a = createGame({ tuning, seed: 11 }).snapshot();
  const b = createGame({ tuning, seed: 11 }).snapshot();
  assert.equal(a.motes_active, 30);
  assert.equal(a.shades.length, 2);
  assert.deepEqual(a, b);
});

test('motes respawn over time when random_motes is on', () => {
  const g = createGame({ tuning, seed: 2, scenario: { random_shades: false, motes: [] } });
  for (let i = 0; i < 600; i++) g.step({});
  assert.equal(g.snapshot().motes_active, 5);
});

test('night 1 is winnable: autopilot bot wins seed 1 using only player inputs', async () => {
  const { createBot } = await import('../src/sim/bot.js');
  const g = createGame({ tuning, seed: 1 });
  const bot = createBot();
  while (g.state === 'playing') g.step(bot(g));
  assert.equal(g.state, 'won');
  assert.ok(g.lanterns.every((l) => l.lit));
});

test('no actions after game over', () => {
  const g = createGame({ tuning, seed: 1, scenario: { random_motes: false, random_shades: false, time_left_s: 0.05 } });
  for (let i = 0; i < 10; i++) g.step({});
  assert.equal(g.state, 'lost');
  assert.equal(g.tick, 3);
  assert.deepEqual(g.step({}), []);
});
