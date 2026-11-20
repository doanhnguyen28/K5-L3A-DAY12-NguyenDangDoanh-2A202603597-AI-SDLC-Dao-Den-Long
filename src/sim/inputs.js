export class InputError extends Error {}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export function validateInputs(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.frames)) throw new InputError('inputs: missing "frames" array');
  let last = -1;
  for (const [i, f] of doc.frames.entries()) {
    if (!f || typeof f !== 'object') throw new InputError(`inputs: frame ${i} is not an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new InputError(`inputs: frame ${i} has invalid tick`);
    if (f.tick <= last) throw new InputError(`inputs: frame ${i} tick ${f.tick} is not strictly increasing`);
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum) || f.move.some((v) => v < -1 || v > 1)) {
        throw new InputError(`inputs: frame ${i} has invalid move`);
      }
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) throw new InputError(`inputs: frame ${i} has invalid cam_yaw_deg`);
    for (const b of BUTTONS) {
      if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new InputError(`inputs: frame ${i} has non-boolean ${b}`);
    }
  }
  return doc;
}

export function validateScenario(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new InputError('scenario: must be a JSON object');
  const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
  if (doc.player !== undefined) {
    const p = doc.player;
    if (!p || typeof p !== 'object') throw new InputError('scenario: invalid player');
    if (p.pos !== undefined && !vec3(p.pos)) throw new InputError('scenario: invalid player.pos');
    if (p.carried !== undefined && !(Number.isInteger(p.carried) && p.carried >= 0)) throw new InputError('scenario: invalid player.carried');
    if (p.flames !== undefined && !(Number.isInteger(p.flames) && p.flames >= 0)) throw new InputError('scenario: invalid player.flames');
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (p[k] !== undefined && !(Number.isInteger(p[k]) && p[k] >= 0)) throw new InputError(`scenario: invalid player.${k}`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (doc[k] !== undefined && typeof doc[k] !== 'boolean') throw new InputError(`scenario: ${k} must be boolean`);
  }
  if (doc.motes !== undefined && !(Array.isArray(doc.motes) && doc.motes.every(vec3))) throw new InputError('scenario: invalid motes');
  if (doc.shades !== undefined) {
    if (!Array.isArray(doc.shades)) throw new InputError('scenario: invalid shades');
    for (const s of doc.shades) {
      if (!s || typeof s !== 'object' || !vec3(s.pos)) throw new InputError('scenario: invalid shade');
      if (s.state !== undefined && !['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(s.state)) throw new InputError('scenario: invalid shade state');
      if (s.state_ticks_left !== undefined && !(Number.isInteger(s.state_ticks_left) && s.state_ticks_left >= 0)) throw new InputError('scenario: invalid shade state_ticks_left');
    }
  }
  if (doc.drifters !== undefined) {
    if (!Array.isArray(doc.drifters)) throw new InputError('scenario: invalid drifters');
    for (const d of doc.drifters) {
      if (!d || typeof d !== 'object' || !vec3(d.pos)) throw new InputError('scenario: invalid drifter');
      if (d.state !== undefined && !['idle', 'chase', 'flee', 'removed'].includes(d.state)) throw new InputError('scenario: invalid drifter state');
      if (d.stolen !== undefined && !(Number.isInteger(d.stolen) && d.stolen >= 0)) throw new InputError('scenario: invalid drifter stolen');
    }
  }
  if (doc.charms !== undefined) {
    if (!Array.isArray(doc.charms)) throw new InputError('scenario: invalid charms');
    for (const c of doc.charms) {
      if (!c || typeof c !== 'object' || c.id === undefined) throw new InputError('scenario: charm needs id');
      if (c.pos !== undefined && !vec3(c.pos)) throw new InputError('scenario: invalid charm pos');
    }
  }
  if (doc.lanterns !== undefined) {
    if (!Array.isArray(doc.lanterns)) throw new InputError('scenario: invalid lanterns');
    for (const l of doc.lanterns) {
      if (!l || typeof l !== 'object' || typeof l.id !== 'string') throw new InputError('scenario: lantern needs string id');
      if (l.pos !== undefined && !vec3(l.pos)) throw new InputError('scenario: invalid lantern pos');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') throw new InputError('scenario: invalid lantern lit');
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new InputError('scenario: invalid lantern deposited');
    }
  }
  if (doc.time_left_s !== undefined && !(isNum(doc.time_left_s) && doc.time_left_s > 0)) throw new InputError('scenario: invalid time_left_s');
  return doc;
}

export function createInputTimeline(doc) {
  const frames = doc ? doc.frames : [];
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let idx = 0;
  return function at(tick) {
    while (idx < frames.length && frames[idx].tick <= tick) {
      const f = frames[idx++];
      if (f.move !== undefined) cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (f[b] !== undefined) cur[b] = f[b];
    }
    return cur;
  };
}
