import * as THREE from 'three';
import { createGame } from '../sim/game.js';
import { TICK_RATE, WIND_SPEED } from '../sim/constants.js';
import { MAPS } from '../sim/maps.js';
import { createBot } from '../sim/bot.js';
import { addEntry, makeEntry, sortEntries, validateName } from '../leaderboard.js';
import { sfx } from './audio.js';

const PAL = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  litLamp: '#FFB347', core: '#FFE9B0', offLamp: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeEdge: '#7A3CFF', shadeStun: '#3A3450', shirt: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', ui: '#F5F1E6',
};
const CB_EDGE = '#00B3FF';
const NIGHT_TEXT = {
  1: 'Mây à, sương đen đã nuốt bến thuyền. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé.',
  2: 'Hai hòn đảo Cau nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng mê đom đóm của con lắm. Bục nhảy sẽ đưa con sang đảo bên kia.',
  3: 'Đảo Chuông cao ba tầng, gió thổi từng cơn. Leo dốc, nhảy bục để lên đỉnh tháp. Giữ đèn cháy để gọi bình minh về.',
};
const ACTIONS = [
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng'],
];
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP' };
const keyLabel = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift trái').replace('ShiftRight', 'Shift phải').replace(/^Arrow/, 'Mũi tên ');

const params = new URLSearchParams(location.search);
const BENCH = params.get('bench') === '1';
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
const settings = {
  volume: store.get('volume', 0.7), sens: store.get('sens', 0.3), cb: store.get('cb', false),
  calm: store.get('calm', false), big: store.get('big', false), keys: { ...DEFAULT_KEYS, ...store.get('keys', {}) },
};
if (params.get('cb') === '1') settings.cb = true;
if (params.get('big') === '1') settings.big = true;
sfx.setVolume(BENCH ? 0 : settings.volume);

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), flames: $('flames'), timer: $('timer'), lit: $('lit'), score: $('score'), motebar: $('motebar'),
  cddash: $('cddash'), cdpulse: $('cdpulse'), prompt: $('prompt'), promptval: $('promptval'), prompttext: $('prompttext'),
  arrow: $('arrow'), shadearrow: $('shadearrow'), charmhud: $('charmhud'), charmval: $('charmval'), fps: $('fps'),
  need: $('need'), carrytext: $('carrytext'), captions: $('captions'), flash: $('flash'),
};
for (let i = 0; i < T.capacity_max; i++) ui.motebar.appendChild(document.createElement('i'));
const screens = ['menu', 'intro', 'result', 'pause', 'settings', 'board'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
if (BENCH) {
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720);
} else {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
}
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.fog, 30, 110);
const camera = new THREE.PerspectiveCamera(60, BENCH ? 1280 / 720 : innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  if (BENCH) return;
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
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rMin + rnd() * (rMax - rMin);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (!avoid(x, z)) pts.push([x, z]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6), mat(PAL.wood), pts.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2, 7), mat('#24463c'), pts.length);
  const m = new THREE.Matrix4();
  pts.forEach(([x, z], i) => {
    trunks.setMatrixAt(i, m.makeTranslation(x, 0.4, z));
    crowns.setMatrixAt(i, m.makeTranslation(x, 1.6, z));
  });
  group.add(trunks, crowns);
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

const INST_CAP = 256;
function instanced(geo, material, cap = INST_CAP) {
  const m = new THREE.InstancedMesh(geo, material, cap);
  m.count = 0;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
const moteCores = instanced(new THREE.SphereGeometry(0.11, 8, 6), glow(PAL.moteCore, 3));
const moteHalos = instanced(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.35, depthWrite: false }));
const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const shadeBodies = instanced(shadeGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
shadeBodies.setColorAt(0, new THREE.Color(PAL.shadeBody));
const edgeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeEdge, side: THREE.BackSide });
const shadeEdges = instanced(shadeGeo, edgeMat);
const eyeMat = glow(PAL.shadeEdge, 2.5);
const shadeEyes = instanced(new THREE.SphereGeometry(0.1, 8, 6), eyeMat, INST_CAP * 2);
function applyCb() {
  document.body.classList.toggle('cb', settings.cb);
  const edge = settings.cb ? CB_EDGE : PAL.shadeEdge;
  edgeMat.color.set(edge);
  eyeMat.color.set(edge);
  eyeMat.emissive.set(edge);
}
function applyUiPrefs() {
  document.documentElement.classList.toggle('big', settings.big);
  document.documentElement.classList.toggle('calm', settings.calm);
}

const views = { lanterns: new Map(), drifters: new Map(), charms: new Map() };
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
if (BENCH) {
  guide.visible = false;
  for (const l of leaves) l.visible = false;
}

const pulses = [];
function spawnPulse(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.core, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], pos[1] + 0.1, pos[2]);
  scene.add(m);
  pulses.push({ m, t: 0 });
}

let shake = 0;
function flash(color) {
  if (settings.calm) return;
  ui.flash.style.transition = 'none';
  ui.flash.style.background = color;
  ui.flash.style.opacity = '0.35';
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity 0.35s';
    ui.flash.style.opacity = '0';
  });
}
const captions = [];
function caption(text, ms = 3000) {
  const el = document.createElement('div');
  el.className = 'pill';
  el.textContent = text;
  ui.captions.appendChild(el);
  captions.push({ el, until: performance.now() + ms });
  while (captions.length > 4) captions.shift().el.remove();
}
let shadeAlert = null;

const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false };
let camYaw = 0;
let camPitch = Number(params.get('pitch') || 0.42);
const camDist = Number(params.get('dist') || 10);
let dragging = false;
let lastX = 0;
let lastY = 0;
let capturing = null;

let game = null;
let mode = 'menu';
let night = 1;
let totalScore = 0;
let nightsWon = 0;
let runSeed = 1;
let bot = params.get('bot') === '1' ? createBot() : null;
let showFps = params.get('fps') === '1';
let lastSecond = null;
let windWarned = false;
let settingsReturn = 'menu';
let lowFuelWarned = new Set();

const actionOf = (code) => Object.keys(settings.keys).find((a) => settings.keys[a] === code);
addEventListener('keydown', (e) => {
  if (capturing) {
    e.preventDefault();
    if (e.code === 'Escape') {
      capturing = null;
      $('keywarn').textContent = '';
      renderKeys();
      return;
    }
    const clash = actionOf(e.code);
    if (clash && clash !== capturing) {
      $('keywarn').textContent = `⚠ Phím ${keyLabel(e.code)} đang dùng cho "${ACTIONS.find((a) => a[0] === clash)[1]}". Chọn phím khác.`;
      renderKeys(clash);
      return;
    }
    settings.keys[capturing] = e.code;
    store.set('keys', settings.keys);
    $('keywarn').textContent = '';
    capturing = null;
    renderKeys();
    return;
  }
  if (e.repeat) return;
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  keys.add(e.code);
  const a = actionOf(e.code);
  if (a && a in latch) latch[a] = true;
  if (a === 'pause' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyB' && !actionOf('KeyB')) bot = bot ? null : createBot();
  if (e.code === 'F3') {
    e.preventDefault();
    showFps = !showFps;
  }
  if (e.code === settings.keys.jump || e.code === 'Space') e.preventDefault();
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
  const k = settings.keys;
  const held = (a) => keys.has(k[a]);
  const x = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
  const z = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
  const input = {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: held('jump') || latch.jump, interact: held('interact') || latch.interact,
    pulse: held('pulse') || latch.pulse, dash: held('dash') || latch.dash,
  };
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  return input;
}

function renderKeys(bad = null) {
  const tbl = $('keys');
  tbl.innerHTML = '';
  for (const [a, label] of ACTIONS) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = label;
    const td2 = document.createElement('td');
    if (a === bad) td2.className = 'bad';
    const b = document.createElement('button');
    b.className = 'ghost';
    b.textContent = capturing === a ? 'Nhấn phím…' : keyLabel(settings.keys[a]);
    b.onclick = () => {
      capturing = a;
      $('keywarn').textContent = 'Nhấn phím mới (Esc để hủy).';
      renderKeys();
    };
    td2.appendChild(b);
    tr.append(td1, td2);
    tbl.appendChild(tr);
  }
  updateKeyHints();
}
function updateKeyHints() {
  const k = settings.keys;
  const L = (a) => `<kbd>${keyLabel(k[a])}</kbd>`;
  $('menuKeys').innerHTML = `${L('up')}${L('left')}${L('down')}${L('right')} đi · ${L('jump')} nhảy · ${L('dash')} lướt · ${L('interact')} nạp/châm đèn · ${L('pulse')} tỏa sáng · <kbd>Esc</kbd>/${L('pause')} tạm dừng`;
}

function startNight(n, seed) {
  night = n;
  if (world) disposeGroup(world);
  world = buildWorld(n);
  clearViews();
  game = createGame({ tuning: T, seed, night: n, bench: BENCH });
  if (bot) bot = createBot();
  for (const l of game.lanterns) views.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  lastSecond = null;
  windWarned = false;
  lowFuelWarned = new Set();
  shadeAlert = null;
  scene.background.set(PAL.sky);
}

function showIntro(n) {
  startNight(n, runSeed + n - 1);
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
  nightsWon = 0;
  sfx.stopMusic();
  ui.hud.classList.add('hidden');
  show('menu');
}

async function fetchBoard() {
  try {
    const r = await fetch('/api/leaderboard');
    if (!r.ok) throw new Error('offline');
    return (await r.json()).entries;
  } catch {
    return sortEntries(store.get('leaderboard', []));
  }
}
async function saveScore(name) {
  const body = { name, score: totalScore, nights_won: nightsWon, seed: runSeed };
  let r;
  try {
    r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    r = null;
  }
  if (r && r.status !== 404) {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j.entries;
  }
  const entries = addEntry(store.get('leaderboard', []), makeEntry(body));
  store.set('leaderboard', entries);
  return entries;
}
async function showBoard() {
  const entries = await fetchBoard();
  const tb = $('boardBody');
  tb.innerHTML = '';
  entries.forEach((e, i) => {
    const tr = document.createElement('tr');
    for (const v of [i + 1, e.name, e.score, e.nights_won, e.achieved_at.replace('T', ' ').slice(0, 16)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
  $('boardEmpty').textContent = entries.length ? '' : 'Chưa có ai lưu điểm.';
  show('board');
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
  let offerSave = false;
  if (result === 'won') {
    totalScore += game.score;
    nightsWon += 1;
    const litNow = game.lanterns.filter((l) => l.lit).length;
    if (night === 3) {
      $('resTitle').textContent = 'Bình Minh';
      $('resMsg').textContent = `Ba hòn đảo đã sáng trở lại. Mặt trời lên trên biển mây. Tổng điểm: ${totalScore}.`;
      scene.background.set('#e9a27a');
      add('Về menu', toMenu);
      offerSave = true;
    } else {
      $('resTitle').textContent = `Đêm ${night} — Thắng!`;
      $('resMsg').textContent = `Trời sáng với ${litNow}/${game.lanterns.length} đèn còn cháy. Điểm đêm: ${game.score}. Tổng điểm: ${totalScore}.`;
      add(`Sang Đêm ${night + 1}`, () => showIntro(night + 1));
      add('Về menu', toMenu, true);
    }
  } else {
    const why = { dawn: `Trời sáng nhưng chưa đủ ${game.needLit} đèn còn cháy.`, no_flames: 'Mây đã mất hết Ngọn Lửa.' };
    $('resTitle').textContent = `Đêm ${night} — Thua`;
    $('resMsg').textContent = `${why[reason] || ''} Tổng điểm (các đêm đã thắng): ${totalScore}.`;
    add('Chơi lại Đêm này', () => showIntro(night));
    add('Về menu', toMenu, true);
    offerSave = true;
  }
  $('saveForm').style.display = offerSave ? 'grid' : 'none';
  $('btnSave').disabled = false;
  $('saveMsg').textContent = '';
  show('result');
}
$('saveForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = validateName($('saveName').value);
  if (!name) {
    $('saveMsg').textContent = '⚠ Tên cần 3–12 ký tự: chữ (có dấu được), số hoặc _.';
    return;
  }
  try {
    const entries = await saveScore(name);
    const rank = entries.findIndex((x) => x.name === name && x.score === totalScore) + 1;
    $('saveMsg').textContent = rank ? `Đã lưu! Hạng ${rank}.` : 'Đã lưu, nhưng chưa vào top 10.';
    $('btnSave').disabled = true;
  } catch (err) {
    $('saveMsg').textContent = `⚠ ${err.message}`;
  }
};

$('btnStart').onclick = () => {
  totalScore = 0;
  nightsWon = 0;
  runSeed = (Date.now() & 0x7fffffff) >>> 0;
  sfx.unlock();
  showIntro(1);
};
$('btnBoard').onclick = showBoard;
$('btnBoardBack').onclick = () => show('menu');
$('btnPlay').onclick = play;
$('btnResume').onclick = play;
$('btnRestart').onclick = () => showIntro(night);
$('btnMenu').onclick = toMenu;
const openSettings = (from) => {
  settingsReturn = from;
  $('setVolume').value = settings.volume;
  $('setSens').value = settings.sens;
  $('setCb').checked = settings.cb;
  $('setCalm').checked = settings.calm;
  $('setBig').checked = settings.big;
  $('keywarn').textContent = '';
  renderKeys();
  show('settings');
};
$('btnSettingsMenu').onclick = () => openSettings('menu');
$('btnSettingsPause').onclick = () => openSettings('pause');
$('btnSettingsBack').onclick = () => {
  capturing = null;
  show(settingsReturn);
};
$('btnKeysReset').onclick = () => {
  settings.keys = { ...DEFAULT_KEYS };
  store.set('keys', settings.keys);
  $('keywarn').textContent = 'Đã khôi phục phím mặc định.';
  renderKeys();
};
$('setVolume').oninput = (e) => {
  settings.volume = Number(e.target.value);
  sfx.setVolume(settings.volume);
  store.set('volume', settings.volume);
};
$('setSens').oninput = (e) => {
  settings.sens = Number(e.target.value);
  store.set('sens', settings.sens);
};
$('setCb').onchange = (e) => {
  settings.cb = e.target.checked;
  store.set('cb', settings.cb);
  applyCb();
};
$('setCalm').onchange = (e) => {
  settings.calm = e.target.checked;
  store.set('calm', settings.calm);
  applyUiPrefs();
};
$('setBig').onchange = (e) => {
  settings.big = e.target.checked;
  store.set('big', settings.big);
  applyUiPrefs();
};

function handleEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'refuel': sfx.deposit(); break;
      case 'lantern_lit': {
        sfx.lit();
        flash('#FFB347');
        lowFuelWarned.delete(e.data.lantern_id);
        const v = views.lanterns.get(e.data.lantern_id);
        if (v) v.userData.litAt = performance.now();
        break;
      }
      case 'lantern_out': sfx.lost(); caption(`🏮 Đèn ${e.data.lantern_id} đã tắt`); lowFuelWarned.delete(e.data.lantern_id); break;
      case 'pulse': sfx.pulse(); spawnPulse(game.player.pos); break;
      case 'player_hit':
        sfx.hit();
        flash('#FF5A5F');
        if (!settings.calm) shake = 0.35;
        caption(e.data.by === 'fall' ? '⚠ Mây rơi khỏi đảo! −1 Ngọn Lửa' : '⚠ Bóng Mực chạm Mây! −1 Ngọn Lửa');
        break;
      case 'shade_spawned':
        sfx.spawn();
        caption('⚠ Bóng Mực xuất hiện');
        shadeAlert = { id: e.data.id, until: performance.now() + 3500 };
        break;
      case 'dash': sfx.dash(); break;
      case 'charm_picked': sfx.charm(); caption('🍃 Bùa Gió: chạy nhanh 10 giây'); break;
      case 'drifter_steal': sfx.steal(); caption(`⚠ Gió Lạc cướp ${e.data.amount} đom đóm`); break;
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
const dummy = new THREE.Object3D();
const mtx = new THREE.Matrix4();
const eyeOff = [new THREE.Matrix4().makeTranslation(-0.25, 0.15, 0.62), new THREE.Matrix4().makeTranslation(0.25, 0.15, 0.62)];
const colBody = new THREE.Color(PAL.shadeBody);
const colStun = new THREE.Color(PAL.shadeStun);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function renderEntities(t, p) {
  const nm = Math.min(game.motes.length, INST_CAP);
  for (let i = 0; i < nm; i++) {
    const it = game.motes[i];
    const ph = Number(it.id.slice(1)) * 1.7;
    const hidden = it.kind === 'dropped' && it.ttl < 120 && Math.floor(t * 8) % 2 === 0;
    if (hidden) {
      moteCores.setMatrixAt(i, ZERO);
      moteHalos.setMatrixAt(i, ZERO);
      continue;
    }
    mtx.makeTranslation(it.pos[0] + Math.sin(t * 1.3 + ph) * 0.12, it.pos[1] + 0.8 + Math.sin(t * 2 + ph) * 0.2, it.pos[2] + Math.cos(t * 1.1 + ph) * 0.12);
    moteCores.setMatrixAt(i, mtx);
    moteHalos.setMatrixAt(i, mtx);
  }
  moteCores.count = moteHalos.count = nm;
  moteCores.instanceMatrix.needsUpdate = moteHalos.instanceMatrix.needsUpdate = true;

  const ns = Math.min(game.shades.length, INST_CAP);
  for (let i = 0; i < ns; i++) {
    const s = game.shades[i];
    const stunned = s.state === 'stunned';
    const spawnK = s.state === 'spawning' ? Math.max(0.05, 1 - s.ticks / 60) : 1;
    const sc = (stunned ? 0.8 + Math.sin(t * 10) * 0.05 : 1) * spawnK;
    const bob = Math.sin(t * 3 + s.pos[0]) * 0.1;
    dummy.position.set(s.pos[0], s.pos[1] + bob, s.pos[2]);
    dummy.lookAt(p.pos[0], s.pos[1] + bob, p.pos[2]);
    dummy.scale.set(sc, sc * 0.85, sc);
    dummy.updateMatrix();
    shadeBodies.setMatrixAt(i, dummy.matrix);
    shadeBodies.setColorAt(i, stunned ? colStun : colBody);
    dummy.scale.set(sc * 1.08, sc * 0.93, sc * 1.08);
    dummy.updateMatrix();
    shadeEdges.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    shadeEyes.setMatrixAt(2 * i, mtx.multiplyMatrices(dummy.matrix, eyeOff[0]));
    shadeEyes.setMatrixAt(2 * i + 1, mtx.multiplyMatrices(dummy.matrix, eyeOff[1]));
  }
  shadeBodies.count = shadeEdges.count = ns;
  shadeEyes.count = ns * 2;
  shadeBodies.instanceMatrix.needsUpdate = shadeEdges.instanceMatrix.needsUpdate = shadeEyes.instanceMatrix.needsUpdate = true;
  if (shadeBodies.instanceColor) shadeBodies.instanceColor.needsUpdate = true;

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
}

function renderLanterns(now, t) {
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
      if (low && !lowFuelWarned.has(l.id) && mode === 'playing') {
        lowFuelWarned.add(l.id);
        caption(`🏮 Đèn ${l.id} sắp hết dầu (< ${T.low_fuel_threshold})`);
      }
    } else {
      u.light.intensity = frac * 5;
      u.shell.material.color.set(PAL.offLamp);
      u.shell.material.emissiveIntensity = frac * 0.6;
      u.core.material.emissiveIntensity = frac;
      u.ring.material.opacity = 0;
    }
  }
  return litCount;
}

function render(now, benchT) {
  const t = now / 1000;
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = p.facing;
  player.visible = !(p.invuln > 0) || Math.floor(t * 12) % 2 === 0;
  player.userData.light.intensity = 4 + Math.min(p.carried, T.carry_capacity) * 0.8;

  renderEntities(t, p);
  const litCount = renderLanterns(now, t);
  ambient.intensity = 0.15 + 0.55 * (litCount / game.lanterns.length);

  const unlit = game.lanterns.filter((l) => !l.lit).map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) })).sort((a, b) => a.d - b.d)[0];
  if (!BENCH) {
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
      caption('🍃 Gió sắp thổi mạnh (2 giây)');
    }
    if (!warn) windWarned = false;
  }

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

  if (BENCH) {
    const a = (2 * Math.PI * benchT) / 15;
    camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
    camera.lookAt(0, 0, 0);
  } else {
    const th = (camYaw * Math.PI) / 180;
    desired.set(p.pos[0] - Math.sin(th) * camDist * Math.cos(camPitch), p.pos[1] + 1.2 + camDist * Math.sin(camPitch), p.pos[2] - Math.cos(th) * camDist * Math.cos(camPitch));
    if (camera.position.distanceTo(desired) > 15) camera.position.copy(desired);
    else camera.position.lerp(desired, 0.15);
    camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
    if (shake > 0 && !settings.calm) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - 0.02);
    }
    updateHud(p, litCount, unlit, now);
  }
  renderer.render(scene, camera);
}

function edgeArrow(el, pos, y) {
  v3.set(pos[0], y, pos[2]).project(camera);
  const behind = v3.z > 1;
  const off = behind || Math.abs(v3.x) > 1 || Math.abs(v3.y) > 1;
  if (!off) {
    el.style.display = 'none';
    return;
  }
  let x = v3.x;
  let yy = v3.y;
  if (behind) {
    x = -x;
    yy = -yy;
  }
  const ang = Math.atan2(yy, x);
  const s = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
  const ex = (Math.cos(ang) / s) * 0.88;
  const ey = (Math.sin(ang) / s) * 0.88;
  el.style.display = 'block';
  el.style.left = `${((ex + 1) / 2) * innerWidth - 14}px`;
  el.style.top = `${((1 - ey) / 2) * innerHeight - 13}px`;
  el.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
}

function updateHud(p, litCount, unlit, now) {
  ui.flames.innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? 'on' : 'off'}">🔥</span>`).join('');
  const tl = Math.max(0, Math.ceil(game.timeLeft()));
  const clock = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
  ui.timer.textContent = settings.cb && tl <= 30 ? `⚠ ${clock}` : clock;
  ui.timer.classList.toggle('danger', tl <= 30);
  if (mode === 'playing' && tl <= 10 && tl > 0 && tl !== lastSecond) {
    sfx.countdown();
    if (tl === 10) caption('⏳ 10 giây cuối trước bình minh');
  }
  lastSecond = tl;
  ui.lit.textContent = `${litCount}/${game.lanterns.length}`;
  ui.need.textContent = `cần ${game.needLit} lúc bình minh`;
  const cap = game.capacity();
  ui.carrytext.textContent = `Đom đóm ${p.carried} / ${cap}`;
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
  const near = game.lanterns.filter((l) => (!l.lit || l.fu < T.fuel_max * 60) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)[0];
  ui.prompt.style.display = near ? 'block' : 'none';
  const ik = keyLabel(settings.keys.interact);
  if (near && near.lit) {
    ui.prompttext.textContent = `${ik} — Châm dầu`;
    ui.promptval.textContent = `${Math.floor(near.fu / 60)}/${T.fuel_max}`;
  } else if (near) {
    ui.prompttext.textContent = `${ik} — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'}`;
    ui.promptval.textContent = `${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost}`;
  }
  if (unlit) edgeArrow(ui.arrow, unlit.l.pos, unlit.l.pos[1] + 2.6);
  else ui.arrow.style.display = 'none';
  const alertShade = shadeAlert && now < shadeAlert.until ? game.shades.find((s) => s.id === shadeAlert.id) : null;
  if (alertShade) edgeArrow(ui.shadearrow, alertShade.pos, alertShade.pos[1]);
  else ui.shadearrow.style.display = 'none';
  for (let i = captions.length - 1; i >= 0; i--) {
    if (now > captions[i].until) {
      captions[i].el.remove();
      captions.splice(i, 1);
    }
  }
}

let fpsFrames = 0;
let fpsT0 = performance.now();
let fpsValue = 0;
const fpsSamples = [];
let acc = 0;
let last = performance.now();
const bench = { start: null, warm: 3, dur: Number(params.get('duration') || 30), dts: [], prev: null, done: false, heapPeak: 0 };

function benchFrame(now) {
  if (bench.start === null) {
    bench.start = now;
    fetch('/bench/first', { method: 'POST', body: JSON.stringify({ at: Date.now() }) }).catch(() => {});
  }
  const el = (now - bench.start) / 1000;
  if (bench.prev !== null && el > bench.warm && !bench.done) {
    bench.dts.push(now - bench.prev);
    if (performance.memory) bench.heapPeak = Math.max(bench.heapPeak, performance.memory.usedJSHeapSize);
  }
  bench.prev = now;
  if (el >= bench.warm + bench.dur && !bench.done) {
    bench.done = true;
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    fetch('/bench/result', {
      method: 'POST',
      body: JSON.stringify({
        dts: bench.dts,
        renderer: `three.js r${THREE.REVISION} WebGL2 | ${gpu} | ${navigator.userAgent.match(/(Edg|Chrome)\/[\d.]+/)?.[0] || navigator.userAgent}`,
        canvas: [renderer.domElement.width, renderer.domElement.height],
        js_heap_peak_mb: bench.heapPeak ? Math.round(bench.heapPeak / 1048576) : null,
        shades: game.shades.length,
        motes: game.motes.length,
      }),
    }).catch(() => {});
    window.__benchDone = true;
  }
}

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (BENCH) {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / TICK_RATE && steps < 8) {
      game.step({});
      acc -= 1 / TICK_RATE;
      steps++;
    }
    render(now, bench.start === null ? 0 : (now - bench.start) / 1000);
    benchFrame(now);
    requestAnimationFrame(frame);
    return;
  }
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
  render(now, 0);
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

applyCb();
applyUiPrefs();
updateKeyHints();
if (BENCH) {
  startNight(1, Number(params.get('seed') || 42));
  show(null);
  ui.hud.classList.add('hidden');
  mode = 'bench';
} else {
  startNight(Number(params.get('night') || 1), Number(params.get('seed') || 1));
  show('menu');
  if (params.get('autostart') === '1') {
    const n = Number(params.get('night') || 1);
    runSeed = Number(params.get('seed') || 1) - (n - 1);
    startNight(n, Number(params.get('seed') || 1));
    const warp = Number(params.get('warp') || 0);
    const warpBot = createBot();
    for (let i = 0; i < warp && game.state === 'playing'; i++) handleEvents(game.step(warpBot(game)));
    for (const v of views.lanterns.values()) v.userData.litAt = null;
    for (const pu of pulses.splice(0)) scene.remove(pu.m);
    if (params.get('yaw')) camYaw = Number(params.get('yaw'));
    const screen = params.get('screen');
    if (screen === 'intro') showIntro(n);
    else if (screen === 'settings') openSettings('menu');
    else if (screen === 'board') showBoard();
    else if (game.state === 'playing') {
      play();
      if (screen === 'pause') togglePause();
    }
  }
}
requestAnimationFrame(frame);

window.__ddl = {
  get game() { return game; },
  get fps() { return { now: fpsValue, samples: [...fpsSamples] }; },
  startNight,
};
