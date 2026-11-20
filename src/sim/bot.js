const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const level = (y) => (y >= 5.5 ? 2 : y >= 2.5 ? 1 : 0);
const polar = (r, a) => [r * Math.cos(a), 0, r * Math.sin(a)];
const RAMPS = [(30 * Math.PI) / 180, (150 * Math.PI) / 180];

function clear(g, a, b) {
  const d = hd(a, b);
  const n = Math.max(1, Math.ceil(d));
  const base = a[1];
  for (let i = 1; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const z = a[2] + ((b[2] - a[2]) * i) / n;
    const h = g.groundAt(x, z);
    if (h === null || h > base + 0.5 || h < base - 0.5) return false;
    if (g.map.tower && Math.hypot(x, z) < 2.6) return false;
  }
  return true;
}

function orbit(g, p, target, radius) {
  const ap = Math.atan2(p.pos[2], p.pos[0]);
  const at = Math.atan2(target[2], target[0]);
  let diff = at - ap;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const step = Math.sign(diff || 1) * Math.min(Math.abs(diff), 0.45);
  return polar(Math.max(radius, Math.hypot(p.pos[0], p.pos[2])), ap + step);
}

function route(g, target) {
  const p = g.player;
  const n = g.night;
  if (n === 1) return target;
  if (n === 2) {
    const side = (x) => (x < 35 ? 0 : 1);
    if (side(p.pos[0]) === side(target[0])) return target;
    if (side(p.pos[0]) === 0) return p.pos[0] < 26 || Math.abs(p.pos[2]) > 1.2 ? [25, 0, 0] : [46, 0, 0];
    return p.pos[0] > 44 || Math.abs(p.pos[2]) > 1.2 ? [45, 0, 0] : [24, 0, 0];
  }
  const L = level(p.pos[1]);
  const TL = level(target[1]);
  const r = Math.hypot(p.pos[0], p.pos[2]);
  if (L === TL) {
    if (clear(g, p.pos, target)) return target;
    if (L === 1) return orbit(g, p, target, 18);
    return orbit(g, p, target, 27);
  }
  if (TL > L) {
    if (L === 0) {
      let best = null;
      for (const a of RAMPS) {
        const foot = polar(31, a);
        const d = hd(p.pos, foot);
        if (!best || d < best.d) best = { a, foot, d };
      }
      const ux = Math.cos(best.a);
      const uz = Math.sin(best.a);
      const s = p.pos[0] * ux + p.pos[2] * uz;
      const perp = Math.abs(-p.pos[0] * uz + p.pos[2] * ux);
      if (perp < 1 && s <= 31.5 && s >= 22) return polar(20, best.a);
      if (best.d < 1) return polar(20, best.a);
      return clear(g, p.pos, best.foot) ? best.foot : orbit(g, p, best.foot, 27);
    }
    const pad = [0, 3, 13];
    return clear(g, p.pos, pad) ? pad : orbit(g, p, pad, 18);
  }
  if (L === 2) return [target[0], 0, target[2]];
  if (r < 25) {
    const a = Math.atan2(p.pos[2], p.pos[0]);
    return polar(28, a);
  }
  return target;
}

export function createBot() {
  let toggle = false;
  return function decide(g) {
    const T = g.tuning;
    const p = g.player;
    toggle = !toggle;
    const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
    if (p.fallWait > 0 || p.launch || !p.grounded) return input;

    const cost = (pos) => hd(pos, p.pos) + 25 * Math.abs(level(pos[1]) - level(p.pos[1])) + (g.night === 2 && (pos[0] < 35) !== (p.pos[0] < 35) ? 30 : 0);

    const danger = [
      ...g.shades.filter((s) => s.state === 'wander' || s.state === 'chase').map((s) => ({ d: hd(s.pos, p.pos), dy: Math.abs(s.pos[1] - p.pos[1] - 0.8) })),
      ...g.drifters.filter((d) => d.state === 'chase').map((d) => ({ d: hd(d.pos, p.pos) - 1, dy: Math.abs(d.pos[1] - p.pos[1] - 0.8) })),
    ].filter((x) => x.d < 4.2 && Math.hypot(x.d, x.dy) < 4.9);
    if (danger.length && p.carried >= T.pulse_cost && p.pulseCd === 0) input.pulse = toggle;

    const unlit = g.lanterns.filter((l) => !l.lit);
    const need = unlit.reduce((s, l) => s + (T.lantern_cost - l.deposited), 0);
    const lantern = unlit.map((l) => ({ l, c: cost(l.pos) })).sort((a, b) => a.c - b.c)[0];
    const motes = g.motes.map((m) => ({ m, c: cost(m.pos) })).sort((a, b) => a.c - b.c);
    const reserve = Math.min(6, need);
    const goLantern = lantern && p.carried > 0 && (p.carried >= reserve || motes.length === 0 || p.carried >= T.lantern_cost - lantern.l.deposited);

    let target = null;
    if (goLantern) {
      const l = lantern.l;
      if (hd(l.pos, p.pos) <= T.interact_radius * 0.8 && level(l.pos[1]) === level(p.pos[1])) {
        input.interact = toggle;
      } else {
        target = l.pos;
      }
    } else if (motes.length) {
      target = motes[0].m.pos;
    }

    let mx = 0;
    let mz = 0;
    if (target) {
      const wp = route(g, target);
      const d = hd(wp, p.pos);
      if (d > 1e-6) {
        mx = (wp[0] - p.pos[0]) / d;
        mz = (wp[2] - p.pos[2]) / d;
      }
    }
    let closest = Infinity;
    for (const sh of g.shades) {
      if (sh.state !== 'wander' && sh.state !== 'chase') continue;
      if (Math.abs(sh.pos[1] - p.pos[1]) > 2) continue;
      const d = hd(sh.pos, p.pos);
      if (d > 6 || d < 1e-6) continue;
      closest = Math.min(closest, d);
      const w = ((6 - d) / 6) * (sh.state === 'chase' ? 2.5 : 0.8);
      mx += ((p.pos[0] - sh.pos[0]) / d) * w;
      mz += ((p.pos[2] - sh.pos[2]) / d) * w;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1e-6) {
      mx /= len;
      mz /= len;
      const safe = (dx, dz) => {
        const h = g.groundAt(p.pos[0] + dx * 3, p.pos[2] + dz * 3);
        return h !== null && Math.abs(h - p.pos[1]) < 0.6;
      };
      if (!safe(mx, mz)) {
        if (safe(-mz, mx)) [mx, mz] = [-mz, mx];
        else if (safe(mz, -mx)) [mx, mz] = [mz, -mx];
      }
      input.move = [mx, mz];
    }
    if (closest < 2.2 && !input.pulse && p.dashCd === 0) input.dash = toggle;
    return input;
  };
}
