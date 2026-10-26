// Three.js scene: stadium, arena shell, field, goals, pads, ball, car and effects.
// Everything lives inside `world`, which is rotated so its children use physics
// coordinates directly (x right, y toward the orange goal, z up).
import * as THREE from '../vendor/three.module.min.js';
import { ARENA, GOAL, BALL, CAR, BIG_PADS, SMALL_PADS } from './constants.js';
import { INSET, EDGES, onFlatFloor } from './arena.js';
import * as T from './textures.js';
import { buildCar } from './carModel.js';
import { Particles } from './effects.js';

const { W, L, H, R } = ARENA;
const BLUE = new THREE.Color(0x2a7bff);
const ORANGE = new THREE.Color(0xff7a1c);

function teamMix(y, out) {
  const t = THREE.MathUtils.smoothstep(y, -900, 900);
  return out.copy(BLUE).lerp(ORANGE, t);
}

// Outline of the inset octagon: base points with outward normals. Arcs at the
// corners let a ring be offset by any distance d with a constant vertex count.
function buildOutline() {
  const pts = [];
  const ARC = 8;
  for (let i = 0; i < 8; i++) {
    const v = INSET[i];
    const prev = EDGES[(i + 7) % 8], e = EDGES[i];
    const a0 = Math.atan2(prev.ny, prev.nx);
    let da = Math.atan2(e.ny, e.nx) - a0;
    while (da <= 0) da += Math.PI * 2;
    for (let k = 0; k <= ARC; k++) {
      const a = a0 + da * k / ARC;
      pts.push({ x: v[0], y: v[1], nx: Math.cos(a), ny: Math.sin(a), back: false });
    }
    const back = Math.abs(e.ny) > 0.99;
    const ts = [];
    const n = Math.max(1, Math.ceil(e.len / 340));
    for (let s = 1; s < n; s++) ts.push(s / n);
    if (back) for (const gx of [-GOAL.W, GOAL.W]) {
      const t = (gx - e.px) / e.ex;
      if (t > 0 && t < 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (const t of ts) pts.push({ x: e.px + e.ex * t, y: e.py + e.ey * t, nx: e.nx, ny: e.ny, back });
  }
  pts.push({ ...pts[0] });
  return pts;
}

// Builds a tube surface around the outline from a list of rings {d, z, color, alpha}.
function buildShell(outline, rings, { skip, uScale = 400, vScale = 400 } = {}) {
  const np = outline.length, nr = rings.length;
  const pos = new Float32Array(np * nr * 3);
  const uv = new Float32Array(np * nr * 2);
  const col = new Float32Array(np * nr * 4);
  const tmp = new THREE.Color();
  // u by arc length at the outermost ring, v by profile length.
  const ref = Math.max(...rings.map(r => r.d));
  const us = [0];
  for (let i = 1; i < np; i++) {
    const a = outline[i - 1], b = outline[i];
    us.push(us[i - 1] + Math.hypot(b.x + b.nx * ref - a.x - a.nx * ref, b.y + b.ny * ref - a.y - a.ny * ref));
  }
  const vs = [0];
  for (let j = 1; j < nr; j++) vs.push(vs[j - 1] + Math.hypot(rings[j].d - rings[j - 1].d, rings[j].z - rings[j - 1].z));
  for (let j = 0; j < nr; j++) {
    const r = rings[j];
    for (let i = 0; i < np; i++) {
      const o = outline[i];
      const k = j * np + i;
      const x = o.x + o.nx * r.d, y = o.y + o.ny * r.d;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = r.z;
      uv[k * 2] = us[i] / uScale; uv[k * 2 + 1] = vs[j] / vScale;
      r.color(x, y, tmp);
      col[k * 4] = tmp.r; col[k * 4 + 1] = tmp.g; col[k * 4 + 2] = tmp.b; col[k * 4 + 3] = r.alpha;
    }
  }
  const idx = [];
  for (let j = 0; j < nr - 1; j++) {
    for (let i = 0; i < np - 1; i++) {
      if (skip && skip(outline[i], outline[i + 1], rings[j], rings[j + 1])) continue;
      const a = j * np + i, b = a + 1, c = a + np, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

export class GameScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a16);
    this.camera = new THREE.PerspectiveCamera(70, 1, 10, 90000);
    this.world = new THREE.Group();
    this.world.rotation.x = -Math.PI / 2;
    this.world.updateMatrixWorld();
    this.scene.add(this.world);

    this.env = this.buildEnv();
    this.buildLights();
    this.buildSky();
    this.buildStadium();
    this.buildArena();
    this.buildGoals();
    this.buildPads();
    this.buildBall();
    this.buildCar();

    this.particles = new Particles(3000);
    this.world.add(this.particles.points);

    this.shake = 0;
    this.time = 0;
  }

  buildEnv() {
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    const g = sky.geometry, c = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 100;
      const col = new THREE.Color(0x1a2240).lerp(new THREE.Color(0x8fa6d8), Math.max(0, y) * 0.9);
      if (y < 0) col.lerp(new THREE.Color(0x203a22), -y);
      c.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    envScene.add(sky);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 8), lamp);
      const a = i / 6 * Math.PI * 2;
      m.position.set(Math.cos(a) * 60, 45, Math.sin(a) * 60);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    const tex = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();
    return tex;
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff8f0, 0x3a4a34, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(0.25, 1, 0.35);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.6);
    fill.position.set(-0.4, 0.5, -0.8);
    this.scene.add(fill);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(60000, 32, 16);
    const p = geo.attributes.position, c = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 60000;
      const col = new THREE.Color(0x2a2f58).lerp(new THREE.Color(0x05070f), Math.min(1, Math.max(0, y) * 1.6));
      c.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, depthWrite: false, fog: false }));
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  buildStadium() {
    const outline = buildOutline();
    const tint = new THREE.Color();
    const crowd = T.crowdTexture();
    const dark = (x, y, out) => out.setRGB(0.05, 0.06, 0.09);
    const white = new THREE.Color(1, 1, 1);
    const seat = (x, y, out) => out.copy(teamMix(y, tint)).lerp(white, 0.35).multiplyScalar(0.55);
    const stands = buildShell(outline, [
      { d: R + 120, z: 650, color: dark, alpha: 1 },
      { d: R + 260, z: 900, color: seat, alpha: 1 },
      { d: R + 3400, z: 3700, color: seat, alpha: 1 },
      { d: R + 3500, z: 4400, color: dark, alpha: 1 },
    ], { uScale: 700, vScale: 520 });
    const standMat = new THREE.MeshBasicMaterial({ map: crowd, vertexColors: true, side: THREE.DoubleSide });
    this.world.add(new THREE.Mesh(stands, standMat));

    // Base below the stands and the roof ring.
    const base = buildShell(outline, [
      { d: R + 40, z: -40, color: dark, alpha: 1 },
      { d: R + 120, z: 650, color: dark, alpha: 1 },
    ]);
    this.world.add(new THREE.Mesh(base, new THREE.MeshBasicMaterial({ color: 0x0b0e16, side: THREE.DoubleSide })));
    const roofCol = (x, y, out) => teamMix(y, out).multiplyScalar(0.12);
    const roof = buildShell(outline, [
      { d: R + 3500, z: 4400, color: roofCol, alpha: 1 },
      { d: R + 900, z: 4700, color: roofCol, alpha: 1 },
    ]);
    this.world.add(new THREE.Mesh(roof, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // Light rigs along the roof edge.
    const rigGeo = new THREE.BoxGeometry(420, 60, 50);
    const rigMat = new THREE.MeshBasicMaterial({ color: 0xeaf1ff });
    const rigs = new THREE.InstancedMesh(rigGeo, rigMat, 40);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let n = 0;
    const step = Math.floor(outline.length / 40);
    for (let i = 0; i < outline.length - 1 && n < 40; i += step) {
      const o = outline[i];
      v.set(o.x + o.nx * (R + 1000), o.y + o.ny * (R + 1000), 4620);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(o.ny, o.nx) + Math.PI / 2);
      m.compose(v, q, s);
      rigs.setMatrixAt(n++, m);
    }
    rigs.count = n;
    this.world.add(rigs);
    // Floor outside the arena (under the walls).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshBasicMaterial({ color: 0x070a10 }));
    ground.position.z = -45;
    this.world.add(ground);
  }

  buildArena() {
    const outline = buildOutline();
    const tint = new THREE.Color();
    const base = new THREE.Color(0x0a1020);
    const ringColor = (strength, glow = 0) => (x, y, out) => out.copy(base).lerp(teamMix(y, tint), strength).addScalar(glow);
    const rings = [];
    const NB = 10;
    for (let k = 0; k <= NB; k++) {
      const phi = k / NB * Math.PI / 2;
      rings.push({ d: R * Math.sin(phi), z: R * (1 - Math.cos(phi)), color: ringColor(0.18 + 0.12 * k / NB), alpha: 0.96 });
    }
    rings.push({ d: R, z: R + 10, color: ringColor(1.0, 0.25), alpha: 1 });
    rings.push({ d: R, z: R + 34, color: ringColor(1.0, 0.25), alpha: 1 });
    rings.push({ d: R, z: R + 46, color: ringColor(0.3), alpha: 0.9 });
    rings.push({ d: R, z: GOAL.H, color: ringColor(0.32), alpha: 0.82 });
    rings.push({ d: R, z: GOAL.H + 120, color: ringColor(0.34), alpha: 0.55 });
    for (const z of [1000, 1350, 1700]) rings.push({ d: R, z, color: ringColor(0.38), alpha: 0.3 });
    rings.push({ d: R, z: H - R, color: ringColor(0.5), alpha: 0.32 });
    for (let k = 1; k <= NB; k++) {
      const phi = Math.PI / 2 + k / NB * Math.PI / 2;
      rings.push({ d: R * Math.sin(phi), z: H - R - R * Math.cos(phi), color: ringColor(0.45), alpha: 0.28 });
    }
    const skip = (a, b, r0, r1) => a.back && b.back && Math.abs(a.x) <= GOAL.W + 0.5 && Math.abs(b.x) <= GOAL.W + 0.5 && r1.z <= GOAL.H + 0.5;
    const geo = buildShell(outline, rings, { skip, uScale: 300, vScale: 300 });
    const mat = new THREE.MeshBasicMaterial({
      map: T.hexTexture(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(geo, mat);
    shell.renderOrder = 2;
    this.world.add(shell);

    // Ceiling cap.
    const ceilShape = new THREE.Shape(INSET.map(([x, y]) => new THREE.Vector2(x, y)));
    const ceilGeo = new THREE.ShapeGeometry(ceilShape);
    const cuv = ceilGeo.attributes.uv;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) / 380, cuv.getY(i) / 380);
    const ceil = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial({
      map: mat.map, color: 0x2a3456, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
    }));
    ceil.position.z = H;
    ceil.renderOrder = 1;
    this.world.add(ceil);

    // Field floor with goal notches.
    const [a, kA] = INSET[1];
    const [kB, b] = INSET[2];
    const gy = L + GOAL.D;
    const pts = [
      [a, -kA], [a, kA], [kB, b], [GOAL.W, b], [GOAL.W, gy], [-GOAL.W, gy], [-GOAL.W, b], [-kB, b],
      [-a, kA], [-a, -kA], [-kB, -b], [-GOAL.W, -b], [-GOAL.W, -gy], [GOAL.W, -gy], [GOAL.W, -b], [kB, -b],
    ];
    const floorGeo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
    const fp = floorGeo.attributes.position, fuv = floorGeo.attributes.uv;
    for (let i = 0; i < fp.count; i++) {
      fuv.setXY(i, (fp.getX(i) + W) / (2 * W), (fp.getY(i) + T.FIELD_YM) / (2 * T.FIELD_YM));
    }
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: T.fieldTexture() }));
    this.world.add(floor);

    // Ground beneath the ramps so the transparent shell never shows the void.
    const under = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 200, 2 * L + 200), new THREE.MeshBasicMaterial({ color: 0x0d1a12 }));
    under.position.z = -2;
    this.world.add(under);
  }

  buildGoals() {
    const net = T.netTexture();
    this.goalFrames = [];
    for (const s of [-1, 1]) {
      const col = s > 0 ? ORANGE : BLUE;
      const netMat = new THREE.MeshBasicMaterial({
        map: net, color: col.clone().multiplyScalar(1.2), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
      });
      const innerMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.28), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
      const g = new THREE.Group();
      const yb = s * (L + GOAL.D);
      const mk = (w, h, mat, pos, rot) => {
        const geo = new THREE.PlaneGeometry(w, h);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 110, uv.getY(i) * h / 110);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        m.rotation.set(...rot);
        m.renderOrder = 3;
        g.add(m);
      };
      for (const mat of [innerMat, netMat]) {
        mk(2 * GOAL.W, GOAL.H, mat, [0, yb, GOAL.H / 2], [Math.PI / 2, 0, 0]);
        mk(GOAL.D, GOAL.H, mat, [GOAL.W, s * (L + GOAL.D / 2), GOAL.H / 2], [Math.PI / 2, Math.PI / 2, 0]);
        mk(GOAL.D, GOAL.H, mat, [-GOAL.W, s * (L + GOAL.D / 2), GOAL.H / 2], [Math.PI / 2, Math.PI / 2, 0]);
        mk(2 * GOAL.W, GOAL.D, mat, [0, s * (L + GOAL.D / 2), GOAL.H], [0, 0, 0]);
      }
      // Glowing frame.
      const frameMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6) });
      const post = new THREE.BoxGeometry(34, 26, GOAL.H + 34);
      for (const x of [-1, 1]) {
        const p = new THREE.Mesh(post, frameMat);
        p.position.set(x * (GOAL.W + 17), s * (L - 8), (GOAL.H + 34) / 2);
        g.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * GOAL.W + 68, 26, 34), frameMat);
      bar.position.set(0, s * (L - 8), GOAL.H + 17);
      g.add(bar);
      this.goalFrames.push(frameMat);
      this.world.add(g);
    }
  }

  buildPads() {
    this.padMeshes = [];
    const baseGeo = new THREE.CylinderGeometry(150, 165, 10, 32);
    baseGeo.rotateX(Math.PI / 2);
    const smallBaseGeo = new THREE.CylinderGeometry(74, 80, 3, 24);
    smallBaseGeo.rotateX(Math.PI / 2);
    const ringGeo = new THREE.TorusGeometry(120, 9, 8, 40);
    const discGeo = new THREE.CylinderGeometry(54, 54, 4, 24);
    discGeo.rotateX(Math.PI / 2);
    const orbGeo = new THREE.SphereGeometry(52, 20, 14);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x4a505c });
    const glowTex = T.radialTexture('rgba(255,190,80,0.9)', 'rgba(255,120,20,0)');
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (const [x, y] of BIG_PADS) {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      g.add(new THREE.Mesh(baseGeo, baseMat));
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffa630 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = 6;
      g.add(ring);
      const orbMat = new THREE.MeshBasicMaterial({ color: 0xffc04a });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.z = 100;
      g.add(orb);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(320, 320, 1);
      glow.position.z = 100;
      g.add(glow);
      this.world.add(g);
      this.padMeshes.push({ big: true, orb, glow, ringMat });
    }
    for (const [x, y] of SMALL_PADS) {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      g.add(new THREE.Mesh(smallBaseGeo, baseMat));
      const discMat = new THREE.MeshBasicMaterial({ color: 0xffb13a });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.z = 1.5;
      g.add(disc);
      this.world.add(g);
      this.padMeshes.push({ big: false, discMat });
    }
  }

  buildBall() {
    const mat = new THREE.MeshStandardMaterial({
      map: T.ballTexture(), metalness: 0.15, roughness: 0.38, envMap: this.env, envMapIntensity: 0.9,
      emissive: 0x1a1d24, emissiveIntensity: 0.6,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.R, 48, 32), mat);
    this.world.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: T.radialTexture('rgba(0,0,0,0.75)'), transparent: true, depthWrite: false,
    }));
    this.ballShadow.renderOrder = 1;
    this.world.add(this.ballShadow);
  }

  buildCar() {
    const car = buildCar(this.env, 'blue', T.radialTexture('rgba(255,200,120,0.9)', 'rgba(255,120,30,0)'));
    this.carParts = car;
    this.car = car.group;
    this.world.add(this.car);
    this.carShadow = new THREE.Mesh(new THREE.PlaneGeometry(150, 100), new THREE.MeshBasicMaterial({
      map: T.radialTexture('rgba(0,0,0,0.7)'), transparent: true, depthWrite: false,
    }));
    this.carShadow.renderOrder = 1;
    this.world.add(this.carShadow);
  }

  setQuality(q) {
    this.particles.quality = q === 'low' ? 0.4 : 1;
  }

  resize(w, h, pixelRatio) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.material.uniforms.scale.value = h * pixelRatio * 0.5 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
  }

  setCamera(pos, look, up, vfov) {
    const c = this.camera;
    c.position.set(pos.x, pos.z, -pos.y);
    c.up.set(up.x, up.z, -up.y);
    c.lookAt(look.x, look.z, -look.y);
    if (Math.abs(c.fov - vfov) > 0.01) {
      c.fov = vfov;
      c.updateProjectionMatrix();
      const h = this.renderer.domElement.height;
      this.particles.material.uniforms.scale.value = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(vfov) / 2);
    }
    if (this.shake > 0.01) {
      c.position.x += (Math.random() - 0.5) * this.shake * 30;
      c.position.y += (Math.random() - 0.5) * this.shake * 30;
    }
  }

  // view: interpolated simulation state for this frame.
  update(view, dt) {
    this.time += dt;
    this.shake *= Math.exp(-6 * dt);
    const car = view.car, ball = view.ball;

    // Car
    this.car.position.copy(car.pos);
    this.car.quaternion.copy(car.quat);
    const parts = this.carParts;
    for (const w of parts.wheels) {
      w.spin.rotation.y = car.wheelSpin;
      if (w.front) w.steer.rotation.z = -car.steer * 0.42;
    }
    parts.flame.visible = car.boosting;
    if (car.boosting) {
      const f = 0.85 + Math.random() * 0.3;
      parts.flame.scale.set(f, 0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.2);
    }

    // Car shadow
    if (car.onGround) {
      this.carShadow.visible = true;
      this.carShadow.position.copy(car.pos).addScaledVector(car.normal, -CAR.REST_HEIGHT + 1.5);
      this.carShadow.quaternion.copy(car.quat);
      this.carShadow.material.opacity = 1;
    } else if (onFlatFloor(car.pos.x, car.pos.y) && car.pos.z < 1600) {
      this.carShadow.visible = true;
      this.carShadow.position.set(car.pos.x, car.pos.y, 1.5);
      this.carShadow.rotation.set(0, 0, Math.atan2(car.fwd.y, car.fwd.x));
      this.carShadow.material.opacity = Math.max(0, 1 - car.pos.z / 1600);
    } else this.carShadow.visible = false;

    // Ball
    this.ball.visible = !ball.exploded;
    this.ball.position.copy(ball.pos);
    this.ball.quaternion.copy(ball.quat);
    const showShadow = !ball.exploded && onFlatFloor(ball.pos.x, ball.pos.y);
    this.ballShadow.visible = showShadow;
    if (showShadow) {
      this.ballShadow.position.set(ball.pos.x, ball.pos.y, 1.2);
      const s = BALL.R * 2.3;
      this.ballShadow.scale.set(s, s, 1);
      this.ballShadow.material.opacity = 0.55 + 0.45 * Math.max(0, 1 - ball.pos.z / 1800);
    }

    // Pads
    for (let i = 0; i < this.padMeshes.length; i++) {
      const m = this.padMeshes[i], active = view.pads[i] <= 0;
      if (m.big) {
        m.orb.visible = m.glow.visible = active;
        m.orb.position.z = m.glow.position.z = 100 + Math.sin(this.time * 2.4 + i) * 8;
        m.ringMat.color.setHex(active ? 0xffa630 : 0x3a3326);
      } else m.discMat.color.setHex(active ? 0xffb13a : 0x5a5850);
    }

    this.particles.update(dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
