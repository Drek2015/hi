import * as THREE from '../vendor/three.module.min.js';
import { TICK } from './constants.js';
import { World } from './physics.js';
import { GameScene } from './scene.js';
import { CameraRig } from './camera.js';
import { Input, TouchControls } from './input.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings } from './settings.js';
import { SPAWNS, BALL } from './constants.js';
import { parseGlb, fitCar, fitBall, saveModel, loadSavedModel } from './models.js';

const settings = loadSettings();
const canvas = document.getElementById('game');
const input = new Input(settings);
const touch = new TouchControls(document.getElementById('touch'));
input.attachTouch(touch);
const sound = new Sound(settings);
const world = new World();
const gfx = new GameScene(canvas);
const rig = new CameraRig();

let paused = true;
let playing = false;
let clock = 0;
const isTouch = matchMedia('(pointer: coarse)').matches;

// Interpolation snapshots.
const prev = { carPos: new THREE.Vector3(), carQuat: new THREE.Quaternion(), ballPos: new THREE.Vector3(), ballQuat: new THREE.Quaternion() };
const view = {
  car: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fwd: new THREE.Vector3(), normal: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: true, boosting: false, supersonic: false, steer: 0, wheelSpin: 0 },
  ball: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), exploded: false },
  pads: new Float32Array(world.pads.length),
};

function snapshot() {
  prev.carPos.copy(world.car.pos); prev.carQuat.copy(world.car.quat);
  prev.ballPos.copy(world.ball.pos); prev.ballQuat.copy(world.ball.quat);
}

const ui = new UI(settings, input, {
  play: startPlaying,
  togglePause,
  resetShot: () => { world.resetAll(); snapshot(); rig.snap(); },
  resetAll: () => { world.resetAll(); world.score.blue = world.score.orange = 0; clock = 0; snapshot(); rig.snap(); },
  settingsChanged: applySettings,
  fullscreen: goFullscreen,
  loadModel: async (kind, file) => {
    try {
      const buf = await file.arrayBuffer();
      await applyModel(kind, buf);
      await saveModel(kind, buf);
      ui.toast(`${kind === 'car' ? 'Car' : 'Ball'} model loaded`);
    } catch (e) {
      ui.toast('That file could not be loaded. Use a .glb model.');
    }
  },
  clearModel: async kind => {
    models[kind] = null;
    if (kind === 'car') gfx.setCustomCar(null); else gfx.setCustomBall(null);
    await saveModel(kind, null);
    ui.toast(`Using the built-in ${kind}`);
  },
});

// Player-supplied models.
const models = { car: null, ball: null, carYaw: 0 };
async function applyModel(kind, buf) {
  const obj = await parseGlb(buf.slice(0));
  models[kind] = buf;
  if (kind === 'car') { models.carYaw = settings.models.carYaw; gfx.setCustomCar(fitCar(obj, settings.models.carYaw)); }
  else gfx.setCustomBall(fitBall(obj, BALL.R));
}
for (const kind of ['car', 'ball']) {
  loadSavedModel(kind).then(buf => { if (buf) applyModel(kind, buf).catch(() => {}); });
}
input.onPad = (on, id) => { ui.setPadStatus(on, id); updateTouchVisibility(); };
ui.setPadStatus(false, '');

function applySettings() {
  world.opt.unlimitedBoost = settings.training.unlimitedBoost;
  world.opt.dodgeDeadzone = settings.controls.dodgeDeadzone;
  if (world.spawnIndex !== settings.training.spawn) world.spawnIndex = settings.training.spawn;
  gfx.setQuality(settings.video.particles);
  gfx.carParts.hitbox.visible = settings.training.showHitbox;
  sound.applyVolume();
  resolution.reset();
  resize();
  ui.renderTools();
  if (models.car && models.carYaw !== settings.models.carYaw) applyModel('car', models.car).catch(() => {});
}

function updateTouchVisibility() {
  const show = playing && isTouch && input.padIndex < 0 && !ui.menuOpen;
  touch.show(show);
  document.getElementById('pause-btn').hidden = !playing || ui.menuOpen;
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

function startPlaying() {
  sound.start();
  goFullscreen();
  keepAwake();
  playing = true;
  paused = false;
  world.car.prevJump = true;
  ui.show('game');
  rig.snap();
  updateTouchVisibility();
}

function togglePause() {
  if (!playing) return;
  paused = !paused;
  ui.show(paused ? 'pause' : 'game');
  if (!paused) {
    world.car.prevJump = true;
    saveSettings(settings);
  }
  input.clearEdges();
  updateTouchVisibility();
}

// ---------- resolution & resizing ----------
const resolution = {
  scale: 1,
  samples: [],
  slowTime: 0,
  fastTime: 0,
  max() { return Math.min(window.devicePixelRatio || 1, 2.25); },
  reset() {
    const r = settings.video.renderScale;
    this.scale = r === 'auto' ? Math.min(1.5, this.max()) : r === 'native' ? (window.devicePixelRatio || 1) : r;
    this.samples = []; this.slowTime = 0; this.fastTime = 0;
  },
  // Dynamic resolution: drop pixels when frames are missed, add back when there is headroom.
  track(dt) {
    if (settings.video.renderScale !== 'auto') return false;
    this.samples.push(dt);
    if (this.samples.length > 120) this.samples.shift();
    if (this.samples.length < 60) return false;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const vsync = sorted[Math.floor(sorted.length * 0.1)];
    const recent = this.samples.slice(-20).reduce((a, b) => a + b, 0) / 20;
    if (recent > vsync * 1.2) { this.slowTime += dt; this.fastTime = 0; }
    else if (recent < vsync * 1.06) { this.fastTime += dt; this.slowTime = 0; }
    if (this.slowTime > 0.4 && this.scale > 0.55) {
      this.scale = Math.max(0.55, this.scale * 0.88); this.slowTime = 0; this.samples.length = 0; return true;
    }
    if (this.fastTime > 4 && this.scale < this.max()) {
      this.scale = Math.min(this.max(), this.scale * 1.06); this.fastTime = 0; return true;
    }
    return false;
  },
};
resolution.reset();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  gfx.resize(w, h, resolution.scale);
  document.getElementById('rotate').hidden = !(isTouch && h > w);
}
addEventListener('resize', resize);
screen.orientation?.addEventListener?.('change', resize);
applySettings();

// ---------- events → effects, sound, rumble ----------
const tmpV = new THREE.Vector3();
const BLUE_C = [0.25, 0.55, 1.0, 1], ORANGE_C = [1.0, 0.5, 0.12, 1], CLEAR = [0, 0, 0, 0];

function handleEvents() {
  const P = gfx.particles;
  for (const e of world.events) {
    switch (e.type) {
      case 'hit':
        sound.hit(e.strength);
        input.rumble(0.25 + e.strength * 0.75, 0.4 + e.strength * 0.6, 60 + e.strength * 120);
        P.burst(e.pos, 10 + Math.round(e.strength * 30), 400 + e.strength * 900, 0.35, 26, 4, [1, 0.95, 0.75, 1], [1, 0.5, 0.1, 0], { drag: 3 });
        if (settings.camera.shake) gfx.shake = Math.max(gfx.shake, e.strength * 0.6);
        break;
      case 'bounce': sound.bounce(e.strength); break;
      case 'jump': sound.jump(); break;
      case 'doublejump': sound.jump(); break;
      case 'flip': sound.flip(); break;
      case 'land': sound.land(e.strength); if (e.strength > 0.3) input.rumble(e.strength * 0.4, 0.2, 60); break;
      case 'bump': sound.land(e.strength); input.rumble(e.strength * 0.5, 0.3, 70); break;
      case 'pad':
        sound.pad(e.big);
        P.burst(world.car.pos, e.big ? 30 : 8, 350, 0.45, 18, 2, [1, 0.8, 0.3, 1], [1, 0.4, 0.05, 0], { drag: 2.5, up: 200 });
        break;
      case 'goal': {
        const c = e.team === 'blue' ? BLUE_C : ORANGE_C;
        P.burst(e.pos, 450, 2600, 1.4, 120, 10, [1, 1, 1, 1], [c[0], c[1], c[2], 0], { drag: 2.2, grav: -300 });
        P.burst(e.pos, 160, 1200, 2.2, 260, 60, c, CLEAR, { drag: 1.6, up: 300 });
        gfx.shake = 1.2;
        sound.goal();
        input.rumble(1, 1, 700);
        ui.goalBanner(e.team, e.speed);
        break;
      }
      case 'ballspawn':
        P.burst(world.ball.pos, 60, 500, 0.7, 50, 6, [1, 1, 1, 1], [0.6, 0.8, 1, 0], { drag: 3 });
        break;
      default: break;
    }
  }
  world.events.length = 0;
}

function emitTrails(dt) {
  const car = world.car, P = gfx.particles;
  if (car.boosting) {
    const n = Math.max(1, Math.round(dt * 300));
    for (let i = 0; i < n; i++) {
      tmpV.set(-72 - Math.random() * 30, (Math.random() - 0.5) * 8, 9 + (Math.random() - 0.5) * 8).applyQuaternion(view.car.quat).add(view.car.pos);
      const s = 180 + Math.random() * 160;
      P.emit(tmpV.x, tmpV.y, tmpV.z,
        -car.fwd.x * s + car.vel.x * 0.85 + (Math.random() - 0.5) * 60,
        -car.fwd.y * s + car.vel.y * 0.85 + (Math.random() - 0.5) * 60,
        -car.fwd.z * s + car.vel.z * 0.85 + (Math.random() - 0.5) * 60,
        0.22 + Math.random() * 0.12, 70, 26, [1, 0.55, 0.16, 0.85], [0.6, 0.12, 0.04, 0], 5, 60);
    }
    // Smoke puffs left hanging in the air behind the car.
    const S = gfx.smoke;
    const puffs = Math.max(1, Math.round(dt * 70));
    for (let i = 0; i < puffs; i++) {
      tmpV.set(-80 - Math.random() * 40, (Math.random() - 0.5) * 14, 11 + (Math.random() - 0.5) * 10).applyQuaternion(view.car.quat).add(view.car.pos);
      S.emit(tmpV.x, tmpV.y, tmpV.z,
        car.vel.x * 0.12 + (Math.random() - 0.5) * 70, car.vel.y * 0.12 + (Math.random() - 0.5) * 70, car.vel.z * 0.12 + 40 + Math.random() * 40,
        0.75 + Math.random() * 0.35, 60, 170, [0.93, 0.9, 0.86, 0.5], [0.78, 0.78, 0.8, 0], 1.5, 0);
    }
  }
  if (car.supersonic) {
    for (const side of [-1, 1]) {
      tmpV.set(-40, side * 36, -6).applyQuaternion(view.car.quat).add(view.car.pos);
      P.emit(tmpV.x, tmpV.y, tmpV.z, car.vel.x * 0.85, car.vel.y * 0.85, car.vel.z * 0.85, 0.35, 12, 4, [0.9, 0.95, 1, 0.8], [0.6, 0.8, 1, 0], 0, 0);
    }
  }
}

// ---------- main loop ----------
let acc = 0;
let last = performance.now();
let lastRender = 0;
let fps = 0, fpsFrames = 0, fpsTime = 0;
const vizRaw = [0, 0];

function frame(now) {
  requestAnimationFrame(frame);
  const limit = settings.video.fpsLimit;
  if (limit && now - lastRender < 1000 / limit - 1.5) return;
  lastRender = now;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0; }
  if (resolution.track(dt)) resize();

  const st = input.poll(dt, ui.menuOpen);

  // Menu and system buttons.
  const nav = input.takeNav();
  if (input.takeEdge('menu')) {
    if (!playing) startPlaying();
    else if (ui.screen === 'settings') ui.back();
    else togglePause();
  } else if (ui.menuOpen) ui.handleNav(nav);
  if (!ui.menuOpen && playing) {
    if (input.takeEdge('reset')) { world.resetAll(); snapshot(); rig.snap(); }
    for (const a of ['takePossession', 'startDribble', 'passBall', 'launchBall', 'defendShot']) {
      if (input.takeEdge(a)) { world.training(a); snapshot(); }
    }
  }
  input.clearEdges();

  if (ui.screen === 'settings') {
    const pad = input.getPad();
    if (pad) {
      const ax = settings.controls.stickAxes;
      vizRaw[0] = pad.axes[ax.steerX] ?? 0; vizRaw[1] = pad.axes[ax.steerY] ?? 0;
    }
    const dz = settings.controls.deadzone;
    let px = vizRaw[0], py = vizRaw[1];
    if (settings.controls.deadzoneShape === 'circle') {
      const m = Math.hypot(px, py);
      const s = m <= dz ? 0 : Math.min(1, (m - dz) / (1 - dz)) / m;
      px *= s; py *= s;
    } else {
      const f = v => (Math.abs(v) <= dz ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - dz) / (1 - dz)));
      px = f(px); py = f(py);
    }
    ui.drawStickViz(vizRaw, [px, py]);
    ui.drawPadTest(input.getPad());
  }

  if (!paused && playing) {
    acc += dt * settings.training.gameSpeed;
    let steps = 0;
    while (acc >= TICK && steps < 12) {
      snapshot();
      world.step(st);
      handleEvents();
      acc -= TICK;
      steps++;
    }
    if (steps === 12) acc = 0;
    clock += dt;
    ui.setClock(clock);
  }

  // Interpolate between the last two ticks.
  const alpha = paused || !playing ? 1 : acc / TICK;
  const c = world.car, b = world.ball;
  view.car.pos.lerpVectors(prev.carPos, c.pos, alpha);
  view.car.quat.slerpQuaternions(prev.carQuat, c.quat, alpha);
  view.car.fwd.set(1, 0, 0).applyQuaternion(view.car.quat);
  view.car.normal.copy(c.normal);
  view.car.vel.copy(c.vel);
  view.car.onGround = c.onGround;
  view.car.boosting = c.boosting && !paused;
  view.car.supersonic = c.supersonic;
  view.car.steer = c.steer;
  view.car.wheelSpin = c.wheelSpin;
  view.ball.pos.lerpVectors(prev.ballPos, b.pos, alpha);
  view.ball.quat.slerpQuaternions(prev.ballQuat, b.quat, alpha);
  view.ball.exploded = b.exploded;
  for (let i = 0; i < world.pads.length; i++) view.pads[i] = world.pads[i].timer;

  if (!paused && playing) emitTrails(dt);
  const camState = { ballCam: st.ballCam, camX: st.camX, camY: st.camY };
  const cam = rig.update(paused ? 0 : dt, view.car, view.ball, camState, settings.camera, gfx.camera.aspect);
  gfx.setCamera(cam.pos, cam.look, cam.up, cam.vfov);
  gfx.update(view, paused ? 0 : dt);
  gfx.render();
  sound.update(c, paused || !playing);
  ui.updateHud(world, fps, dt);
}

// Attract mode on the start screen: slow orbit of the field.
world.resetAll();
snapshot();
requestAnimationFrame(t => { last = t; frame(t); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing && !paused) togglePause();
  if (!document.hidden && wakeLock === null && playing) keepAwake();
});

// Offline support when served over https (GitHub Pages etc).
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.__game = { world, settings, gfx, rig, SPAWNS };
