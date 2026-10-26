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
