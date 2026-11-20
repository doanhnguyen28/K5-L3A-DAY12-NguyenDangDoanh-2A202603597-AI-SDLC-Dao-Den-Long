const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function createBot() {
  let toggle = false;
  return function decide(g) {
    const T = g.tuning;
    const p = g.player;
    toggle = !toggle;
    const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

    const threat = g.shades
      .filter((s) => s.state !== 'stunned')
      .map((s) => ({ s, d: hd(s.pos, p.pos) }))
      .sort((a, b) => a.d - b.d)[0];
    if (threat && threat.d < T.pulse_radius * 0.6 && p.carried >= T.pulse_cost && g.tick + 1 >= p.pulseReadyAt) {
      input.pulse = toggle;
    }

    const unlit = g.lanterns.filter((l) => !l.lit);
    const need = unlit.reduce((sum, l) => sum + (T.lantern_cost - l.deposited), 0);
    const lanternNear = unlit.map((l) => ({ l, d: hd(l.pos, p.pos) })).sort((a, b) => a.d - b.d)[0];
    const goDeposit = lanternNear && p.carried > 0 && (p.carried >= Math.min(T.carry_capacity, need) || g.motes.length === 0 || p.carried >= T.lantern_cost - lanternNear.l.deposited + 2);

    let target = null;
    if (goDeposit) {
      target = lanternNear.l.pos;
      if (lanternNear.d <= T.interact_radius * 0.8) {
        input.interact = toggle;
        target = null;
      }
    } else {
      const mote = g.motes.map((m) => ({ m, d: hd(m.pos, p.pos) })).sort((a, b) => a.d - b.d)[0];
      if (mote) target = mote.m.pos;
    }

    let mx = 0;
    let mz = 0;
    if (target) {
      const d = hd(target, p.pos);
      if (d > 1e-6) {
        mx = (target[0] - p.pos[0]) / d;
        mz = (target[2] - p.pos[2]) / d;
      }
    }
    if (threat && threat.d < 3 && !input.pulse) {
      const ax = (p.pos[0] - threat.s.pos[0]) / (threat.d || 1);
      const az = (p.pos[2] - threat.s.pos[2]) / (threat.d || 1);
      mx = mx * 0.4 + ax;
      mz = mz * 0.4 + az;
    }
    input.move = [Math.max(-1, Math.min(1, mx)), Math.max(-1, Math.min(1, mz))];
    return input;
  };
}
