import * as THREE from '../vendor/three.module.min.js';
import { WORLDS } from './courses.js';
import { Course, DistanceField, makeBall, stepBall, shoot, simulateShot, planShot, PHYS } from './sim.js';
import { HoleView } from './render.js';
import { canvasTex } from './themes.js';
import { Sfx } from './audio.js';

// ---------- renderer ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1500);
const sfx = new Sfx();

let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 62 : 48;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- persistent progress ----------
const SAVE = 'putt-legends-v1';
let progress = {};
try { progress = JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch { progress = {}; }
function saveProgress() { try { localStorage.setItem(SAVE, JSON.stringify(progress)); } catch { /* ignore */ } }

// ---------- rivals ----------
const RIVALS = [
  { name: 'Vortex', color: '#ff4d5a', pattern: 'stripes', skill: 0.6 },
  { name: 'Nova', color: '#3fa2ff', pattern: 'swirl', skill: 0.72 },
  { name: 'Hex', color: '#ffd23a', pattern: 'dots', skill: 0.84 },
];

function ballTexture(color, pattern) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    if (pattern === 'stripes') for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
    else if (pattern === 'swirl') { g.lineWidth = 12; g.strokeStyle = color; for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 48, 0); g.bezierCurveTo(i * 48 + 30, h * 0.4, i * 48 - 10, h * 0.6, i * 48 + 30, h); g.stroke(); } }
    else if (pattern === 'dots') for (let y = 12; y < h; y += 26) for (let x = (y / 26) % 2 * 16 + 8; x < w; x += 32) { g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); }
    // Dimples
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 4; y < h; y += 8) for (let x = (y % 16) ? 4 : 0; x < w; x += 8) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
  });
}

// ---------- trails ----------
class Trail {
  constructor(color, width = 0.14) {
    this.N = 48;
    this.pts = [];
    this.width = width;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 2 * 3);
    this.col = new Float32Array(this.N * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.c = new THREE.Color(color);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
  push(x, y, z) {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(x - last[0], z - last[2]) < 0.05) return;
    this.pts.push([x, y, z]);
    if (this.pts.length > this.N) this.pts.shift();
  }
  fade(dt) { if (this.pts.length && Math.random() < dt * 30) this.pts.shift(); }
  clear() { this.pts.length = 0; }
  update() {
    const n = this.pts.length;
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[Math.min(i, n - 1)] || [0, -99, 0];
      const q = this.pts[Math.min(i + 1, n - 1)] || p;
      const pp = this.pts[Math.max(i - 1, 0)] || p;
      let dx = q[0] - pp[0], dz = q[2] - pp[2];
      const l = Math.hypot(dx, dz) || 1;
      const k = n ? i / Math.max(1, n - 1) : 0;
      const w = this.width * (0.25 + 0.75 * k) / 2;
      const nx = -dz / l * w, nz = dx / l * w;
      this.pos.set([p[0] + nx, p[1] + 0.01, p[2] + nz, p[0] - nx, p[1] + 0.01, p[2] - nz], i * 6);
      const a = i < n ? k * 0.75 : 0;
      this.col.set([this.c.r * a, this.c.g * a, this.c.b * a, a, this.c.r * a, this.c.g * a, this.c.b * a, a], i * 8);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------- confetti ----------
class Confetti {
  constructor() {
    this.N = 300;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true }));
    this.points.frustumCulled = false;
  }
  burst(x, y, z, n = 160) {
    const cols = [[1, 0.3, 0.35], [0.25, 0.65, 1], [1, 0.82, 0.2], [0.4, 1, 0.5], [0.85, 0.4, 1]];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.p.push({ x, y, z, vx: Math.cos(a) * s, vy: 3 + Math.random() * 4, vz: Math.sin(a) * s, life: 2 + Math.random(), c: cols[i % cols.length] });
    }
    if (this.p.length > this.N) this.p.splice(0, this.p.length - this.N);
  }
  update(dt) {
    this.p = this.p.filter(q => (q.life -= dt) > 0);
    this.p.forEach((q, i) => {
      q.vy -= 9 * dt; q.vx *= 0.98; q.vz *= 0.98; if (q.vy < -2) q.vy = -2;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      this.pos.set([q.x, q.y, q.z], i * 3); this.col.set(q.c, i * 3);
    });
    this.points.geometry.setDrawRange(0, this.p.length);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------- bot planner (worker with main-thread fallback) ----------
let worker = null;
const pending = new Map();
let planId = 0;
try {
  worker = new Worker(new URL('./botworker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => { const cb = pending.get(e.data.id); pending.delete(e.data.id); cb?.(e.data); };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }
let fallbackJobs = [];
function requestPlan(ball, t0, skill, cb) {
  const id = ++planId;
  const snap = { x: ball.x, y: ball.y, vx: 0, vy: 0, moving: false, sunk: false, portalCd: 0 };
  if (worker) {
    pending.set(id, cb);
    worker.postMessage({ type: 'plan', id, ball: snap, t0, skill });
  } else fallbackJobs.push({ gen: planShot(game.course, game.field, snap, t0, skill), cb });
}
function runFallback(budgetMs) {
  const end = performance.now() + budgetMs;
  while (fallbackJobs.length && performance.now() < end) {
    const job = fallbackJobs[0];
    const r = job.gen.next();
    if (r.done) { fallbackJobs.shift(); job.cb(r.value); }
  }
}

// ---------- game state ----------
const game = {
  screen: 'home', mode: 'race', world: 0, hole: 0,
  course: null, field: null, view: null, t: 0, acc: 0,
  players: [], phase: 'intro', phaseT: 0, timeLeft: 0, fast: 1,
  aim: { angle: 0, power: 0, dragging: false, sx: 0, sy: 0, charging: false, chargeT: 0 },
  camYaw: 0, overview: false, results: [],
};
const ui = {
  home: document.getElementById('home'), hud: document.getElementById('hud'), pause: document.getElementById('pause'),
  result: document.getElementById('result'), banner: document.getElementById('banner'),
  holeInfo: document.getElementById('hole-info'), strokes: document.getElementById('strokes'), timer: document.getElementById('timer'),
  board: document.getElementById('board'), hint: document.getElementById('hint'), power: document.getElementById('power'),
  powerFill: document.getElementById('power-fill'), worlds: document.getElementById('worlds'), skip: document.getElementById('skip-btn'),
};
const confetti = new Confetti();
const aimGroup = new THREE.Group();
const aimLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
const aimArrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
aimGroup.add(aimLine, aimArrow);
const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
ringMesh.rotation.x = -Math.PI / 2;

const sphereGeo = new THREE.SphereGeometry(PHYS.R, 28, 18);

function makePlayer(name, color, pattern, isBot, skill) {
  // Rivals are ghost balls: you see them race but never collide with them.
  const mat = new THREE.MeshStandardMaterial({ map: ballTexture(color, pattern), roughness: 0.32, metalness: 0.05, transparent: isBot, opacity: isBot ? 0.62 : 1, depthWrite: !isBot });
  const mesh = new THREE.Mesh(sphereGeo, mat);
  mesh.castShadow = !isBot;
  mesh.renderOrder = isBot ? 4 : 6;
  return { name, color, isBot, skill, mesh, trail: new Trail(color === '#ffffff' ? '#9fe7ff' : color), ball: null, strokes: 0, finished: false, finishT: 0, waitT: 0, planning: false, place: 0, roll: new THREE.Quaternion() };
}

function startHole() {
  const w = WORLDS[game.world];
  const def = w.holes[game.hole];
  game.view?.dispose();
  game.course = new Course(def);
  game.field = new DistanceField(game.course);
  game.view = new HoleView(renderer, game.course, w.theme);
  worker?.postMessage({ type: 'hole', world: game.world, hole: game.hole });
  fallbackJobs = [];
  pending.clear();
  game.t = 0; game.acc = 0; game.fast = 1;
  game.timeLeft = game.mode === 'race' ? 75 : Infinity;
  for (const p of game.players) {
    p.ball = makeBall(game.course);
    p.strokes = 0; p.finished = false; p.finishT = 0; p.place = 0; p.planning = false;
    p.waitT = 2.2 + Math.random() * 1.8;
    p.trail.clear();
    p.mesh.visible = true;
    p.mesh.scale.setScalar(1);
    game.view.scene.add(p.mesh, p.trail.mesh);
  }
  game.view.scene.add(aimGroup, ringMesh, confetti.points);
  aimGroup.visible = false;
  game.aim.angle = game.field.bestDirection(game.course.start.x, game.course.start.y);
  game.camYaw = game.aim.angle;
  game.phase = 'intro'; game.phaseT = 0;
  ui.holeInfo.innerHTML = `<b>${w.name}</b><span>Hole ${game.hole + 1}/${w.holes.length} · ${def.name} · Par ${def.par}</span>`;
  ui.skip.hidden = true;
  showBanner(`HOLE ${game.hole + 1}`, `${def.name} · Par ${def.par}`, 'intro');
  renderBoard();
}

function startWorld(i) {
  sfx.start();
  game.world = i; game.hole = 0;
  const me = makePlayer('You', '#ffffff', 'plain', false, 1);
  game.players = [me];
  if (game.mode === 'race') {
    const boost = i * 0.03;
    for (const r of RIVALS) game.players.push(makePlayer(r.name, r.color, r.pattern, true, Math.min(0.95, r.skill + boost)));
  }
  game.results = game.players.map(() => ({ points: 0, strokes: 0 }));
  setScreen('play');
  startHole();
  tryFullscreen();
}

function tryFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) Promise.resolve(req.call(el, { navigationUI: 'hide' })).catch(() => {});
}

// ---------- shooting ----------
function me() { return game.players[0]; }
function canShoot() {
  if (game.screen !== 'play' || game.phase !== 'play' || game.overview || !game.players.length) return false;
  const p = me();
  return !p.finished && !p.ball.moving;
}

function doShoot(p, angle, power) {
  shoot(p.ball, angle, power);
  p.strokes++;
  p.trail.clear();
  if (!p.isBot) { sfx.putt(power); game.camYaw = angle; }
  renderBoard();
}

function previewPath() {
  const p = me();
  if (!aimGroup.visible) return;
  const pts = [];
  simulateShot(game.course, p.ball, game.t, game.aim.angle, Math.max(0.05, game.aim.power), 3, pts);
  const maxLen = 1.0 + game.aim.power * 3.2;
  const path = [[p.ball.x, p.ball.y]];
  let len = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const q = path[path.length - 1];
    const d = Math.hypot(pts[i] - q[0], pts[i + 1] - q[1]);
    if (len + d > maxLen) break;
    len += d; path.push([pts[i], pts[i + 1]]);
  }
  // Dotted ribbon
  const pos = [];
  const c = game.course;
  for (let i = 0; i < path.length - 1; i++) {
    if (i % 2) continue;
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l * 0.045, ny = dx / l * 0.045;
    const h0 = c.height(x0, y0) + 0.02, h1 = c.height(x1, y1) + 0.02;
    pos.push(x0 + nx, h0, -(y0 + ny), x0 - nx, h0, -(y0 - ny), x1 + nx, h1, -(y1 + ny), x0 - nx, h0, -(y0 - ny), x1 - nx, h1, -(y1 - ny), x1 + nx, h1, -(y1 + ny));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  aimLine.geometry.dispose();
  aimLine.geometry = geo;
  const end = path[path.length - 1], prev = path[Math.max(0, path.length - 2)];
  aimArrow.position.set(end[0], c.height(end[0], end[1]) + 0.05, -end[1]);
  aimArrow.rotation.set(0, 0, 0);
  aimArrow.rotateY(Math.atan2(end[0] - prev[0], -(end[1] - prev[1])) + Math.PI);
  aimArrow.rotateX(-Math.PI / 2);
  const col = new THREE.Color().setHSL(0.33 - game.aim.power * 0.33, 0.9, 0.6);
  aimLine.material.color.copy(col); aimArrow.material.color.copy(col);
}

// Touch / mouse: drag back from anywhere to aim and set power.
canvas.addEventListener('pointerdown', e => {
  sfx.start();
  if (!canShoot()) return;
  game.aim.dragging = true; game.aim.sx = e.clientX; game.aim.sy = e.clientY; game.aim.power = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!game.aim.dragging) return;
  const dx = e.clientX - game.aim.sx, dy = e.clientY - game.aim.sy;
  const len = Math.hypot(dx, dy);
  const full = Math.min(innerWidth, innerHeight) * 0.32;
  game.aim.power = Math.min(1, len / full);
  if (len > 8) {
    // Screen-space pull mapped onto the ground plane, relative to the camera heading.
    const yaw = game.camYaw;
    const fx = Math.cos(yaw), fy = Math.sin(yaw), rx = Math.sin(yaw), ry = -Math.cos(yaw);
    const px = rx * dx + fx * -dy, py = ry * dx + fy * -dy;
    game.aim.angle = Math.atan2(-py, -px);
  }
  aimGroup.visible = game.aim.power > 0.03;
  previewPath();
  updatePowerUi();
});
const release = () => {
  if (!game.aim.dragging) return;
  game.aim.dragging = false;
  aimGroup.visible = false;
  if (game.aim.power > 0.06 && canShoot()) doShoot(me(), game.aim.angle, game.aim.power);
  game.aim.power = 0;
  updatePowerUi();
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', () => { game.aim.dragging = false; aimGroup.visible = false; game.aim.power = 0; updatePowerUi(); });

function updatePowerUi() {
  const show = game.aim.power > 0.03 && (game.aim.dragging || game.aim.charging);
  ui.power.hidden = !show;
  ui.powerFill.style.transform = `scaleX(${game.aim.power})`;
  ui.power.dataset.level = game.aim.power > 0.8 ? 'high' : game.aim.power > 0.45 ? 'mid' : 'low';
}

// ---------- gamepad ----------
const padPrev = {};
function pollPad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(p => p && p.connected);
  if (!pad) return;
  const btn = i => !!pad.buttons[i]?.pressed;
  const edge = i => { const on = btn(i); const e = on && !padPrev[i]; padPrev[i] = on; return e; };
  const navUp = edge(12) , navDown = edge(13), navLeft = edge(14), navRight = edge(15);
  const cross = btn(0), crossEdge = edge(0), circle = edge(1), tri = edge(3), opts = edge(9);
  if (game.screen !== 'play' || !ui.pause.hidden || !ui.result.hidden) {
    menuNav({ up: navUp || navLeft, down: navDown || navRight, confirm: crossEdge, back: circle || opts });
    return;
  }
  if (opts) { togglePause(); return; }
  if (tri) toggleOverview();
  if (!canShoot()) { game.aim.charging = false; return; }
  const lx = Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0;
  const fine = btn(4) || btn(5) ? 0.25 : 1;
  if (lx) { game.aim.angle -= lx * 1.8 * fine * dt; game.camYaw = game.aim.angle; }
  if (cross) {
    if (!game.aim.charging) { game.aim.charging = true; game.aim.chargeT = 0; }
    game.aim.chargeT += dt;
    game.aim.power = 0.5 - 0.5 * Math.cos(game.aim.chargeT * Math.PI / 1.2);
  } else if (game.aim.charging) {
    game.aim.charging = false;
    if (game.aim.power > 0.04) doShoot(me(), game.aim.angle, game.aim.power);
    game.aim.power = 0;
  }
  if (circle) { game.aim.charging = false; game.aim.power = 0; }
  aimGroup.visible = game.aim.charging || lx !== 0 || game.aim.power > 0;
  if (aimGroup.visible) { if (!game.aim.charging) game.aim.power = Math.max(game.aim.power, 0.25); previewPath(); }
  updatePowerUi();
}

let focusIdx = 0;
function focusables() {
  const root = !ui.pause.hidden ? ui.pause : !ui.result.hidden ? ui.result : game.screen === 'home' ? ui.home : null;
  return root ? [...root.querySelectorAll('button:not([hidden])')].filter(b => b.offsetParent !== null) : [];
}
function menuNav(n) {
  const list = focusables();
  if (!list.length) return;
  if (n.up) focusIdx = (focusIdx - 1 + list.length) % list.length;
  if (n.down) focusIdx = (focusIdx + 1) % list.length;
  focusIdx = Math.min(focusIdx, list.length - 1);
  list.forEach((b, i) => b.classList.toggle('pad-focus', i === focusIdx));
  if (n.up || n.down) list[focusIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (n.confirm) list[focusIdx].click();
  if (n.back && !ui.pause.hidden) togglePause();
}

// ---------- flow ----------
function setScreen(s) {
  game.screen = s;
  ui.home.hidden = s !== 'home';
  ui.hud.hidden = s !== 'play';
  ui.pause.hidden = true;
  ui.result.hidden = true;
  focusIdx = 0;
  if (s === 'home') renderHome();
}

function togglePause() {
  if (game.screen !== 'play') return;
  ui.pause.hidden = !ui.pause.hidden;
  focusIdx = 0;
}

function toggleOverview() { game.overview = !game.overview; document.getElementById('view-btn').classList.toggle('on', game.overview); }

let bannerTimer = 0;
function showBanner(title, sub, kind = '') {
  ui.banner.innerHTML = `<div class="b-title">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
  ui.banner.className = `banner show ${kind}`;
  ui.banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { ui.banner.hidden = true; }, 2200);
}

function scoreName(strokes, par) {
  if (strokes === 1) return 'HOLE IN ONE!';
  const d = strokes - par;
  return { '-3': 'ALBATROSS!', '-2': 'EAGLE!', '-1': 'BIRDIE!', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY' }[d] ?? `+${d}`;
}

function onSunk(p) {
  p.finished = true;
  p.finishT = game.t;
  const order = game.players.filter(q => q.finished).length;
  p.place = order;
  sfx.cup(p.isBot);
  const h = game.course.height(game.course.cup.x, game.course.cup.y);
  if (!p.isBot) {
    confetti.burst(game.course.cup.x, h + 0.3, -game.course.cup.y);
    const par = WORLDS[game.world].holes[game.hole].par;
    const placeTxt = game.mode === 'race' ? ['1ST!', '2ND', '3RD', '4TH'][order - 1] + ' · ' : '';
    showBanner(scoreName(p.strokes, par), `${placeTxt}${p.strokes} stroke${p.strokes > 1 ? 's' : ''}`, order === 1 ? 'gold' : '');
    if (order === 1 || p.strokes === 1) sfx.fanfare();
    if (game.players.some(q => !q.finished)) ui.skip.hidden = false;
  }
  renderBoard();
}

function endHole(timeout = false) {
  if (game.phase === 'done') return;
  game.phase = 'done';
  ui.skip.hidden = true;
  // Unfinished players are ranked by distance to the cup.
  const rest = game.players.filter(p => !p.finished).sort((a, b) => game.field.at(a.ball.x, a.ball.y) - game.field.at(b.ball.x, b.ball.y));
  let place = game.players.filter(p => p.finished).length;
  for (const p of rest) { p.place = ++place; p.strokes += 2; }
  const pts = [10, 7, 5, 3];
  game.players.forEach((p, i) => {
    game.results[i].points += p.finished ? pts[p.place - 1] : Math.max(0, pts[p.place - 1] - 3);
    game.results[i].strokes += p.strokes;
  });
  if (timeout) showBanner("TIME'S UP", 'Unfinished balls get +2 strokes');
  setTimeout(showHoleResult, timeout ? 1600 : 900);
}

function showHoleResult() {
  const w = WORLDS[game.world];
  const last = game.hole >= w.holes.length - 1;
  const par = w.holes[game.hole].par;
  const rows = game.players.map((p, i) => ({ p, r: game.results[i] }));
  const sorted = game.mode === 'race'
    ? [...rows].sort((a, b) => b.r.points - a.r.points || a.r.strokes - b.r.strokes)
    : rows;
  let title = last ? (game.mode === 'race' ? 'FINAL STANDINGS' : 'ROUND COMPLETE') : `HOLE ${game.hole + 1} RESULTS`;
  const myRank = sorted.findIndex(x => !x.p.isBot) + 1;
  let stars = 0;
  if (last) {
    const totalPar = w.holes.reduce((a, h) => a + h.par, 0);
    stars = game.mode === 'race' ? Math.max(0, 4 - myRank) : (game.results[0].strokes <= totalPar - 2 ? 3 : game.results[0].strokes <= totalPar ? 2 : 1);
    const prev = progress[w.id] || { stars: 0, best: null };
    progress[w.id] = { stars: Math.max(prev.stars, stars), best: prev.best == null ? game.results[0].strokes : Math.min(prev.best, game.results[0].strokes) };
    saveProgress();
    if (myRank === 1 || stars === 3) { sfx.fanfare(); confetti.burst(game.course.cup.x, 1, -game.course.cup.y, 260); }
  }
  ui.result.innerHTML = `
    <div class="r-card">
      <div class="r-title">${title}</div>
      ${last ? `<div class="r-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : `<div class="r-sub">${w.holes[game.hole].name} · Par ${par}</div>`}
      <table class="r-table"><thead><tr><th></th><th>Player</th><th>Hole</th><th>Strokes</th>${game.mode === 'race' ? '<th>Points</th>' : ''}</tr></thead><tbody>
      ${sorted.map((x, i) => `<tr class="${x.p.isBot ? '' : 'me'}"><td>${i + 1}</td><td><span class="dot" style="background:${x.p.color}"></span>${x.p.name}</td><td>${x.p.finished ? x.p.strokes : x.p.strokes + ' (DNF)'}</td><td>${x.r.strokes}</td>${game.mode === 'race' ? `<td><b>${x.r.points}</b></td>` : ''}</tr>`).join('')}
      </tbody></table>
      <div class="r-btns">
        ${last ? `<button class="btn primary" data-act="next-world">${game.world < WORLDS.length - 1 ? 'Next World' : 'Back to Worlds'}</button><button class="btn" data-act="replay">Play Again</button><button class="btn" data-act="home">Worlds</button>`
          : `<button class="btn primary" data-act="next-hole">Next Hole</button><button class="btn" data-act="home">Quit</button>`}
      </div>
    </div>`;
  ui.result.hidden = false;
  focusIdx = 0;
  ui.result.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    sfx.click();
    const a = b.dataset.act;
    ui.result.hidden = true;
    if (a === 'next-hole') { game.hole++; startHole(); }
    else if (a === 'next-world') { if (game.world < WORLDS.length - 1) startWorld(game.world + 1); else setScreen('home'); }
    else if (a === 'replay') startWorld(game.world);
    else setScreen('home');
  }));
}

function renderBoard() {
  if (!game.players.length) return;
  const p = me();
  ui.strokes.textContent = `Strokes ${p.strokes}`;
  if (game.mode !== 'race') { ui.board.hidden = true; return; }
  ui.board.hidden = false;
  ui.board.innerHTML = game.players.map((q, i) => `<div class="pl ${q.isBot ? '' : 'me'} ${q.finished ? 'done' : ''}">
    <span class="dot" style="background:${q.color}"></span><span class="nm">${q.name}</span>
    <span class="st">${q.finished ? ['1st', '2nd', '3rd', '4th'][q.place - 1] : q.strokes}</span><span class="pt">${game.results[i]?.points ?? 0}</span></div>`).join('');
}

// ---------- home ----------
const WORLD_ART = {
  rooftops: 'linear-gradient(160deg,#1b1d3a 0%,#3a2a6a 55%,#0d0f1c 100%)',
  docks: 'linear-gradient(160deg,#0b1d22 0%,#1d4a3a 50%,#2a0f3a 100%)',
  hall: 'linear-gradient(160deg,#0a0e2a 0%,#24418a 55%,#d9b44a 140%)',
  tower: 'linear-gradient(160deg,#ff9a6a 0%,#7a3cff 70%,#2a5da8 100%)',
  lab: 'linear-gradient(160deg,#1a0a0e 0%,#b3121b 60%,#f2c14e 130%)',
  hollow: 'linear-gradient(160deg,#1a0f33 0%,#8a3a5a 55%,#ff7a1a 120%)',
};
const WORLD_ICON = { rooftops: '🌙', docks: '⚓', hall: '★', tower: 'T', lab: '◉', hollow: '🎃' };

function renderHome() {
  ui.worlds.innerHTML = WORLDS.map((w, i) => {
    const pr = progress[w.id] || { stars: 0, best: null };
    return `<button class="world" data-i="${i}" style="background:${WORLD_ART[w.theme]}">
      <span class="w-icon">${WORLD_ICON[w.theme]}</span>
      <span class="w-name">${w.name}</span>
      <span class="w-tag">${w.tagline}</span>
      <span class="w-meta"><span class="w-stars">${'★'.repeat(pr.stars)}${'☆'.repeat(3 - pr.stars)}</span>${pr.best != null ? `<span>Best ${pr.best}</span>` : `<span>${w.holes.length} holes</span>`}</span>
    </button>`;
  }).join('');
  ui.worlds.querySelectorAll('.world').forEach(b => b.addEventListener('click', () => { sfx.start(); sfx.click(); startWorld(+b.dataset.i); }));
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  game.mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
  sfx.start(); sfx.click();
}));
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('view-btn').addEventListener('click', toggleOverview);
ui.skip.addEventListener('click', () => { game.fast = 6; ui.skip.hidden = true; });
document.querySelectorAll('#pause [data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (a === 'resume') togglePause();
  else if (a === 'restart') { ui.pause.hidden = true; startWorld(game.world); }
  else if (a === 'sound') { sfx.enabled = !sfx.enabled; b.textContent = `Sound: ${sfx.enabled ? 'On' : 'Off'}`; }
  else if (a === 'quit') setScreen('home');
}));
addEventListener('keydown', e => {
  if (e.code === 'Escape') togglePause();
  if (e.code === 'KeyV') toggleOverview();
});

// ---------- camera ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt) {
  const c = game.course;
  if (!c) return;
  const p = me();
  const b = p.ball;
  const h = c.height(b.x, b.y);
  let pos, look;
  const k = 1 - Math.exp(-dt * (game.phase === 'intro' ? 2.2 : 5));
  if (game.phase === 'intro' || game.overview || p.finished) {
    // Bird's-eye view of the whole hole, tilted.
    const span = Math.max(c.cols, c.rows);
    const tx = c.cols / 2, ty = c.rows / 2;
    const yaw = game.phase === 'intro' ? Math.PI / 2 + Math.sin(game.phaseT * 0.5) * 0.25 : Math.PI / 2;
    const dist = span * (camera.aspect < 1 ? 1.25 : 0.95) + 2;
    pos = new THREE.Vector3(tx - Math.cos(yaw) * dist * 0.55, span * 0.95 + 2, -(ty - Math.sin(yaw) * dist * 0.55));
    look = new THREE.Vector3(tx, 0, -ty);
  } else {
    let yaw = game.camYaw;
    if (b.moving) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1) {
        let target = Math.atan2(b.vy, b.vx), d = target - game.camYaw;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        game.camYaw += d * Math.min(1, dt * 1.2);
      }
    } else if (!game.aim.dragging && !game.aim.charging) {
      let d = game.aim.angle - game.camYaw;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      game.camYaw += d * Math.min(1, dt * 4);
    }
    yaw = game.camYaw;
    const back = camera.aspect < 1 ? 3.6 : 3.0, up = camera.aspect < 1 ? 3.0 : 2.3;
    pos = new THREE.Vector3(b.x - Math.cos(yaw) * back, h + up, -(b.y - Math.sin(yaw) * back));
    look = new THREE.Vector3(b.x + Math.cos(yaw) * 1.4, h, -(b.y + Math.sin(yaw) * 1.4));
  }
  if (camPos.lengthSq() === 0) { camPos.copy(pos); camLook.copy(look); }
  camPos.lerp(pos, k); camLook.lerp(look, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---------- main loop ----------
let last = performance.now();
const frameTimes = [];
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  adaptResolution(dt);
  pollPad(dt);
  if (game.screen === 'play' && game.view) {
    const paused = !ui.pause.hidden || !ui.result.hidden;
    if (!paused) tick(dt);
    const sdt = paused ? 0 : dt;
    for (const p of game.players) syncBall(p, sdt);
    game.view.update(game.t, sdt);
    confetti.update(sdt);
    updateCamera(dt);
    const b = me().ball;
    ringMesh.visible = canShoot();
    ringMesh.position.set(b.x, game.course.height(b.x, b.y) + 0.01, -b.y);
    ringMesh.material.opacity = 0.5 + Math.sin(game.t * 5) * 0.3;
    renderer.render(game.view.scene, camera);
    ui.hint.hidden = !(canShoot() && me().strokes === 0 && game.hole === 0 && !game.aim.dragging);
  } else {
    if (game.view) { game.view.update(now / 1000, dt); renderer.render(game.view.scene, camera); }
  }
  runFallback(4);
}

function tick(dt) {
  if (game.phase === 'intro') {
    game.phaseT += dt;
    if (game.phaseT > 2.4) { game.phase = 'play'; game.phaseT = 0; }
    return;
  }
  if (game.phase !== 'play') return;
  const steps = dt * game.fast;
  game.acc += steps;
  while (game.acc >= PHYS.DT) {
    game.acc -= PHYS.DT;
    game.t += PHYS.DT;
    for (const p of game.players) {
      if (p.finished) continue;
      const ev = stepBall(game.course, p.ball, game.t);
      if (ev) handleEvent(p, ev);
    }
  }
  if (game.mode === 'race') {
    game.timeLeft -= dt * game.fast;
    ui.timer.textContent = Math.max(0, Math.ceil(game.timeLeft));
    ui.timer.classList.toggle('low', game.timeLeft < 10);
    if (game.timeLeft <= 0) { endHole(true); return; }
  } else ui.timer.textContent = '';
  // Bots
  for (const p of game.players) {
    if (!p.isBot || p.finished || p.ball.moving || p.planning) continue;
    p.waitT -= dt * game.fast;
    if (p.waitT > 0) continue;
    p.planning = true;
    const t0 = game.t + 0.25;
    requestPlan(p.ball, t0, p.skill, r => {
      if (game.phase !== 'play' || p.finished) { p.planning = false; return; }
      doShoot(p, r.angle, r.power);
      p.planning = false;
      p.waitT = 1.2 + Math.random() * 1.6;
    });
  }
  if (game.players.every(p => p.finished)) endHole(false);
}

function handleEvent(p, ev) {
  if (ev === 'sunk') { onSunk(p); return; }
  if (p.isBot) return;
  if (ev === 'wall') sfx.wall(Math.hypot(p.ball.vx, p.ball.vy));
  else if (ev === 'bumper') {
    sfx.bumper();
    const o = game.course.dynamic.filter(o => o.type === 'bumper').sort((a, b) => Math.hypot(a.x - p.ball.x, a.y - p.ball.y) - Math.hypot(b.x - p.ball.x, b.y - p.ball.y))[0];
    if (o) game.view.bump(o);
    navigator.vibrate?.(15);
  } else if (ev === 'spinner') sfx.spinner();
  else if (ev === 'boost') sfx.boost();
  else if (ev === 'portal') { sfx.portal(); p.trail.clear(); }
  else if (ev === 'stop') { game.aim.angle = game.camYaw; }
}

const _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
function syncBall(p, dt) {
  const b = p.ball, c = game.course;
  if (!b) return;
  const h = c.height(b.x, b.y);
  if (b.sunk) {
    const s = Math.max(0, 1 - b.sinkT * 3);
    p.mesh.position.set(c.cup.x, h + PHYS.R - (1 - s) * 0.3, -c.cup.y);
    p.mesh.scale.setScalar(Math.max(0.01, s));
    p.mesh.visible = s > 0.02;
  } else {
    p.mesh.position.set(b.x, h + PHYS.R, -b.y);
    // Roll the ball with its motion.
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.01 && dt > 0) {
      _axis.set(-b.vy, 0, -b.vx).normalize();
      _q.setFromAxisAngle(_axis, sp * dt / PHYS.R);
      p.mesh.quaternion.premultiply(_q);
    }
  }
  if (p.isBot) {
    // Fade ghosts that sit on top of your ball so yours stays readable.
    const mb = me().ball;
    const near = !b.sunk && Math.hypot(b.x - mb.x, b.y - mb.y) < 0.35;
    p.mesh.material.opacity += ((near ? 0.18 : 0.62) - p.mesh.material.opacity) * Math.min(1, dt * 8);
  }
  if (b.moving) p.trail.push(p.mesh.position.x, h, p.mesh.position.z); else p.trail.fade(dt);
  p.trail.update();
}

// Lower resolution if frames are being dropped; raise it again when there is headroom.
let slow = 0, fast = 0;
function adaptResolution(dt) {
  frameTimes.push(dt);
  if (frameTimes.length < 90) return;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const vsync = sorted[9];
  const recent = frameTimes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  frameTimes.shift();
  if (recent > vsync * 1.25) { slow += dt; fast = 0; } else if (recent < vsync * 1.06) { fast += dt; slow = 0; }
  const max = Math.min(window.devicePixelRatio || 1, 2);
  if (slow > 0.5 && pixelRatio > 0.7) { pixelRatio = Math.max(0.7, pixelRatio * 0.85); slow = 0; frameTimes.length = 0; resize(); }
  if (fast > 5 && pixelRatio < max) { pixelRatio = Math.min(max, pixelRatio * 1.08); fast = 0; resize(); }
}

// Show a live preview hole behind the menu.
function attractView() {
  const w = WORLDS[0];
  game.course = new Course(w.holes[2]);
  game.view = new HoleView(renderer, game.course, w.theme);
  const c = game.course;
  camera.position.set(c.cols / 2 + 6, 7, -c.rows / 2 + 7);
  camera.lookAt(c.cols / 2, 0, -c.rows / 2);
}
attractView();
setScreen('home');
requestAnimationFrame(t => { last = t; frame(t); });

window.__golf = { game, WORLDS };
