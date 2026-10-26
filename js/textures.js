// Procedural canvas textures: field turf, wall hex panels, crowd, ball panels.
import * as THREE from '../vendor/three.module.min.js';
import { ARENA, GOAL } from './constants.js';
import { INSET } from './arena.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const FIELD_YM = ARENA.L + GOAL.D;

export function fieldTexture() {
  const W = 1536, H = Math.round(W * FIELD_YM / ARENA.W);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const sx = W / (2 * ARENA.W), sy = H / (2 * FIELD_YM);
  const px = x => (x + ARENA.W) * sx;
  const py = y => (FIELD_YM - y) * sy;

  // Turf with mowing stripes across the width.
  g.fillStyle = '#2f6b33';
  g.fillRect(0, 0, W, H);
  const stripe = 512;
  for (let y = -FIELD_YM; y < FIELD_YM; y += stripe) {
    if (Math.round(y / stripe) % 2 === 0) continue;
    g.fillStyle = 'rgba(255,255,255,0.045)';
    g.fillRect(0, py(y + stripe), W, stripe * sy);
  }
  // Fine grass noise.
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 16;
    d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.5;
  }
  g.putImageData(img, 0, 0);

  // Team halves.
  const half = (y0, y1, col) => {
    const grad = g.createLinearGradient(0, py(y0), 0, py(y1));
    grad.addColorStop(0, col.replace('A', '0.0'));
    grad.addColorStop(0.3, col.replace('A', '0.08'));
    grad.addColorStop(1, col.replace('A', '0.16'));
    g.fillStyle = grad;
    g.fillRect(0, Math.min(py(y0), py(y1)), W, Math.abs(py(y1) - py(y0)));
  };
  half(0, -FIELD_YM, 'rgba(40,110,255,A)');
  half(0, FIELD_YM, 'rgba(255,120,30,A)');

  // Team chevrons painted across each end of the field, pointing at midfield.
  for (const s of [-1, 1]) {
    const col = s > 0 ? 'rgba(255,96,24,0.5)' : 'rgba(40,110,255,0.3)';
    g.save();
    g.beginPath();
    g.rect(0, Math.min(py(s * 3100), py(s * ARENA.L)), W, Math.abs(py(s * ARENA.L) - py(s * 3100)));
    g.clip();
    g.fillStyle = col;
    const band = 150, gap = 380, slope = 0.42;
    for (let y0 = 3100 - 3000; y0 < ARENA.L + 200; y0 += gap) {
      g.beginPath();
      g.moveTo(px(-ARENA.W), py(s * (y0 + ARENA.W * slope)));
      g.lineTo(px(0), py(s * y0));
      g.lineTo(px(ARENA.W), py(s * (y0 + ARENA.W * slope)));
      g.lineTo(px(ARENA.W), py(s * (y0 + ARENA.W * slope + band)));
      g.lineTo(px(0), py(s * (y0 + band)));
      g.lineTo(px(-ARENA.W), py(s * (y0 + ARENA.W * slope + band)));
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  const lw = 34 * sx;
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.95)';

  // Field border following the flat floor outline.
  g.beginPath();
  INSET.forEach(([x, y], i) => {
    const s = 0.985;
    if (i === 0) g.moveTo(px(x * s), py(y * s)); else g.lineTo(px(x * s), py(y * s));
  });
  g.closePath();
  g.stroke();

  // Centre line and circle.
  g.beginPath();
  g.moveTo(px(-ARENA.W * 0.94), py(0)); g.lineTo(px(ARENA.W * 0.94), py(0));
  g.stroke();
  g.beginPath();
  g.ellipse(px(0), py(0), 1000 * sx, 1000 * sy, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(px(0), py(0), 40 * sx, 40 * sy, 0, 0, Math.PI * 2); g.fill();

  // Penalty-style boxes in front of each goal.
  for (const s of [-1, 1]) {
    const yb = s * (ARENA.L - 240);
    g.beginPath();
    g.moveTo(px(-1900), py(yb));
    g.lineTo(px(-1900), py(yb - s * 1000));
    g.lineTo(px(1900), py(yb - s * 1000));
    g.lineTo(px(1900), py(yb));
    g.stroke();
    g.beginPath();
    g.moveTo(px(-GOAL.W - 250), py(yb));
    g.lineTo(px(-GOAL.W - 250), py(yb - s * 420));
    g.lineTo(px(GOAL.W + 250), py(yb - s * 420));
    g.lineTo(px(GOAL.W + 250), py(yb));
    g.stroke();
    g.beginPath();
    g.ellipse(px(0), py(yb - s * 1000), 720 * sx, 360 * sy, 0, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : Math.PI * 2);
    g.stroke();
    // Goal line glow.
    const col = s > 0 ? 'rgba(255,140,40,0.95)' : 'rgba(60,140,255,0.95)';
    g.strokeStyle = col;
    g.lineWidth = lw * 1.4;
    g.beginPath(); g.moveTo(px(-GOAL.W), py(s * ARENA.L)); g.lineTo(px(GOAL.W), py(s * ARENA.L)); g.stroke();
    g.lineWidth = lw;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    // Goal floor.
    g.fillStyle = 'rgba(10,14,22,0.55)';
    g.fillRect(px(-GOAL.W), Math.min(py(s * ARENA.L), py(s * FIELD_YM)), 2 * GOAL.W * sx, GOAL.D * sy);
  }
  return tex(c);
}

export function hexTexture() {
  const s = 46;
  const hw = Math.sqrt(3) * s;
  const W = Math.round(hw * 4), H = Math.round(s * 6);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#6d7280';
  g.fillRect(0, 0, W, H);
  const hex = (cx, cy) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const x = cx + s * Math.cos(a), y = cy + s * Math.sin(a);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  for (let row = -1; row <= 4; row++) {
    for (let col = -1; col <= 5; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0);
      const cy = row * s * 1.5;
      hex(cx, cy);
      const shade = 92 + ((row * 7 + col * 13) % 5) * 7;
      g.fillStyle = `rgb(${shade},${shade + 4},${shade + 14})`;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#e6ecff';
      g.stroke();
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function netTexture() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 6;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function crowdTexture() {
  const W = 512, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#10131c';
  g.fillRect(0, 0, W, H);
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) * H / rows;
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, y + 5, W, 2);
    for (let x = 2; x < W; x += 7 + rnd() * 3) {
      const l = 40 + rnd() * 60;
      g.fillStyle = `hsl(${rnd() * 360}, ${20 + rnd() * 40}%, ${l}%)`;
      g.fillRect(x, y - 4 + rnd() * 2, 4, 4);
      g.fillStyle = `hsl(25, 30%, ${30 + rnd() * 40}%)`;
      g.fillRect(x + 0.5, y - 8, 3, 3);
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ball panels: Voronoi cells of evenly spread points, drawn in equirectangular space.
export function ballTexture() {
  const W = 768, H = 384;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const N = 42;
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) * 2 / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  for (let j = 0; j < H; j++) {
    const lat = Math.PI * (j + 0.5) / H;
    const sy = Math.cos(lat), sr = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = 2 * Math.PI * (i + 0.5) / W;
      // Matches SphereGeometry's uv mapping.
      const dx = -Math.cos(lon) * sr, dz = Math.sin(lon) * sr, dy = sy;
      let b1 = -2, b2 = -2, bi = 0;
      for (let k = 0; k < N; k++) {
        const p = pts[k];
        const dd = p[0] * dx + p[1] * dy + p[2] * dz;
        if (dd > b1) { b2 = b1; b1 = dd; bi = k; } else if (dd > b2) b2 = dd;
      }
      const edge = (b1 - b2) * 40;
      const o = (j * W + i) * 4;
      let col;
      if (edge < 0.35) col = [48, 52, 60];
      else if (edge < 0.7) col = [235, 240, 248];
      else {
        const shade = bi % 3 === 0 ? 200 : 214;
        const v = Math.min(1, edge / 6);
        col = [shade + v * 20, shade + 4 + v * 20, shade + 10 + v * 20];
      }
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

export function radialTexture(inner = 'rgba(0,0,0,0.65)', outer = 'rgba(0,0,0,0)') {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, inner.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.6) + ')'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

// ---------- Daytime stadium scenery ----------
function prng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function skyTexture() {
  const W = 2048, H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H / 2);
  grad.addColorStop(0, '#2f6fd6');
  grad.addColorStop(0.6, '#79aee9');
  grad.addColorStop(1, '#d8e8f5');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H / 2);
  g.fillStyle = '#c9d7c0';
  g.fillRect(0, H / 2, W, H / 2);
  // Soft cumulus clouds.
  const rnd = prng(4242);
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * W, cy = 120 + rnd() * 300, s = 30 + rnd() * 70;
    for (let k = 0; k < 9; k++) {
      const x = cx + (rnd() - 0.5) * s * 3, y = cy + (rnd() - 0.5) * s * 0.7, r = s * (0.5 + rnd() * 0.7);
      const cg = g.createRadialGradient(x, y, 0, x, y, r);
      cg.addColorStop(0, 'rgba(255,255,255,0.55)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  const t = tex(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function mountainTexture() {
  const W = 2048, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rnd = prng(77);
  const ridge = (base, amp, rough, color, snow) => {
    const pts = [];
    let y = base;
    for (let x = 0; x <= W; x += 8) {
      const peak = Math.sin(x / W * Math.PI * 2 * 3) * amp * 0.5 + Math.sin(x / W * Math.PI * 2 * 7 + 1) * amp * 0.3;
      y += (rnd() - 0.5) * rough;
      y = y * 0.92 + base * 0.08;
      pts.push([x, base - amp * 0.5 - peak + (y - base)]);
    }
    g.beginPath();
    g.moveTo(0, H);
    for (const [x, yy] of pts) g.lineTo(x, yy);
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (snow) {
      g.save();
      g.clip();
      const sg = g.createLinearGradient(0, base - amp * 1.2, 0, base - amp * 0.35);
      sg.addColorStop(0, 'rgba(250,252,255,0.95)');
      sg.addColorStop(1, 'rgba(250,252,255,0)');
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  };
  ridge(300, 260, 26, '#8ea3bd', true);
  ridge(380, 120, 14, '#6f8a74', false);
  ridge(440, 50, 8, '#5d7a4c', false);
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function cityTexture() {
  const W = 2048, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rnd = prng(9001);
  let x = 0;
  while (x < W) {
    const w = 30 + rnd() * 70;
    const h = 80 + Math.pow(rnd(), 2.2) * 400;
    const tone = 150 + rnd() * 60;
    g.fillStyle = `rgb(${tone * 0.78},${tone * 0.86},${tone})`;
    g.fillRect(x, H - h, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let wy = H - h + 8; wy < H - 6; wy += 10) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (rnd() > 0.35) g.fillRect(wx, wy, 4, 5);
    if (h > 330) { g.fillStyle = `rgb(${tone * 0.7},${tone * 0.78},${tone * 0.9})`; g.fillRect(x + w / 2 - 3, H - h - 60, 6, 60); }
    x += w + rnd() * 18;
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function treeTexture() {
  const W = 128, H = 320;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#5b4632';
  g.fillRect(W / 2 - 4, H - 50, 8, 50);
  const rnd = prng(5);
  for (let i = 0; i < 420; i++) {
    const t = rnd();
    const y = 18 + t * (H - 70);
    const half = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 44 + 6;
    const x = W / 2 + (rnd() - 0.5) * 2 * half;
    const hue = 55 + rnd() * 45, l = 32 + rnd() * 22;
    g.fillStyle = `hsl(${hue}, 60%, ${l}%)`;
    g.beginPath();
    g.ellipse(x, y, 7 + rnd() * 6, 10 + rnd() * 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

export function grassTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#6f8a3c';
  g.fillRect(0, 0, 256, 256);
  const rnd = prng(31);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `hsl(${70 + rnd() * 30}, 45%, ${28 + rnd() * 20}%)`;
    g.fillRect(rnd() * 256, rnd() * 256, 2, 3);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function boardTexture() {
  const W = 1024, H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#1b1f27';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a303b';
  g.fillRect(0, 14, W, H - 28);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 10, W, 4);
  g.fillRect(0, H - 14, W, 4);
  g.font = 'italic 900 64px "Exo 2", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = '#e9edf5';
  g.fillText('BOOST ARENA', 40, H / 2 + 2);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 520; x < W; x += 40) g.fillRect(x, 24, 22, H - 48);
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function lightPanelTexture() {
  const c = canvas(256, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f48';
  g.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) {
    const cx = 22 + x * 42, cy = 24 + y * 40;
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 18);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.6, '#fff6dc');
    rg.addColorStop(1, '#8a8f99');
    g.fillStyle = rg;
    g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

export function bannerTexture(team) {
  const c = canvas(128, 512);
  const g = c.getContext('2d');
  const base = team === 'blue' ? ['#2b6dff', '#1747b8'] : ['#ff6a1a', '#c2410c'];
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, base[0]); grad.addColorStop(1, base[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 512);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 108, 492);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(64, 70); g.lineTo(104, 110); g.lineTo(64, 190); g.lineTo(24, 110); g.closePath();
  g.fill();
  g.fillStyle = base[1];
  g.beginPath(); g.arc(64, 118, 22, 0, Math.PI * 2); g.fill();
  g.save();
  g.translate(64, 340);
  g.rotate(-Math.PI / 2);
  g.font = 'italic 900 34px "Exo 2", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText('BOOST ARENA', 0, 0);
  g.restore();
  return tex(c);
}
