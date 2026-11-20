import * as THREE from 'three';
import { createGame } from '../sim/game.js';
import { TICK_RATE, WIND_SPEED } from '../sim/constants.js';
import { MAPS } from '../sim/maps.js';
import { createBot } from '../sim/bot.js';
import { sfx } from './audio.js';

const PAL = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  litLamp: '#FFB347', core: '#FFE9B0', offLamp: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeEdge: '#7A3CFF', shadeStun: '#3A3450', shirt: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', ui: '#F5F1E6',
};
const NIGHT_TEXT = {
  1: 'Mây à, sương đen đã nuốt bến thuyền. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé.',
  2: 'Hai hòn đảo Cau nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng mê đom đóm của con lắm. Bục nhảy sẽ đưa con sang đảo bên kia.',
  3: 'Đảo Chuông cao ba tầng, gió thổi từng cơn. Leo dốc, nhảy bục để lên đỉnh tháp. Thắp hết bảy ngọn đèn để gọi bình minh về.',
};

const params = new URLSearchParams(location.search);
const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`ddl.${k}`);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`ddl.${k}`, JSON.stringify(v));
    } catch {}
  },
};
const settings = { volume: store.get('volume', 0.7), sens: store.get('sens', 0.3), cb: store.get('cb', false) };
const CB_EDGE = '#00B3FF';
sfx.setVolume(settings.volume);

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), flames: $('flames'), timer: $('timer'), lit: $('lit'), score: $('score'), motebar: $('motebar'),
  cddash: $('cddash'), cdpulse: $('cdpulse'), prompt: $('prompt'), promptval: $('promptval'), arrow: $('arrow'),
  charmhud: $('charmhud'), charmval: $('charmval'), windhud: $('windhud'), fps: $('fps'),
  need: $('need'), carrytext: $('carrytext'), prompttext: $('prompttext'),
};
for (let i = 0; i < T.capacity_max; i++) ui.motebar.appendChild(document.createElement('i'));
function applyCb() {
  document.body.classList.toggle('cb', settings.cb);
  const edge = settings.cb ? CB_EDGE : PAL.shadeEdge;
  eyeMat.color.set(edge);
  eyeMat.emissive.set(edge);
  for (const v of views.shades.values()) v.userData.edge.material.color.set(edge);
}
const screens = ['menu', 'intro', 'result', 'pause', 'settings'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.fog, 30, 110);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ambient = new THREE.HemisphereLight('#c8d2ff', '#22304a', 0.15);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#b7bdff', 0.35);
moon.position.set(-30, 60, -20);
scene.add(moon);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat(PAL.sea, { roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -9;
scene.add(sea);

let world = null;
function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  scene.remove(g);
}
function islandDisk(group, x, z, r) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 5, 5, 72), mat(PAL.grass));
  top.position.set(x, -2.5, z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.5, 6, 72), mat(PAL.sand));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, -0.25, z);
  group.add(top, rim);
}
function trees(group, cx, cz, rMin, rMax, count, seed, avoid = () => false) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6);
  const crownGeo = new THREE.ConeGeometry(0.9, 2, 7);
  const trunkMat = mat(PAL.wood);
  const crownMat = mat('#24463c');
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rMin + rnd() * (rMax - rMin);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (avoid(x, z)) continue;
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 0.4, z);
    const c = new THREE.Mesh(crownGeo, crownMat);
    c.position.set(x, 1.6, z);
    group.add(t, c);
  }
}
function pad(group, pos) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), glow('#7fd6ff', 1.2));
  m.position.set(pos[0], pos[1] + 0.06, pos[2]);
  group.add(m);
}
function buildWorld(night) {
  const M = MAPS[night];
  const g = new THREE.Group();
  if (night === 1) {
    islandDisk(g, 0, 0, 40);
    trees(g, 0, 0, 34, 39, 40, 11);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 9), mat(PAL.wood));
    pier.position.set(0, -0.1, -44);
    g.add(pier);
  } else if (night === 2) {
    islandDisk(g, 0, 0, 28);
    islandDisk(g, 70, 0, 28);
    trees(g, 0, 0, 24, 27, 18, 21, (x, z) => Math.abs(z) < 4);
    trees(g, 70, 0, 24, 27, 18, 31, (x, z) => Math.abs(z) < 4);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(PAL.wood));
    bridge.position.set(35, -0.15, 0);
    g.add(bridge);
    for (let x = 26.5; x <= 43.5; x += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 4.1), mat('#8a6a45'));
      slat.position.set(x, 0.02, 0);
      g.add(slat);
    }
    for (const p of M.pads) pad(g, p.pos);
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(45, 40, 5, 80), mat(PAL.grass));
    base.position.y = -2.5;
    g.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(45, 0.5, 6, 80), mat(PAL.sand));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.25;
    g.add(rim);
    const shape = new THREE.Shape();
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const a = (Math.PI * i) / N;
      if (i === 0) shape.moveTo(24 * Math.cos(a), -24 * Math.sin(a));
      else shape.lineTo(24 * Math.cos(a), -24 * Math.sin(a));
    }
    for (let i = N; i >= 0; i--) {
      const a = (Math.PI * i) / N;
      shape.lineTo(12 * Math.cos(a), -12 * Math.sin(a));
    }
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }), mat('#3a6b5c'));
    tier1.rotation.x = -Math.PI / 2;
    g.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat('#467a6a'));
    tier2.position.y = 3;
    g.add(tier2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat('#8d7b66'));
    tower.position.y = 10;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), mat(PAL.gold, { metalness: 0.6, roughness: 0.4 }));
    bell.position.y = 15;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 24), mat('#7a2a2a'));
    roof.position.y = 15.4;
    g.add(tower, bell, roof);
    for (const a of [Math.PI / 6, (5 * Math.PI) / 6]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, Math.hypot(6, 3)), mat(PAL.sand));
      ramp.rotation.order = 'YXZ';
      ramp.rotation.set(Math.atan2(3, 6), Math.atan2(Math.cos(a), Math.sin(a)), 0);
      ramp.position.set(27 * Math.cos(a), 1.35, 27 * Math.sin(a));
      g.add(ramp);
    }
    for (const p of M.pads) pad(g, p.pos);
    trees(g, 0, 0, 38, 44, 36, 41, (x, z) => z > 0 && Math.abs(Math.atan2(z, x) - Math.PI / 6) < 0.2);
  }
  scene.add(g);
  return g;
}

function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.9, 12), mat(PAL.shirt));
  body.position.y = 0.45;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), mat(PAL.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.92;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.04), mat(PAL.scarf));
  tail.position.set(0.1, 0.75, -0.26);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat('#f1c9a0'));
  head.position.y = 1.15;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.36, 24), mat('#e0be72'));
  hat.position.y = 1.45;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), glow(PAL.litLamp, 3));
  lamp.position.set(0, 0.98, 0.55);
  const light = new THREE.PointLight(PAL.litLamp, 8, 10, 1.6);
  light.position.copy(lamp.position);
  g.add(body, scarf, tail, head, hat, lamp, light);
  g.userData = { light };
  scene.add(g);
  return g;
}
const player = makePlayer();

const moteCoreGeo = new THREE.SphereGeometry(0.11, 8, 6);
const moteHaloGeo = new THREE.SphereGeometry(0.28, 10, 8);
const moteCoreMat = glow(PAL.moteCore, 3);
const moteHaloMat = new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.35, depthWrite: false });
const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
const eyeMat = glow(PAL.shadeEdge, 2.5);

const views = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
function clearViews() {
  for (const m of Object.values(views)) {
    for (const v of m.values()) scene.remove(v);
    m.clear();
  }
}
function makeLantern(l) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(PAL.wood));
  post.position.y = 1.6;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat(PAL.offLamp, { emissive: PAL.litLamp, emissiveIntensity: 0 }));
  shell.scale.set(1, 1.25, 1);
  shell.position.set(0, 2.6, 0.8);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glow(PAL.core, 0));
  core.position.copy(shell.position);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), mat(PAL.wood));
  arm.position.set(0, 3.1, 0.4);
  const light = new THREE.PointLight(PAL.litLamp, 0, 22, 1.4);
  light.position.copy(shell.position);
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: '#111522' }));
  tear.position.set(0.1, 2.75, 1.34);
  tear.rotation.z = 0.5;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), new THREE.MeshBasicMaterial({ color: '#1B2350', side: THREE.DoubleSide }));
  barBg.position.set(0, 3.9, 0.8);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.12), new THREE.MeshBasicMaterial({ color: PAL.litLamp, side: THREE.DoubleSide }));
  bar.position.set(0, 3.9, 0.81);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.litLamp, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(post, shell, core, arm, light, ring, tear, barBg, bar);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  g.userData = { shell, core, light, ring, tear, barBg, bar, litAt: null };
  scene.add(g);
  return g;
}
function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteCoreGeo, moteCoreMat), new THREE.Mesh(moteHaloGeo, moteHaloMat));
  scene.add(g);
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: PAL.shadeBody, roughness: 0.4, transparent: true, opacity: 0.95 }));
  body.scale.set(1, 0.85, 1);
  const edge = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: settings.cb ? CB_EDGE : PAL.shadeEdge, side: THREE.BackSide, transparent: true, opacity: 0.9 }));
  edge.scale.set(1.08, 0.93, 1.08);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.15, 0.62);
  e2.position.set(0.25, 0.15, 0.62);
  g.add(body, edge, e1, e2);
  g.userData = { body, edge };
  scene.add(g);
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.4, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const segs = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), m);
    s.position.z = -i * 0.4;
    g.add(s);
    segs.push(s);
  }
  g.userData = { segs };
  scene.add(g);
  return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.04), glow(PAL.scarf, 0.6));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.54, 0.84, 0.06)), new THREE.LineBasicMaterial({ color: PAL.gold }));
  g.add(paper, edges);
  scene.add(g);
  return g;
}
const guide = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow('#fff1a8', 4));
const guideLight = new THREE.PointLight('#fff1a8', 2, 4, 2);
guide.add(guideLight);
scene.add(guide);

const leaves = [];
const leafGeo = new THREE.PlaneGeometry(0.18, 0.1);
const leafMat = new THREE.MeshBasicMaterial({ color: '#c9a35a', side: THREE.DoubleSide, transparent: true, opacity: 0 });
for (let i = 0; i < 40; i++) {
  const l = new THREE.Mesh(leafGeo, leafMat);
  l.userData = { o: [Math.random() * 30 - 15, Math.random() * 4, Math.random() * 30 - 15], s: 0.5 + Math.random() };
  scene.add(l);
  leaves.push(l);
}

const pulses = [];
function spawnPulse(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.core, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], pos[1] + 0.1, pos[2]);
  scene.add(m);
  pulses.push({ m, t: 0 });
}

const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false };
let camYaw = 0;
let camPitch = Number(params.get('pitch') || 0.42);
const camDist = Number(params.get('dist') || 10);
let dragging = false;
let lastX = 0;
let lastY = 0;
const KEYMAP = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse', ShiftLeft: 'dash', ShiftRight: 'dash' };

let game = null;
let mode = 'menu';
let night = 1;
let totalScore = 0;
let bot = params.get('bot') === '1' ? createBot() : null;
let showFps = params.get('fps') === '1';
let lastSecond = null;
let windWarned = false;
let settingsReturn = 'menu';

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (KEYMAP[e.code]) latch[KEYMAP[e.code]] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyB') bot = bot ? null : createBot();
  if (e.code === 'F3') {
    e.preventDefault();
    showFps = !showFps;
  }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  if (mode === 'playing') togglePause();
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) latch.pulse = true;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * settings.sens;
  camPitch = Math.min(1.5, Math.max(0.1, camPitch + (e.clientY - lastY) * settings.sens * 0.01));
  lastX = e.clientX;
  lastY = e.clientY;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

function readInput() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyW')) z += 1;
  if (keys.has('KeyS')) z -= 1;
  if (keys.has('KeyA')) x += 1;
  if (keys.has('KeyD')) x -= 1;
  const held = (k) => Object.entries(KEYMAP).some(([code, a]) => a === k && keys.has(code));
  const input = {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: held('jump') || latch.jump, interact: held('interact') || latch.interact,
    pulse: held('pulse') || latch.pulse, dash: held('dash') || latch.dash,
  };
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  return input;
}

function startNight(n, seed = (Date.now() & 0x7fffffff) >>> 0) {
  night = n;
  if (world) disposeGroup(world);
  world = buildWorld(n);
  clearViews();
  game = createGame({ tuning: T, seed, night: n });
  if (bot) bot = createBot();
  for (const l of game.lanterns) views.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  lastSecond = null;
  windWarned = false;
  scene.background.set(PAL.sky);
}

function showIntro(n) {
  startNight(n);
  $('introNight').textContent = `Đêm ${n}`;
  $('introName').textContent = MAPS[n].name;
  $('introQuote').textContent = `“${NIGHT_TEXT[n]}”`;
  $('introGoal').textContent = `Đèn cạn dầu theo thời gian và Bóng Mực sẽ hút dầu đèn yếu. Giữ ít nhất ${game.needLit}/${game.lanterns.length} đèn sáng tới bình minh (${T[MAPS[n].durationKey]} giây).`;
  mode = 'intro';
  show('intro');
  ui.hud.classList.add('hidden');
}
function play() {
  mode = 'playing';
  show(null);
  ui.hud.classList.remove('hidden');
  sfx.unlock();
  sfx.startMusic();
}
function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    show('pause');
  } else if (mode === 'paused') {
    play();
  }
}
function toMenu() {
  mode = 'menu';
  totalScore = 0;
  sfx.stopMusic();
  ui.hud.classList.add('hidden');
  show('menu');
}
function showResult(result, reason) {
  mode = 'result';
  sfx.stopMusic();
  const btns = $('resBtns');
  btns.innerHTML = '';
  const add = (label, fn, ghost = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (ghost) b.className = 'ghost';
    b.onclick = fn;
    btns.appendChild(b);
  };
  if (result === 'won') {
    totalScore += game.score;
    const litNow = game.lanterns.filter((l) => l.lit).length;
    if (night === 3) {
      $('resTitle').textContent = 'Bình Minh';
      $('resMsg').textContent = `Ba hòn đảo đã sáng trở lại. Mặt trời lên trên biển mây. Tổng điểm: ${totalScore}.`;
      scene.background.set('#e9a27a');
      add('Về menu', toMenu);
    } else {
      $('resTitle').textContent = `Đêm ${night} — Thắng!`;
      $('resMsg').textContent = `Trời sáng với ${litNow}/${game.lanterns.length} đèn còn cháy. Điểm đêm: ${game.score}. Tổng điểm: ${totalScore}.`;
      add(`Sang Đêm ${night + 1}`, () => showIntro(night + 1));
      add('Về menu', toMenu, true);
    }
  } else {
    const why = { dawn: `Trời sáng nhưng chưa đủ ${game.needLit} đèn còn cháy.`, no_flames: 'Mây đã mất hết Ngọn Lửa.' };
    $('resTitle').textContent = `Đêm ${night} — Thua`;
    $('resMsg').textContent = `${why[reason] || ''} Tổng điểm hiện tại: ${totalScore}.`;
    add('Chơi lại Đêm này', () => showIntro(night));
    add('Về menu', toMenu, true);
  }
  show('result');
}

$('btnStart').onclick = () => {
  totalScore = 0;
  sfx.unlock();
  showIntro(1);
};
$('btnPlay').onclick = play;
$('btnResume').onclick = play;
$('btnRestart').onclick = () => showIntro(night);
$('btnMenu').onclick = toMenu;
const openSettings = (from) => {
  settingsReturn = from;
  $('setVolume').value = settings.volume;
  $('setSens').value = settings.sens;
  $('setCb').checked = settings.cb;
  show('settings');
};
$('btnSettingsMenu').onclick = () => openSettings('menu');
$('btnSettingsPause').onclick = () => openSettings('pause');
$('btnSettingsBack').onclick = () => show(settingsReturn);
$('setVolume').oninput = (e) => {
  settings.volume = Number(e.target.value);
  sfx.setVolume(settings.volume);
  store.set('volume', settings.volume);
};
$('setCb').onchange = (e) => {
  settings.cb = e.target.checked;
  store.set('cb', settings.cb);
  applyCb();
};
$('setSens').oninput = (e) => {
  settings.sens = Number(e.target.value);
  store.set('sens', settings.sens);
};

function handleEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': {
        sfx.lit();
        const v = views.lanterns.get(e.data.lantern_id);
        if (v) v.userData.litAt = performance.now();
        break;
      }
      case 'pulse': sfx.pulse(); spawnPulse(game.player.pos); break;
      case 'refuel': sfx.deposit(); break;
      case 'lantern_out': sfx.lost(); break;
      case 'player_hit': sfx.hit(); break;
      case 'shade_spawned': sfx.spawn(); break;
      case 'dash': sfx.dash(); break;
      case 'charm_picked': sfx.charm(); break;
      case 'drifter_steal': sfx.steal(); break;
      case 'game_over':
        (e.data.result === 'won' ? sfx.won : sfx.lost)();
        setTimeout(() => showResult(e.data.result, e.data.reason), 900);
        break;
    }
  }
}

function syncMap(map, items, make, update) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    let v = map.get(it.id);
    if (!v) {
      v = make(it);
      map.set(it.id, v);
    }
    update(v, it);
  }
  for (const [id, v] of map) {
    if (!seen.has(id)) {
      scene.remove(v);
      map.delete(id);
    }
  }
}

const v3 = new THREE.Vector3();
const desired = new THREE.Vector3();
function render(now) {
  const t = now / 1000;
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = p.facing;
  player.visible = !(p.invuln > 0) || Math.floor(t * 12) % 2 === 0;
  player.userData.light.intensity = 4 + Math.min(p.carried, T.carry_capacity) * 0.8;

  syncMap(views.motes, game.motes, makeMote, (m, it) => {
    const ph = Number(it.id.slice(1)) * 1.7;
    m.position.set(it.pos[0] + Math.sin(t * 1.3 + ph) * 0.12, it.pos[1] + 0.8 + Math.sin(t * 2 + ph) * 0.2, it.pos[2] + Math.cos(t * 1.1 + ph) * 0.12);
    m.visible = !(it.kind === 'dropped' && it.ttl < 120 && Math.floor(t * 8) % 2 === 0);
  });
  syncMap(views.shades, game.shades, makeShade, (v, s) => {
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.1, s.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    const stunned = s.state === 'stunned';
    v.userData.body.material.color.set(stunned ? PAL.shadeStun : PAL.shadeBody);
    v.userData.edge.material.opacity = stunned ? 0.3 : 0.9;
    const spawnK = s.state === 'spawning' ? 1 - s.ticks / 60 : 1;
    v.scale.setScalar((stunned ? 0.8 + Math.sin(t * 10) * 0.05 : 1) * Math.max(0.05, spawnK));
  });
  syncMap(views.drifters, game.drifters, makeDrifter, (v, d) => {
    v.visible = d.state !== 'removed';
    v.position.set(d.pos[0], d.pos[1] + Math.sin(t * 4) * 0.2, d.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    if (d.state === 'flee') v.rotateY(Math.PI);
    v.userData.segs.forEach((s, i) => {
      s.position.y = Math.sin(t * 8 - i * 0.8) * 0.15;
      s.rotation.z = Math.sin(t * 6 - i) * 0.4;
    });
  });
  syncMap(views.charms, game.charms, makeCharm, (v, c) => {
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(t * 2) * 0.15, c.pos[2]);
    v.rotation.y = t * 1.5;
  });

  let litCount = 0;
  for (const l of game.lanterns) {
    const u = views.lanterns.get(l.id).userData;
    const frac = l.deposited / (l.everLit ? T.relight_cost : T.lantern_cost);
    const fuel = l.fu / 60;
    const low = l.lit && fuel < T.low_fuel_threshold;
    const blinkOn = !low || Math.floor(t * 2) % 2 === 0;
    u.shell.scale.set(l.lit ? 1 : 0.8, l.lit ? 1.25 : 1.0, l.lit ? 1 : 0.8);
    u.tear.visible = !l.lit;
    u.barBg.visible = u.bar.visible = l.lit && blinkOn;
    u.bar.scale.x = Math.max(0.001, fuel / T.fuel_max);
    u.bar.position.x = -0.68 * (1 - fuel / T.fuel_max);
    u.bar.material.color.set(low ? (settings.cb ? '#FFFFFF' : PAL.danger) : PAL.litLamp);
    u.barBg.lookAt(camera.position);
    u.bar.lookAt(camera.position);
    if (l.lit) {
      litCount++;
      const k = (u.litAt ? Math.min(1, (now - u.litAt) / 800) : 1) * (blinkOn ? 1 : 0.25);
      u.light.intensity = 40 * k;
      u.shell.material.color.set(PAL.litLamp);
      u.shell.material.emissiveIntensity = 1.5 * k;
      u.core.material.emissiveIntensity = 3 * k;
      u.ring.material.opacity = game.isSafe(l) ? 0.35 * k : 0;
    } else {
      u.light.intensity = frac * 5;
      u.shell.material.color.set(PAL.offLamp);
      u.shell.material.emissiveIntensity = frac * 0.6;
      u.core.material.emissiveIntensity = frac;
      u.ring.material.opacity = 0;
    }
  }
  const progress = litCount / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * progress;

  const unlit = game.lanterns.filter((l) => !l.lit).map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) })).sort((a, b) => a.d - b.d)[0];
  let gx = p.pos[0] + Math.cos(t * 2) * 1.1;
  let gz = p.pos[2] + Math.sin(t * 2) * 1.1;
  if (unlit && p.carried > 0 && unlit.d > T.interact_radius) {
    gx = p.pos[0] + ((unlit.l.pos[0] - p.pos[0]) / unlit.d) * 2;
    gz = p.pos[2] + ((unlit.l.pos[2] - p.pos[2]) / unlit.d) * 2;
  }
  guide.position.lerp(v3.set(gx, p.pos[1] + 1.6 + Math.sin(t * 4) * 0.15, gz), 0.12);

  const warn = game.windWarning();
  const windOn = game.wind.active;
  leafMat.opacity = windOn ? 0.9 : warn ? 0.5 : 0;
  if (warn || windOn) {
    const a = (game.wind.dirDeg * Math.PI) / 180;
    for (const l of leaves) {
      const o = l.userData.o;
      o[0] += Math.cos(a) * WIND_SPEED * 0.05 * l.userData.s * (windOn ? 3 : 1);
      o[2] += Math.sin(a) * WIND_SPEED * 0.05 * l.userData.s * (windOn ? 3 : 1);
      if (Math.abs(o[0]) > 15) o[0] = -Math.sign(o[0]) * 15;
      if (Math.abs(o[2]) > 15) o[2] = -Math.sign(o[2]) * 15;
      l.position.set(p.pos[0] + o[0], p.pos[1] + o[1] + Math.sin(t * 3 + o[0]) * 0.3, p.pos[2] + o[2]);
      l.rotation.set(t * l.userData.s, t, 0);
    }
  }
  if (warn && !windWarned && mode === 'playing') {
    windWarned = true;
    sfx.wind();
  }
  if (!warn) windWarned = false;

  for (let i = pulses.length - 1; i >= 0; i--) {
    const pu = pulses[i];
    pu.t += 1 / 60;
    const k = Math.min(1, pu.t / 0.4);
    pu.m.scale.setScalar(0.5 + k * T.pulse_radius);
    pu.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) {
      scene.remove(pu.m);
      pulses.splice(i, 1);
    }
  }

  const th = (camYaw * Math.PI) / 180;
  const dist = camDist;
  desired.set(p.pos[0] - Math.sin(th) * dist * Math.cos(camPitch), p.pos[1] + 1.2 + dist * Math.sin(camPitch), p.pos[2] - Math.cos(th) * dist * Math.cos(camPitch));
  if (camera.position.distanceTo(desired) > 15) camera.position.copy(desired);
  else camera.position.lerp(desired, 0.15);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  updateHud(p, litCount, unlit);
  renderer.render(scene, camera);
}

function updateHud(p, litCount, unlit) {
  ui.flames.innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? 'on' : 'off'}">🔥</span>`).join('');
  const tl = Math.max(0, Math.ceil(game.timeLeft()));
  ui.timer.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
  ui.timer.classList.toggle('danger', tl <= 30);
  if (settings.cb && tl <= 30) ui.timer.textContent = `⚠ ${ui.timer.textContent}`;
  if (mode === 'playing' && tl <= 10 && tl > 0 && tl !== lastSecond) sfx.countdown();
  lastSecond = tl;
  ui.lit.textContent = `${litCount}/${game.lanterns.length}`;
  ui.need.textContent = `cần ${game.needLit} lúc bình minh`;
  const cap = game.capacity();
  ui.carrytext.textContent = `${p.carried} / ${cap}`;
  ui.score.textContent = totalScore + game.score;
  [...ui.motebar.children].forEach((c, i) => {
    c.style.display = i < cap ? '' : 'none';
    c.classList.toggle('on', i < p.carried);
  });
  const dashFull = Math.round(T.dash_cooldown_s * TICK_RATE);
  const pulseFull = Math.round(T.pulse_cooldown_s * TICK_RATE);
  ui.cddash.style.setProperty('--p', p.charm > 0 ? 1 : 1 - p.dashCd / dashFull);
  ui.cdpulse.style.setProperty('--p', 1 - p.pulseCd / pulseFull);
  ui.cdpulse.classList.toggle('off', p.carried < T.pulse_cost);
  ui.charmhud.style.display = p.charm > 0 ? 'block' : 'none';
  ui.charmval.textContent = Math.ceil(p.charm / TICK_RATE);
  ui.windhud.style.display = game.windWarning() ? 'block' : 'none';
  const near = game.lanterns.filter((l) => (!l.lit || l.fu < T.fuel_max * 60) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)[0];
  ui.prompt.style.display = near ? 'block' : 'none';
  if (near && near.lit) {
    ui.prompttext.textContent = 'E — Châm dầu';
    ui.promptval.textContent = `${Math.floor(near.fu / 60)}/${T.fuel_max}`;
  } else if (near) {
    ui.prompttext.textContent = near.everLit ? 'E — Thắp lại' : 'E — Nạp ánh sáng';
    ui.promptval.textContent = `${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost}`;
  }

  ui.arrow.style.display = 'none';
  if (unlit) {
    v3.set(unlit.l.pos[0], unlit.l.pos[1] + 2.6, unlit.l.pos[2]).project(camera);
    const behind = v3.z > 1;
    const off = behind || Math.abs(v3.x) > 1 || Math.abs(v3.y) > 1;
    if (off) {
      let x = v3.x;
      let y = v3.y;
      if (behind) {
        x = -x;
        y = -y;
      }
      const ang = Math.atan2(y, x);
      const m = 0.88;
      const s = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
      const ex = (Math.cos(ang) / s) * m;
      const ey = (Math.sin(ang) / s) * m;
      ui.arrow.style.display = 'block';
      ui.arrow.style.left = `${((ex + 1) / 2) * innerWidth - 14}px`;
      ui.arrow.style.top = `${((1 - ey) / 2) * innerHeight - 13}px`;
      ui.arrow.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    }
  }
}

let fpsFrames = 0;
let fpsT0 = performance.now();
let fpsValue = 0;
const fpsSamples = [];
let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  if (mode === 'playing' && game.state === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / TICK_RATE && steps < 8) {
      const wasGrounded = game.player.grounded;
      handleEvents(game.step(bot ? bot(game) : readInput()));
      if (wasGrounded && !game.player.grounded && game.player.vy > 6) sfx.jump();
      acc -= 1 / TICK_RATE;
      steps++;
      if (game.state !== 'playing') break;
    }
  } else {
    acc = 0;
  }
  render(now);
  fpsFrames++;
  if (now - fpsT0 >= 1000) {
    fpsValue = (fpsFrames * 1000) / (now - fpsT0);
    fpsSamples.push(fpsValue);
    if (fpsSamples.length > 120) fpsSamples.shift();
    fpsFrames = 0;
    fpsT0 = now;
  }
  ui.fps.style.display = showFps ? 'block' : 'none';
  if (showFps) {
    const avg = fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0;
    ui.fps.textContent = `${fpsValue.toFixed(0)} FPS · TB ${avg.toFixed(1)} (${fpsSamples.length}s) · ${renderer.domElement.width}×${renderer.domElement.height}`;
  }
  requestAnimationFrame(frame);
}

startNight(Number(params.get('night') || 1), Number(params.get('seed') || 1));
if (params.get('cb') === '1') settings.cb = true;
applyCb();
show('menu');
if (params.get('autostart') === '1') {
  const n = Number(params.get('night') || 1);
  startNight(n, Number(params.get('seed') || 1));
  const warp = Number(params.get('warp') || 0);
  const warpBot = createBot();
  for (let i = 0; i < warp && game.state === 'playing'; i++) handleEvents(game.step(warpBot(game)));
  for (const v of views.lanterns.values()) v.userData.litAt = null;
  if (params.get('yaw')) camYaw = Number(params.get('yaw'));
  const screen = params.get('screen');
  if (screen === 'intro') showIntro(n);
  else if (game.state === 'playing') {
    play();
    if (screen === 'pause') togglePause();
  }
}
requestAnimationFrame(frame);

window.__ddl = {
  get game() { return game; },
  get fps() { return { now: fpsValue, samples: [...fpsSamples] }; },
  startNight,
};
