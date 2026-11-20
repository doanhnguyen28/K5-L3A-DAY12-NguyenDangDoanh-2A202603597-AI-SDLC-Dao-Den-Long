const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const ring = (r, startDeg, stepDeg, count, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = (startDeg + i * stepDeg) * DEG;
    return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
  });
const lanterns = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));

function night1Ground(x, z) {
  return Math.hypot(x, z) <= 40 ? 0 : null;
}

function night2Ground(x, z) {
  if (Math.hypot(x, z) <= 28) return 0;
  if (Math.hypot(x - 70, z) <= 28) return 0;
  if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
  return null;
}

const RAMP_ANGLES = [30 * DEG, 150 * DEG];
function rampHeight(x, z) {
  for (const a of RAMP_ANGLES) {
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const s = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && s >= 24 && s <= 30) return (3 * (30 - s)) / 6;
  }
  return null;
}

function night3Ground(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  const ramp = rampHeight(x, z);
  if (ramp !== null) return ramp;
  return 0;
}

export const MAPS = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    durationKey: 'night1_duration_s',
    start: [0, 0, 0],
    ground: night1Ground,
    lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadePoints: ring(37, 15, 30, 12, 1),
    shadeInterval: 480,
    shadeMax: 6,
    shadeSpeedMul: 1,
    pads: [],
    charms: [],
    drifters: false,
    wind: false,
    tower: null,
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    durationKey: 'night2_duration_s',
    start: [0, 0, 0],
    ground: night2Ground,
    lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    motePoints: [
      ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
      ...ring(10, 0, 90, 4, 0, 70, 0), ...ring(22, 0, 45, 8, 0, 70, 0),
    ],
    shadePoints: [...ring(26, 22.5, 45, 8, 1), ...ring(26, 22.5, 45, 8, 1, 70, 0)],
    shadeInterval: 420,
    shadeMax: 8,
    shadeSpeedMul: 1,
    pads: [
      { pos: [20, 0, 18], vy: 14, speed: 24, target: [70, 0] },
      { pos: [50, 0, -18], vy: 14, speed: 24, target: [0, 0] },
    ],
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    drifters: true,
    wind: false,
    tower: null,
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    durationKey: 'night3_duration_s',
    start: [0, 0, -30],
    ground: night3Ground,
    lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    motePoints: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadePoints: ring(43, 0, 22.5, 16, 1),
    shadeInterval: 360,
    shadeMax: 10,
    shadeSpeedMul: 4.5 / 4,
    pads: [{ pos: [0, 3, 13], vy: 12, speed: 8, dir: [0, -1] }],
    charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
    drifters: true,
    wind: true,
    tower: { pos: [0, 6, 0], radius: 2, height: 8 },
  },
};
