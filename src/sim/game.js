import { createRng } from './rng.js';
import * as C from './constants.js';
import { MAPS } from './maps.js';

const EPS = 1e-9;
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export const round3 = (v) => Math.round(v * 1000) / 1000 + 0;
const r3v = (p) => [round3(p[0]), round3(p[1]), round3(p[2])];
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const idNum = (id) => {
  const m = /(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
const byId = (a, b) => idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));
const byDistThenId = (a, b) => a.d - b.d || byId(a, b);
const ticksOf = (s) => Math.max(0, Math.round((Number(s) || 0) * C.TICK_RATE));
const unitAway = (from, to) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d < EPS ? [1, 0] : [dx / d, dz / d];
};

export function moveToWorld(move, camYawDeg) {
  let x = move[0];
  let z = move[1];
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const t = (camYawDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

export function createGame({ tuning, seed = 0, scenario = null, night = 1 }) {
  const T = tuning;
  const M = MAPS[night];
  if (!M) throw new Error(`unknown night ${night}`);
  const sc = scenario || {};
  const rng = createRng(seed);
  const groundAt = (x, z) => M.ground(x, z);

  const g = {
    tuning: T,
    map: M,
    night,
    tick: 0,
    simTick: 0,
    state: 'playing',
    paused: false,
    score: 0,
    duration: sc.time_left_s ?? T[M.durationKey],
    player: {
      pos: [...M.start],
      vel: [0, 0, 0],
      vy: 0,
      grounded: true,
      facing: 0,
      flames: T.flames,
      carried: 0,
      invuln: 0,
      dashCd: 0,
      pulseCd: 0,
      charm: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      launch: null,
      fallWait: 0,
      respawnNow: false,
    },
    lanterns: M.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0, justLit: false })),
    motes: [],
    shades: [],
    drifters: [],
    charms: M.charms.map((c) => ({ id: c.id, pos: [...c.pos], available: true, respawn: 0 })),
    wind: { enabled: sc.wind_enabled ?? M.wind, active: false, dirDeg: 0 },
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    randomDrifters: sc.random_drifters !== false && M.drifters,
    prevButtons: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    nextMote: 1,
    nextShade: 1,
    nextDrifter: 1,
    startEvents: [{ name: 'night_start', data: { night } }],
  };
  const p = g.player;

  const usedShade = new Set();
  const newShadeId = () => {
    while (usedShade.has(`S${g.nextShade}`)) g.nextShade++;
    const id = `S${g.nextShade++}`;
    usedShade.add(id);
    return id;
  };
  const usedDrifter = new Set();
  const newDrifterId = () => {
    while (usedDrifter.has(`D${g.nextDrifter}`)) g.nextDrifter++;
    const id = `D${g.nextDrifter++}`;
    usedDrifter.add(id);
    return id;
  };
  const addMote = (pos, kind, pointIdx = -1) => {
    const m = { id: `M${g.nextMote++}`, pos: [...pos], kind, ttl: kind === 'dropped' ? C.DROP_TTL : null, pointIdx };
    g.motes.push(m);
    return m;
  };
  const makeShade = (id, pos, state = 'wander', ticks = 0) => ({
    id, pos: [...pos], state, ticks, pushTicks: 0, pushDir: [1, 0], recoilDir: [1, 0], evict: false, waypoint: null, retarget: 0,
  });
  const makeDrifter = (id, pos, state = 'idle', stolen = 0, ticks = 0) => ({ id, pos: [...pos], state, stolen, ticks, waypoint: null, retarget: 0 });
  const randomIslandPoint = () => {
    const pt = M.motePoints[Math.floor(rng() * M.motePoints.length)];
    return [pt[0], pt[1], pt[2]];
  };

  if (sc.player) {
    const sp = sc.player;
    if (Array.isArray(sp.pos)) p.pos = sp.pos.map(Number);
    if (sp.carried != null) p.carried = sp.carried;
    if (sp.flames != null) p.flames = sp.flames;
    if (sp.invuln_ticks != null) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks != null) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks != null) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks != null) p.charm = sp.charm_ticks;
  }
  {
    const gh = groundAt(p.pos[0], p.pos[2]);
    p.grounded = gh !== null && Math.abs(p.pos[1] - gh) < 1e-6;
  }

  if (Array.isArray(sc.lanterns)) {
    for (const l of sc.lanterns) {
      const t = g.lanterns.find((x) => x.id === l.id);
      if (!t) continue;
      if (Array.isArray(l.pos)) t.pos = l.pos.map(Number);
      if (l.deposited != null) t.deposited = l.deposited;
      if (l.lit === true) t.lit = true;
      if (l.lit === false) t.lit = false;
      if (t.deposited >= T.lantern_cost) t.lit = true;
      if (t.lit) t.deposited = Math.max(t.deposited, T.lantern_cost);
    }
  }

  if (Array.isArray(sc.motes)) {
    for (const pos of sc.motes) {
      const idx = M.motePoints.findIndex((q) => q[0] === pos[0] && q[1] === pos[1] && q[2] === pos[2]);
      addMote(pos.map(Number), 'random', idx);
    }
  } else if (g.randomMotes) {
    const idxs = M.motePoints.map((_, i) => i);
    for (let i = 0; i < C.MOTE_START && idxs.length; i++) {
      const k = Math.floor(rng() * idxs.length);
      const [idx] = idxs.splice(k, 1);
      addMote(M.motePoints[idx], 'random', idx);
    }
  }

  if (Array.isArray(sc.shades)) {
    for (const s of sc.shades) if (s.id != null) usedShade.add(String(s.id));
    for (const s of sc.shades) {
      const id = s.id != null ? String(s.id) : newShadeId();
      const st = SHADE_STATES.includes(s.state) ? s.state : 'wander';
      const sh = makeShade(id, s.pos.map(Number), st, s.state_ticks_left ?? 0);
      if (st === 'stunned' && !s.state_ticks_left) sh.ticks = ticksOf(T.pulse_stun_s);
      if (st === 'recoil') {
        if (!s.state_ticks_left) sh.ticks = C.SHADE_RECOIL_TICKS;
        sh.recoilDir = unitAway(p.pos, sh.pos);
      }
      if (st === 'spawning' && !s.state_ticks_left) sh.ticks = C.SHADE_SPAWNING_TICKS;
      g.shades.push(sh);
    }
  }

  if (Array.isArray(sc.drifters)) {
    for (const d of sc.drifters) if (d.id != null) usedDrifter.add(String(d.id));
    for (const d of sc.drifters) {
      const id = d.id != null ? String(d.id) : newDrifterId();
      const st = DRIFTER_STATES.includes(d.state) ? d.state : 'idle';
      let ticks = d.state_ticks_left ?? 0;
      if (st === 'flee' && !ticks) ticks = C.DRIFTER_FLEE_TICKS;
      g.drifters.push(makeDrifter(id, d.pos.map(Number), st, d.stolen ?? 0, ticks));
    }
  }

  if (Array.isArray(sc.charms)) {
    g.charms = sc.charms.map((c) => {
      const def = M.charms.find((x) => x.id === c.id);
      const pos = Array.isArray(c.pos) ? c.pos.map(Number) : def ? [...def.pos] : [0, 0, 0];
      const available = c.available !== false;
      return { id: String(c.id), pos, available, respawn: available ? 0 : c.respawn_ticks ?? C.CHARM_RESPAWN };
    });
  }

  g.timeLeft = () => g.duration - g.simTick / C.TICK_RATE;
  g.groundAt = groundAt;
  g.windWarning = () => g.wind.enabled && !g.wind.active && C.WIND_EVERY - (g.simTick % C.WIND_EVERY) <= C.WIND_WARN_TICKS;

  const blockedAt = (x, z, y) => {
    const gh = groundAt(x, z);
    if (gh !== null && gh > y + C.STEP_UP) return true;
    const tw = M.tower;
    if (tw && Math.hypot(x - tw.pos[0], z - tw.pos[2]) < tw.radius && y < tw.pos[1] + tw.height) return true;
    return false;
  };

  const keepOutOfSafe = (s) => {
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const d = hdist(s.pos, l.pos);
      if (d < T.safe_radius) {
        const [ux, uz] = unitAway(l.pos, s.pos);
        s.pos[0] = l.pos[0] + ux * T.safe_radius;
        s.pos[2] = l.pos[2] + uz * T.safe_radius;
      }
    }
  };
  const hover = (e, h) => {
    const gh = groundAt(e.pos[0], e.pos[2]);
    e.pos[1] = (gh ?? 0) + h;
  };
  const moveToward = (e, target, speed) => {
    const d = hdist(e.pos, target);
    if (d < EPS) return;
    const step = Math.min(speed * C.DT, d);
    e.pos[0] += ((target[0] - e.pos[0]) / d) * step;
    e.pos[2] += ((target[2] - e.pos[2]) / d) * step;
  };
  const wander = (e, speed) => {
    if (!e.waypoint || e.retarget <= 0 || hdist(e.pos, e.waypoint) < 0.5) {
      e.waypoint = randomIslandPoint();
      e.retarget = C.SHADE_WANDER_RETARGET;
    }
    e.retarget -= 1;
    moveToward(e, e.waypoint, speed);
  };

  const dropMotes = (count) => {
    if (count <= 0) return;
    const base = rng() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = base + (i * Math.PI * 2) / count;
      const r = C.DROP_RING[0] + rng() * (C.DROP_RING[1] - C.DROP_RING[0]);
      let x = p.pos[0] + Math.cos(a) * r;
      let z = p.pos[2] + Math.sin(a) * r;
      let gh = groundAt(x, z);
      if (gh === null) {
        x = p.pos[0] - Math.cos(a) * r;
        z = p.pos[2] - Math.sin(a) * r;
        gh = groundAt(x, z);
      }
      if (gh === null) {
        x = p.pos[0];
        z = p.pos[2];
        gh = p.pos[1];
      }
      addMote([round3(x), gh, round3(z)], 'dropped');
    }
  };

  const tickCounters = () => {
    g.simTick += 1;
    if (p.dashCd > 0) p.dashCd -= 1;
    if (p.pulseCd > 0) p.pulseCd -= 1;
    if (p.invuln > 0) p.invuln -= 1;
    if (p.charm > 0) p.charm -= 1;
    if (p.fallWait > 0) {
      p.fallWait -= 1;
      if (p.fallWait === 0 && p.flames > 0) p.respawnNow = true;
    }
    for (const s of g.shades) {
      if ((s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') && s.ticks > 0) {
        s.ticks -= 1;
        if (s.ticks === 0) {
          s.state = 'wander';
          s.pushTicks = 0;
        }
      }
    }
    for (const d of g.drifters) {
      if (d.state === 'flee' && d.ticks > 0) {
        d.ticks -= 1;
        if (d.ticks === 0) d.state = 'removed';
      }
    }
    for (let i = g.motes.length - 1; i >= 0; i--) {
      const m = g.motes[i];
      if (m.kind === 'dropped') {
        m.ttl -= 1;
        if (m.ttl <= 0) g.motes.splice(i, 1);
      }
    }
    for (const c of g.charms) {
      if (!c.available && c.respawn > 0) {
        c.respawn -= 1;
        if (c.respawn === 0) c.available = true;
      }
    }
    if (g.wind.enabled) {
      const phase = g.simTick % C.WIND_EVERY;
      if (phase === 0) g.wind.dirDeg = Math.floor(rng() * 360);
      g.wind.active = g.simTick >= C.WIND_EVERY && phase < C.WIND_TICKS;
    }
  };

  const movePlayer = (input, pressed, emit) => {
    if (p.respawnNow) {
      p.respawnNow = false;
      p.pos = [...M.start];
      p.vel = [0, 0, 0];
      p.vy = 0;
      p.grounded = true;
      p.launch = null;
      p.dashTicks = 0;
      p.invuln = ticksOf(T.invuln_s);
      return;
    }
    if (p.fallWait > 0 || p.flames <= 0) {
      p.vel = [0, 0, 0];
      return;
    }
    const speed = p.charm > 0 ? C.CHARM_SPEED : T.player_speed;
    const [wx, wz] = moveToWorld(input.move || [0, 0], input.cam_yaw_deg || 0);
    const moving = Math.hypot(wx, wz) > EPS;
    if (moving && !p.launch) p.facing = Math.atan2(wx, wz);

    if (pressed('dash') && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      const len = Math.hypot(wx, wz);
      p.dashDir = moving ? [wx / len, wz / len] : [Math.sin(p.facing), Math.cos(p.facing)];
      p.dashTicks = ticksOf(T.dash_duration_s);
      p.dashCd = ticksOf(T.dash_cooldown_s);
      emit('dash', {});
    }
    const dashing = p.dashTicks > 0;

    let hx;
    let hz;
    if (dashing) {
      hx = p.dashDir[0] * T.dash_speed;
      hz = p.dashDir[1] * T.dash_speed;
    } else if (p.launch) {
      [hx, hz] = p.launch;
    } else {
      hx = wx * speed;
      hz = wz * speed;
    }
    if (g.wind.active) {
      const a = (g.wind.dirDeg * Math.PI) / 180;
      hx += Math.cos(a) * C.WIND_SPEED;
      hz += Math.sin(a) * C.WIND_SPEED;
    }

    if (pressed('jump') && p.grounded && !p.launch) {
      p.vy = C.JUMP_SPEED;
      p.grounded = false;
    }

    const nx = p.pos[0] + hx * C.DT;
    const nz = p.pos[2] + hz * C.DT;
    if (!blockedAt(nx, nz, p.pos[1])) {
      p.pos[0] = nx;
      p.pos[2] = nz;
    } else if (!blockedAt(nx, p.pos[2], p.pos[1])) {
      p.pos[0] = nx;
    } else if (!blockedAt(p.pos[0], nz, p.pos[1])) {
      p.pos[2] = nz;
    }

    const gh = groundAt(p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (gh === null || gh < p.pos[1] - C.SNAP_DOWN) {
        p.grounded = false;
        p.vy = 0;
      } else {
        p.pos[1] = gh;
        p.vy = 0;
      }
    } else if (!dashing) {
      p.vy -= C.GRAVITY * C.DT;
      p.pos[1] += p.vy * C.DT;
      if (gh !== null && p.pos[1] <= gh && p.vy <= 0) {
        p.pos[1] = gh;
        p.vy = 0;
        p.grounded = true;
        p.launch = null;
      }
    }
    if (dashing) p.dashTicks -= 1;

    p.vel = [hx, p.grounded || dashing ? 0 : p.vy, hz];

    if (p.grounded) {
      for (const pad of M.pads) {
        if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= 1 + EPS && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
          let dx;
          let dz;
          if (pad.target) {
            const tx = pad.target[0] - p.pos[0];
            const tz = pad.target[1] - p.pos[2];
            const len = Math.hypot(tx, tz);
            dx = tx / len;
            dz = tz / len;
          } else {
            [dx, dz] = pad.dir;
          }
          p.launch = [dx * pad.speed, dz * pad.speed];
          p.vy = pad.vy;
          p.grounded = false;
          break;
        }
      }
    }

    if (p.pos[1] < C.FALL_Y && p.fallWait === 0) {
      const lost = p.carried;
      p.carried = 0;
      p.flames = Math.max(0, p.flames - 1);
      p.fallWait = C.FALL_WAIT_TICKS;
      p.vel = [0, 0, 0];
      p.vy = 0;
      p.launch = null;
      p.dashTicks = 0;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  };

  const active = () => p.fallWait === 0 && p.flames > 0 && !p.respawnNow;

  g.step = (input = {}) => {
    if (g.state === 'won' || g.state === 'lost') return [];
    const events = [];
    const emit = (name, data) => events.push({ name, data });
    const btn = {
      jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause,
    };
    const prev = g.prevButtons;
    g.prevButtons = btn;

    if (btn.pause && !prev.pause) {
      if (!g.paused) {
        g.paused = true;
        g.state = 'paused';
        g.tick += 1;
        emit('paused', {});
        return events;
      }
      g.paused = false;
      g.state = 'playing';
      emit('resumed', {});
    } else if (g.paused) {
      g.tick += 1;
      return events;
    }
    const pressedNow = (k) => btn[k] && !prev[k];

    tickCounters();
    movePlayer(input, pressedNow, emit);

    if (active()) {
      if (p.carried < T.carry_capacity) {
        const near = g.motes
          .map((m) => ({ m, id: m.id, d: hdist(p.pos, m.pos) }))
          .filter((x) => x.d <= T.pickup_radius + EPS && Math.abs(p.pos[1] - x.m.pos[1]) <= C.PICKUP_HEIGHT + EPS)
          .sort(byDistThenId);
        for (const { m } of near) {
          if (p.carried >= T.carry_capacity) break;
          g.motes.splice(g.motes.indexOf(m), 1);
          p.carried += 1;
          emit('mote_picked', { carried: p.carried });
        }
      }
      for (const c of g.charms) {
        if (c.available && hdist(p.pos, c.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= C.PICKUP_HEIGHT + EPS) {
          c.available = false;
          c.respawn = C.CHARM_RESPAWN;
          p.charm = C.CHARM_TICKS;
          emit('charm_picked', { charm_id: c.id, charm_ticks: C.CHARM_TICKS });
        }
      }
    }

    if (active() && pressedNow('interact') && p.carried > 0) {
      const cand = g.lanterns
        .filter((l) => !l.lit)
        .map((l) => ({ l, id: l.id, d: hdist(p.pos, l.pos) }))
        .filter((x) => x.d <= T.interact_radius + EPS)
        .sort(byDistThenId)[0];
      if (cand) {
        const l = cand.l;
        const amount = Math.min(p.carried, T.lantern_cost - l.deposited);
        if (amount > 0) {
          p.carried -= amount;
          l.deposited += amount;
          g.score += T.score.per_mote * amount;
          emit('deposit', { lantern_id: l.id, amount, deposited: l.deposited });
          if (l.deposited >= T.lantern_cost) {
            l.lit = true;
            l.justLit = true;
            g.score += T.score.per_lantern;
            emit('lantern_lit', { lantern_id: l.id });
          }
        }
      }
    }

    for (const l of g.lanterns) {
      if (!l.justLit) continue;
      l.justLit = false;
      for (const s of g.shades) {
        if (hdist(s.pos, l.pos) < T.safe_radius) s.evict = { lantern: l, ticks: C.SAFE_EVICT_TICKS };
      }
    }

    if (active() && pressedNow('pulse') && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCd = ticksOf(T.pulse_cooldown_s);
      const c = [p.pos[0], p.pos[1] + C.PULSE_HEIGHT, p.pos[2]];
      const d3 = (e) => Math.hypot(e.pos[0] - c[0], e.pos[1] - c[1], e.pos[2] - c[2]);
      const hit = g.shades.filter((s) => d3(s) <= T.pulse_radius + EPS).sort(byId);
      for (const s of hit) {
        s.state = 'stunned';
        s.ticks = ticksOf(T.pulse_stun_s);
        s.pushTicks = C.PUSH_TICKS;
        s.pushDir = unitAway(p.pos, s.pos);
      }
      g.score += T.score.per_stun * hit.length;
      for (const d of g.drifters.filter((x) => x.state !== 'removed' && d3(x) <= T.pulse_radius + EPS).sort(byId)) {
        if (d.state === 'chase') {
          d.state = 'flee';
          d.ticks = C.DRIFTER_FLEE_TICKS;
        } else if (d.state === 'flee' && d.stolen > 0) {
          const gh = groundAt(d.pos[0], d.pos[2]) ?? 0;
          for (let i = 0; i < d.stolen; i++) addMote([round3(d.pos[0]), gh, round3(d.pos[2])], 'dropped');
          emit('drifter_drop', { drifter_id: d.id, amount: d.stolen });
          d.stolen = 0;
          d.ticks = C.DRIFTER_DROP_VANISH_TICKS;
        }
      }
      emit('pulse', { stunned_ids: hit.map((s) => s.id) });
    }

    const shadeSpeed = T.shade_speed * M.shadeSpeedMul;
    for (const s of g.shades) {
      if (s.evict) {
        const l = s.evict.lantern;
        const d = hdist(s.pos, l.pos);
        const [ux, uz] = unitAway(l.pos, s.pos);
        const nd = Math.min(T.safe_radius, d + T.safe_radius / C.SAFE_EVICT_TICKS);
        s.pos[0] = l.pos[0] + ux * nd;
        s.pos[2] = l.pos[2] + uz * nd;
        s.evict.ticks -= 1;
        if (nd >= T.safe_radius - EPS || s.evict.ticks <= 0) {
          s.pos[0] = l.pos[0] + ux * T.safe_radius;
          s.pos[2] = l.pos[2] + uz * T.safe_radius;
          s.evict = false;
        }
        continue;
      }
      if (s.state === 'spawning') continue;
      if (s.state === 'stunned') {
        if (s.pushTicks > 0) {
          const step = T.pulse_push_m / C.PUSH_TICKS;
          s.pos[0] += s.pushDir[0] * step;
          s.pos[2] += s.pushDir[1] * step;
          s.pushTicks -= 1;
          keepOutOfSafe(s);
        }
        continue;
      }
      if (s.state === 'recoil') {
        const step = C.SHADE_RECOIL_M / C.SHADE_RECOIL_TICKS;
        s.pos[0] += s.recoilDir[0] * step;
        s.pos[2] += s.recoilDir[1] * step;
        keepOutOfSafe(s);
        hover(s, C.SHADE_HOVER);
        continue;
      }
      const d = hdist(s.pos, p.pos);
      if (!active()) s.state = 'wander';
      else if (s.state === 'wander' && d <= C.SHADE_DETECT + EPS) s.state = 'chase';
      else if (s.state === 'chase' && d > C.SHADE_GIVEUP + EPS) s.state = 'wander';
      if (s.state === 'chase') moveToward(s, p.pos, shadeSpeed);
      else wander(s, C.SHADE_WANDER_SPEED);
      keepOutOfSafe(s);
      hover(s, C.SHADE_HOVER);
    }

    for (const d of g.drifters) {
      if (d.state === 'removed') continue;
      if (d.state === 'flee') {
        const [ux, uz] = unitAway(p.pos, d.pos);
        d.pos[0] += ux * C.DRIFTER_SPEED * C.DT;
        d.pos[2] += uz * C.DRIFTER_SPEED * C.DT;
        continue;
      }
      const want = active() && p.carried >= C.DRIFTER_CHASE_CARRY && hdist(d.pos, p.pos) <= C.DRIFTER_CHASE_DIST + EPS;
      d.state = want ? 'chase' : 'idle';
      if (d.state === 'chase') moveToward(d, p.pos, C.DRIFTER_SPEED);
      else wander(d, C.DRIFTER_IDLE_SPEED);
      hover(d, C.DRIFTER_HOVER);
    }

    if (active()) {
      for (const d of [...g.drifters].sort(byId)) {
        if (d.state !== 'chase' || p.carried <= 0) continue;
        if (hdist(d.pos, p.pos) <= C.DRIFTER_TOUCH + EPS) {
          const amount = Math.min(C.DRIFTER_STEAL, p.carried);
          p.carried -= amount;
          d.stolen = amount;
          d.state = 'flee';
          d.ticks = C.DRIFTER_FLEE_TICKS;
          emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }
      for (const s of [...g.shades].sort(byId)) {
        if (s.evict || (s.state !== 'wander' && s.state !== 'chase')) continue;
        if (hdist(s.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(s.pos[1] - p.pos[1]) > C.SHADE_HIT_HEIGHT + EPS) continue;
        if (p.invuln > 0) continue;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        p.flames = Math.max(0, p.flames - 1);
        p.invuln = ticksOf(T.invuln_s);
        dropMotes(dropped);
        s.state = 'recoil';
        s.ticks = C.SHADE_RECOIL_TICKS;
        s.recoilDir = unitAway(p.pos, s.pos);
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }

    if (g.randomMotes && g.simTick % C.MOTE_SPAWN_EVERY === 0 && g.motes.length < C.MOTE_CAP) {
      const taken = new Set(g.motes.filter((m) => m.kind === 'random').map((m) => m.pointIdx));
      const free = M.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
      if (free.length) {
        const idx = free[Math.floor(rng() * free.length)];
        addMote(M.motePoints[idx], 'random', idx);
      }
    }
    if (g.randomShades) {
      let count = 0;
      if (g.simTick === C.SHADE_FIRST_SPAWN) count = C.SHADE_FIRST_COUNT;
      else if (g.simTick > C.SHADE_FIRST_SPAWN && (g.simTick - C.SHADE_FIRST_SPAWN) % M.shadeInterval === 0) count = 1;
      for (let i = 0; i < count && g.shades.length < M.shadeMax; i++) {
        const valid = M.shadePoints.filter((q) => hdist(q, p.pos) >= C.SHADE_MIN_SPAWN_DIST - EPS);
        if (!valid.length) break;
        const q = valid[Math.floor(rng() * valid.length)];
        const s = makeShade(newShadeId(), [q[0], (groundAt(q[0], q[2]) ?? 0) + C.SHADE_HOVER, q[2]], 'spawning', C.SHADE_SPAWNING_TICKS);
        g.shades.push(s);
        emit('shade_spawned', { id: s.id });
      }
    }
    if (g.randomDrifters && g.simTick % C.DRIFTER_SPAWN_EVERY === 0) {
      const alive = g.drifters.filter((d) => d.state !== 'removed').length;
      if (alive < C.DRIFTER_MAX) {
        const q = M.shadePoints[Math.floor(rng() * M.shadePoints.length)];
        g.drifters.push(makeDrifter(newDrifterId(), [q[0], (groundAt(q[0], q[2]) ?? 0) + C.DRIFTER_HOVER, q[2]]));
      }
    }

    g.tick += 1;

    if (p.flames <= 0) {
      g.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (g.lanterns.every((l) => l.lit)) {
      g.score += T.score.per_second_left * Math.floor(Math.max(0, g.timeLeft()) + EPS);
      g.score += T.score.per_flame_left * p.flames;
      g.state = 'won';
      emit('game_over', { result: 'won', reason: 'all_lit' });
    } else if (g.timeLeft() <= EPS) {
      g.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
    return events;
  };

  g.snapshot = () => ({
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state,
    time_left_s: round3(Math.max(0, g.timeLeft())),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dirDeg },
    player: {
      pos: r3v(p.pos),
      vel: r3v(p.vel),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: p.invuln > 0,
      dash_cd_s: round3(p.dashCd / C.TICK_RATE),
      pulse_cd_s: round3(p.pulseCd / C.TICK_RATE),
      charm_s: round3(p.charm / C.TICK_RATE),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3v(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : round3(m.ttl / C.TICK_RATE) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: r3v(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: r3v(c.pos), available: c.available, respawn_s: round3(c.respawn / C.TICK_RATE) })),
  });

  return g;
}
