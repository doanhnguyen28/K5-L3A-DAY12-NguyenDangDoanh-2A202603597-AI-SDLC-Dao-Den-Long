import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGame, moveToWorld, round3 } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';
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

test('standard maps: lantern counts, spawn point counts, terrain heights', () => {
  assert.equal(MAPS[1].lanterns.length, 5);
  assert.equal(MAPS[2].lanterns.length, 6);
  assert.equal(MAPS[3].lanterns.length, 7);
  assert.equal(MAPS[1].motePoints.length, 24);
  assert.equal(MAPS[2].motePoints.length, 24);
  assert.equal(MAPS[3].motePoints.length, 30);
  assert.equal(MAPS[1].shadePoints.length, 12);
  assert.equal(MAPS[2].shadePoints.length, 16);
  assert.equal(MAPS[3].shadePoints.length, 16);
  assert.deepEqual(MAPS[1].shadePoints[0], [round3(37 * Math.cos(Math.PI / 12)), 1, round3(37 * Math.sin(Math.PI / 12))]);
  const g1 = MAPS[1].ground;
  assert.equal(g1(0, 40), 0);
  assert.equal(g1(0, 40.01), null);
  const g2 = MAPS[2].ground;
  assert.equal(g2(35, 0), 0);
  assert.equal(g2(35, 2.5), null);
  assert.equal(g2(70, 27), 0);
  const g3 = MAPS[3].ground;
  assert.equal(g3(0, 5), 6);
  assert.equal(g3(0, 18), 3);
  assert.equal(g3(0, -18), 0);
  assert.equal(g3(0, 10), 0);
  assert.equal(g3(0, 46), null);
  const a = Math.PI / 6;
  assert.ok(close(g3(27 * Math.cos(a), 27 * Math.sin(a)), 1.5));
  for (const m of MAPS[3].motePoints) assert.equal(g3(m[0], m[2]), m[1]);
  for (const l of MAPS[3].lanterns) assert.equal(g3(l.pos[0], l.pos[2]), l.pos[1]);
});

test('night start: 20 random motes on 20 distinct standard points, kind random', () => {
  for (const night of [1, 2, 3]) {
    const s = createGame({ tuning, seed: 7, night }).snapshot();
    assert.equal(s.motes.length, 20);
    assert.equal(new Set(s.motes.map((m) => m.pos.join(','))).size, 20);
    for (const m of s.motes) assert.equal(m.kind, 'random');
  }
});

test('spawned shades are at least 15 m from the player', () => {
  const g = createGame({ tuning, seed: 3, scenario: { random_motes: false, random_drifters: false, player: { pos: [33, 0, 9] } } });
  let seen = 0;
  for (let i = 0; i < 2000 && g.state === 'playing'; i++) {
    for (const e of g.step({}).filter((x) => x.name === 'shade_spawned')) {
      const s = g.shades.find((x) => x.id === e.data.id);
      assert.ok(Math.hypot(s.pos[0] - g.player.pos[0], s.pos[2] - g.player.pos[2]) >= 15 - 1e-9);
      seen++;
    }
  }
  assert.ok(seen > 0);
});

test('shade count respects the per-night maximum', () => {
  for (const night of [1, 2, 3]) {
    const g = createGame({ tuning, seed: 4, night, scenario: { random_drifters: false, wind_enabled: false, player: { pos: night === 3 ? [0, 0, -30] : [0, 0, 0] } } });
    let max = 0;
    for (let i = 0; i < 6000 && g.state === 'playing'; i++) {
      g.player.invuln = 1000;
      g.step({});
      max = Math.max(max, g.shades.length);
    }
    assert.equal(max, MAPS[night].shadeMax, `night ${night}`);
  }
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

test('random default night: deterministic per seed, no shades before tick 300', () => {
  const a = createGame({ tuning, seed: 11 }).snapshot();
  const b = createGame({ tuning, seed: 11 }).snapshot();
  assert.equal(a.shades.length, 0);
  assert.deepEqual(a, b);
});

test('motes respawn every 240 ticks when random_motes is on', () => {
  const g = createGame({ tuning, seed: 2, scenario: { random_shades: false, motes: [] } });
  for (let i = 0; i < 1200; i++) g.step({});
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
