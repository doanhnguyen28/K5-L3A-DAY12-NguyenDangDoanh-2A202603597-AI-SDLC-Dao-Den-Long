import { createGame } from './game.js';
import { createInputTimeline } from './inputs.js';

export function runHeadless({ tuning, seed, scenario, inputs, ticks, snapshotEvery = 10, night = 1 }) {
  const lines = [];
  const game = createGame({ tuning, seed, scenario, night });
  for (const e of game.startEvents) lines.push({ type: 'event', tick: 0, name: e.name, data: e.data });
  const inputAt = createInputTimeline(inputs);
  lines.push(game.snapshot());
  for (let k = 0; k < ticks && (game.state === 'playing' || game.state === 'paused'); k++) {
    const events = game.step(inputAt(k));
    for (const e of events) lines.push({ type: 'event', tick: game.tick, name: e.name, data: e.data });
    if (game.tick % snapshotEvery === 0) lines.push(game.snapshot());
  }
  lines.push({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  return lines;
}
