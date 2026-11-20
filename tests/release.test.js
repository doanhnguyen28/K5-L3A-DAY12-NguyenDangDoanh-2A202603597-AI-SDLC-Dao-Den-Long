import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/scenario.js';
import { addEntry, isoWithOffset, makeEntry, sortEntries, validateName } from '../src/leaderboard.js';
import { benchStats } from '../src/benchstats.js';
import { createGame } from '../src/sim/game.js';

const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const tuning = contract.tuning;
const tmp = () => mkdtempSync(join(tmpdir(), 'ddl-rel-'));
const sh = (cmd, extra, env = {}) => {
  const [c, ...base] = cmd.split(' ');
  return spawnSync(c, [...base, ...extra], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
};

test('leaderboard names: 3-12 chars of letters/digits/_; Vietnamese with diacritics accepted', () => {
  assert.equal(validateName('Moon_01'), 'Moon_01');
  assert.equal(validateName('Mây'), 'Mây');
  assert.equal(validateName('NguyễnĐăng'), 'NguyễnĐăng');
  for (const bad of ['ab', 'abcdefghijklm', 'has space', 'bad-dash', '', null, '漢字漢字']) assert.equal(validateName(bad), null, String(bad));
});

test('leaderboard order: score desc, ties by earlier achieved_at, keeps top 10', () => {
  const mk = (name, score, t) => ({ name, score, nights_won: 1, achieved_at: t, seed: 1 });
  let e = [];
  e = addEntry(e, mk('late', 500, '2026-11-20T10:00:05+07:00'));
  e = addEntry(e, mk('early', 500, '2026-11-20T10:00:01+07:00'));
  e = addEntry(e, mk('top', 900, '2026-11-20T11:00:00+07:00'));
  assert.deepEqual(e.map((x) => x.name), ['top', 'early', 'late']);
  for (let i = 0; i < 12; i++) e = addEntry(e, mk(`p${String(i).padStart(2, '0')}`, i, `2026-11-20T12:00:${String(i).padStart(2, '0')}+07:00`));
  assert.equal(e.length, 10);
  assert.equal(e.at(-1).score, 5);
  assert.deepEqual(sortEntries([...e].reverse()).map((x) => x.name), e.map((x) => x.name));
});

test('leaderboard entry fields and ISO 8601 timestamp with offset', () => {
  const en = makeEntry({ name: 'Doanh', score: 1200, nights_won: 2, seed: 99 });
  assert.deepEqual(Object.keys(en), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  assert.match(en.achieved_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.match(isoWithOffset(new Date('2026-01-02T03:04:05Z')), /[+-]\d\d:\d\d$/);
  assert.throws(() => makeEntry({ name: 'Doanh', score: 1, nights_won: 4, seed: 1 }));
});

test('run_cmd --export-leaderboard writes {"entries": [...]} in order and exits 0', () => {
  const d = tmp();
  const lb = join(d, 'lb.json');
  writeFileSync(lb, JSON.stringify({ entries: [
    { name: 'bbb', score: 10, nights_won: 0, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 },
    { name: 'aaa', score: 30, nights_won: 1, achieved_at: '2026-11-20T09:00:00+07:00', seed: 2 },
  ] }));
  const out = join(d, 'out.json');
  const r = sh(contract.run_cmd, ['--export-leaderboard', out], { LEADERBOARD_FILE: lb });
  assert.equal(r.status, 0, r.stderr);
  const doc = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(doc.entries.map((e) => e.name), ['aaa', 'bbb']);
  const empty = join(d, 'empty.json');
  const r2 = sh(contract.run_cmd, ['--export-leaderboard', empty], { LEADERBOARD_FILE: join(d, 'missing.json') });
  assert.equal(r2.status, 0);
  assert.deepEqual(JSON.parse(readFileSync(empty, 'utf8')), { entries: [] });
});

test('bench stats follow the ticket definitions', () => {
  const dts = [...Array(98).fill(10), 40, 50];
  const s = benchStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round(((1000 * 100) / (98 * 10 + 90)) * 10) / 10);
  assert.equal(s.p1_low_fps, 20);
  assert.equal(s.frame_ms_p95, 10);
  assert.equal(benchStats([16]).p1_low_fps, 62.5);
});

test('bench scene: 200 wander shades, 100 motes, L1-L3 lit at fuel 100; no spawns, damage, pickup, decay or end', () => {
  const g = createGame({ tuning, seed: 42, night: 1, bench: true });
  const s0 = g.snapshot();
  assert.equal(s0.shades.length, 200);
  assert.ok(s0.shades.every((s) => s.state === 'wander'));
  assert.ok(s0.shades.every((s) => Math.hypot(s.pos[0], s.pos[2]) <= 38));
  assert.equal(s0.motes.length, 100);
  assert.deepEqual(s0.lanterns.map((l) => [l.lit, l.fuel]), [[true, 100], [true, 100], [true, 100], [false, 0], [false, 0]]);
  for (let i = 0; i < 60 * 400; i++) g.step({});
  const s1 = g.snapshot();
  assert.equal(s1.state, 'playing');
  assert.equal(s1.shades.length, 200);
  assert.equal(s1.motes.length, 100);
  assert.equal(s1.player.flames, 3);
  assert.ok(s1.lanterns.slice(0, 3).every((l) => l.fuel === 100));
  assert.ok(s1.shades.every((s) => s.state === 'wander'));
  assert.notDeepEqual(s1.shades[0].pos, s0.shades[0].pos);
  assert.deepEqual(createGame({ tuning, seed: 42, night: 1, bench: true }).snapshot(), s0);
});

test('soak_cmd: 10 nights, 0 crashes, memory within 1.2x, valid soak.json', () => {
  const out = join(tmp(), 'soak.json');
  const r = sh(contract.soak_cmd, ['--seed', '7', '--nights', '10', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 10);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 10);
  assert.ok(s.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} vs ${s.mem_start_mb}`);
});
