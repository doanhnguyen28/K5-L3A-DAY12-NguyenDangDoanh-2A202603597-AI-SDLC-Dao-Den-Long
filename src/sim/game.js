import { createRng } from './rng.js';
import * as C from './constants.js';

const EPS = 1e-9;

export const round3 = (v) => Math.round(v * 1000) / 1000 + 0;
const r3v = (p) => [round3(p[0]), round3(p[1]), round3(p[2])];
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const idNum = (id) => {
  const m = /(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
const byDistThenId = (a, b) => a.d - b.d || idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));

export function defaultLanterns(count = 5) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const ang = (2 * Math.PI * k) / count;
    out.push({
      id: `L${k + 1}`,
      pos: [round3(C.LANTERN_RING_RADIUS * Math.sin(ang)), 0, round3(C.LANTERN_RING_RADIUS * Math.cos(ang))],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

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

export function createGame({ tuning, seed = 0, scenario = null }) {
  const T = tuning;
  const sc = scenario || {};
  const rng = createRng(seed);
  const secToTicks = (s) => Math.max(0, Math.round((Number(s) || 0) * C.TICK_RATE));

  const g = {
    tuning: T,
    tick: 0,
    state: 'playing',
    result: null,
    score: 0,
    duration: sc.time_left_s ?? T.night1_duration_s,
    player: { pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0, invulnUntil: 0, pulseReadyAt: 0, facing: 0 },
    lanterns: defaultLanterns(T.lantern_count_night1),
    shades: [],
    motes: [],
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    moteTimer: 0,
    shadeTimer: 0,
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
    nextMote: 1,
    nextShade: 1,
  };

  const usedShadeIds = new Set();
  const newShadeId = () => {
    while (usedShadeIds.has(`S${g.nextShade}`)) g.nextShade++;
    const id = `S${g.nextShade++}`;
    usedShadeIds.add(id);
    return id;
  };
  const newMoteId = () => `M${g.nextMote++}`;

  const randomMotePos = () => {
    const r = Math.sqrt(C.MOTE_MIN_FROM_ORIGIN ** 2 + rng() * (C.MOTE_SPAWN_RADIUS ** 2 - C.MOTE_MIN_FROM_ORIGIN ** 2));
    const a = rng() * 2 * Math.PI;
    return [round3(r * Math.cos(a)), 0, round3(r * Math.sin(a))];
  };
  const randomShadePos = () => {
    const a = rng() * 2 * Math.PI;
    return [round3(C.SHADE_SPAWN_RING * Math.cos(a)), C.SHADE_HOVER_Y, round3(C.SHADE_SPAWN_RING * Math.sin(a))];
  };
  const makeShade = (pos, id) => ({ id, pos: [...pos], state: 'chase', stunUntil: 0 });

  if (sc.player) {
    if (Array.isArray(sc.player.pos)) g.player.pos = sc.player.pos.map(Number);
    if (sc.player.carried != null) g.player.carried = Number(sc.player.carried);
    if (sc.player.flames != null) g.player.flames = Number(sc.player.flames);
  }

  if (Array.isArray(sc.lanterns)) {
    for (const l of sc.lanterns) {
      const target = g.lanterns.find((x) => x.id === l.id);
      if (!target) continue;
      if (Array.isArray(l.pos)) target.pos = l.pos.map(Number);
      if (l.deposited != null) target.deposited = Number(l.deposited);
      if (l.lit === true) target.lit = true;
      if (l.lit === false) target.lit = false;
      if (target.deposited >= T.lantern_cost) target.lit = true;
      if (target.lit) target.deposited = Math.max(target.deposited, T.lantern_cost);
    }
  }

  if (Array.isArray(sc.motes)) {
    for (const p of sc.motes) g.motes.push({ id: newMoteId(), pos: p.map(Number) });
  } else if (g.randomMotes) {
    for (let i = 0; i < C.MOTE_TARGET; i++) g.motes.push({ id: newMoteId(), pos: randomMotePos() });
  }

  if (Array.isArray(sc.shades)) {
    for (const s of sc.shades) if (s.id != null) usedShadeIds.add(String(s.id));
    for (const s of sc.shades) {
      const id = s.id != null ? String(s.id) : newShadeId();
      g.shades.push(makeShade((s.pos || [0, C.SHADE_HOVER_Y, 0]).map(Number), id));
    }
  } else if (g.randomShades) {
    for (let i = 0; i < C.SHADE_INITIAL; i++) g.shades.push(makeShade(randomShadePos(), newShadeId()));
  }

  g.timeLeft = () => g.duration - g.tick / C.TICK_RATE;

  const keepOutOfLanterns = (s) => {
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const d = hdist(s.pos, l.pos);
      if (d < T.safe_radius) {
        let dx = s.pos[0] - l.pos[0];
        let dz = s.pos[2] - l.pos[2];
        if (d < EPS) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] = l.pos[0] + dx * T.safe_radius;
        s.pos[2] = l.pos[2] + dz * T.safe_radius;
      }
    }
  };

  g.step = (input = {}) => {
    if (g.state !== 'playing') return [];
    const events = [];
    const emit = (name, data) => events.push({ name, data });
    const p = g.player;
    const n = g.tick + 1;
    const move = input.move || [0, 0];
    const btn = {
      jump: !!input.jump,
      interact: !!input.interact,
      pulse: !!input.pulse,
      dash: !!input.dash,
    };
    const pressed = (k) => btn[k] && !g.prevButtons[k];

    const [wx, wz] = moveToWorld(move, input.cam_yaw_deg || 0);
    p.pos[0] += wx * T.player_speed * C.DT;
    p.pos[2] += wz * T.player_speed * C.DT;
    if (Math.hypot(wx, wz) > EPS) p.facing = Math.atan2(wx, wz);
    const rad = Math.hypot(p.pos[0], p.pos[2]);
    if (rad > C.ISLAND_RADIUS) {
      p.pos[0] *= C.ISLAND_RADIUS / rad;
      p.pos[2] *= C.ISLAND_RADIUS / rad;
    }
    const onGround = p.pos[1] <= EPS && p.vy <= 0;
    if (pressed('jump') && onGround) p.vy = C.JUMP_SPEED;
    if (p.vy !== 0 || p.pos[1] > 0) {
      p.vy -= C.GRAVITY * C.DT;
      p.pos[1] += p.vy * C.DT;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
      }
    }

    if (p.carried < T.carry_capacity) {
      const near = g.motes
        .map((m) => ({ m, id: m.id, d: hdist(p.pos, m.pos) }))
        .filter((x) => x.d <= T.pickup_radius + EPS)
        .sort(byDistThenId);
      for (const { m } of near) {
        if (p.carried >= T.carry_capacity) break;
        g.motes.splice(g.motes.indexOf(m), 1);
        p.carried += 1;
        g.score += T.score.per_mote;
        emit('mote_picked', { carried: p.carried });
      }
    }

    if (pressed('interact') && p.carried > 0) {
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
          emit('deposit', { lantern_id: l.id, amount, deposited: l.deposited });
          if (l.deposited >= T.lantern_cost) {
            l.lit = true;
            g.score += T.score.per_lantern;
            emit('lantern_lit', { lantern_id: l.id });
          }
        }
      }
    }

    if (pressed('pulse') && n >= p.pulseReadyAt && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseReadyAt = n + secToTicks(T.pulse_cooldown_s);
      const hit = g.shades
        .map((s) => ({ s, id: s.id, d: hdist(p.pos, s.pos) }))
        .filter((x) => x.d <= T.pulse_radius + EPS)
        .sort(byDistThenId);
      for (const { s, d } of hit) {
        s.state = 'stunned';
        s.stunUntil = n + secToTicks(T.pulse_stun_s);
        let dx = s.pos[0] - p.pos[0];
        let dz = s.pos[2] - p.pos[2];
        if (d < EPS) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] += dx * T.pulse_push_m;
        s.pos[2] += dz * T.pulse_push_m;
        keepOutOfLanterns(s);
      }
      g.score += T.score.per_stun * hit.length;
      emit('pulse', { stunned_ids: hit.map((x) => x.id) });
    }

    for (const s of g.shades) {
      if (s.state === 'stunned') {
        if (n < s.stunUntil) continue;
        s.state = 'chase';
      }
      const d = hdist(s.pos, p.pos);
      if (d > EPS) {
        const stepLen = Math.min(T.shade_speed * C.DT, d);
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
      }
      keepOutOfLanterns(s);
    }

    if (n >= p.invulnUntil) {
      const hitter = g.shades
        .filter((s) => s.state !== 'stunned')
        .map((s) => ({ s, id: s.id, d: hdist(s.pos, p.pos) }))
        .filter((x) => x.d <= T.shade_hit_radius + EPS)
        .sort(byDistThenId)[0];
      if (hitter) {
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        p.flames = Math.max(0, p.flames - 1);
        p.invulnUntil = n + secToTicks(T.invuln_s);
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }

    if (g.randomMotes) {
      g.moteTimer += 1;
      if (g.moteTimer >= secToTicks(C.MOTE_RESPAWN_S)) {
        g.moteTimer = 0;
        if (g.motes.length < C.MOTE_TARGET) g.motes.push({ id: newMoteId(), pos: randomMotePos() });
      }
    }
    if (g.randomShades) {
      g.shadeTimer += 1;
      if (g.shadeTimer >= secToTicks(C.SHADE_SPAWN_S)) {
        g.shadeTimer = 0;
        if (g.shades.length < C.SHADE_MAX) {
          const s = makeShade(randomShadePos(), newShadeId());
          g.shades.push(s);
          emit('shade_spawned', { id: s.id });
        }
      }
    }

    g.prevButtons = btn;
    g.tick += 1;

    if (g.lanterns.every((l) => l.lit)) {
      g.score += T.score.per_second_left * Math.floor(Math.max(0, g.timeLeft()) + EPS);
      g.score += T.score.per_flame_left * p.flames;
      g.state = 'won';
      emit('game_over', { result: 'won', reason: 'all_lit' });
    } else if (p.flames <= 0) {
      g.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (g.timeLeft() <= EPS) {
      g.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
    return events;
  };

  g.snapshot = () => ({
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: round3(Math.max(0, g.timeLeft())),
    score: g.score,
    player: { pos: r3v(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3v(m.pos) })),
  });

  return g;
}
