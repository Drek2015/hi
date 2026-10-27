// High-detail ability effects, drawn at full screen resolution in world units (a fighter is ~180
// units tall). Every ability resolves to a spec: a renderer plus its colours, scale and options.
// Specs come from the ability's own entry in ABILITY (vfxspecs.js) or, failing that, its fx id.
import { SPEC_BY_ABILITY, SPEC_BY_FX } from './vfxspecs.js';

const TAU = Math.PI * 2;
const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);

function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

export function specFor(sig, fx) {
  const base = String(fx || '').replace(/(Boom|Out|In|Hit)$/, '');
  return (sig && SPEC_BY_ABILITY[sig]) || SPEC_BY_FX[base] || null;
}

function glow(g, x, y, r, color, a = 1) {
  if (!(r > 0) || !Number.isFinite(x + y + r)) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1;
}

// Jagged lightning between two points with branches. `seed` changes ~30 times a second.
function bolt(g, x1, y1, x2, y2, width, color, seed, jag = 0.22, branches = 2, depth = 0) {
  const r = rng(seed);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const n = Math.max(4, Math.floor(len / 26));
  const pts = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const t = i / n, off = (r() - 0.5) * len * jag * Math.sin(Math.PI * t) * 1.4;
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
  }
  pts.push([x2, y2]);
  g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'miter'; g.lineCap = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  if (depth < 1) for (let b = 0; b < branches; b++) {
    const p = pts[1 + Math.floor(r() * (pts.length - 2))];
    const a = Math.atan2(dy, dx) + (r() - 0.5) * 2.2, l = len * (0.2 + r() * 0.3);
    bolt(g, p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, width * 0.55, color, seed * 7 + b + 1, jag, 1, depth + 1);
  }
}

// Lightning drawn as glow + coloured body + core; dark lightning puts a black body on a coloured glow.
function lightning(g, x1, y1, x2, y2, s, seed, w = 1) {
  g.globalCompositeOperation = 'lighter';
  bolt(g, x1, y1, x2, y2, 18 * w, s.glow + '55', seed, 0.22, 2);
  if (s.dark) {
    g.globalCompositeOperation = 'source-over';
    bolt(g, x1, y1, x2, y2, 7 * w, '#05020a', seed, 0.22, 2);
    g.globalCompositeOperation = 'lighter';
    bolt(g, x1, y1, x2, y2, 1.6 * w, s.edge || '#bfe8ff', seed, 0.22, 2);
  } else {
    bolt(g, x1, y1, x2, y2, 6 * w, s.c1, seed, 0.22, 2);
    bolt(g, x1, y1, x2, y2, 2.2 * w, '#ffffff', seed, 0.22, 2);
  }
  g.globalCompositeOperation = 'source-over';
}

function entityPos(e) {
  if (e.kind === 'beam') return [e.x, e.y];
  if (e.kind === 'strike') return [e.x, (e.y || 0) - (e.h || 200) / 2];
  if (e.kind === 'rush' && e.x === undefined) return [e.owner.x + e.owner.facing * 52, e.owner.y - 110];
  return [e.x, e.y];
}

// ---------- renderers ----------

const R = {};

// Energy spheres: Rasengan, Tailed Beast Bomb, Spirit Bomb, ki blasts, Truth-Seeking Balls...
R.orb = (g, e, s, t, opt = {}) => {
  const [x, y] = opt.at || entityPos(e);
  const age = opt.age ?? e.t;
  let r = (opt.r ?? (e.kind === 'rush' ? 34 : e.r || 36)) * (s.size || 1);
  if (s.grow && !opt.at) r *= 0.55 + 0.45 * ease(age / 0.35);
  r *= 1 + 0.04 * Math.sin(t * 24);
  const vx = e.vx || 0, vy = e.vy || 0, sp = Math.hypot(vx, vy);
  g.save();
  if (s.flicker) g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 9));
  // Trail
  if (sp > 0 && !opt.at) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 4; i++) glow(g, x - vx / sp * r * 0.7 * i, y - vy / sp * r * 0.7 * i, r * (1.1 - i * 0.18), s.glow, 0.35 / i);
    g.globalCompositeOperation = 'source-over';
  }
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y, r * 2.4, s.glow, r > 70 ? 0.3 : 0.5);
  g.globalCompositeOperation = 'source-over';
  if (s.dark) {
    // Dark core with a hot rim (Tailed Beast Bomb, Truth-Seeking Balls, Karma).
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    gr.addColorStop(0, s.c3 || '#000000'); gr.addColorStop(0.75, s.c1); gr.addColorStop(1, s.c2);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = s.rim || s.c2; g.lineWidth = r * 0.1;
    g.beginPath(); g.arc(x, y, r * 0.96, 0, TAU); g.stroke();
    // Compressed chakra streaks swirling over the surface.
    g.lineWidth = Math.max(2, r * 0.05);
    for (let i = 0; i < 6; i++) {
      const a = t * (3 + i * 0.4) + i;
      g.strokeStyle = i % 2 ? (s.rim || s.c2) : '#ffffff';
      g.globalAlpha = 0.6;
      g.beginPath(); g.ellipse(x, y, r * 0.85, r * (0.25 + 0.1 * i % 0.5), a, 0, Math.PI * 0.9); g.stroke();
    }
    g.globalAlpha = 1;
    // Inward compression lines
    g.strokeStyle = s.rim || s.c2; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + t * 2, u = (t * 3 + i * 0.37) % 1;
      const r0 = r * (2.2 - u * 1.1);
      g.globalAlpha = u;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * (r0 - r * 0.35), y + Math.sin(a) * (r0 - r * 0.35)); g.stroke();
    }
    g.globalAlpha = 1;
  } else {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, s.c2 || '#ffffff'); gr.addColorStop(0.8, s.c1); gr.addColorStop(1, 'rgba(255,255,255,0)');
    // Big spheres are drawn solid so they keep their colour instead of blowing out to white.
    g.globalCompositeOperation = r > 70 ? 'source-over' : 'lighter';
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    // Spinning spiral streaks (Rasengan) or plain shimmer.
    const n = s.spiral ?? 0;
    g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const a = t * 22 + i * TAU / n;
      g.globalAlpha = 0.8;
      g.beginPath(); g.ellipse(x, y, r * 0.9, r * 0.32, a * 0.25 + i, a, a + 2.4); g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'lighter';
  if (s.blades) {
    // Rasenshuriken: four long spinning wind blades and a ring.
    g.save(); g.translate(x, y); g.rotate(t * 16);
    for (let i = 0; i < 4; i++) {
      g.rotate(TAU / 4);
      const L = r * 3.2;
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(160,230,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(r * 0.6, -r * 0.12); g.quadraticCurveTo(L * 0.6, -r * 0.55, L, -r * 0.05); g.quadraticCurveTo(L * 0.55, r * 0.15, r * 0.6, r * 0.12); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(200,240,255,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, r * 2.1, 0, TAU); g.stroke();
  }
  if (s.crackle) for (let i = 0; i < 4; i++) {
    const a = (Math.floor(t * 30) * 2.39 + i * 1.7);
    lightning(g, x, y, x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 2, { c1: s.crackle, glow: s.crackle }, Math.floor(t * 30) + i, 0.6);
    g.globalCompositeOperation = 'lighter';
  }
  g.restore();
};

// Lightning techniques: Chidori/Raikiri at the hand while rushing, bolts as projectiles.
R.lightning = (g, e, s, t, opt = {}) => {
  const [x, y] = opt.at || entityPos(e);
  const seed = Math.floor(t * 30) + (e.id || 0) * 31;
  const r = 30 * (s.size || 1) * (opt.scale || 1);
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y, r * 3.2, s.glow, 0.7);
  if (s.dark) { g.globalCompositeOperation = 'source-over'; glow(g, x, y, r * 1.3, '#05020a', 0.95); g.globalCompositeOperation = 'lighter'; }
  else glow(g, x, y, r * 1.4, '#ffffff', 0.9);
  for (let i = 0; i < 7; i++) {
    const a = (seed * 1.7 + i * 0.9) % TAU, L = r * (2 + ((seed + i * 3) % 5) * 0.5);
    lightning(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, s, seed + i, 0.7);
  }
  if (e.kind === 'rush' && !opt.at) {
    // Streak back along the path and crackling into the ground.
    const o = e.owner;
    lightning(g, x, y, x - o.facing * 260, y + 30, s, seed + 50, 1.1);
    lightning(g, x - o.facing * 60, y + 20, x - o.facing * 140, o.y, s, seed + 70, 0.7);
  }
  if (e.kind === 'proj' && !opt.at) {
    const sp = Math.hypot(e.vx, e.vy) || 1;
    const L = (e.r || 30) * 5 * (s.size || 1);
    lightning(g, x, y, x - e.vx / sp * L, y - e.vy / sp * L, s, seed + 9, 1.2);
    if (s.hound) { // Lightning hound: a running beast's head of lightning.
      g.fillStyle = s.c1; g.globalAlpha = 0.8;
      g.beginPath(); g.ellipse(x, y, r * 1.6, r * 1.1, Math.atan2(e.vy, e.vx), 0, TAU); g.fill(); g.globalAlpha = 1;
      for (const k of [-1, 1]) lightning(g, x, y - r, x - e.vx / sp * r * 1.5, y - r * 2.2 + k * 10, s, seed + k + 99, 0.6);
    }
  }
  g.restore();
};

// Beams: Kamehameha, Unibeam, flame and lightning streams, Indra's Arrow.
R.beam = (g, e, s, t) => {
  const x1 = e.x, y1 = e.y, x2 = e.ex, y2 = e.ey;
  if (x1 === undefined || x2 === undefined) return;
  const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  const fade = e.life - e.t < 0.15 ? Math.max(0, (e.life - e.t) / 0.15) : 1;
  const w = (e.width || 80) * (s.size || 1) * Math.min(1, (e.grow ?? 1) * 1.5) * fade;
  g.save();
  g.translate(x1, y1); g.rotate(ang);
  g.globalCompositeOperation = 'lighter';
  // Outer glow
  const og = g.createLinearGradient(0, -w * 1.2, 0, w * 1.2);
  og.addColorStop(0, 'rgba(0,0,0,0)'); og.addColorStop(0.5, s.glow); og.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.35; g.fillStyle = og; g.fillRect(0, -w * 1.2, len, w * 2.4); g.globalAlpha = 1;
  if (s.style === 'fire') {
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 26; i++) {
      const u = ((i * 0.13 + t * 2.2) % 1), px = u * len, rr = w * (0.45 + 0.35 * Math.sin(i * 3.1 + t * 9)) * (0.6 + u * 0.6);
      const gr = g.createRadialGradient(px, 0, 0, px, 0, rr);
      gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.25, s.c2); gr.addColorStop(0.7, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.85; g.fillStyle = gr; g.beginPath(); g.arc(px, Math.sin(i * 7 + t * 14) * w * 0.15, rr, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
  } else {
    // Body with rippling edges (drawn solid so the beam keeps its colour).
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = s.c1;
    g.beginPath(); g.moveTo(0, -w * 0.55);
    for (let px = 0; px <= len; px += 18) g.lineTo(px, -w * (0.5 + 0.06 * Math.sin(px * 0.05 - t * 40)));
    for (let px = len; px >= 0; px -= 18) g.lineTo(px, w * (0.5 + 0.06 * Math.sin(px * 0.05 + t * 40)));
    g.closePath(); g.fill();
    g.fillStyle = s.c2; g.fillRect(0, -w * 0.25, len, w * 0.5);
    g.fillStyle = '#ffffff'; g.fillRect(0, -w * 0.09, len, w * 0.18);
    // Spiral bands travelling down the beam.
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
    for (let px = (t * 900) % 90; px < len; px += 90) { g.beginPath(); g.ellipse(px, 0, w * 0.18, w * 0.52, 0, 0, TAU); g.stroke(); }
    g.globalCompositeOperation = 'lighter';
  }
  if (s.style === 'bolt') { g.rotate(-ang); g.translate(-x1, -y1); const seed = Math.floor(t * 30);
    for (let k = 0; k < 3; k++) lightning(g, x1, y1 + (k - 1) * w * 0.3, x2, y2 + (k - 1) * w * 0.3, s, seed + k * 13, 1);
    g.translate(x1, y1); g.rotate(ang); g.globalCompositeOperation = 'lighter'; }
  // Muzzle and impact splash
  glow(g, 0, 0, w * 1.3, s.c1, 0.7);
  glow(g, 0, 0, w * 0.6, '#ffffff', 0.9);
  glow(g, len, 0, w * 1.6, s.c1, 0.7);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + t * 6, L = w * (1 + 0.5 * Math.sin(t * 30 + i));
    g.beginPath(); g.moveTo(len, 0); g.lineTo(len + Math.cos(a + 0.12) * L, Math.sin(a + 0.12) * L); g.lineTo(len + Math.cos(a - 0.12) * L, Math.sin(a - 0.12) * L); g.fill();
  }
  if (s.style === 'arrow') {
    g.fillStyle = s.c2; g.beginPath(); g.moveTo(len + w * 2, 0); g.lineTo(len - w * 0.4, -w * 1.1); g.lineTo(len - w * 0.4, w * 1.1); g.fill();
  }
  g.restore();
};

// Fireballs and flames; `dark` gives Amaterasu's black fire.
R.flame = (g, e, s, t, opt = {}) => {
  const [x, y] = opt.at || entityPos(e);
  const r = (e.r || 40) * (s.size || 1) * (opt.scale || 1);
  const sp = Math.hypot(e.vx || 0, e.vy || 0) || 1;
  const bx = -(e.vx || -1) / sp, by = -(e.vy || 0) / sp;
  g.save();
  g.globalCompositeOperation = s.dark ? 'source-over' : 'lighter';
  if (!s.dark) glow(g, x, y, r * 2.6, s.glow, 0.6);
  for (let i = 0; i < 16; i++) {
    const u = ((i * 0.071 + t * 3) % 1);
    const px = x + bx * u * r * 3 + Math.sin(i * 5 + t * 20) * r * 0.25, py = y + by * u * r * 3 + Math.cos(i * 3 + t * 17) * r * 0.25 - u * r * 0.4;
    const rr = r * (1 - u * 0.75);
    const gr = g.createRadialGradient(px, py, 0, px, py, rr);
    if (s.dark) { gr.addColorStop(0, '#000000'); gr.addColorStop(0.7, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
    else { gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.3, s.c2); gr.addColorStop(0.75, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
    g.globalAlpha = 1 - u * 0.6;
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
  }
  if (s.dark) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = s.c2; g.lineWidth = 3; g.globalAlpha = 0.7; g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.stroke(); }
  g.restore();
};

// Kamui and other space-warping swirls.
R.vortex = (g, e, s, t, opt = {}) => {
  const [x, y] = opt.at || entityPos(e);
  const life = e.life || 0.6, u = Math.min(1, (e.t || 0) / life);
  let r = (opt.r ?? e.r ?? 120) * (s.size || 1);
  r *= s.absorb ? (u < 0.3 ? ease(u / 0.3) : 1 - ease((u - 0.3) / 0.7) * 0.9) : 0.5 + 0.5 * ease(u * 2);
  g.save();
  g.translate(x, y);
  g.globalCompositeOperation = 'source-over';
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
  gr.addColorStop(0, '#000000'); gr.addColorStop(0.5, s.c1 + 'cc'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 1.3, 0, TAU); g.fill();
  g.rotate(t * (s.spin ?? 7));
  for (let arm = 0; arm < 6; arm++) {
    g.rotate(TAU / 6);
    g.strokeStyle = arm % 2 ? s.c2 : s.c3 || '#1a0a2a'; g.lineWidth = r * 0.09;
    g.globalAlpha = 0.85;
    g.beginPath();
    for (let k = 0; k <= 30; k++) { const q = k / 30, a = q * 4.2, rr = r * (1.25 - q); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#000000'; g.beginPath(); g.arc(0, 0, r * 0.22, 0, TAU); g.fill();
  g.restore();
};

const SHIELD_PATH = (g, r) => { g.beginPath(); g.arc(0, 0, r, 0, TAU); };

// Thrown weapons and physical projectiles, each its own shape.
R.thrown = (g, e, s, t) => {
  const [x, y] = entityPos(e);
  const ang = Math.atan2(e.vy || 0, e.vx || 1);
  const r = (e.r || 24) * (s.size || 1);
  g.save(); g.translate(x, y);
  // Motion streak
  g.globalCompositeOperation = 'lighter';
  const streak = g.createLinearGradient(0, 0, -Math.cos(ang) * r * 5, -Math.sin(ang) * r * 5);
  streak.addColorStop(0, (s.glow || '#ffffff') + 'aa'); streak.addColorStop(1, 'rgba(0,0,0,0)');
  g.strokeStyle = streak; g.lineWidth = r * 0.7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-Math.cos(ang) * r * 5, -Math.sin(ang) * r * 5); g.stroke();
  g.globalCompositeOperation = 'source-over';
  const spin = (e.spin || t * 18);
  switch (s.shape) {
    case 'kunai': {
      g.rotate(ang);
      const L = r * 2.6;
      g.fillStyle = '#d8dde8'; g.strokeStyle = '#2a2a33'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(L, 0); g.lineTo(L * 0.15, -r * 0.45); g.lineTo(0, 0); g.lineTo(L * 0.15, r * 0.45); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(L, 0); g.lineTo(L * 0.2, -r * 0.12); g.lineTo(L * 0.2, 0); g.fill();
      g.fillStyle = '#3a3040'; g.fillRect(-L * 0.55, -r * 0.13, L * 0.55, r * 0.26);
      g.strokeStyle = '#2a2a33'; g.beginPath(); g.arc(-L * 0.68, 0, r * 0.22, 0, TAU); g.stroke();
      if (s.formula) { g.fillStyle = '#ffd84a'; g.font = `${r * 0.5}px serif`; g.fillText('雷', -L * 0.45, r * 0.18); }
      break;
    }
    case 'shuriken': {
      g.rotate(spin);
      g.fillStyle = s.c1 || '#c9d0dc'; g.strokeStyle = '#2a2a33'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r * 1.4; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(0, 0, r * 0.18, 0, TAU); g.fill();
      if (s.glow2) { g.globalCompositeOperation = 'lighter'; glow(g, 0, 0, r * 2, s.glow2, 0.6); }
      break;
    }
    case 'capShield': {
      // Spinning vibranium shield seen edge-on as it rotates.
      g.rotate(-0.2); g.scale(Math.max(0.25, Math.abs(Math.cos(spin * 0.5))), 1);
      const R2 = r * 1.6;
      for (const [rr, c] of [[1, '#c8202f'], [0.78, '#f2f2f6'], [0.56, '#c8202f'], [0.36, '#2a5ad8']]) { g.fillStyle = c; SHIELD_PATH(g, R2 * rr); g.fill(); }
      g.fillStyle = '#ffffff'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R2 * 0.13 : R2 * 0.32; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.fill();
      g.strokeStyle = '#1a1a22'; g.lineWidth = 3; SHIELD_PATH(g, R2); g.stroke();
      break;
    }
    case 'hammer': case 'axe': {
      g.rotate(spin);
      const H = r * 1.3;
      g.fillStyle = '#6a4a2a'; g.fillRect(-r * 0.15, 0, r * 0.3, r * 2.2);
      g.fillStyle = '#2a2a33'; g.fillRect(-r * 0.2, r * 2.1, r * 0.4, r * 0.3);
      if (s.shape === 'hammer') {
        const gr = g.createLinearGradient(-H, 0, H, 0); gr.addColorStop(0, '#6a7080'); gr.addColorStop(0.5, '#d8dde8'); gr.addColorStop(1, '#5a6070');
        g.fillStyle = gr; g.fillRect(-H, -r * 0.9, H * 2, r * 1.1);
        g.strokeStyle = '#2a2a33'; g.lineWidth = 2; g.strokeRect(-H, -r * 0.9, H * 2, r * 1.1);
        g.strokeStyle = '#9aa2b8'; g.strokeRect(-H * 0.7, -r * 0.7, H * 1.4, r * 0.7);
      } else {
        g.fillStyle = '#b8c0d0'; g.strokeStyle = '#2a2a33'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -r * 0.3); g.quadraticCurveTo(r * 1.9, -r * 1.4, r * 1.6, r * 0.6); g.quadraticCurveTo(r * 0.9, r * 0.1, 0, r * 0.4); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c87a3a'; g.beginPath(); g.moveTo(0, -r * 0.3); g.lineTo(-r * 0.9, -r * 0.2); g.lineTo(0, r * 0.2); g.fill();
      }
      if (s.crackle) { g.rotate(-spin); g.translate(-x, -y); for (let i = 0; i < 3; i++) { const a = Math.floor(t * 30) * 1.3 + i * 2; lightning(g, x, y, x + Math.cos(a) * r * 3, y + Math.sin(a) * r * 3, { c1: s.crackle, glow: s.crackle }, Math.floor(t * 30) + i, 0.6); } }
      break;
    }
    case 'rod': case 'senbon': {
      g.rotate(ang);
      const L = r * (s.shape === 'rod' ? 3.6 : 2.4), Wd = s.shape === 'rod' ? r * 0.35 : r * 0.12;
      g.globalCompositeOperation = 'lighter'; glow(g, 0, 0, r * 1.8, s.glow, 0.5); g.globalCompositeOperation = 'source-over';
      g.fillStyle = s.c1; g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.6, -Wd); g.lineTo(-L * 0.6, Wd); g.closePath(); g.fill();
      g.strokeStyle = s.c2; g.lineWidth = 2; g.stroke();
      break;
    }
    case 'chain': {
      g.rotate(ang);
      g.fillStyle = '#c9d0dc'; g.strokeStyle = '#2a2a33'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(r * 1.6, 0); g.quadraticCurveTo(r * 0.4, -r * 1.2, -r * 0.4, -r * 0.6); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
      g.restore(); g.save();
      // Chain links back to the thrower.
      const o = e.owner, hx = o.x + o.facing * 40, hy = o.y - 110;
      const d = Math.hypot(x - hx, y - hy), n = Math.floor(d / 22);
      g.strokeStyle = '#8a8f9a'; g.lineWidth = 3;
      for (let i = 0; i < n; i++) { const q = i / n; g.beginPath(); g.ellipse(hx + (x - hx) * q, hy + (y - hy) * q + Math.sin(q * Math.PI) * 18, 8, 5, Math.atan2(y - hy, x - hx) + (i % 2) * 1.2, 0, TAU); g.stroke(); }
      break;
    }
    case 'missile': {
      g.rotate(ang);
      g.fillStyle = '#d8dde8'; g.fillRect(-r * 1.2, -r * 0.3, r * 2, r * 0.6);
      g.fillStyle = '#c8282f'; g.beginPath(); g.moveTo(r * 0.8, -r * 0.3); g.lineTo(r * 1.5, 0); g.lineTo(r * 0.8, r * 0.3); g.fill();
      g.fillStyle = '#6a7080'; g.beginPath(); g.moveTo(-r * 1.2, -r * 0.3); g.lineTo(-r * 1.6, -r * 0.8); g.lineTo(-r * 0.8, -r * 0.3); g.fill();
      g.beginPath(); g.moveTo(-r * 1.2, r * 0.3); g.lineTo(-r * 1.6, r * 0.8); g.lineTo(-r * 0.8, r * 0.3); g.fill();
      g.globalCompositeOperation = 'lighter'; glow(g, -r * 1.6, 0, r * 1.1, '#ff9a3a', 1); glow(g, -r * 1.4, 0, r * 0.5, '#ffffff', 1);
      g.globalCompositeOperation = 'source-over';
      for (let i = 1; i < 7; i++) { g.globalAlpha = 0.35 - i * 0.04; g.fillStyle = '#c8c8d0'; g.beginPath(); g.arc(-r * (1.6 + i * 0.9), Math.sin(t * 20 + i) * 4, r * (0.35 + i * 0.12), 0, TAU); g.fill(); }
      break;
    }
    case 'web': case 'webBall': {
      const R2 = r * (s.shape === 'webBall' ? 1.5 : 1.1);
      g.rotate(spin * 0.2);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.fillStyle = 'rgba(240,244,250,0.35)';
      SHIELD_PATH(g, R2); g.fill();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R2 * 1.25, Math.sin(a) * R2 * 1.25); g.stroke(); }
      for (const k of [0.4, 0.75, 1]) { g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i * TAU / 8; g.lineTo(Math.cos(a) * R2 * k, Math.sin(a) * R2 * k); } g.stroke(); }
      if (s.crackle) { g.rotate(-spin * 0.2); g.translate(-x, -y); for (let i = 0; i < 3; i++) { const a = Math.floor(t * 30) * 2 + i * 2; lightning(g, x, y, x + Math.cos(a) * R2 * 1.8, y + Math.sin(a) * R2 * 1.8, { c1: '#bfeaff', glow: '#7fd0ff' }, Math.floor(t * 30) + i, 0.5); } }
      break;
    }
    case 'webLine': {
      g.restore(); g.save();
      const o = e.owner, hx = o.x + o.facing * 40, hy = o.y - 120;
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(x, y); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.8, 0, TAU); g.stroke();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3); g.stroke(); }
      break;
    }
    case 'cube': {
      g.rotate(spin * 0.15);
      const c = r * 1.2;
      g.fillStyle = '#16141c'; g.fillRect(-c, -c, c * 2, c * 2);
      g.strokeStyle = '#c9a6ff'; g.lineWidth = 4; g.strokeRect(-c, -c, c * 2, c * 2);
      g.strokeStyle = 'rgba(201,166,255,0.5)'; g.lineWidth = 2; g.strokeRect(-c * 0.6, -c * 0.6, c * 1.2, c * 1.2);
      break;
    }
    case 'tendril': {
      g.restore(); g.save();
      const o = e.owner, hx = o.x + o.facing * 30, hy = o.y - 110;
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = k ? '#2a2a40' : '#0a0a12'; g.lineWidth = 14 - k * 4;
        g.beginPath(); g.moveTo(hx, hy);
        g.bezierCurveTo(hx + (x - hx) * 0.3, hy - 80 + k * 30 + Math.sin(t * 12) * 30, hx + (x - hx) * 0.7, y + 60 - k * 30, x, y); g.stroke();
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, TAU); g.fill();
      break;
    }
  }
  g.restore();
};

// Giant crescent slashes.
function crescent(g, x, y, R2, a0, a1, w, c1, c2) {
  g.save(); g.translate(x, y);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = c1;
  g.beginPath(); g.arc(0, 0, R2, a0, a1); g.arc(R2 * 0.12 * Math.cos((a0 + a1) / 2), R2 * 0.12 * Math.sin((a0 + a1) / 2), R2 - w, a1, a0, true); g.closePath(); g.fill();
  g.fillStyle = c2;
  g.beginPath(); g.arc(0, 0, R2, a0 + 0.1, a1 - 0.1); g.arc(R2 * 0.06 * Math.cos((a0 + a1) / 2), R2 * 0.06 * Math.sin((a0 + a1) / 2), R2 - w * 0.4, a1 - 0.1, a0 + 0.1, true); g.closePath(); g.fill();
  g.restore();
}

R.slash = (g, e, s, t) => {
  const [x, y] = entityPos(e);
  const life = e.life || 0.5, u = Math.min(1, Math.max(0, (e.t - (e.delay > 0 ? 0 : 0)) / life));
  const size = (e.kind === 'strike' ? (e.w || 300) * 0.6 : (e.r || 150)) * (s.size || 1);
  const dir = e.dir || e.owner?.facing || 1;
  g.save(); g.globalAlpha = 1 - Math.max(0, u - 0.6) * 2.5;
  const sweep = ease(u * 2.2);
  const n = s.count || 1;
  for (let i = 0; i < n; i++) {
    const tilt = (s.cross ? (i ? 0.8 : -0.8) : i * 0.5) * dir;
    g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(tilt);
    crescent(g, 0, 0, size, -1.9, -1.9 + 3.4 * sweep, size * 0.28, s.c1, s.c2);
    g.restore();
  }
  if (s.crackle) lightning(g, x - size * 0.6 * dir, y - size * 0.5, x + size * 0.7 * dir, y + size * 0.4, { c1: s.crackle, glow: s.crackle }, Math.floor(t * 30), 1);
  g.restore();
};

// Shockwaves: Shinra Tensei, vibranium slams, thunderclaps, Stopped Time, Solar Flare, gusts.
R.shock = (g, e, s, t) => {
  const [x, y] = entityPos(e);
  const life = e.life || 0.5, u = Math.min(1, (e.t || 0) / life);
  const r = (e.r || 180) * (s.size || 1);
  g.save(); g.translate(x, y);
  const fade = 1 - u;
  switch (s.style) {
    case 'shinra': {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const rr = r * ease(u * 1.4 + k * 0.08) * (1 + k * 0.15);
        g.strokeStyle = `rgba(232,224,255,${0.6 * fade})`; g.lineWidth = 18 - k * 4;
        g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke();
      }
      glow(g, 0, 0, r * 0.6, s.c1, 0.8 * fade);
      g.strokeStyle = `rgba(255,255,255,${0.5 * fade})`; g.lineWidth = 3;
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r0 = r * ease(u) * 0.6; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r0 * 1.8, Math.sin(a) * r0 * 1.8); g.stroke(); }
      break;
    }
    case 'time': {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = s.c1; g.lineWidth = 6; g.globalAlpha = fade;
      const rr = r * ease(u * 2);
      g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.beginPath(); g.moveTo(Math.cos(a) * rr * 0.85, Math.sin(a) * rr * 0.85); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); g.stroke(); }
      g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -rr * 0.7); g.moveTo(0, 0); g.lineTo(rr * 0.45, 0); g.stroke();
      g.fillStyle = s.c2; g.globalAlpha = 0.25 * fade; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill();
      break;
    }
    case 'solar': {
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, 0, r * 4 * ease(u * 3), '#ffffff', fade);
      g.fillStyle = `rgba(255,255,240,${0.8 * fade})`;
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.05) * r * 5, Math.sin(a - 0.05) * r * 5); g.lineTo(Math.cos(a + 0.05) * r * 5, Math.sin(a + 0.05) * r * 5); g.fill(); }
      break;
    }
    case 'wind': {
      g.globalCompositeOperation = 'lighter';
      g.rotate(t * 8);
      for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); crescent(g, 0, 0, r * (0.6 + 0.5 * ease(u)), 0, 1.6, r * 0.12, `rgba(200,242,255,${0.7 * fade})`, `rgba(255,255,255,${0.8 * fade})`); }
      break;
    }
    case 'genjutsu': {
      g.globalCompositeOperation = 'lighter';
      const rr = r * ease(u * 1.5);
      g.strokeStyle = s.c1; g.lineWidth = 10; g.globalAlpha = fade; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke();
      g.fillStyle = s.c1; g.globalAlpha = 0.25 * fade; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill();
      g.globalAlpha = fade; g.fillStyle = '#1a0a0a';
      g.rotate(t * 6);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; g.beginPath(); g.arc(Math.cos(a) * rr * 0.4, Math.sin(a) * rr * 0.4, rr * 0.1, 0, TAU); g.fill(); }
      break;
    }
    default: {
      // Ring shockwave with flying debris (vibranium, thunderclap, impact, fire walls).
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, 0, r * 1.1, s.glow || s.c1, 0.8 * fade);
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = k ? s.c1 : '#ffffff'; g.lineWidth = (14 - k * 4) * fade + 1; g.globalAlpha = fade;
        g.beginPath(); g.arc(0, 0, r * ease(u * 1.5 + k * 0.1) * (1 + k * 0.2), 0, TAU); g.stroke();
      }
      if (s.crackle) for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + u * 2; lightning(g, 0, 0, Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, { c1: s.crackle, glow: s.crackle }, Math.floor(t * 30) + i, 0.8); g.globalCompositeOperation = 'lighter'; }
      if (s.fire) for (let i = 0; i < 12; i++) { const a = i * TAU / 12; glow(g, Math.cos(a) * r * ease(u * 1.5), Math.sin(a) * r * ease(u * 1.5) * 0.6, r * 0.35, s.c1, fade); }
      g.globalCompositeOperation = 'source-over'; g.fillStyle = s.debris || '#9a8a7a';
      for (let i = 0; i < 14; i++) { const a = i * 2.39, d = r * ease(u * 1.3) * (0.6 + (i % 4) * 0.15); g.globalAlpha = fade; g.fillRect(Math.cos(a) * d, Math.sin(a) * d * 0.7 - u * 40, 10, 10); }
    }
  }
  g.restore();
};

// Giant summons and strikes from above or below.
R.giant = (g, e, s, t) => {
  const x = e.x, gy = e.y || 0, w = (e.w || 300) * (s.size || 1), h = (e.h || 300) * (s.size || 1);
  const delay = Math.max(0.05, e.delay || 0.3);
  const pre = Math.min(1, e.t / delay), post = e.t > delay ? Math.min(1, (e.t - delay) / Math.max(0.1, (e.life || 0.9) - delay)) : 0;
  const fade = post > 0.7 ? 1 - (post - 0.7) / 0.3 : 1;
  const dir = e.dir || 1;
  g.save();
  // Warning shadow on the ground.
  g.fillStyle = `rgba(0,0,0,${0.35 * pre * fade})`;
  g.beginPath(); g.ellipse(x, gy, w * 0.55, 18, 0, 0, TAU); g.fill();
  g.globalAlpha = fade;
  switch (s.style) {
    case 'toad': {
      const drop = (1 - ease(pre)) * 700, sq = post > 0 ? 1 - 0.15 * Math.sin(Math.min(1, post * 4) * Math.PI) : 1;
      g.save(); g.translate(x, gy - drop); g.scale(1 / sq, sq);
      const W = w * 0.75, H = h * 0.6;
      g.fillStyle = '#c8501f'; g.beginPath(); g.ellipse(0, -H * 0.5, W, H * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8a070'; g.beginPath(); g.ellipse(0, -H * 0.3, W * 0.6, H * 0.3, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a2a60'; g.fillRect(-W * 0.8, -H * 0.7, W * 1.6, H * 0.18);
      for (const k of [-1, 1]) { g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(k * W * 0.45, -H * 0.95, H * 0.16, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.fillRect(k * W * 0.45 - H * 0.12, -H * 0.97, H * 0.24, H * 0.05); }
      g.strokeStyle = '#5a1a0a'; g.lineWidth = 6; g.beginPath(); g.arc(0, -H * 0.55, W * 0.45, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
      break;
    }
    case 'paw': {
      const reach = ease(pre) * 0.7 + ease(post * 3) * 0.3;
      g.save(); g.translate(x - dir * w * 0.6 + dir * w * reach, gy - h * 0.45); g.scale(dir, 1);
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, 0, h * 0.9, '#ff9a1f', 0.6);
      g.fillStyle = 'rgba(255,170,40,0.85)';
      g.beginPath(); g.ellipse(-w * 0.2, 0, w * 0.35, h * 0.25, 0, 0, TAU); g.fill();
      for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; g.beginPath(); g.moveTo(w * 0.05, Math.sin(a) * h * 0.2); g.lineTo(w * 0.45 + Math.cos(a) * 30, Math.sin(a) * h * 0.38); g.lineTo(w * 0.1, Math.sin(a) * h * 0.2 + 20); g.fill(); }
      g.restore();
      break;
    }
    case 'spikes': {
      const k = ease(post * 3) * (pre >= 1 ? 1 : 0);
      for (let i = 0; i < 7; i++) {
        const sx = x + (i - 3) * w / 7, sh = h * (0.6 + ((i * 37) % 10) / 20) * k;
        g.fillStyle = s.c1; g.strokeStyle = '#3a2a1a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(sx - 26, gy); g.lineTo(sx + ((i % 2) - 0.5) * 30, gy - sh); g.lineTo(sx + 26, gy); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = s.c2; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 6, gy); g.lineTo(sx, gy - sh * 0.7); g.stroke();
      }
      break;
    }
    case 'cube': case 'meteor': case 'missileStrike': case 'gedo': case 'golem': {
      const drop = (1 - ease(pre)) * 900;
      const cy = gy - h * 0.5 - drop, cs = Math.min(w, h) * 0.55;
      if (s.style === 'cube') {
        g.fillStyle = '#16141c'; g.fillRect(x - cs, cy - cs, cs * 2, cs * 2);
        g.strokeStyle = '#c9a6ff'; g.lineWidth = 6; g.strokeRect(x - cs, cy - cs, cs * 2, cs * 2);
        g.strokeStyle = 'rgba(201,166,255,0.5)'; g.lineWidth = 3; g.strokeRect(x - cs * 0.7, cy - cs * 0.7, cs * 1.4, cs * 1.4);
      } else if (s.style === 'meteor') {
        g.globalCompositeOperation = 'lighter';
        for (let i = 1; i < 8; i++) glow(g, x + i * cs * 0.35 * dir, cy - i * cs * 0.5, cs * (1.2 - i * 0.1), '#ff7a2a', 0.5);
        g.globalCompositeOperation = 'source-over';
        const gr = g.createRadialGradient(x - cs * 0.3, cy - cs * 0.3, cs * 0.1, x, cy, cs);
        gr.addColorStop(0, '#9a7a5a'); gr.addColorStop(1, '#3a2a1a');
        g.fillStyle = gr; g.beginPath(); g.arc(x, cy, cs, 0, TAU); g.fill();
        g.fillStyle = 'rgba(30,20,10,0.6)';
        for (const [a, b, c] of [[-0.3, -0.2, 0.2], [0.35, 0.1, 0.15], [-0.1, 0.4, 0.12]]) { g.beginPath(); g.arc(x + a * cs, cy + b * cs, c * cs, 0, TAU); g.fill(); }
      } else if (s.style === 'missileStrike') {
        g.save(); g.translate(x, cy); g.rotate(Math.PI / 2); R.thrown(g, { x: 0, y: 0, vx: 1, vy: 0, r: cs * 0.5, owner: e.owner }, { shape: 'missile', size: 1 }, t); g.restore();
      } else {
        // Giant hand / fist slamming down.
        g.fillStyle = s.c1; g.strokeStyle = s.c2; g.lineWidth = 6;
        g.beginPath(); g.roundRect?.(x - cs, cy - cs * 0.8, cs * 2, cs * 1.6, cs * 0.3); if (!g.roundRect) g.rect(x - cs, cy - cs * 0.8, cs * 2, cs * 1.6); g.fill(); g.stroke();
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - cs + (i + 0.5) * cs * 0.5, cy + cs * 0.2); g.lineTo(x - cs + (i + 0.5) * cs * 0.5, cy + cs * 0.8); g.stroke(); }
      }
      if (post > 0) { g.globalCompositeOperation = 'lighter'; glow(g, x, gy - 20, w * (0.6 + post), s.impact || '#ffb07a', 1 - post); }
      break;
    }
    case 'blade': {
      // Giant translucent Susanoo sword sweeping down.
      const a = -2.2 + 2.4 * ease(Math.max(pre * 0.3, post * 2.5));
      g.save(); g.translate(x - dir * w * 0.3, gy - 40); g.scale(dir, 1); g.rotate(a);
      g.globalCompositeOperation = 'lighter';
      const L = h * 1.3;
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, s.c1); gr.addColorStop(1, s.c2);
      g.fillStyle = gr; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(0, -24); g.lineTo(L, -6); g.lineTo(L + 40, 0); g.lineTo(L, 6); g.lineTo(0, 24); g.closePath(); g.fill();
      glow(g, L * 0.5, 0, L * 0.6, s.c1, 0.4);
      g.restore();
      break;
    }
    case 'pillar': case 'kirin': case 'bifrost': {
      const k = post > 0 ? 1 - post * 0.5 : ease(pre) * 0.25;
      const top = gy - 1600, W = w * (s.style === 'kirin' ? 0.5 : 0.35) * k;
      g.globalCompositeOperation = 'lighter';
      if (s.style === 'bifrost') {
        const cols = ['#ff5a5a', '#ffb84a', '#ffe84a', '#7fff7a', '#5ad8ff', '#9a7aff'];
        cols.forEach((c, i) => { g.fillStyle = c; g.globalAlpha = 0.5 * fade; g.fillRect(x - W + i * W * 2 / 6, top, W * 2 / 6 + 1, gy - top); });
        g.globalAlpha = fade; g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, gy, w * 0.6, 26, 0, 0, TAU); g.stroke();
      } else if (post > 0 || pre > 0.5) {
        const seed = Math.floor(t * 30);
        glow(g, x, gy - 300, W * 6, s.glow, 0.6 * fade);
        for (let i = 0; i < (s.style === 'kirin' ? 5 : 3); i++) lightning(g, x + (i - 1) * W * 0.4, top, x + (i - 1) * W * 0.2, gy, s, seed + i * 11, s.style === 'kirin' ? 2.6 : 1.8);
        if (s.style === 'kirin') {
          // Dragon head of lightning at the strike point.
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = s.c1; g.globalAlpha = 0.7 * fade;
          g.beginPath(); g.moveTo(x - 140, gy - 260); g.lineTo(x + 160, gy - 200); g.lineTo(x + 40, gy - 120); g.lineTo(x - 120, gy - 140); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 60, gy - 210, 14, 0, TAU); g.fill();
        }
      }
      break;
    }
    case 'chibaku': {
      const k = ease(pre) * (1 - post * 0.3);
      g.globalCompositeOperation = 'source-over';
      const cy = gy - h * 0.6;
      glow(g, x, cy, w * 0.7 * k, '#000000', 0.8);
      g.fillStyle = '#05030a'; g.beginPath(); g.arc(x, cy, 40 * k, 0, TAU); g.fill();
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39 + t * (1 + i % 3), d = w * 0.5 * (1.2 - k * 0.8) + (i % 4) * 14;
        g.fillStyle = i % 2 ? '#5a4a3a' : '#7a6a5a';
        g.save(); g.translate(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8); g.rotate(a); g.fillRect(-12 - i % 3 * 6, -10, 24 + i % 3 * 12, 20); g.restore();
      }
      break;
    }
    case 'cross': {
      g.save(); g.translate(x, gy - h * 0.5);
      for (const k of [-1, 1]) { g.save(); g.rotate(k * 0.75); g.globalCompositeOperation = 'lighter'; g.fillStyle = s.c1; const L = h * 0.8 * ease(post * 3); g.fillRect(-L, -10, L * 2, 20); g.fillStyle = '#ffffff'; g.fillRect(-L, -4, L * 2, 8); g.restore(); }
      g.restore();
      break;
    }
    default: { // impact star with ground cracks (haymaker, ground slam)
      if (post > 0) {
        g.globalCompositeOperation = 'lighter';
        glow(g, x, gy - h * 0.4, w * 0.8, s.c1, 1 - post);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = '#2a2018'; g.lineWidth = 5;
        for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 7; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + Math.cos(a) * w * 0.7, gy + 8 + i % 2 * 6); g.stroke(); }
      }
    }
  }
  g.restore();
};

// Barrages: a storm of strikes in front of the attacker in its colours.
R.combo = (g, e, s, t) => {
  const o = e.owner;
  const cx = o.x + o.facing * 90, cy = o.y - 110;
  const seed = Math.floor(t * 24);
  const r = rng(seed + (e.id || 0));
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, cx, cy, 120 * (s.size || 1), s.glow || s.c1, 0.5);
  for (let i = 0; i < 4; i++) {
    const px = cx + (r() - 0.5) * 150, py = cy + (r() - 0.5) * 140;
    if (s.inner === 'orb') R.orb(g, e, s, t, { at: [px, py], r: 26, age: 1 });
    else if (s.inner === 'slash') { g.save(); g.translate(px, py); g.rotate(r() * TAU); crescent(g, 0, 0, 70 * (s.size || 1), -1, 1.4, 18, s.c1, s.c2 || '#ffffff'); g.restore(); }
    else if (s.inner === 'lightning') lightning(g, px - 60, py - 40, px + 60, py + 40, s, seed + i, 0.8);
    else { // fists / kicks: impact stars
      g.fillStyle = s.c1; g.beginPath();
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? 12 : 34; g.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
      g.fill(); glow(g, px, py, 30, '#ffffff', 1);
    }
  }
  g.restore();
};

// Traps sitting on the ground.
R.trap = (g, e, s, t) => {
  const x = e.x, y = e.y || 0, w = e.w || 140;
  const pop = ease(e.t / 0.25);
  g.save();
  switch (s.style) {
    case 'tag': {
      g.fillStyle = '#f2e8c8'; g.fillRect(x - 18, y - 52 * pop, 36, 52 * pop);
      g.fillStyle = '#c8282f'; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.fillText('爆', x, y - 20);
      g.globalCompositeOperation = 'lighter'; glow(g, x, y - 26, 40 + 8 * Math.sin(t * 12), '#ff7a2a', 0.5);
      break;
    }
    case 'hounds': {
      for (let i = 0; i < 3; i++) {
        const hx = x + (i - 1) * w * 0.35, hy = y - 40 * pop - Math.abs(Math.sin(t * 6 + i)) * 10;
        g.fillStyle = '#6a5a4a'; g.beginPath(); g.ellipse(hx, hy, 26, 20, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(hx - 18, hy - 12); g.lineTo(hx - 12, hy - 32); g.lineTo(hx - 4, hy - 16); g.fill();
        g.beginPath(); g.moveTo(hx + 18, hy - 12); g.lineTo(hx + 12, hy - 32); g.lineTo(hx + 4, hy - 16); g.fill();
        g.fillStyle = '#1a1a22'; g.fillRect(hx - 22, hy - 4, 44, 8);
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(hx, hy + 8, 5, 0, TAU); g.fill();
      }
      break;
    }
    case 'prison': case 'rods': {
      for (let i = 0; i < 6; i++) {
        const px = x + (i - 2.5) * w / 6, H = (s.style === 'rods' ? 150 : 180) * pop;
        g.fillStyle = s.c1; g.fillRect(px - 8, y - H, 16, H);
        g.strokeStyle = s.c2; g.lineWidth = 2; g.strokeRect(px - 8, y - H, 16, H);
      }
      if (s.style === 'prison') { g.fillStyle = s.c1; g.fillRect(x - w * 0.55, y - 180 * pop, w * 1.1, 14); }
      break;
    }
    case 'webnet': {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
      for (let i = 0; i <= 6; i++) { const px = x - w / 2 + i * w / 6; g.beginPath(); g.moveTo(px, y); g.lineTo(x, y - 30 * pop); g.stroke(); }
      g.beginPath(); g.ellipse(x, y - 4, w / 2, 10, 0, 0, TAU); g.stroke();
      break;
    }
    default: {
      g.fillStyle = 'rgba(220,220,230,0.6)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + (i - 2.5) * 30, y - 30 - Math.sin(t * 3 + i) * 10, 40, 0, TAU); g.fill(); }
    }
  }
  g.restore();
};

// Teleport flashes and other one-shot visuals (entities of kind 'visual').
R.warp = (g, e, s, t) => {
  const u = e.t / (e.life || 0.4), x = e.x, y = e.y;
  const out = /Out$/.test(e.fx);
  g.save();
  g.globalCompositeOperation = 'lighter';
  switch (s.warp || s.style) {
    case 'raijin': {
      glow(g, x, y, 200 * (1 - u), '#ffd84a', 1);
      g.strokeStyle = '#fff6c0'; g.lineWidth = 6 * (1 - u);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 260 * ease(u), y + Math.sin(a) * 260 * ease(u)); g.stroke(); }
      g.fillStyle = `rgba(255,216,74,${1 - u})`; g.font = 'bold 60px serif'; g.textAlign = 'center'; g.fillText('雷', x, y + 20);
      break;
    }
    case 'kamui': R.vortex(g, { ...e, r: 110, life: e.life, t: out ? e.t : e.life - e.t }, { ...s, absorb: false }, t); break;
    case 'instant': {
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,255,255,${(1 - u) * 0.8})`; g.fillRect(x - 60 + i * 24, y - 300 * (1 - u), 6, 600 * (1 - u)); }
      glow(g, x, y, 160 * (1 - u), '#ffe06a', 1);
      break;
    }
    case 'eye': {
      g.fillStyle = s.c1; g.globalAlpha = 1 - u;
      g.beginPath(); g.moveTo(x - 120 * (1 + u), y); g.quadraticCurveTo(x, y - 70, x + 120 * (1 + u), y); g.quadraticCurveTo(x, y + 70, x - 120 * (1 + u), y); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill();
      break;
    }
    case 'ripple': {
      for (let k = 0; k < 3; k++) { g.strokeStyle = s.c1; g.lineWidth = 6; g.globalAlpha = 1 - u; g.beginPath(); g.arc(x, y, 60 + (u + k * 0.2) * 220, 0, TAU); g.stroke(); }
      break;
    }
    case 'smoke': {
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) { const a = i * 0.7; g.fillStyle = `rgba(232,228,238,${(1 - u) * 0.85})`; g.beginPath(); g.arc(x + Math.cos(a) * 60 * ease(u), y + Math.sin(a) * 50 * ease(u), 55 * (0.6 + u), 0, TAU); g.fill(); }
      break;
    }
    default: glow(g, x, y, 160 * (1 - u), s.c1 || '#ffffff', 1);
  }
  g.restore();
};

// ---------- auras, shields, ghosts (around fighters) ----------

// Flaming aura behind a fighter for transformations and power-ups.
export function drawAura(g, f, s, t) {
  g.save();
  try { drawAuraInner(g, f, s, t); } catch (err) { console.error('drawAura', err); } finally { g.restore(); }
}

function drawAuraInner(g, f, s, t) {
  const x = f.x, y = f.y;
  const H = 210 * (s.size || 1);
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y - H * 0.45, H * 0.75, s.glow || s.c1, 0.55);
  if (s.style === 'susanoo') {
    // A translucent Susanoo construct towering over the fighter.
    g.globalAlpha = 0.55;
    const c = s.c1;
    g.fillStyle = c; g.strokeStyle = s.c2; g.lineWidth = 6;
    g.beginPath(); g.ellipse(x, y - 250, 110, 140, 0, 0, TAU); g.fill(); g.stroke();
    g.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x, y - 210 + i * 26, 70 + i * 6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.arc(x, y - 210 + i * 26, 70 + i * 6, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke(); }
    g.fillStyle = s.c2; g.beginPath(); g.ellipse(x, y - 360, 52, 60, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * 20, y - 365, 10, 5, 0, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  } else {
    // Rising flame tongues around the body.
    for (let i = 0; i < 14; i++) {
      const u = ((t * (s.speed || 2.4)) + i * 0.137) % 1;
      const px = x + Math.sin(i * 2.3) * 46 * (1 - u * 0.5), py = y - u * H;
      const rr = 34 * (1 - u * 0.6);
      const gr = g.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, s.c2 || '#ffffff'); gr.addColorStop(0.5, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.85 * (1 - u); g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rr * 0.7, rr * 1.4, 0, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    if (s.sparks) { const seed = Math.floor(t * 20); for (let i = 0; i < 2; i++) { const a = seed * 1.3 + i * 3; lightning(g, x + Math.cos(a) * 50, y - 100 + Math.sin(a) * 70, x + Math.cos(a) * 110, y - 100 + Math.sin(a) * 120, { c1: s.sparks, glow: s.sparks }, seed + i, 0.6); g.globalCompositeOperation = 'lighter'; } }
    if (s.marks) { g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#1e1400'; g.lineWidth = 4; g.globalAlpha = 0.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x, y - 110, 40 + i * 14, 0.3 + i, 1.1 + i); g.stroke(); } g.globalAlpha = 1; }
    if (s.tendrils) { g.globalCompositeOperation = 'source-over'; for (let i = 0; i < 4; i++) { g.strokeStyle = '#0a0a12'; g.lineWidth = 8; const a = i * 1.6 + t * 2; g.beginPath(); g.moveTo(x, y - 110); g.quadraticCurveTo(x + Math.cos(a) * 90, y - 110 + Math.sin(a) * 90, x + Math.cos(a + 0.6) * 130, y - 110 + Math.sin(a + 0.6) * 120); g.stroke(); } }
  }
  g.restore();
}

export function drawShield(g, f, s, t) {
  g.save();
  try { drawShieldInner(g, f, s, t); } catch (err) { console.error('drawShield', err); } finally { g.restore(); }
}

function drawShieldInner(g, f, s, t) {
  const x = f.x, y = f.y - 100, dir = f.facing;
  const k = f.shield ? Math.max(0.3, f.shield.hp / f.shield.max) : 1;
  g.save();
  switch (s.style) {
    case 'ribcage': {
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = s.c1; g.lineWidth = 10; g.globalAlpha = 0.75 * k;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x, y - 40 + i * 30, 90 + i * 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(x, y - 40 + i * 30, 90 + i * 8, -Math.PI * 0.9, -Math.PI * 0.1); g.stroke(); }
      g.lineWidth = 14; g.beginPath(); g.moveTo(x, y - 140); g.lineTo(x, y + 120); g.stroke();
      glow(g, x, y, 170, s.c1, 0.4 * k);
      break;
    }
    case 'wall': {
      const wx = x + dir * 90;
      g.fillStyle = s.c1; g.fillRect(wx - 30, y - 120, 60, 220);
      g.strokeStyle = s.c2; g.lineWidth = 4; g.strokeRect(wx - 30, y - 120, 60, 220);
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(wx - 30, y - 120 + i * 44); g.lineTo(wx + 30, y - 120 + i * 44 + 6); g.stroke(); }
      break;
    }
    case 'disc': {
      // Big front shield (Cap's shield, Madara's gunbai).
      g.translate(x + dir * 70, y); g.scale(0.45 * dir, 1);
      const R2 = 110;
      if (s.gunbai) { g.fillStyle = '#c8282f'; g.beginPath(); g.ellipse(0, -10, R2, R2 * 1.1, 0, 0, TAU); g.fill(); g.fillStyle = '#f4f2ea'; g.beginPath(); g.ellipse(0, -40, R2 * 0.6, R2 * 0.45, 0, 0, TAU); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(-8, 80, 16, 90); }
      else for (const [rr, c] of [[1, '#c8202f'], [0.78, '#f2f2f6'], [0.56, '#c8202f'], [0.36, '#2a5ad8']]) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, R2 * rr, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'lighter'; glow(g, 0, 0, R2 * 1.3, '#cfd8ff', 0.3);
      break;
    }
    default: {
      // Dome: webs, cubes, hex barriers, thunder, absorption.
      g.globalCompositeOperation = 'lighter';
      glow(g, x, y, 170, s.c1, 0.35 * k);
      g.strokeStyle = s.c1; g.lineWidth = 6; g.globalAlpha = 0.8 * k;
      g.beginPath(); g.arc(x, y, 130, 0, TAU); g.stroke();
      if (s.style === 'hex') for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t; g.beginPath(); for (let j = 0; j <= 6; j++) { const b = j * TAU / 6; g.lineTo(x + Math.cos(a) * 80 + Math.cos(b) * 28, y + Math.sin(a) * 80 + Math.sin(b) * 28); } g.stroke(); }
      if (s.style === 'web') for (let i = 0; i < 10; i++) { const a = i * TAU / 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 130, y + Math.sin(a) * 130); g.stroke(); }
      if (s.style === 'absorb') { R.vortex(g, { x: x + dir * 60, y, r: 80, t: 0.3, life: 1 }, { c1: s.c1, c2: s.c2, spin: 6 }, t); }
      if (s.style === 'thunder') for (let i = 0; i < 4; i++) { const a = Math.floor(t * 30) * 1.7 + i * 1.6; lightning(g, x + Math.cos(a) * 130, y + Math.sin(a) * 130, x + Math.cos(a + 0.8) * 130, y + Math.sin(a + 0.8) * 130, { c1: s.c1, glow: s.c1 }, Math.floor(t * 30) + i, 0.6); }
    }
  }
  g.restore();
}

// Charge-up at the hand during a wind-up (the Tailed Beast Bomb gathering and growing, etc.).
export function drawChargeVfx(g, f, s, t) {
  g.save();
  try { drawChargeVfxInner(g, f, s, t); } catch (err) { console.error('drawChargeVfx', err); } finally { g.restore(); }
}

function drawChargeVfxInner(g, f, s, t) {
  const c = f.cast, w = c.def.windup ?? 0.12;
  const k = Math.min(1, c.t / Math.max(0.05, w));
  const at = [f.x + f.facing * 70, f.y - 125];
  const r = (s.chargeR || 40) * (s.size || 1) * (0.15 + 0.85 * ease(k));
  g.save();
  // Chakra streaming in toward the hand.
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = s.rim || s.c2 || s.c1; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + t * 3, u = (t * 2.5 + i * 0.29) % 1, d = r * (3.2 - u * 2);
    g.globalAlpha = u * 0.8;
    g.beginPath(); g.moveTo(at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d); g.lineTo(at[0] + Math.cos(a) * (d - 40), at[1] + Math.sin(a) * (d - 40)); g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
  const rend = R[s.kind];
  if (s.kind === 'orb') R.orb(g, { x: at[0], y: at[1], t: 1 }, s, t, { at, r, age: 1 });
  else if (s.kind === 'lightning') R.lightning(g, { kind: 'charge', id: f.id }, s, t, { at, scale: 0.4 + 0.8 * k });
  else if (s.kind === 'flame') R.flame(g, { x: at[0], y: at[1], r: 30 }, s, t, { at, scale: 0.3 + 0.9 * k });
  else if (rend && s.kind === 'vortex') R.vortex(g, { t: 0.3, life: 1 }, s, t, { at, r: r * 1.5 });
}

// Main entry: draw an entity if it has a high-detail spec. Returns true when handled.
export function drawVfx(g, e, t) {
  g.save();
  try { return drawVfxInner(g, e, t); } catch (err) { console.error('vfx', e.fx, err); return true; } finally { g.restore(); }
}

function drawVfxInner(g, e, t) {
  let s = specFor(e.sig, e.fx);
  if (!s) return false;
  if (e.delay > 0 && e.kind !== 'strike') return true;
  let kind = s.kind;
  // Phasing is drawn on the fighter itself (ghost), not as a separate effect.
  if (e.kind === 'visual' && e.follow && s.ghost && e.life > 0.6) return true;
  if (e.kind === 'burst' && e.follow && s.ghost) return true;
  if (e.kind === 'visual') kind = 'warp';
  else if (e.kind === 'proj' && !['orb', 'lightning', 'flame', 'thrown', 'beam'].includes(kind)) kind = 'orb';
  else if (/Boom$|Hit$/.test(e.fx) && e.kind === 'burst') kind = s.boom || 'boom';
  else if (e.kind === 'beam' && kind !== 'beam') kind = 'beam';
  else if (e.kind === 'strike' && !['giant', 'slash'].includes(kind)) kind = 'giant';
  else if (e.kind === 'trap') kind = 'trap';
  else if (e.kind === 'burst' && !['shock', 'vortex', 'slash', 'orb'].includes(kind)) kind = 'shock';
  else if (e.owner?.cast?.def.prim === 'combo' && e.kind === 'rush') kind = 'combo';
  if (kind === 'boom') { drawBoom(g, e, s, t); return true; }
  const fn = R[kind];
  if (!fn) return false;
  if (kind === 'orb' && !s.c1) s = { ...s, c1: s.glow || '#ffffff', c2: '#ffffff', glow: s.glow || '#ffffff' };
  fn(g, e, s.burstSpec && e.kind === 'burst' ? { ...s, ...s.burstSpec } : s, t);
  return true;
}

// Explosions when projectiles detonate: a dome sized to the blast, in the ability's colours.
function drawBoom(g, e, s, t) {
  const u = Math.min(1, e.t / (e.life || 0.45));
  const r = (e.r || 160) * (s.boomSize || 1.2);
  const x = e.x, y = e.y;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const rr = r * ease(u * 1.6);
  glow(g, x, y, rr * 1.6, s.glow, 1 - u);
  if (s.dark) {
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(0,0,0,${1 - u})`); gr.addColorStop(0.8, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1 - u * 0.7; g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
  } else {
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, s.c2 || '#ffffff'); gr.addColorStop(0.85, s.c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1 - u * 0.8; g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
  }
  g.globalAlpha = 1 - u;
  g.strokeStyle = s.rim || s.c2 || '#ffffff'; g.lineWidth = 10 * (1 - u) + 2;
  g.beginPath(); g.arc(x, y, rr * 1.15, 0, TAU); g.stroke();
  // Ground-hugging dust wave.
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgba(150,130,110,${0.5 * (1 - u)})`;
  g.beginPath(); g.ellipse(x, 0, rr * 1.4, 30 + rr * 0.1, 0, Math.PI, TAU); g.fill();
  g.restore();
}
