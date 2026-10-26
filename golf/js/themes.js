// Visual themes: palette, lighting, rails, props and the surrounding world for each map.
import * as THREE from '../vendor/three.module.min.js';

// ---------- small helpers ----------
export function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function skyDome(top, mid, bottom, radius = 400) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const p = geo.attributes.position, cols = [];
  const ct = new THREE.Color(top), cm = new THREE.Color(mid), cb = new THREE.Color(bottom), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / radius;
    if (y > 0) c.copy(cm).lerp(ct, Math.pow(y, 0.6)); else c.copy(cm).lerp(cb, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

function windowsTexture(lit = 0.35, tint = '#ffd98a', base = '#1a1f2e') {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let y = 6; y < h - 6; y += 14) for (let x = 6; x < w - 6; x += 14) {
      g.fillStyle = r() < lit ? tint : 'rgba(255,255,255,0.05)';
      g.fillRect(x, y, 7, 8);
    }
  }, { repeat: true });
}

function starField(count, radius, size = 1.2) {
  const pos = new Float32Array(count * 3);
  const r = rng(99);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * radius, Math.abs(u) * radius * 0.9 + radius * 0.05, Math.sin(a) * s * radius], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, fog: false }));
}

function instanced(geo, mat, transforms, colors) {
  const m = new THREE.InstancedMesh(geo, mat, transforms.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  transforms.forEach((t, i) => {
    q.setFromEuler(e.set(t.rx || 0, t.ry || 0, t.rz || 0));
    M.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
    m.setMatrixAt(i, M);
    if (colors) m.setColorAt(i, new THREE.Color(colors[i]));
  });
  return m;
}

// ---------- rail / side textures ----------
const railTextures = {
  stone: () => canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#4a4d58'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) {
      const s = 60 + r() * 25;
      g.fillStyle = `rgb(${s},${s + 2},${s + 10})`; g.fillRect(x + 1, y + 1, 30, 14);
    }
  }, { repeat: true }),
  wood: (c1 = '#8a4f22', c2 = '#6b3a16') => canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 40; i++) { g.strokeStyle = r() < 0.5 ? c2 : 'rgba(255,220,170,0.15)'; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + r() * 4); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h);
  }, { repeat: true }),
  marble: () => canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#eef0f4'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    g.strokeStyle = 'rgba(150,160,180,0.35)';
    for (let i = 0; i < 10; i++) { g.lineWidth = 0.5 + r(); g.beginPath(); g.moveTo(r() * w, 0); g.bezierCurveTo(r() * w, h * 0.3, r() * w, h * 0.7, r() * w, h); g.stroke(); }
    g.fillStyle = '#d9b44a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  }, { repeat: true }),
  steel: (c = '#3b4d6e') => canvasTex(128, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#9fb0c8'); grad.addColorStop(0.15, c); grad.addColorStop(1, '#1d2638');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 8; x < w; x += 32) { g.beginPath(); g.arc(x, h / 2, 2.5, 0, 7); g.fill(); }
  }, { repeat: true }),
  armor: () => canvasTex(128, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#ff6b5a'); grad.addColorStop(0.4, '#b3121b'); grad.addColorStop(1, '#5e0a0f');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c14e'; g.fillRect(0, h * 0.42, w, 6);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < w; x += 42) g.fillRect(x, 0, 2, h);
  }, { repeat: true }),
  fence: () => canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#3a2a3f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = x % 32 ? '#5a3f2a' : '#4d3524'; g.fillRect(x + 1, 0, 14, h); }
    g.fillStyle = '#ff8a1e'; g.fillRect(0, 4, w, 4);
  }, { repeat: true }),
};

function turfTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    const r = rng(17);
    for (let i = 0; i < 2600; i++) { const v = 200 + r() * 55; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1.5, 2.5); }
  }, { repeat: true });
}

// ---------- themes ----------
export const THEMES = {
  rooftops: {
    turf: ['#3a9a5e', '#2f8450'], skirt: '#3a3d4a', rail: () => railTextures.stone(), railCap: '#b8bccb',
    flag: '#7d5cff', exposure: 0.95,
    hemi: [0xa8b6ff, 0x3a3450, 1.35], sun: [0xd8e2ff, 2.3, [-3, 8, 5]],
    fog: [0x1a1830, 0.018],
    ballTrail: '#ffffff',
    bumper: 'chimney', spinner: 'iron', mover: 'van',
    build: buildRooftops,
  },
  docks: {
    turf: ['#35906a', '#2b7a59'], skirt: '#3a3f3e', rail: () => railTextures.wood('#7a5f45', '#4e3c2c'), railCap: '#e8d6a8',
    flag: '#39ff88', exposure: 0.95,
    hemi: [0x9fd0d8, 0x2a2438, 1.3], sun: [0xd8ffee, 2.1, [4, 7, 3]],
    fog: [0x101a1e, 0.03],
    bumper: 'bollard', spinner: 'crane', mover: 'container',
    build: buildDocks,
  },
  hall: {
    turf: ['#3f9a63', '#368a57'], skirt: '#e9e6dd', rail: () => railTextures.marble(), railCap: '#d9b44a',
    flag: '#2a5bd7', exposure: 1.05,
    hemi: [0xdfe8ff, 0x3a3a50, 1.0], sun: [0xffffff, 2.0, [6, 9, 2]],
    fog: null,
    bumper: 'shield', spinner: 'gold', mover: 'door',
    build: buildHall,
  },
  tower: {
    turf: ['#4caa4f', '#419445'], skirt: '#5d6b85', rail: () => railTextures.steel('#4b3a8a'), railCap: '#c9d3ff',
    flag: '#7a3cff', exposure: 1.05,
    hemi: [0xffd2b0, 0x4a3a50, 1.0], sun: [0xffb070, 2.2, [-8, 5, -4]],
    fog: [0xf0a37a, 0.006],
    bumper: 'tpillar', spinner: 'steel', mover: 'crate',
    build: buildTower,
  },
  lab: {
    turf: ['#2f8f9a', '#277a84'], skirt: '#1c1f28', rail: () => railTextures.armor(), railCap: '#f2c14e',
    flag: '#ff2e3a', exposure: 1.0,
    hemi: [0xbfe0ff, 0x2a2028, 1.2], sun: [0xffffff, 2.2, [3, 9, 4]],
    fog: [0x0a0d14, 0.02],
    bumper: 'reactor', spinner: 'laser', mover: 'drone',
    build: buildLab,
  },
  hollow: {
    turf: ['#4e8a35', '#41762c'], skirt: '#3a2a1e', rail: () => railTextures.fence(), railCap: '#ff8a1e',
    flag: '#ff7a1a', exposure: 1.0,
    hemi: [0xc0a8f0, 0x3a2430, 1.25], sun: [0xffcf9a, 2.2, [-6, 6, -5]],
    fog: [0x3a2245, 0.03],
    bumper: 'pumpkin', spinner: 'scythe', mover: 'coffin',
    build: buildHollow,
  },
};

export function turfMap() { return turfTexture(); }
export function railTexture(theme) { return THEMES[theme].rail(); }

// ---------- obstacle meshes ----------
export function bumperMesh(kind, radius) {
  const g = new THREE.Group();
  const H = 0.36;
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
  switch (kind) {
    case 'chimney': {
      add(new THREE.CylinderGeometry(radius, radius * 1.05, H + 0.25, 20), new THREE.MeshStandardMaterial({ map: railTextures.stone(), roughness: 0.9 }), (H + 0.25) / 2);
      add(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x5a5e6a }), H + 0.28);
      add(new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x0c0c10 }), H + 0.315);
      break;
    }
    case 'bollard': {
      add(new THREE.CylinderGeometry(radius * 0.8, radius, H, 18), new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.6, roughness: 0.4 }), H / 2);
      add(new THREE.SphereGeometry(radius * 0.85, 18, 10, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.6, roughness: 0.4 }), H);
      add(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0xffcc22, emissive: 0x332200 }), 0.15);
      break;
    }
    case 'shield': {
      add(new THREE.CylinderGeometry(radius, radius, H, 32), new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.3 }), H / 2);
      add(new THREE.TorusGeometry(radius * 0.92, 0.035, 8, 40), new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.9, roughness: 0.25 }), H).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.02, 5), new THREE.MeshBasicMaterial({ color: 0x2a5bd7 }), H + 0.012);
      break;
    }
    case 'tpillar': {
      add(new THREE.CylinderGeometry(radius, radius, H, 24), new THREE.MeshStandardMaterial({ color: 0x5b4ab8, metalness: 0.4, roughness: 0.35 }), H / 2);
      add(new THREE.BoxGeometry(radius * 1.4, 0.03, radius * 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff }), H + 0.02);
      add(new THREE.BoxGeometry(radius * 0.35, 0.03, radius * 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), H + 0.02).position.z = radius * 0.3;
      break;
    }
    case 'reactor': {
      add(new THREE.CylinderGeometry(radius, radius * 1.1, H, 32), new THREE.MeshStandardMaterial({ color: 0x9aa4b4, metalness: 0.9, roughness: 0.3 }), H / 2);
      const ring = add(new THREE.TorusGeometry(radius * 0.7, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color: 0x8ff6ff }), H + 0.01);
      ring.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0xd8ffff }), H + 0.01);
      break;
    }
    case 'pumpkin': {
      const mat = new THREE.MeshStandardMaterial({ color: 0xff7a14, roughness: 0.55 });
      for (let i = 0; i < 6; i++) {
        const lobe = add(new THREE.SphereGeometry(radius * 0.62, 16, 12), mat, radius * 0.62);
        lobe.scale.set(0.8, 0.95, 1.15);
        lobe.position.x = Math.cos(i / 6 * Math.PI * 2) * radius * 0.32;
        lobe.position.z = Math.sin(i / 6 * Math.PI * 2) * radius * 0.32;
        lobe.rotation.y = -i / 6 * Math.PI * 2;
      }
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x3d5a1e }), radius * 1.25);
      const face = add(new THREE.PlaneGeometry(radius * 1.1, radius * 0.8), new THREE.MeshBasicMaterial({ map: pumpkinFace(), transparent: true, depthWrite: false }), radius * 0.66);
      face.position.z = radius * 0.94;
      face.castShadow = false;
      break;
    }
    default:
      add(new THREE.CylinderGeometry(radius, radius, H, 20), new THREE.MeshStandardMaterial({ color: 0xcccccc }), H / 2);
  }
  return g;
}

let _face = null;
function pumpkinFace() {
  if (_face) return _face;
  _face = canvasTex(128, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffe36a';
    g.shadowColor = '#ffb020'; g.shadowBlur = 10;
    const tri = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s); g.lineTo(x - s, y + s); g.fill(); };
    tri(38, 32, 12); tri(90, 32, 12); tri(64, 52, 7);
    g.beginPath(); g.moveTo(24, 66); g.quadraticCurveTo(64, 96, 104, 66); g.lineTo(96, 64); g.lineTo(86, 74); g.lineTo(76, 66); g.lineTo(64, 76); g.lineTo(52, 66); g.lineTo(42, 74); g.lineTo(32, 64); g.closePath(); g.fill();
  });
  return _face;
}

export function spinnerMesh(kind, len) {
  const g = new THREE.Group();
  const bar = new THREE.Group();
  let barMat, hubMat;
  switch (kind) {
    case 'laser': barMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a }); hubMat = new THREE.MeshStandardMaterial({ color: 0xb3121b, metalness: 0.8, roughness: 0.3 }); break;
    case 'gold': barMat = new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.9, roughness: 0.25 }); hubMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); break;
    case 'crane': barMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, metalness: 0.4, roughness: 0.5 }); hubMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); break;
    case 'scythe': barMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8 }); hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a }); break;
    case 'steel': barMat = new THREE.MeshStandardMaterial({ color: 0x8a7ad8, metalness: 0.7, roughness: 0.3 }); hubMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee }); break;
    default: barMat = new THREE.MeshStandardMaterial({ color: 0x5c606c, metalness: 0.7, roughness: 0.4 }); hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2c33 });
  }
  const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.18), barMat);
  b.position.y = 0.18; b.castShadow = true;
  bar.add(b);
  if (kind === 'scythe') {
    const blade = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 16, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.2 }));
    blade.position.set(len / 2 - 0.1, 0.18, 0.28); blade.rotation.x = Math.PI / 2; blade.castShadow = true;
    bar.add(blade);
  }
  if (kind === 'laser') {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.18;
    bar.add(glow);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 16), hubMat);
  hub.position.y = 0.21; hub.castShadow = true;
  g.add(hub, bar);
  return { group: g, bar };
}

export function moverMesh(kind, w, h) {
  const g = new THREE.Group();
  const H = 0.34;
  let mat;
  switch (kind) {
    case 'door': mat = new THREE.MeshStandardMaterial({ color: 0xd8dce6, metalness: 0.7, roughness: 0.25 }); break;
    case 'drone': mat = new THREE.MeshStandardMaterial({ color: 0x9aa4b4, metalness: 0.9, roughness: 0.3 }); break;
    case 'coffin': mat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 }); break;
    case 'container': mat = new THREE.MeshStandardMaterial({ color: 0xc23b22, metalness: 0.3, roughness: 0.6 }); break;
    case 'van': mat = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.6, roughness: 0.35 }); break;
    default: mat = new THREE.MeshStandardMaterial({ color: 0xa0714a, roughness: 0.8 });
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 * w, H, 2 * h), mat);
  box.position.y = H / 2; box.castShadow = true;
  g.add(box);
  const stripeCol = { door: 0x2a5bd7, drone: 0x8ff6ff, coffin: 0xd9b44a, container: 0xffffff, van: 0x7d5cff }[kind] ?? 0x222222;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2 * w + 0.01, 0.04, 2 * h + 0.01), new THREE.MeshBasicMaterial({ color: stripeCol }));
  stripe.position.y = H * 0.7;
  g.add(stripe);
  return g;
}

export function blockMesh(theme, w, h) {
  const g = new THREE.Group();
  if (theme === 'hollow') {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8d96, roughness: 0.95 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * w, 0.42, 2 * h), mat);
    slab.position.y = 0.21; slab.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(w, w, 2 * h, 16, 1, false, Math.PI / 2, Math.PI), mat);
    top.rotation.set(Math.PI / 2, 0, 0); top.position.y = 0.42; top.castShadow = true;
    const text = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.3, 0.16), new THREE.MeshBasicMaterial({ map: ripTexture(), transparent: true }));
    text.position.set(0, 0.3, h + 0.002);
    g.add(slab, top, text);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 * w, 0.4, 2 * h), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    b.position.y = 0.2; b.castShadow = true; g.add(b);
  }
  return g;
}

let _rip = null;
function ripTexture() {
  if (_rip) return _rip;
  _rip = canvasTex(128, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#3a3c44'; g.font = 'bold 24px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('R.I.P.', w / 2, h / 2 + 1);
  });
  return _rip;
}

export function boostTexture() {
  const t = canvasTex(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let y = 18; y < h; y += 40) { g.beginPath(); g.moveTo(12, y + 14); g.lineTo(32, y - 4); g.lineTo(52, y + 14); g.stroke(); }
  }, { repeat: true });
  return t;
}

export function webTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(235,235,245,0.75)'; g.lineWidth = 1.5;
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140); g.stroke(); }
    for (let r = 14; r < 130; r += 16) { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; const rr = r + (i % 2) * 3; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  }, { repeat: true });
}

export function flagTexture(theme) {
  const col = THEMES[theme].flag;
  return canvasTex(128, 80, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const cx = w / 2, cy = h / 2;
    switch (theme) {
      case 'rooftops': g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(cx + 10, cy - 6, 20, 0, Math.PI * 2); g.fill(); break;
      case 'docks': g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy + 2); break;
      case 'hall': { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.fill(); break; }
      case 'tower': g.fillRect(cx - 24, cy - 22, 48, 12); g.fillRect(cx - 7, cy - 22, 14, 46); break;
      case 'lab': g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill(); break;
      case 'hollow': g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', cx, cy + 3); break;
      default: break;
    }
  });
}

// ---------- surrounding worlds ----------
// Each builder gets the scene root, the course bounds {cx, cz, w, d} (three.js x/z), and returns an update(t) fn.

function buildRooftops(root, b) {
  root.add(skyDome(0x070a1c, 0x2a2350, 0x120f22));
  root.add(starField(500, 380, 1.4));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: 0xf2efe0, fog: false }));
  moon.position.set(-120, 110, -260); moon.lookAt(0, 0, 0);
  root.add(moon);
  // Rooftop under the course.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 8, 30, b.d + 8), new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.95 }));
  roof.position.set(b.cx, -15.6, b.cz); roof.receiveShadow = true;
  root.add(roof);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 8.6, 0.5, b.d + 8.6), new THREE.MeshStandardMaterial({ color: 0x3a3d48 }));
  ledge.position.set(b.cx, -0.35, b.cz);
  root.add(ledge);
  // Gargoyles on the corners.
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b5f6b, roughness: 0.9 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const gg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), stone); body.scale.set(1, 1.2, 0.9); body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), stone); head.position.set(0, 1.25, 0.35);
    const hornGeo = new THREE.ConeGeometry(0.08, 0.3, 6);
    const h1 = new THREE.Mesh(hornGeo, stone); h1.position.set(-0.15, 1.55, 0.3);
    const h2 = h1.clone(); h2.position.x = 0.15;
    const wingGeo = new THREE.ConeGeometry(0.55, 1.2, 3);
    const w1 = new THREE.Mesh(wingGeo, stone); w1.position.set(-0.6, 1.0, -0.2); w1.rotation.z = 0.9;
    const w2 = w1.clone(); w2.position.x = 0.6; w2.rotation.z = -0.9;
    gg.add(body, head, h1, h2, w1, w2);
    gg.traverse(o => { o.castShadow = true; });
    gg.position.set(b.cx + sx * (b.w / 2 + 3.6), -0.1, b.cz + sz * (b.d / 2 + 3.6));
    gg.lookAt(b.cx + sx * 50, -0.1, b.cz + sz * 50);
    root.add(gg);
  }
  // City of gothic towers.
  const winTex = windowsTexture(0.32, '#ffcf73', '#11131c');
  const bMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.55 });
  const r = rng(21);
  const tf = [], spires = [];
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = 40 + r() * 140;
    const w = 6 + r() * 10, h = 12 + r() * (d < 80 ? 30 : 70);
    tf.push({ x: b.cx + Math.cos(a) * d, y: h / 2 - 31, z: b.cz + Math.sin(a) * d, sx: w, sy: h, sz: w, ry: r() });
    if (r() < 0.35) spires.push({ x: b.cx + Math.cos(a) * d, y: h - 31 + 6, z: b.cz + Math.sin(a) * d, sx: w * 0.4, sy: 12, sz: w * 0.4, ry: tf[tf.length - 1].ry });
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const uv = boxGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 6);
  root.add(instanced(boxGeo, bMat, tf));
  root.add(instanced(new THREE.ConeGeometry(0.7, 1, 4), new THREE.MeshStandardMaterial({ color: 0x1a1c24 }), spires));
  // Searchlights sweeping the clouds.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beams = [];
  for (const [x, z] of [[-60, -40], [70, -90]]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 160, 24, 1, true), beamMat);
    beam.geometry.translate(0, -80, 0);
    const pivot = new THREE.Group(); pivot.position.set(b.cx + x, -10, b.cz + z);
    beam.rotation.x = Math.PI; pivot.add(beam);
    root.add(pivot); beams.push(pivot);
  }
  const rain = rainSystem(b, 0x9fb0e0);
  root.add(rain.points);
  return t => {
    beams.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.35 + i * 2) * 0.5; p.rotation.x = Math.cos(t * 0.27 + i) * 0.35; });
    rain.update(t);
  };
}

function rainSystem(b, color) {
  const N = 1400;
  const pos = new Float32Array(N * 6);
  const r = rng(8);
  for (let i = 0; i < N; i++) {
    const x = b.cx + (r() - 0.5) * (b.w + 30), y = r() * 30, z = b.cz + (r() - 0.5) * (b.d + 30);
    pos.set([x, y, z, x + 0.06, y - 0.7, z], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, color: { value: new THREE.Color(color) } },
    vertexShader: 'uniform float t; void main(){ vec3 p = position; p.y = mod(p.y - t*22.0, 30.0) - 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
    fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 0.35); }',
    transparent: true, depthWrite: false,
  });
  const points = new THREE.LineSegments(g, mat);
  points.frustumCulled = false;
  return { points, update: t => { mat.uniforms.t.value = t; } };
}

function waterPlane(color, size = 800) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.25 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

function buildDocks(root, b) {
  root.add(skyDome(0x05080c, 0x16262a, 0x0a1012));
  root.add(starField(200, 380, 1.0));
  const pier = new THREE.Mesh(new THREE.BoxGeometry(b.w + 10, 4, b.d + 10), new THREE.MeshStandardMaterial({ map: railTextures.wood('#4a3a2a', '#2a2018'), roughness: 0.9 }));
  pier.position.set(b.cx, -2.6, b.cz); pier.receiveShadow = true;
  root.add(pier);
  const water = waterPlane(0x0b2a2e);
  water.position.set(b.cx, -3.2, b.cz);
  root.add(water);
  // Shipping containers.
  const r = rng(31);
  const cols = [0xc23b22, 0x1f6fb2, 0x2f8f4a, 0xd9a21b, 0x7a2fb2];
  const tf = [], cc = [];
  for (let i = 0; i < 40; i++) {
    const side = r() < 0.5 ? -1 : 1;
    tf.push({ x: b.cx + side * (b.w / 2 + 8 + r() * 30), y: -0.6 + Math.floor(r() * 3) * 2.6, z: b.cz + (r() - 0.5) * (b.d + 40), sx: 6, sy: 2.6, sz: 2.4, ry: r() < 0.5 ? 0 : Math.PI / 2 });
    cc.push(cols[i % cols.length]);
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 }), tf, cc));
  // Cranes.
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, metalness: 0.4, roughness: 0.5 });
  for (const [x, z] of [[-22, -20], [26, 10]]) {
    const c = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 30, 1.2), craneMat); mast.position.y = 13;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1, 1), craneMat); arm.position.set(6, 28, 0);
    c.add(mast, arm); c.position.set(b.cx + x, -2, b.cz + z); c.rotation.y = x;
    root.add(c);
  }
  // Neon signs.
  const sign = (text, color, x, z, ry) => {
    const t = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
      g.font = 'bold 76px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(b.cx + x, 7, b.cz + z); m.rotation.y = ry;
    root.add(m);
  };
  sign('PIER 13', '#39ff88', 0, -(b.d / 2 + 14), 0);
  sign('CHEMICAL WORKS', '#c04dff', -(b.w / 2 + 14), 0, Math.PI / 2);
  sign('HA HA HA', '#39ff88', b.w / 2 + 14, -6, -Math.PI / 2);
  // Street lamps.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xbfffd8 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), lampMat);
    pole.position.set(b.cx + sx * (b.w / 2 + 2.5), 1.4, b.cz + sz * (b.d / 2 + 2.5));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glowMat);
    bulb.position.set(pole.position.x, 3.5, pole.position.z);
    root.add(pole, bulb);
  }
  const fogSprites = [];
  return t => { water.position.y = -3.2 + Math.sin(t * 0.8) * 0.05; void fogSprites; };
}

function earthTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1b4f9c'; g.fillRect(0, 0, w, h);
    const r = rng(42);
    for (let i = 0; i < 26; i++) {
      const cx = r() * w, cy = h * 0.2 + r() * h * 0.6, s = 30 + r() * 90;
      g.fillStyle = r() < 0.7 ? '#3d8a3d' : '#b59a5a';
      g.beginPath();
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = s * (0.6 + r() * 0.5); g.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr * 0.8); }
      g.fill();
    }
    g.fillStyle = '#f2f6ff'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 160; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 50, 4 + r() * 8, r(), 0, Math.PI * 2); g.fill(); }
  });
}

function buildHall(root, b) {
  const space = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 12), new THREE.MeshBasicMaterial({ color: 0x02030a, side: THREE.BackSide, fog: false }));
  root.add(space);
  const stars = starField(1500, 420, 1.3);
  stars.geometry.attributes.position.array.forEach((v, i, a) => { if (i % 3 === 1) a[i] = (v - 200) * 2; });
  root.add(stars);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 32), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.8, emissive: 0x0a1a40, emissiveIntensity: 0.3 }));
  earth.position.set(b.cx + 60, -230, b.cz - 120);
  root.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(166, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6fb2ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
  atmo.position.copy(earth.position);
  root.add(atmo);
  // Floating marble platform with gold trim.
  const marble = new THREE.MeshStandardMaterial({ map: railTextures.marble(), roughness: 0.35 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.d) * 0.75 + 3, Math.max(b.w, b.d) * 0.6, 2.5, 48), marble);
  plat.position.set(b.cx, -1.6, b.cz); plat.receiveShadow = true;
  root.add(plat);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(Math.max(b.w, b.d) * 0.75 + 3, 0.15, 8, 64), new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.9, roughness: 0.25 }));
  trim.rotation.x = Math.PI / 2; trim.position.set(b.cx, -0.35, b.cz);
  root.add(trim);
  // Columns and hero statues around the hall.
  const R = Math.max(b.w, b.d) * 0.75 + 2;
  const colGeo = new THREE.CylinderGeometry(0.45, 0.5, 9, 16);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const x = b.cx + Math.cos(a) * R, z = b.cz + Math.sin(a) * R;
    if (i % 2 === 0) {
      const c = new THREE.Mesh(colGeo, marble); c.position.set(x, 4.2, z); c.castShadow = true; root.add(c);
    } else {
      const s = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), marble); ped.position.y = 0.2;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 4, 10), gold); body.position.y = 1.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), gold); head.position.y = 2.75;
      const cape = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.0, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8), gold); cape.position.y = 1.6;
      s.add(ped, body, head, cape);
      s.position.set(x, -0.3, z); s.lookAt(b.cx, -0.3, b.cz);
      s.traverse(o => { o.castShadow = true; });
      root.add(s);
    }
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 1, 0.25, 8, 80), gold);
  ring.position.set(b.cx, 8.8, b.cz); ring.rotation.x = Math.PI / 2;
  root.add(ring);
  return t => { earth.rotation.y = t * 0.02; };
}

function buildTower(root, b) {
  root.add(skyDome(0x3a4ea8, 0xff9a6a, 0x4a3a6a));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false }));
  sun.position.set(-200, 25, 260); sun.lookAt(0, 0, 0);
  root.add(sun);
  const water = waterPlane(0x2a5da8, 1200);
  water.position.y = -2.4;
  root.add(water);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.d) * 0.85 + 6, Math.max(b.w, b.d) + 10, 3, 40), new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 1 }));
  island.position.set(b.cx, -1.9, b.cz); island.receiveShadow = true;
  root.add(island);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.d) + 10.5, Math.max(b.w, b.d) + 12, 0.6, 40), new THREE.MeshStandardMaterial({ color: 0xe8cf94 }));
  sand.position.set(b.cx, -2.5, b.cz);
  root.add(sand);
  // The T tower.
  const glassTex = windowsTexture(0.7, '#9fd4ff', '#24345e');
  const towerMat = new THREE.MeshStandardMaterial({ map: glassTex, metalness: 0.5, roughness: 0.2, emissive: 0x223355, emissiveIntensity: 0.4 });
  const t = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(8, 40, 8), towerMat); shaft.position.y = 18;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 9), towerMat); bar.position.y = 40;
  t.add(shaft, bar);
  t.position.set(b.cx + 4, -2, b.cz - b.d / 2 - 22);
  root.add(t);
  // Skyline across the bay.
  const city = windowsTexture(0.4, '#ffe0a0', '#2a2440');
  const r = rng(77), tf = [];
  for (let i = 0; i < 70; i++) {
    const x = b.cx + (r() - 0.5) * 300, h = 10 + r() * 50;
    tf.push({ x, y: h / 2 - 2.4, z: b.cz - 160 - r() * 40, sx: 6 + r() * 8, sy: h, sz: 6 + r() * 8 });
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: city, emissive: 0xffffff, emissiveMap: city, emissiveIntensity: 0.3 }), tf));
  // Palm-ish trees on the island.
  const trunk = new THREE.MeshStandardMaterial({ color: 0x7a5a3a }), leaf = new THREE.MeshStandardMaterial({ color: 0x2f8a3a, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.3, R = Math.max(b.w, b.d) * 0.7 + 5;
    const p = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 8), trunk); tr.position.y = 2;
    p.add(tr);
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.6), leaf); l.position.y = 4; l.rotation.set(1.1, k / 5 * Math.PI * 2, 0); l.translateY(1.2); p.add(l); }
    p.position.set(b.cx + Math.cos(a) * R, -0.5, b.cz + Math.sin(a) * R);
    p.traverse(o => { o.castShadow = true; });
    root.add(p);
  }
  return tt => { water.position.y = -2.4 + Math.sin(tt * 0.6) * 0.05; };
}

function buildLab(root, b) {
  const W = Math.max(b.w, b.d) + 24;
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, 16, W), new THREE.MeshStandardMaterial({ color: 0x14171f, side: THREE.BackSide, roughness: 0.8 }));
  room.position.set(b.cx, 6, b.cz); room.receiveShadow = true;
  root.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1c2029'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2b313d'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, { repeat: true }), roughness: 0.4, metalness: 0.5 }));
  floor.material.map.repeat.set(W / 3, W / 3);
  floor.rotation.x = -Math.PI / 2; floor.position.set(b.cx, -1.9, b.cz); floor.receiveShadow = true;
  root.add(floor);
  // Raised platform with glowing edge.
  const plat = new THREE.Mesh(new THREE.BoxGeometry(b.w + 3, 1.6, b.d + 3), new THREE.MeshStandardMaterial({ color: 0x1b1f28, metalness: 0.6, roughness: 0.4 }));
  plat.position.set(b.cx, -1.1, b.cz); plat.receiveShadow = true;
  root.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 3.1, 0.06, b.d + 3.1), new THREE.MeshBasicMaterial({ color: 0x5fe6ff }));
  edge.position.set(b.cx, -0.36, b.cz);
  root.add(edge);
  // Window wall with night city.
  const cityTex = windowsTexture(0.45, '#ffd890', '#0b1020');
  cityTex.repeat.set(10, 1.5);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, 11), new THREE.MeshBasicMaterial({ map: cityTex }));
  win.position.set(b.cx, 5, b.cz - W / 2 + 0.05);
  root.add(win);
  // Armor suits on display.
  const red = new THREE.MeshStandardMaterial({ color: 0xb3121b, metalness: 0.85, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.9, roughness: 0.25 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xbff8ff });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.6), red); torso.position.y = 2.6;
    const chest = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), glow); chest.position.set(0, 2.85, 0.31);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.55), red); head.position.y = 3.65;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.45), new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.9, roughness: 0.25 })); face.position.set(0, 3.62, 0.28);
    const eyes = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), glow); eyes.position.set(0, 3.7, 0.285);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.5), gold); legs.position.y = 1.0;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.35), red); armL.position.set(-0.75, 2.5, 0);
    const armR = armL.clone(); armR.position.x = 0.75;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.15, 24), new THREE.MeshBasicMaterial({ color: 0x5fe6ff })); base.position.y = 0.05;
    s.add(torso, chest, head, face, eyes, legs, armL, armR, base);
    s.position.set(b.cx - W / 2 + 4 + i * ((W - 8) / 4), -1.9, b.cz - W / 2 + 3);
    s.traverse(o => { o.castShadow = true; });
    root.add(s);
  }
  // Holograms.
  const holoTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,230,255,0.9)'; g.lineWidth = 2;
    g.strokeRect(4, 4, w - 8, h - 8);
    for (let y = 30; y < h; y += 26) { g.beginPath(); g.moveTo(16, y); g.lineTo(16 + Math.random() * (w - 40), y); g.stroke(); }
    g.beginPath(); g.arc(w * 0.72, h * 0.32, 40, 0, Math.PI * 2); g.stroke();
  });
  const holos = [];
  const holoMat = new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, z, ry] of [[-(b.w / 2 + 4), 0, Math.PI / 2], [b.w / 2 + 4, -3, -Math.PI / 2], [b.w / 2 + 4, 4, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), holoMat);
    m.position.set(b.cx + x, 2.5, b.cz + z); m.rotation.y = ry;
    root.add(m); holos.push(m);
  }
  // Ceiling light strips.
  for (let i = -2; i <= 2; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
    l.position.set(b.cx, 13.9, b.cz + i * 5);
    root.add(l);
  }
  return t => { holos.forEach((h, i) => { h.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.15; h.position.y = 2.5 + Math.sin(t * 1.2 + i) * 0.1; }); };
}

function buildHollow(root, b) {
  root.add(skyDome(0x1a0f33, 0x8a3a5a, 0x2a1a2a));
  root.add(starField(300, 380, 1.2));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }));
  moon.position.set(80, 90, -260); moon.lookAt(0, 0, 0);
  root.add(moon);
  const moonGlow = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
  moonGlow.position.copy(moon.position).multiplyScalar(1.01); moonGlow.lookAt(0, 0, 0);
  root.add(moonGlow);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.d) + 40, Math.max(b.w, b.d) + 40, 2, 48), new THREE.MeshStandardMaterial({ color: 0x2a2a1e, roughness: 1 }));
  ground.position.set(b.cx, -1.6, b.cz); ground.receiveShadow = true;
  root.add(ground);
  const r = rng(13);
  // Dead trees.
  const bark = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 1 });
  const branch = (len, rad) => { const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6); g.translate(0, len / 2, 0); return g; };
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = Math.max(b.w, b.d) * 0.6 + 6 + r() * 18;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(branch(4 + r() * 3, 0.3), bark);
    tree.add(trunk);
    for (let k = 0; k < 5; k++) {
      const br = new THREE.Mesh(branch(1.5 + r() * 2, 0.12), bark);
      br.position.y = 2 + r() * 3; br.rotation.set((r() - 0.5) * 1.8, r() * 6, (r() - 0.5) * 1.8);
      tree.add(br);
    }
    tree.position.set(b.cx + Math.cos(a) * d, -0.6, b.cz + Math.sin(a) * d);
    tree.traverse(o => { o.castShadow = true; });
    root.add(tree);
  }
  // Gravestones and glowing jack-o-lanterns.
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6d76, roughness: 1 });
  const tf = [];
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = Math.max(b.w, b.d) * 0.6 + 3 + r() * 14;
    tf.push({ x: b.cx + Math.cos(a) * d, y: -0.1, z: b.cz + Math.sin(a) * d, sx: 0.7, sy: 1 + r() * 0.5, sz: 0.2, ry: r() * 0.6 - 0.3 + a, rz: (r() - 0.5) * 0.3 });
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), stone, tf));
  const lights = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.2, d = Math.max(b.w, b.d) * 0.6 + 1.5;
    const p = bumperMesh('pumpkin', 0.45);
    p.position.set(b.cx + Math.cos(a) * d, -0.55, b.cz + Math.sin(a) * d);
    p.lookAt(b.cx, -0.55, b.cz);
    root.add(p);
    lights.push(p);
  }
  // Haunted mansion silhouette.
  const dark = new THREE.MeshStandardMaterial({ color: 0x15101c });
  const mansion = new THREE.Group();
  const main = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 8), dark); main.position.y = 6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(13, 7, 4), dark); roof.position.y = 15.5; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.5;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 18, 12), dark); tower.position.set(9, 9, 0);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 12), dark); spire.position.set(9, 21, 0);
  mansion.add(main, roof, tower, spire);
  const win = windowsTexture(0.3, '#ffb347', '#15101c');
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(19, 10), new THREE.MeshBasicMaterial({ map: win }));
  facade.position.set(0, 6, 4.05);
  mansion.add(facade);
  mansion.position.set(b.cx - 10, -1, b.cz - Math.max(b.w, b.d) - 30);
  root.add(mansion);
  // Bats.
  const batGeo = new THREE.BufferGeometry();
  batGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.9, 0.2, -0.3, -0.3, 0, 0.2, 0, 0, 0, 0.9, 0.2, -0.3, 0.3, 0, 0.2], 3));
  const bats = [];
  const batMat = new THREE.MeshBasicMaterial({ color: 0x0a0610, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(batGeo, batMat);
    m.userData = { a: r() * 6.28, rad: 10 + r() * 25, h: 6 + r() * 10, sp: 0.3 + r() * 0.5 };
    root.add(m); bats.push(m);
  }
  // Fireflies.
  const N = 120, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([b.cx + (r() - 0.5) * (b.w + 20), r() * 3, b.cz + (r() - 0.5) * (b.d + 20)], i * 3);
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xffd36a, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
  root.add(ff);
  return t => {
    for (const m of bats) {
      const u = m.userData, a = u.a + t * u.sp;
      m.position.set(b.cx + Math.cos(a) * u.rad, u.h + Math.sin(t * 2 + u.a) * 0.6, b.cz + Math.sin(a) * u.rad);
      m.rotation.y = -a;
      m.scale.y = 0.5 + Math.abs(Math.sin(t * 14 + u.a)) * 1.2;
    }
    ff.material.opacity = 0.5 + Math.sin(t * 2) * 0.3;
    ff.position.y = Math.sin(t * 0.7) * 0.2;
  };
}
