let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let volume = 0.7;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.15, slideTo = null, dest = null) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(dest || master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, gain = 0.08, freq = 800) {
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
}

const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];

export const sfx = {
  unlock: () => ensure(),
  setVolume(v) {
    volume = v;
    if (master) master.gain.value = v;
  },
  startMusic() {
    const c = ensure();
    if (!c || musicTimer) return;
    musicGain = c.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);
    const drone = [110, 164.8].map((f) => {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0.05;
      o.connect(g).connect(musicGain);
      o.start();
      return o;
    });
    musicGain.userData = drone;
    musicTimer = setInterval(() => {
      const f = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(f, 0, 1.4, 'sine', 0.05, null, musicGain);
      if (Math.random() < 0.3) tone(f * 1.5, 0.4, 1.2, 'sine', 0.03, null, musicGain);
    }, 900);
  },
  stopMusic() {
    if (!musicTimer) return;
    clearInterval(musicTimer);
    musicTimer = null;
    for (const o of musicGain.userData) o.stop();
    musicGain.disconnect();
  },
  pickup: (n) => tone(880 + n * 40, 0, 0.18, 'sine', 0.08),
  deposit: () => tone(520, 0, 0.25, 'triangle', 0.1),
  lit: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.6, 'sine', 0.1)),
  pulse: () => tone(300, 0, 0.45, 'sine', 0.14, 900),
  hit: () => tone(140, 0, 0.35, 'sawtooth', 0.12, 60),
  jump: () => tone(400, 0, 0.15, 'square', 0.04, 700),
  dash: () => noise(0.2, 0.15, 1500),
  charm: () => [700, 1050].forEach((f, i) => tone(f, i * 0.08, 0.3, 'triangle', 0.08)),
  steal: () => tone(600, 0, 0.4, 'sawtooth', 0.06, 200),
  spawn: () => tone(110, 0, 0.6, 'square', 0.04, 80),
  wind: () => noise(1.8, 0.1, 400),
  countdown: () => tone(1000, 0, 0.08, 'square', 0.06),
  won: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.15, 0.9, 'triangle', 0.1)),
  lost: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.25, 0.7, 'sine', 0.1)),
};
