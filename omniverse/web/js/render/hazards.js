// Stage events on screen: weather and light for each arena, and the hazards themselves with
// their warnings. Hazards draw in world units on the full-resolution canvas; weather draws in
// art pixels on the low-res layers so it matches the pixel backdrop.
import { glowSprite, rgba } from './colors.js';
import { UNIT } from './pixel.js';

const TAU = Math.PI * 2;
const clamp01 = u => Math.max(0, Math.min(1, u));
const bell = u => Math.sin(Math.PI * clamp01(u));
// Cheap stable noise per index.
const nz = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function glow(g, color, x, y, r, a = 1) {
  if (!(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  g.globalAlpha = a; g.drawImage(glowSprite(color, 64), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}

// A jagged bolt from (x0, y0) to (x1, y1) with a seed so it flickers between shapes.
function bolt(g, x0, y0, x1, y1, seed, width, color) {
  const n = 14, pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    pts.push([x0 + (x1 - x0) * u + (nz(seed * 31 + i) - 0.5) * 120, y0 + (y1 - y0) * u]);
  }
  pts.push([x1, y1]);
  for (const [w, c] of [[width * 3, rgba(color, 0.35)], [width, color], [width * 0.4, '#ffffff']]) {
    g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  // Side forks
  g.strokeStyle = color; g.lineWidth = width * 0.4;
  for (let i = 3; i < n; i += 4) {
    const [x, y] = pts[i]; const d = nz(seed + i) < 0.5 ? -1 : 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * 90, y + 70); g.lineTo(x + d * 130, y + 160); g.stroke();
  }
}

// Ground warning: a pulsing stripe on the floor where the hazard will land.
function floorWarn(g, x, half, u, t, color = '#ff3a3a') {
  const pulse = 0.5 + 0.5 * Math.sin(t * 24);
  g.fillStyle = rgba(color, 0.18 + 0.25 * u * pulse);
  g.fillRect(x - half, -10, half * 2, 14);
  g.fillStyle = rgba(color, 0.6 + 0.4 * pulse);
  const w = half * (0.3 + 0.7 * u);
  g.fillRect(x - w, -4, w * 2, 5);
  // Chevrons pointing in.
  g.fillStyle = rgba('#ffffff', 0.8 * pulse);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const cx = x + s * (half + 30 + i * 34 - u * 20);
    g.beginPath(); g.moveTo(cx, -30); g.lineTo(cx - s * 18, -18); g.lineTo(cx, -6); g.lineTo(cx + s * 6, -18); g.closePath(); g.fill();
  }
}

function rockShape(g, r, seed, fill, edge) {
  g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = Math.max(3, r * 0.08);
  g.beginPath();
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = r * (0.78 + 0.3 * nz(seed + i)); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.stroke();
  // Light face and cracks.
  g.fillStyle = rgba('#ffffff', 0.18); g.beginPath(); g.ellipse(-r * 0.25, -r * 0.3, r * 0.42, r * 0.26, -0.5, 0, TAU); g.fill();
  g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = Math.max(2, r * 0.04);
  g.beginPath(); g.moveTo(-r * 0.1, -r * 0.5); g.lineTo(r * 0.05, -r * 0.1); g.lineTo(r * 0.35, r * 0.05); g.moveTo(r * 0.05, -r * 0.1); g.lineTo(-r * 0.2, r * 0.35); g.stroke();
}

const DRAW = {
  boulder(g, h, t, w) {
    const u = clamp01(h.t / h.tele);
    if (h.t < h.tele) {
      floorWarn(g, h.x, h.r, u, t);
      // Pebbles trickling down from the statue above.
      g.fillStyle = '#8d8576';
      for (let i = 0; i < 6; i++) { const yy = w.ceiling + ((h.t * 900 + i * 170) % 900); g.fillRect(h.x + (nz(i) - 0.5) * 120, yy, 10, 10); }
      return;
    }
    g.save(); g.translate(h.x, h.y); g.rotate(h.t * 4 * (h.x > 0 ? -1 : 1));
    rockShape(g, h.r, 7, '#8d8576', '#3d382f');
    g.restore();
    if (h.landed) { // dust settling
      const a = clamp01(1 - (h.t - h.tele - 0.4) / 0.8);
      for (let i = 0; i < 6; i++) glow(g, '#d8ccb8', h.x + (i - 2.5) * 70, -30 - nz(i) * 40, 90, 0.35 * a);
    }
  },
  wave(g, h, t, w) {
    if (h.t < h.tele) {
      const u = h.t / h.tele, edge = h.dir > 0 ? w.left : w.right;
      // Water swelling at the edge and the waterfall roaring.
      for (let i = 0; i < 8; i++) glow(g, '#cfe8ff', edge + (nz(i) - 0.5) * 160, -40 - u * 120 * nz(i + 9), 70 + 60 * u, 0.5 * u);
      g.fillStyle = rgba('#ffffff', 0.5 + 0.5 * Math.sin(t * 20));
      for (let i = 0; i < 3; i++) { const x = edge + h.dir * (120 + i * 60); g.beginPath(); g.moveTo(x + h.dir * 30, -60); g.lineTo(x, -80); g.lineTo(x, -40); g.closePath(); g.fill(); }
      return;
    }
    const x = h.x, d = h.dir;
    // Body of the wave: tall face, curling crest, foam trail behind.
    const grad = g.createLinearGradient(0, -220, 0, 0);
    grad.addColorStop(0, '#9fd4ff'); grad.addColorStop(0.5, '#3f8ac8'); grad.addColorStop(1, '#1d4a78');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(x - d * 700, 0); g.quadraticCurveTo(x - d * 260, -60, x - d * 60, -190);
    g.quadraticCurveTo(x + d * 30, -250, x + d * 110, -200); g.quadraticCurveTo(x + d * 50, -170, x + d * 70, -120);
    g.quadraticCurveTo(x + d * 110, -40, x + d * 90, 0); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - d * 140, -170); g.quadraticCurveTo(x + d * 20, -260, x + d * 110, -200); g.stroke();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { const fx = x - d * (nz(i) * 600), fy = -20 - nz(i + 3) * (120 * (1 - nz(i) * 0.8)); g.fillRect(fx + Math.sin(t * 10 + i) * 8, fy, 12, 8); }
    for (let i = 0; i < 5; i++) glow(g, '#ffffff', x + d * (40 - i * 60), -200 + i * 30, 60, 0.4);
  },
  lightning(g, h, t, w) {
    if (h.t < h.tele) {
      const u = h.t / h.tele;
      glow(g, '#2a2a40', h.x, w.ceiling + 100, 260, 0.8);
      g.globalAlpha = 0.25 + 0.5 * u * (Math.sin(t * 50) > 0 ? 1 : 0.4);
      g.fillStyle = '#bfe8ff'; g.fillRect(h.x - 4, w.ceiling, 8, -w.ceiling);
      g.globalAlpha = 1;
      floorWarn(g, h.x, 70, u, t, '#ffe94a');
      return;
    }
    const a = 1 - (h.t - h.tele) / (h.active + 0.6);
    g.globalAlpha = clamp01(a * 1.5);
    bolt(g, h.x + 40, w.ceiling, h.x, 0, Math.floor(t * 30), 26, '#cfe0ff');
    glow(g, '#e8f0ff', h.x, -40, 240, 0.8 * a);
    g.globalAlpha = 1;
    g.fillStyle = rgba('#1a1408', 0.6 * a); g.fillRect(h.x - 90, -4, 180, 8);
  },
  strafe(g, h, t, w) {
    const jetY = -950, firing = h.t >= h.tele;
    // The jet overhead, banking across.
    const jx = h.x + (firing ? h.dir * 200 : -h.dir * 400);
    g.save(); g.translate(jx, jetY); g.scale(h.dir * 2.2, 2.2);
    g.fillStyle = '#20263a'; g.strokeStyle = '#0a0d16'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(70, 0); g.lineTo(20, -10); g.lineTo(-40, -12); g.lineTo(-70, -34); g.lineTo(-56, -6); g.lineTo(-70, 10); g.lineTo(-30, 8); g.lineTo(-10, 26); g.lineTo(0, 8); g.lineTo(40, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7fd0ff'; g.fillRect(28, -8, 18, 5);
    g.restore();
    glow(g, '#7fd0ff', jx - h.dir * 160, jetY + 4, 60, 0.9);
    if (!firing) {
      // Targeting laser sweeping the deck.
      g.strokeStyle = rgba('#ff2a2a', 0.5); g.lineWidth = 3;
      g.beginPath(); g.moveTo(jx, jetY + 20); g.lineTo(h.x, 0); g.stroke();
      glow(g, '#ff2a2a', h.x, -6, 40, 0.9);
      floorWarn(g, h.x, 60, h.t / h.tele, t);
      return;
    }
    // Cannon fire: tracer lines from the jet to the floor, with blasts walking behind.
    for (let i = 0; i < 3; i++) {
      const tx = h.x - h.dir * i * 60;
      g.strokeStyle = rgba('#ffd27a', 0.9 - i * 0.25); g.lineWidth = 6 - i;
      g.beginPath(); g.moveTo(jx, jetY + 20); g.lineTo(tx, -10); g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const bx = h.x - h.dir * i * 110, a = 1 - i / 6;
      glow(g, '#ff8a3a', bx, -40, 90 * a + 30, 0.8 * a);
      g.fillStyle = rgba('#ffe9a8', a); g.fillRect(bx - 16, -50 - nz(i + Math.floor(t * 20)) * 60, 32, 50);
    }
  },
  portal(g, h, t) {
    const open = clamp01(h.t / h.tele), close = clamp01((h.t - h.tele - h.active) / 0.6);
    const R = 170 * open * (1 - close);
    if (R > 1) {
      g.save(); g.translate(h.x, h.y);
      glow(g, '#5aa8ff', 0, 0, R * 2.2, 0.7);
      g.fillStyle = '#05060f'; g.beginPath(); g.ellipse(0, 0, R, R * 0.55, 0, 0, TAU); g.fill();
      // Swirling rim
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = ['#bfe8ff', '#5aa8ff', '#2a58c8'][i]; g.lineWidth = 10 - i * 2;
        g.beginPath(); g.ellipse(0, 0, R * (1 + i * 0.08), R * 0.55 * (1 + i * 0.08), t * (1 + i), 0.2, TAU - 0.4); g.stroke();
      }
      // Stars inside
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i++) { const a = nz(i) * TAU + t * 0.3, rr = nz(i + 4) * R * 0.8; g.fillRect(Math.cos(a) * rr, Math.sin(a) * rr * 0.55, 4, 4); }
      g.restore();
    }
    if (h.t < h.tele) { floorWarn(g, h.x, 200, open, t); return; }
    for (const d of h.debris) {
      if (d.done) continue;
      g.save(); g.translate(d.x, d.y); g.rotate(t * 5 + d.r);
      g.fillStyle = '#3a4258'; g.strokeStyle = '#11141e'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-d.r, -d.r * 0.4); g.lineTo(d.r * 0.6, -d.r); g.lineTo(d.r, d.r * 0.3); g.lineTo(-d.r * 0.3, d.r * 0.8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7fd0ff'; g.fillRect(-d.r * 0.3, -d.r * 0.2, d.r * 0.6, 5);
      g.restore();
      glow(g, '#ff8a3a', d.x, d.y - d.r, d.r * 1.2, 0.5);
    }
  },
  overload(g, h, t) {
    if (h.t < h.tele) {
      const u = h.t / h.tele;
      // The arc reactor in the deck charging up.
      glow(g, '#7fd0ff', 0, -20, 120 + 200 * u, 0.5 + 0.4 * u);
      g.strokeStyle = '#bff0ff'; g.lineWidth = 6;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, 60 + i * 50 + u * 40, 14 + i * 8, 0, 0, TAU); g.stroke(); }
      for (let i = 0; i < 6; i++) if (Math.sin(t * 40 + i) > 0.3) bolt(g, 0, -20, (nz(i + Math.floor(t * 10)) - 0.5) * 400 * u, -60 - nz(i) * 120, i + Math.floor(t * 20), 3, '#7fd0ff');
      floorWarn(g, 0, 300, u, t, '#7fd0ff');
      return;
    }
    const a = clamp01(1 - (h.t - h.tele) / (h.active + 0.4));
    for (const s of [-1, 1]) {
      const x = s * h.r;
      g.fillStyle = rgba('#7fd0ff', 0.5 * a); g.fillRect(Math.min(0, x), -12, Math.abs(x), 12);
      glow(g, '#bff0ff', x, -50, 120, 0.9 * a);
      g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 10;
      g.beginPath(); g.ellipse(x, -40, 30, 70, 0, 0, TAU); g.stroke();
    }
  },
  crystals(g, h, t) {
    for (const [i, x] of h.spots.entries()) {
      if (h.t < h.tele) {
        const u = h.t / h.tele;
        g.strokeStyle = rgba('#e8c0ff', 0.4 + 0.6 * u); g.lineWidth = 5;
        g.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + i; g.moveTo(x, -2); g.lineTo(x + Math.cos(a) * 70 * u, -2 + Math.sin(a) * 8); }
        g.stroke();
        glow(g, '#c89ae8', x, -10, 60 + 50 * u, 0.6 * u);
        continue;
      }
      const k = h.t - h.tele, rise = clamp01(k / 0.12), fall = clamp01((k - h.active) / 0.5);
      const ht = 260 * rise * (1 - fall * 0.7);
      g.globalAlpha = 1 - fall;
      for (const [dx, sc] of [[-34, 0.6], [30, 0.75], [0, 1]]) {
        const hh = ht * sc, ww = 34 * sc;
        const grad = g.createLinearGradient(x + dx - ww, 0, x + dx + ww, 0);
        grad.addColorStop(0, '#c89ae8'); grad.addColorStop(0.5, '#f8ecff'); grad.addColorStop(1, '#8a5aa8');
        g.fillStyle = grad; g.strokeStyle = '#4a2a5a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + dx - ww, 0); g.lineTo(x + dx - ww * 0.5, -hh * 0.85); g.lineTo(x + dx, -hh); g.lineTo(x + dx + ww * 0.5, -hh * 0.85); g.lineTo(x + dx + ww, 0); g.closePath(); g.fill(); g.stroke();
      }
      glow(g, '#e8c0ff', x, -ht * 0.5, 120, 0.5);
      g.globalAlpha = 1;
    }
  },
  meteors(g, h, t, w) {
    if (h.t < h.tele) {
      glow(g, '#e0a8ff', 0, w.ceiling + 100, 600, 0.35 * (h.t / h.tele));
      return;
    }
    for (const d of h.rocks) {
      if (d.done) continue;
      const len = 240;
      const grad = g.createLinearGradient(d.x, d.y, d.x - len * 0.34, d.y - len);
      grad.addColorStop(0, rgba('#ffe0ff', 0.9)); grad.addColorStop(1, rgba('#9a5aff', 0));
      g.strokeStyle = grad; g.lineWidth = d.r * 1.3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - len * 0.34, d.y - len); g.stroke();
      glow(g, '#e0a8ff', d.x, d.y, d.r * 2.4, 0.9);
      g.save(); g.translate(d.x, d.y); rockShape(g, d.r * 0.8, 3, '#5a3a6a', '#2a1a33'); g.restore();
      // Shadow on the floor ahead of the impact.
      const gx = d.x + (-d.y) * d.vx / d.vy;
      g.fillStyle = rgba('#000000', 0.25); g.fillRect(gx - d.r, -4, d.r * 2, 6);
    }
  },
};

// Hazards behind the fighters (floor warnings, waves, spires) and in front (falling things).
const FRONT = new Set(['boulder', 'lightning', 'portal', 'meteors', 'strafe']);
export function drawHazards(g, w, t, front) {
  for (const h of w.hazards) {
    if (FRONT.has(h.type) !== front) continue;
    g.save();
    try { DRAW[h.type]?.(g, h, t, w); }
    catch (err) { /* a broken hazard drawing must not break the frame */ }
    finally { g.restore(); }
  }
  // Low gravity: rubble floating up off the floor.
  if (front && (w.gravityScale ?? 1) < 1) {
    for (let i = 0; i < 24; i++) {
      const x = w.left + nz(i) * (w.right - w.left), y = -((t * (50 + nz(i + 1) * 60) + nz(i + 2) * 900) % 900);
      g.save(); g.translate(x, y); g.rotate(t + i);
      g.fillStyle = i % 3 ? '#7a4a7a' : '#c89ae8'; g.fillRect(-10, -8, 20, 16);
      g.restore();
    }
  }
}

// ---------- Weather ----------
// Sky layer pieces drawn right after the backdrop, under the floor, in art pixels.
const SKY = {
  dusk(g, W, H, t, a) {
    g.globalCompositeOperation = 'source-over';
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgba('#3a1a40', 0.45 * a)); grad.addColorStop(0.6, rgba('#ff7a3a', 0.25 * a)); grad.addColorStop(1, rgba('#ffb04a', 0.2 * a));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  },
  rain(g, W, H, t, a) { g.fillStyle = rgba('#26304a', 0.35 * a); g.fillRect(0, 0, W, H); },
  storm(g, W, H, t, a, ev) {
    g.fillStyle = rgba('#141a2c', 0.55 * a); g.fillRect(0, 0, W, H);
    // Storm clouds rolling across the top.
    for (let i = 0; i < 9; i++) {
      const x = ((i * 97 + t * 8) % (W + 160)) - 80, y = H * 0.08 + nz(i) * H * 0.18;
      glow(g, '#2a3048', x, y, 60 + nz(i + 2) * 50, 0.9 * a);
    }
    if (ev.flash > 0.3) {
      g.save(); g.scale(1 / UNIT, 1 / UNIT);
      bolt(g, nz(Math.floor(t)) * W * UNIT, 0, nz(Math.floor(t) + 5) * W * UNIT, H * UNIT * 0.45, Math.floor(t * 10), 10, '#dfe8ff');
      g.restore();
    }
  },
  night(g, W, H, t, a) { g.fillStyle = rgba('#0a0c22', 0.45 * a); g.fillRect(0, 0, W, H); },
  fog(g, W, H, t, a) { g.fillStyle = rgba('#5a6078', 0.25 * a); g.fillRect(0, 0, W, H); },
  searchlights(g, W, H, t, a) {
    g.fillStyle = rgba('#0a0c22', 0.3 * a); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.2), ang = Math.sin(t * (0.3 + i * 0.07) + i * 2) * 0.6;
      g.save(); g.translate(x, H); g.rotate(ang);
      const grad = g.createLinearGradient(0, 0, 0, -H);
      const col = ['#fff1c8', '#bfe0ff', '#ffc8c8'][i % 3];
      grad.addColorStop(0, rgba(col, 0.28 * a)); grad.addColorStop(1, rgba(col, 0));
      g.fillStyle = grad; g.beginPath(); g.moveTo(-3, 0); g.lineTo(-40, -H * 1.2); g.lineTo(40, -H * 1.2); g.lineTo(3, 0); g.fill();
      g.restore();
    }
  },
  fireworks(g, W, H, t, a) {
    g.fillStyle = rgba('#0a0c22', 0.3 * a); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const P = 2.4, ph = (t + k * 0.6) / P, n = Math.floor(ph), u = ph - n;
      const x = W * (0.12 + nz(n * 4 + k) * 0.76), y = H * (0.08 + nz(n * 4 + k + 1) * 0.3);
      const col = ['#ff5a7a', '#ffd23a', '#7fd0ff', '#9aff7a'][(n + k) % 4];
      if (u < 0.25) { g.fillStyle = rgba('#ffffff', a); g.fillRect(x, y + (1 - u / 0.25) * H * 0.4, 1, 3); continue; }
      const v = (u - 0.25) / 0.75, r = 5 + v * 26;
      g.fillStyle = rgba(col, a * (1 - v));
      for (let i = 0; i < 18; i++) { const an = i / 18 * TAU; g.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r + v * v * 12), 2, 2); }
      glow(g, col, x, y, 8 + 20 * (1 - v), 0.5 * a * (1 - v));
    }
  },
  eclipse(g, W, H, t, a, ev, moon) {
    g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba('#a03040', 0.75 * a); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = rgba('#200008', 0.3 * a); g.fillRect(0, 0, W, H);
    if (moon) {
      // Something passes over the moon, leaving a burning red ring.
      const r = moon.r;
      glow(g, '#ff3a3a', moon.x, moon.y, r * 1.6, 0.6 * a);
      g.fillStyle = rgba('#0a0008', a); g.beginPath(); g.arc(moon.x, moon.y, r, 0, TAU); g.fill();
      g.strokeStyle = rgba('#ff6a5a', a); g.lineWidth = 3; g.beginPath(); g.arc(moon.x, moon.y, r + 2, 0, TAU); g.stroke();
      // Six-tomoe pattern glowing on the dark disc: the Infinite Tsukuyomi moon.
      g.fillStyle = rgba('#ff2a2a', 0.8 * a);
      for (let i = 0; i < 3; i++) for (const rr of [0.45, 0.75]) { const an = i / 3 * TAU + rr * 2 + t * 0.1; g.beginPath(); g.arc(moon.x + Math.cos(an) * r * rr, moon.y + Math.sin(an) * r * rr, r * 0.08, 0, TAU); g.fill(); }
      g.strokeStyle = rgba('#ff2a2a', 0.6 * a); g.lineWidth = 2;
      for (const rr of [0.3, 0.6, 0.9]) { g.beginPath(); g.arc(moon.x, moon.y, r * rr, 0, TAU); g.stroke(); }
    }
  },
  aurora(g, W, H, t, a) {
    g.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      const col = ['#5affb0', '#9a7aff', '#ff7ad8'][b];
      for (let x = 0; x < W; x += 2) {
        const y = H * (0.12 + b * 0.07) + Math.sin(x * 0.02 + t * 0.6 + b * 2) * 10 + Math.sin(x * 0.05 - t + b) * 4;
        const hgt = 24 + 14 * Math.sin(x * 0.03 + t * 1.3 + b);
        const grad = g.createLinearGradient(0, y - hgt, 0, y);
        grad.addColorStop(0, rgba(col, 0)); grad.addColorStop(1, rgba(col, 0.22 * a));
        g.fillStyle = grad; g.fillRect(x, y - hgt, 2, hgt);
      }
    }
  },
};

// Weather in front of everything (rain, fog banks, lightning flash), art pixels on the fx layer.
const AIR = {
  rain(g, W, H, t, a) { rain(g, W, H, t, a, 90, '#a8c0e8'); },
  storm(g, W, H, t, a, ev) {
    rain(g, W, H, t, a, 170, '#c8d8f8');
    if (ev.flash > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#dfe8ff', 0.55 * ev.flash); g.fillRect(0, 0, W, H); }
  },
  fog(g, W, H, t, a) {
    for (let i = 0; i < 10; i++) {
      const x = ((i * 83 + t * (6 + i)) % (W + 200)) - 100, y = H * (0.45 + nz(i) * 0.5);
      glow(g, '#c8ccd8', x, y, 60 + nz(i + 1) * 50, 0.55 * a);
    }
  },
  dusk(g, W, H, t, a) {
    // Leaves drifting through the gorge.
    for (let i = 0; i < 16; i++) {
      const x = ((i * 61 + t * (20 + nz(i) * 20)) % (W + 40)) - 20, y = ((i * 37 + t * 14) % (H + 20)) - 10;
      g.fillStyle = rgba(i % 2 ? '#e8743a' : '#d8a03a', 0.9 * a);
      g.fillRect(Math.round(x + Math.sin(t * 2 + i) * 6), Math.round(y), 2, 1);
    }
  },
  calm(g, W, H, t, a) {},
  eclipse(g, W, H, t, a) {
    for (let i = 0; i < 26; i++) { // ash
      const x = ((i * 47 + t * 10) % W), y = ((i * 71 + t * (16 + nz(i) * 10)) % H);
      g.fillStyle = rgba('#ff9a8a', 0.5 * a); g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  },
};

function rain(g, W, H, t, a, n, col) {
  g.strokeStyle = rgba(col, 0.55 * a); g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 300 + nz(i) * 200;
    const x = ((nz(i + 7) * (W + 60) + t * sp * 0.25) % (W + 60)) - 30;
    const y = ((nz(i + 3) * H + t * sp) % (H + 20)) - 10;
    g.moveTo(Math.round(x), Math.round(y)); g.lineTo(Math.round(x - 3), Math.round(y + 9));
  }
  g.stroke();
  // Splashes on the floor line.
  g.fillStyle = rgba('#ffffff', 0.5 * a);
  for (let i = 0; i < n / 6; i++) { const x = (nz(i + 50) * W + t * 40 * i) % W; if (Math.sin(t * 9 + i * 3) > 0.6) g.fillRect(Math.round(x), Math.round(H * 0.82 + nz(i) * H * 0.1), 2, 1); }
}

function blend(fn, g, W, H, t, a, ev, extra) {
  if (!fn || a <= 0.01) return;
  g.save();
  try { fn(g, W, H, t, a, ev, extra); } catch (err) { /* weather is decoration */ } finally { g.restore(); }
}

export function drawSkyWeather(g, ev, W, H, t, moon) {
  if (!ev) return;
  if (ev.mix < 1) blend(SKY[ev.prevWeather], g, W, H, t, 1 - ev.mix, ev, moon);
  blend(SKY[ev.weather], g, W, H, t, ev.mix, ev, moon);
}

export function drawAirWeather(g, ev, W, H, t) {
  if (!ev) return;
  if (ev.mix < 1) blend(AIR[ev.prevWeather], g, W, H, t, 1 - ev.mix, ev);
  blend(AIR[ev.weather], g, W, H, t, ev.mix, ev);
}

// Warning call-outs for each hazard.
export const HAZARD_CALLS = {
  boulder: ['LANDSLIDE!', '#ffb07a'], wave: ['FLOOD SURGE!', '#9fd4ff'], lightning: ['LIGHTNING!', '#ffe94a'],
  strafe: ['AIR STRIKE!', '#ff5a5a'], portal: ['PORTAL BREACH!', '#7fb8ff'], overload: ['REACTOR OVERLOAD!', '#7fd0ff'],
  crystals: ['CRYSTAL ERUPTION!', '#e8c0ff'], meteors: ['CHAKRA METEORS!', '#e0a8ff'],
};
