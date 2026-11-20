let ctx = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.15, slideTo = null) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  unlock: () => ensure(),
  toggleMute: () => (muted = !muted),
  pickup: (n) => tone(880 + n * 40, 0, 0.18, 'sine', 0.08),
  deposit: () => tone(520, 0, 0.25, 'triangle', 0.1),
  lit: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.6, 'sine', 0.1)),
  pulse: () => tone(300, 0, 0.45, 'sine', 0.14, 900),
  hit: () => tone(140, 0, 0.35, 'sawtooth', 0.12, 60),
  spawn: () => tone(110, 0, 0.6, 'square', 0.04, 80),
  won: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.15, 0.9, 'triangle', 0.1)),
  lost: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.25, 0.7, 'sine', 0.1)),
};
