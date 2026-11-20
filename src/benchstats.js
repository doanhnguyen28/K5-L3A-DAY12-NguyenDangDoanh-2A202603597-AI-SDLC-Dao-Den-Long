export function benchStats(dts) {
  const n = dts.length;
  if (!n) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const worstAvg = worst.reduce((a, b) => a + b, 0) / k;
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    frames: n,
    avg_fps: r((1000 * n) / sum),
    p1_low_fps: r(1000 / worstAvg),
    frame_ms_p95: r(p95, 2),
  };
}
