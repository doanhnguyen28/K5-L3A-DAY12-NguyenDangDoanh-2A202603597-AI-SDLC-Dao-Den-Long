import * as THREE from 'three';
import { createGame } from '../sim/game.js';
import { ISLAND_RADIUS, TICK_RATE } from '../sim/constants.js';
import { sfx } from './audio.js';
import { createBot } from '../sim/bot.js';

const params = new URLSearchParams(location.search);
let bot = params.get('bot') === '1' ? createBot() : null;

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;

const $ = (id) => document.getElementById(id);
const ui = {
  flames: $('flames'), carried: $('carried'), lit: $('lit'), time: $('time'), score: $('scoreval'),
  pulsebar: $('pulsebar'), overlay: $('overlay'), title: $('title'), msg: $('msg'), start: $('start'),
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#140b24');
const WARM = new THREE.Color('#3b2a4f');
const DAWN = new THREE.Color('#e9a27a');
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(NIGHT.clone(), 25, 90);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight('#a99ad6', '#2a1a3d', 1.4);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#b7bdff', 0.9);
moon.position.set(-20, 40, -10);
scene.add(moon);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS + 0.6, ISLAND_RADIUS - 6, 4, 72), mat('#2f4133'));
island.position.y = -2;
scene.add(island);
const sand = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_RADIUS + 0.2, 0.6, 8, 72), mat('#8b7a5a'));
sand.rotation.x = Math.PI / 2;
sand.position.y = -0.3;
scene.add(sand);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat('#2b1f45', { roughness: 1 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -7;
scene.add(clouds);

let deco = 12345;
const drand = () => ((deco = (deco * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 36; i++) {
  const r = 32 + drand() * 6;
  const a = drand() * Math.PI * 2;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6), mat('#4a3426'));
  trunk.position.y = 0.4;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7 + drand() * 0.5, 1.6 + drand(), 7), mat('#22362c'));
  crown.position.y = 1.5;
  tree.add(trunk, crown);
  tree.position.set(x, 0, z);
  scene.add(tree);
}
const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 9), mat('#6b4b31'));
pier.position.set(0, -0.1, -ISLAND_RADIUS - 3.5);
scene.add(pier);

function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.9, 12), mat('#4f7fc9'));
  body.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat('#f1c9a0'));
  head.position.y = 1.12;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.36, 24), mat('#e0be72'));
  hat.position.y = 1.42;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), mat('#3b2a1a'));
  string.position.set(0, 1.12, 0.55);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), glow('#ffb347', 3));
  lamp.position.set(0, 0.95, 0.55);
  const light = new THREE.PointLight('#ffb347', 8, 9, 1.6);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  g.userData = { light, lamp };
  return g;
}
const player = makePlayer();
scene.add(player);

const lanternViews = new Map();
function makeLantern(l) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat('#3d2b20'));
  post.position.y = 1.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), mat('#3d2b20'));
  arm.position.set(0, 3.1, 0.4);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat('#463a52'));
  shell.scale.set(1, 1.25, 1);
  shell.position.set(0, 2.6, 0.8);
  const light = new THREE.PointLight('#ffae42', 0, 20, 1.4);
  light.position.copy(shell.position);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.0 }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.04;
  g.add(post, arm, shell, light, ring, fill);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  g.userData = { shell, light, ring, fill, litAt: null };
  scene.add(g);
  return g;
}

const moteGeo = new THREE.SphereGeometry(0.13, 8, 6);
const moteMat = glow('#ffd36b', 3);
const moteViews = new Map();

const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
const eyeMat = glow('#d8b4ff', 2.5);
const shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: '#1d0b2b', emissive: '#3a0d5c', emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.92 }));
  body.scale.set(1, 0.85, 1);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.15, 0.62);
  e2.position.set(0.25, 0.15, 0.62);
  g.add(body, e1, e2);
  g.userData = { body };
  scene.add(g);
  return g;
}

const guide = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow('#fff1a8', 4));
const guideLight = new THREE.PointLight('#fff1a8', 2, 4, 2);
guide.add(guideLight);
scene.add(guide);

const pulses = [];
function spawnPulse(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], 0.1, pos[2]);
  scene.add(m);
  pulses.push({ m, t: 0 });
}

const keys = new Set();
const latch = { jump: false, interact: false, pulse: false };
let camYaw = 0;
let dragging = false;
let lastX = 0;
const KEYMAP = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse' };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (KEYMAP[e.code]) latch[KEYMAP[e.code]] = true;
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyB') bot = bot ? null : createBot();
  if (e.code === 'KeyM') sfx.toggleMute();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) latch.pulse = true;
  dragging = true;
  lastX = e.clientX;
});
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

function readInput() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyW')) z += 1;
  if (keys.has('KeyS')) z -= 1;
  if (keys.has('KeyA')) x += 1;
  if (keys.has('KeyD')) x -= 1;
  const input = {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: keys.has('Space') || latch.jump,
    interact: keys.has('KeyE') || latch.interact,
    pulse: keys.has('KeyF') || latch.pulse,
  };
  latch.jump = latch.interact = latch.pulse = false;
  return input;
}

let game;
let running = false;
let ended = false;

function clearViews(map) {
  for (const v of map.values()) scene.remove(v);
  map.clear();
}

function restart(seed = (Date.now() & 0x7fffffff) >>> 0) {
  game = createGame({ tuning: T, seed });
  if (bot) bot = createBot();
  clearViews(moteViews);
  clearViews(shadeViews);
  clearViews(lanternViews);
  for (const l of game.lanterns) lanternViews.set(l.id, makeLantern(l));
  camYaw = 0;
  ended = false;
  running = true;
  ui.overlay.classList.add('hidden');
  sfx.unlock();
}

ui.start.addEventListener('click', () => restart());

function showEnd(result, reason) {
  ended = true;
  running = false;
  const reasons = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến ấm áp trở lại!', dawn: 'Trời đã sáng mà đảo vẫn chưa được thắp hết đèn.', no_flames: 'Mây đã mất hết ngọn lửa vì Bóng Mực.' };
  ui.title.textContent = result === 'won' ? 'Chiến thắng!' : 'Thua rồi…';
  ui.msg.textContent = `${reasons[reason] || ''} Điểm: ${game.score}.`;
  ui.start.textContent = 'Chơi lại (R)';
  ui.overlay.classList.remove('hidden');
}

function handleEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': {
        sfx.lit();
        const v = lanternViews.get(e.data.lantern_id);
        if (v) v.userData.litAt = performance.now();
        break;
      }
      case 'pulse': sfx.pulse(); spawnPulse(game.player.pos); break;
      case 'player_hit': sfx.hit(); break;
      case 'shade_spawned': sfx.spawn(); break;
      case 'game_over':
        (e.data.result === 'won' ? sfx.won : sfx.lost)();
        setTimeout(() => showEnd(e.data.result, e.data.reason), 900);
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

const tmpColor = new THREE.Color();
function render(now) {
  const t = now / 1000;
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = p.facing;
  const invuln = game.tick < p.invulnUntil;
  player.visible = !invuln || Math.floor(t * 12) % 2 === 0;
  player.userData.light.intensity = 4 + Math.min(p.carried, T.carry_capacity) * 0.8;

  syncMap(moteViews, game.motes, () => {
    const m = new THREE.Mesh(moteGeo, moteMat);
    scene.add(m);
    return m;
  }, (m, it) => {
    const ph = Number(it.id.slice(1)) * 1.7;
    m.position.set(it.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, 0.8 + Math.sin(t * 2 + ph) * 0.25, it.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
  });

  syncMap(shadeViews, game.shades, makeShade, (v, s) => {
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.1, s.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    const stunned = s.state === 'stunned';
    v.userData.body.material.opacity = stunned ? 0.4 : 0.92;
    v.userData.body.material.emissive.set(stunned ? '#8a6bb0' : '#3a0d5c');
    const sc = stunned ? 0.75 + Math.sin(t * 10) * 0.05 : 1;
    v.scale.setScalar(sc);
  });

  let litCount = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const u = v.userData;
    if (l.lit) {
      litCount++;
      const k = u.litAt ? Math.min(1, (now - u.litAt) / 800) : 1;
      u.light.intensity = 40 * k;
      u.shell.material.color.set('#ffb347');
      u.shell.material.emissive.set('#ff9a2e');
      u.shell.material.emissiveIntensity = 2 * k;
      u.ring.material.opacity = 0.35 * k;
    } else {
      const frac = l.deposited / T.lantern_cost;
      u.light.intensity = frac * 6;
      u.shell.material.emissive.set('#ff9a2e');
      u.shell.material.emissiveIntensity = frac * 0.8;
      u.fill.scale.setScalar(0.01 + frac * 3);
      u.fill.material.opacity = frac > 0 ? 0.25 : 0;
    }
  }

  const lightFrac = litCount / game.lanterns.length;
  const target = game.state === 'won' ? DAWN : tmpColor.copy(NIGHT).lerp(WARM, lightFrac);
  scene.background.lerp(target, 0.03);
  scene.fog.color.copy(scene.background);
  scene.fog.far = 90 + lightFrac * 60;
  hemi.intensity = 1.4 + lightFrac * 1.4;

  const unlit = game.lanterns.filter((l) => !l.lit).map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) })).sort((a, b) => a.d - b.d)[0];
  let gx = p.pos[0] + Math.cos(t * 2) * 1.1;
  let gz = p.pos[2] + Math.sin(t * 2) * 1.1;
  if (unlit && p.carried > 0 && unlit.d > T.interact_radius) {
    const dx = (unlit.l.pos[0] - p.pos[0]) / unlit.d;
    const dz = (unlit.l.pos[2] - p.pos[2]) / unlit.d;
    const lead = 2 + Math.sin(t * 3) * 0.4;
    gx = p.pos[0] + dx * lead;
    gz = p.pos[2] + dz * lead;
  }
  guide.position.lerp(new THREE.Vector3(gx, p.pos[1] + 1.6 + Math.sin(t * 4) * 0.15, gz), 0.12);

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
  const dist = 9;
  const desired = new THREE.Vector3(p.pos[0] - Math.sin(th) * dist, p.pos[1] + 4.5, p.pos[2] - Math.cos(th) * dist);
  if (camera.position.distanceTo(desired) > 15) camera.position.copy(desired);
  else camera.position.lerp(desired, 0.15);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  ui.flames.textContent = '♦'.repeat(p.flames) + '◇'.repeat(Math.max(0, T.flames - p.flames));
  ui.carried.textContent = `${p.carried} / ${T.carry_capacity}`;
  ui.lit.textContent = litCount;
  const tl = Math.max(0, Math.ceil(game.timeLeft()));
  ui.time.textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  ui.score.textContent = game.score;
  const cdTicks = Math.round(T.pulse_cooldown_s * TICK_RATE) || 1;
  const ready = Math.min(1, 1 - (p.pulseReadyAt - game.tick) / cdTicks);
  ui.pulsebar.style.width = `${Math.max(0, ready) * 100}%`;
  ui.pulsebar.style.background = p.carried >= T.pulse_cost ? '#ffc46b' : '#7a6a8a';

  renderer.render(scene, camera);
}

game = createGame({ tuning: T, seed: 1 });
for (const l of game.lanterns) lanternViews.set(l.id, makeLantern(l));

let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  if (running && !ended) {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / TICK_RATE && steps < 8) {
      handleEvents(game.step(bot ? bot(game) : readInput()));
      acc -= 1 / TICK_RATE;
      steps++;
      if (game.state !== 'playing') {
        running = false;
        break;
      }
    }
  } else {
    acc = 0;
  }
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (params.get('autostart') === '1') {
  restart(Number(params.get('seed') || 1));
  const warp = Number(params.get('warp') || 0);
  const warpBot = createBot();
  for (let i = 0; i < warp && game.state === 'playing'; i++) handleEvents(game.step(warpBot(game)));
  for (const l of game.lanterns) if (l.lit) lanternViews.get(l.id).userData.litAt = null;
  if (params.get('yaw')) camYaw = Number(params.get('yaw'));
}

window.__ddl = { get game() { return game; }, restart };
