// Draws a rigged, costumed fighter with cel shading, faces, hair, masks and transformation auras.
import { animate, solve } from './rig.js';
import { shade, mix, rgba, glowSprite, flameSprite } from './colors.js';

// Heroic arcade proportions: about eight heads tall, broad shoulders, narrow waist.
// arm/leg: [upper width, lower width]; bulge: how much muscles swell along each limb.
const BUILDS = {
  lean: { arm: [16, 13], leg: [24, 17], chest: 50, waist: 31, hipW: 14, shoulderW: 22, bulge: 0.22 },
  average: { arm: [18, 14], leg: [26, 18], chest: 55, waist: 33, hipW: 15, shoulderW: 24, bulge: 0.28 },
  muscular: { arm: [23, 17], leg: [29, 20], chest: 66, waist: 37, hipW: 16, shoulderW: 30, bulge: 0.36 },
  tall: { arm: [16, 13], leg: [24, 17], chest: 51, waist: 31, hipW: 14, shoulderW: 22, bulge: 0.22, torsoMul: 1.08 },
};

// Transformations change the costume and add an aura.
const FORMS = {
  kcm: { aura: '#ffb31a', glow: '#ffd84a', look: { top: '#ffb31a', topAccent: '#1e1400', bottom: '#ffb31a', shoes: '#ffb31a', markings: 'kcm', eyes: { type: 'kurama' }, cloak: { color: '#ffcf33', trim: '#1e1400', style: 'haori', flames: false, magatama: true } } },
  klm: { aura: '#ff9a1f', glow: '#ffcf33', look: { top: '#ffb31a', topAccent: '#1e1400', bottom: '#ffb31a', shoes: '#ffb31a', markings: 'kcm', eyes: { type: 'kurama' }, cloak: { color: '#ffc21a', trim: '#1e1400', style: 'haori', flames: true, magatama: true } } },
  sixpaths: { aura: '#ffd84a', glow: '#fff1a0', orbs: true, look: { markings: 'kcm', eyes: { type: 'sixpaths' }, cloak: { color: '#ffd84a', trim: '#1e1400', style: 'haori', magatama: true } } },
  baryon: { aura: '#ff3b5c', glow: '#ff8a5a', look: { eyes: { type: 'baryon' }, markings: 'baryon', hair: { style: 'narutoShort', color: '#ffb84a' } } },
  susanoo: { aura: '#9a6bff', construct: '#9a6bff' },
  susanooBlue: { aura: '#4fb6ff', construct: '#4fb6ff' },
  tenTails: { aura: '#d8d8f0', glow: '#ffffff', orbs: true, look: { eyes: { type: 'rinneSharingan' }, hair: { style: 'spikyWhite', color: '#f2f2f8' }, cloak: { color: '#f2f0e8', trim: '#1d1d24', style: 'robe', magatama: true } } },
  karma: { aura: '#9a5bff', glow: '#c9a6ff', look: { markings: 'karmaFull', eyes: { type: 'jougan', color: '#7fc6ff' }, horn: true } },
  fruit: { aura: '#ff5a5a', glow: '#ff9a9a', look: { skin: '#c9473f', horns: 'momoshikiBig', markings: 'otsutsuki' } },
  ssj: { aura: '#ffd84a', glow: '#fff1a0', look: { hair: { style: 'gokuSS', color: '#ffd84a' }, eyes: { type: 'normal', color: '#2fb8a0' } } },
  ssj2: { aura: '#ffd84a', glow: '#fff1a0', sparks: true, look: { hair: { style: 'gokuSS', color: '#ffe066' }, eyes: { type: 'normal', color: '#2fb8a0' } } },
  ssj3: { aura: '#ffd84a', glow: '#fff1a0', sparks: true, look: { hair: { style: 'goku3', color: '#ffd84a' }, eyes: { type: 'normal', color: '#2fb8a0' }, noBrows: true } },
  ssg: { aura: '#ff4a3a', glow: '#ff9a7a', look: { hair: { style: 'goku', color: '#d8302f' }, eyes: { type: 'normal', color: '#c8282f' } } },
  ssb: { aura: '#3fd0ff', glow: '#bff4ff', look: { hair: { style: 'gokuSS', color: '#33c6ff' }, eyes: { type: 'normal', color: '#33c6ff' } } },
  symbiote: { aura: '#2a2a40', glow: '#5a5a80', tendrils: true, look: { top: '#16161c', bottom: '#16161c', shoes: '#16161c', gloves: '#16161c', pattern: 'symbiote', mask: 'symbiote', emblem: 'whiteSpider', skin: '#16161c' } },
};

export const BUFF_AURA = {
  sage: '#ff9a3a', kaioken: '#ff2a2a', jougan: '#7fc6ff', sharingan: '#ff3a3a', spiderAura: '#ff4a5a', instantKill: '#f2c14e', kiAura: '#ffe06a',
};

export function resolveLook(f) {
  const base = f.skin.look;
  const form = f.form && FORMS[f.form];
  if (!form?.look) return base;
  return { ...base, ...form.look, hair: form.look.hair ? { ...base.hair, ...form.look.hair } : base.hair, eyes: form.look.eyes ? { ...base.eyes, ...form.look.eyes } : base.eyes };
}

// ---------- primitives ----------

// A limb with a muscle profile: swells near `peak` along its length, tapers to the joint.
// Shaded with a hard light band and a deep shadow side, which pixelates into arcade-style ramps.
function limb(ctx, a, b, wa, wb, color, flash, bulge = 0.25, peak = 0.35) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const col = flash ? mix(color, '#ffffff', flash) : color;
  const N = 6, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const sw = 1 + bulge * Math.exp(-((u - peak) ** 2) / 0.06);
    const w = (wa + (wb - wa) * u) * sw / 2;
    const cx = a.x + dx * u, cy = a.y + dy * u;
    L.push([cx + px * w, cy + py * w]); R.push([cx - px * w, cy - py * w]);
  }
  // Outline: front side, rounded cap at b, back side, rounded cap at a.
  const cap = (c, r, from) => { for (let k = 1; k < 8; k++) { const th = from + k * Math.PI / 8; ctx.lineTo(c.x + r * (ux * Math.cos(th) + px * Math.sin(th)), c.y + r * (uy * Math.cos(th) + py * Math.sin(th))); } };
  const ra = Math.hypot(L[0][0] - a.x, L[0][1] - a.y), rb = Math.hypot(L[N][0] - b.x, L[N][1] - b.y);
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
  cap(b, rb, Math.PI / 2 - Math.PI);
  ctx.lineTo(R[N][0], R[N][1]);
  for (let i = N - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  cap(a, ra, Math.PI / 2 + 0);
  ctx.closePath();
  const wmax = Math.max(wa, wb) * (1 + bulge) / 2;
  // Light comes from up-front, so the side facing up gets the highlight.
  const s = py < 0 ? 1 : -1;
  const g = ctx.createLinearGradient(a.x + px * wmax * s, a.y + py * wmax * s, a.x - px * wmax * s, a.y - py * wmax * s);
  g.addColorStop(0, shade(col, 0.38)); g.addColorStop(0.22, shade(col, 0.12));
  g.addColorStop(0.42, col); g.addColorStop(0.7, shade(col, -0.25));
  g.addColorStop(0.86, shade(col, -0.48)); g.addColorStop(1, shade(col, -0.55));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
}

function circle(ctx, x, y, r, color, stroke = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) ctx.stroke();
}

function foot(ctx, leg, color, flash) {
  const { ft } = leg;
  ctx.save();
  ctx.translate(ft.x, ft.y);
  const ang = leg.a2 * 0.35;
  ctx.rotate(-ang);
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.quadraticCurveTo(-10, 4, -5, 5);
  ctx.lineTo(20, 5);
  ctx.quadraticCurveTo(23, -4, 10, -9);
  ctx.closePath();
  ctx.fillStyle = flash ? mix(color, '#fff', flash) : color;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Torso as a tapered rounded shape between hip and neck.
// Torso in three-quarter view: pecs swell forward, lats taper into a narrow waist.
function torsoPath(ctx, j, chest, waist) {
  const a = j.torsoA;
  const ux = Math.sin(a), uy = -Math.cos(a);   // along the spine
  const px = Math.cos(a), py = Math.sin(a);    // across (front = +)
  const h = j.hip, n = j.neck;
  const L = Math.hypot(n.x - h.x, n.y - h.y);
  const P = (base, across, along) => [base.x + px * across + ux * along, base.y + py * across + uy * along];
  ctx.beginPath();
  ctx.moveTo(...P(h, waist * 0.5, 0));
  ctx.bezierCurveTo(...P(h, waist * 0.52, L * 0.4), ...P(n, chest * 0.62, -L * 0.3), ...P(n, chest * 0.38, -2));
  ctx.quadraticCurveTo(...P(n, 0, 10), ...P(n, -chest * 0.5, -4));
  ctx.bezierCurveTo(...P(n, -chest * 0.58, -L * 0.3), ...P(h, -waist * 0.55, L * 0.35), ...P(h, -waist * 0.5, 0));
  ctx.quadraticCurveTo(...P(h, 0, -10), ...P(h, waist * 0.5, 0));
  ctx.closePath();
}

function fillGrad(ctx, j, color, chest, flash) {
  const col = flash ? mix(color, '#ffffff', flash) : color;
  const a = j.torsoA, px = Math.cos(a), py = Math.sin(a);
  const c = { x: (j.hip.x + j.neck.x) / 2, y: (j.hip.y + j.neck.y) / 2 };
  const g = ctx.createLinearGradient(c.x + px * chest / 2, c.y + py * chest / 2, c.x - px * chest / 2, c.y - py * chest / 2);
  g.addColorStop(0, shade(col, 0.32)); g.addColorStop(0.25, shade(col, 0.1));
  g.addColorStop(0.5, col); g.addColorStop(0.78, shade(col, -0.28)); g.addColorStop(1, shade(col, -0.5));
  ctx.fillStyle = g;
}

// ---------- hair ----------
// Spikes: [angle from straight up (deg, + toward the face), length (head radii), width (deg)]
const HAIR = {
  naruto: { spikes: [[-140, 1.0, 26], [-115, 1.15, 26], [-90, 1.2, 28], [-62, 1.25, 28], [-35, 1.25, 28], [-8, 1.2, 26], [18, 1.05, 26], [42, 0.85, 24], [62, 0.6, 22]], fringe: [[70, 0.55], [92, 0.5], [112, 0.45]] },
  narutoShort: { spikes: [[-130, 0.75, 26], [-100, 0.85, 28], [-70, 0.9, 28], [-40, 0.95, 28], [-10, 0.9, 26], [20, 0.75, 24], [48, 0.55, 22]], fringe: [[72, 0.38], [95, 0.32]] },
  sasuke: { spikes: [[-165, 1.25, 30], [-140, 1.35, 30], [-115, 1.2, 28], [-85, 0.75, 26], [-55, 0.5, 24]], fringe: [[60, 0.95, 'long'], [85, 1.05, 'long'], [105, 0.75, 'long']], cap: 0.9 },
  sasukeLong: { spikes: [[-170, 1.2, 30], [-145, 1.3, 30], [-120, 1.15, 28], [-90, 0.7, 26]], fringe: [[55, 1.15, 'long'], [80, 1.35, 'long'], [102, 1.2, 'long']], cap: 0.92 },
  kakashi: { spikes: [[-75, 1.6, 26], [-50, 1.75, 28], [-25, 1.7, 26], [-100, 1.35, 26], [-128, 1.0, 26], [0, 1.35, 24], [25, 0.9, 22]], fringe: [[70, 0.35]], tilt: -0.35 },
  short: { spikes: [[-150, 0.6, 30], [-120, 0.7, 30], [-90, 0.72, 30], [-60, 0.7, 30], [-30, 0.62, 28], [0, 0.5, 26]], fringe: [[55, 0.35], [80, 0.3]] },
  spikyWhite: { spikes: [[-150, 1.0, 28], [-120, 1.2, 28], [-90, 1.25, 28], [-60, 1.15, 26], [-30, 0.95, 24], [0, 0.8, 22]], fringe: [[60, 0.6], [85, 0.55]] },
  boruto: { spikes: [[-150, 0.85, 26], [-120, 0.95, 28], [-92, 1.05, 28], [-62, 1.1, 28], [-32, 1.0, 26], [-5, 0.9, 24], [22, 0.7, 22]], fringe: [[60, 0.55], [82, 0.6], [104, 0.45]], tuft: true },
  borutoLong: { spikes: [[-165, 1.25, 30], [-140, 1.3, 30], [-112, 1.2, 28], [-85, 1.05, 28], [-55, 0.95, 26], [-25, 0.8, 24]], fringe: [[55, 0.8, 'long'], [80, 0.95, 'long'], [104, 0.85, 'long']] },
  momoshiki: { spikes: [[-170, 1.0, 34], [-140, 0.8, 32], [-110, 0.6, 30]], fringe: [[60, 0.75, 'long'], [85, 0.85, 'long'], [110, 0.7, 'long']], long: 2.4, cap: 0.95 },
  goku: { spikes: [[-155, 1.15, 34], [-125, 1.35, 34], [-95, 1.25, 32], [-60, 1.1, 30], [-25, 0.95, 28], [10, 1.0, 26], [40, 0.85, 24], [-185, 0.9, 30]], fringe: [[62, 0.75], [85, 0.7], [104, 0.55]] },
  gokuSS: { spikes: [[-140, 1.35, 30], [-110, 1.55, 30], [-80, 1.7, 30], [-50, 1.6, 30], [-20, 1.45, 28], [10, 1.25, 26], [38, 0.95, 24], [-165, 1.1, 28]], fringe: [[66, 0.6], [90, 0.5]], up: true },
  gokuUI: { spikes: [[-140, 1.1, 30], [-110, 1.25, 30], [-80, 1.35, 30], [-50, 1.3, 30], [-20, 1.15, 28], [10, 1.0, 26], [38, 0.8, 24]], fringe: [[66, 0.5]], up: true },
  goku3: { spikes: [[-120, 1.3, 30], [-90, 1.4, 30], [-60, 1.3, 28], [-30, 1.1, 26], [0, 0.9, 24]], fringe: [[64, 0.55]], long: 3.6 },
};

function drawHair(ctx, look, r, front, flash) {
  const st = HAIR[look.hair?.style];
  if (!st) return;
  const col = flash ? mix(look.hair.color, '#fff', flash) : look.hair.color;
  ctx.save();
  if (st.tilt) ctx.rotate(st.tilt);
  if (!front) {
    if (st.long) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.3);
      ctx.quadraticCurveTo(-r * 1.6, r * st.long * 0.5, -r * 0.7, r * st.long);
      ctx.lineTo(r * 0.1, r * st.long * 0.9);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.6, r * 0.2, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -r, 0, r * st.long);
      g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.25));
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    }
    // Spikes behind the skull.
    ctx.beginPath();
    for (const [deg, len0, wdeg] of st.spikes) {
      const len = len0 * 0.72;
      const a = (deg - 90) * Math.PI / 180, w = wdeg * 1.9 * Math.PI / 180;
      const bx1 = Math.cos(a - w / 2) * r * 0.7, by1 = Math.sin(a - w / 2) * r * 0.7;
      const bx2 = Math.cos(a + w / 2) * r * 0.7, by2 = Math.sin(a + w / 2) * r * 0.7;
      const tip = { x: Math.cos(a) * r * (0.92 + len), y: Math.sin(a) * r * (0.92 + len) };
      if (st.up) tip.y -= r * 0.25 * len;
      ctx.moveTo(bx1, by1);
      ctx.quadraticCurveTo((bx1 + tip.x) / 2 + Math.cos(a + 1.2) * 3, (by1 + tip.y) / 2 + Math.sin(a + 1.2) * 3, tip.x, tip.y);
      ctx.quadraticCurveTo((bx2 + tip.x) / 2, (by2 + tip.y) / 2, bx2, by2);
    }
    ctx.arc(0, -r * 0.04, r * 1.04, -Math.PI * 1.08, -Math.PI * 0.1, false);
    const g = ctx.createLinearGradient(-r, -r * 2, r, r);
    g.addColorStop(0, shade(col, 0.25)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    // Highlight strokes.
    ctx.strokeStyle = rgba('#ffffff', 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.2, r * 0.75, -Math.PI * 0.85, -Math.PI * 0.55); ctx.stroke();
  } else {
    {
      // Hair mass over the top of the skull down to the hairline.
      const cap = st.cap ?? 1.0;
      ctx.beginPath();
      ctx.arc(0, -r * 0.04, r * cap * 1.04, -Math.PI * 1.08, -Math.PI * 0.12);
      ctx.quadraticCurveTo(r * 0.55, -r * 0.42, r * 0.05, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.45, -r * 1.0, -r * 0.1);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -r * 1.1, 0, -r * 0.3);
      g.addColorStop(0, shade(col, 0.22)); g.addColorStop(1, shade(col, -0.15));
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    }
    // Fringe / bangs over the forehead.
    for (const [deg, len, kind] of st.fringe || []) {
      const a = (deg - 90) * Math.PI / 180;
      const base = { x: Math.cos(a) * r * 0.55, y: Math.sin(a) * r * 0.55 - r * 0.45 };
      const tip = { x: base.x + Math.cos(a + 0.9) * r * len, y: base.y + Math.sin(a + 0.9) * r * len * (kind === 'long' ? 1.6 : 1) };
      ctx.beginPath();
      ctx.moveTo(base.x - 5, base.y - 3);
      ctx.quadraticCurveTo(tip.x - 3, (base.y + tip.y) / 2, tip.x, tip.y);
      ctx.quadraticCurveTo(tip.x + 4, (base.y + tip.y) / 2, base.x + 6, base.y - 2);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.stroke();
    }

  }
  ctx.restore();
}

// ---------- eyes ----------
function eye(ctx, x, y, s, type, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0.4 * s, 4 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = type === 'byakugan' ? '#ecebf7' : '#ffffff';
  ctx.fill();
  // Heavy upper lid instead of a full outline: reads as an eye at pixel scale.
  ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(-4.4 * s, -1.6 * s); ctx.quadraticCurveTo(0, -4.6 * s, 4.6 * s, -2.4 * s); ctx.stroke();
  const iris = {
    normal: color || '#2a2a2a', sharingan: '#d8202a', mangekyo: '#d8202a', mangekyoBoth: '#d8202a', oneSharingan: color || '#2a2a2a',
    rinnegan: '#b9a3e8', rinneSharingan: '#c9b0f0', byakugan: null, jougan: color || '#7fc6ff', sage: '#ffcf33', kurama: '#ff8a1f',
    sixpaths: '#ffd84a', baryon: '#3fa2ff', ui: '#d8dde8',
  }[type] ?? (color || '#2a2a2a');
  if (iris) {
    ctx.beginPath(); ctx.ellipse(0.9 * s, 0.6 * s, 2.6 * s, 3.3 * s, 0, 0, Math.PI * 2); ctx.fillStyle = iris; ctx.fill();
  }
  ctx.fillStyle = '#111';
  if (type === 'sharingan' || type === 'oneSharingan' && false) {
    ctx.beginPath(); ctx.arc(0.8 * s, 0, 0.9 * s, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) { const a = i * 2.09; ctx.beginPath(); ctx.arc(0.8 * s + Math.cos(a) * 1.8 * s, Math.sin(a) * 1.8 * s, 0.55 * s, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'mangekyo' || type === 'mangekyoBoth') {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); const a = i * 2.09; ctx.moveTo(0.8 * s, 0); ctx.arc(0.8 * s, 0, 2.4 * s, a, a + 0.9); ctx.closePath(); ctx.fill(); }
  } else if (type === 'rinnegan' || type === 'rinneSharingan') {
    ctx.strokeStyle = '#4a3a7a'; ctx.lineWidth = 0.7;
    for (const rr of [0.7, 1.4, 2.1]) { ctx.beginPath(); ctx.arc(0.8 * s, 0, rr * s, 0, Math.PI * 2); ctx.stroke(); }
    if (type === 'rinneSharingan') for (let i = 0; i < 3; i++) { const a = i * 2.09; ctx.beginPath(); ctx.arc(0.8 * s + Math.cos(a) * 1.75 * s, Math.sin(a) * 1.75 * s, 0.4 * s, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'sage' || type === 'kurama' || type === 'sixpaths') {
    ctx.fillRect(-0.6 * s, -0.5 * s, 2.8 * s, 1 * s);
  } else if (type === 'jougan') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0.8 * s, -1.6 * s); ctx.lineTo(2 * s, 0); ctx.lineTo(0.8 * s, 1.6 * s); ctx.lineTo(-0.4 * s, 0); ctx.closePath(); ctx.fill();
  } else if (type === 'byakugan') {
    ctx.strokeStyle = rgba('#b8a8e0', 0.9); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-4 * s, -2 * s); ctx.lineTo(-6 * s, -4 * s); ctx.moveTo(4 * s, -1 * s); ctx.lineTo(6 * s, -3 * s); ctx.stroke();
  } else if (iris) {
    ctx.beginPath(); ctx.arc(1.1 * s, 0, 1.2 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(1.8 * s, -1.1 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- head ----------
function drawHead(ctx, j, look, flash, t, outline) {
  const r = 21;
  const skin = flash ? mix(look.skin, '#fff', flash) : look.skin;
  ctx.save();
  ctx.translate(j.head.x, j.head.y);
  ctx.rotate(j.headA);
  drawHair(ctx, look, r, false, flash);
  // Skull and jaw.
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.1);
  ctx.arc(0, -r * 0.05, r, Math.PI, 0.05);
  ctx.quadraticCurveTo(r * 1.05, r * 0.65, r * 0.45, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.2, r * 1.05, -r * 0.7, r * 0.55);
  ctx.closePath();
  const g = ctx.createLinearGradient(r, -r, -r, r);
  g.addColorStop(0, shade(skin, 0.18)); g.addColorStop(0.6, skin); g.addColorStop(1, shade(skin, -0.28));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  // Ear
  ctx.beginPath(); ctx.ellipse(-r * 0.3, r * 0.15, 4, 6, 0.2, 0, Math.PI * 2); ctx.fillStyle = shade(skin, -0.22); ctx.fill();

  const masked = look.mask === 'spider' || look.mask === 'ironSpider' || look.mask === 'symbiote' || look.mask === 'tobi' || look.mask === 'war';
  if (masked) drawMask(ctx, look, r, flash);
  else {
    const et = look.eyes?.type || 'normal';
    const back = et === 'oneSharingan' ? 'normal' : et;
    const frontT = et === 'oneSharingan' ? 'sharingan' : et;
    if (look.markings === 'sage') {
      ctx.fillStyle = rgba('#ff7a2a', 0.85);
      ctx.beginPath(); ctx.ellipse(r * 0.62, -r * 0.12, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    eye(ctx, r * 0.24, -r * 0.05, 0.95, back, look.eyes?.color);
    eye(ctx, r * 0.68, -r * 0.05, 1.1, frontT === 'normal' && look.eyes?.type === 'oneSharingan' ? 'sharingan' : frontT, look.eyes?.color);
    if (look.eyes?.type === 'oneSharingan' || look.scar) {
      ctx.strokeStyle = '#7a3a3a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(r * 0.62, -r * 0.55); ctx.lineTo(r * 0.7, r * 0.25); ctx.stroke();
      ctx.strokeStyle = '#1a1a22';
    }
    if (look.scarEye) { ctx.strokeStyle = '#8a3a3a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(r * 0.58, -r * 0.6); ctx.lineTo(r * 0.78, r * 0.15); ctx.stroke(); ctx.strokeStyle = '#1a1a22'; }
    if (!look.noBrows) {
      ctx.lineWidth = 2.2; ctx.strokeStyle = shade(look.hair?.color || '#222', -0.3);
      ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.42); ctx.lineTo(r * 0.92, -r * 0.36); ctx.stroke();
      ctx.strokeStyle = '#1a1a22';
    }
    if (look.whiskers) {
      ctx.lineWidth = 1.3; ctx.strokeStyle = shade(skin, -0.45);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * 0.4, r * (0.2 + i * 0.13)); ctx.lineTo(r * 0.78, r * (0.22 + i * 0.12)); ctx.stroke(); }
      ctx.strokeStyle = '#1a1a22';
    }
    if (look.markings === 'kcm' || look.markings === 'baryon') {
      ctx.lineWidth = 2; ctx.strokeStyle = look.markings === 'baryon' ? '#ff4a2a' : '#1e1400';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * 0.38, r * (0.2 + i * 0.14)); ctx.lineTo(r * 0.82, r * (0.24 + i * 0.12)); ctx.stroke(); }
      ctx.strokeStyle = '#1a1a22';
    }
    if (look.markings?.startsWith('karma') || look.markings === 'otsutsuki') {
      ctx.lineWidth = 1.8; ctx.strokeStyle = look.markings === 'otsutsuki' ? '#5a1010' : '#1a1030';
      ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.5); ctx.quadraticCurveTo(r * 0.5, r * 0.1, r * 0.3, -r * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.55); ctx.quadraticCurveTo(r * 0.85, r * 0.25, r * 0.8, -r * 0.2); ctx.stroke();
      ctx.strokeStyle = '#1a1a22';
    }
    // Mouth
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.58); ctx.lineTo(r * 0.82, r * 0.55); ctx.stroke();
    if (look.mask === 'kakashi') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.05);
      ctx.lineTo(r * 1.04, r * 0.08);
      ctx.quadraticCurveTo(r * 1.05, r * 0.7, r * 0.45, r * 0.98);
      ctx.quadraticCurveTo(-r * 0.2, r * 1.15, -r * 0.75, r * 0.6);
      ctx.closePath();
      ctx.fillStyle = flash ? mix('#24304f', '#fff', flash) : '#24304f';
      ctx.fill(); ctx.stroke();
    }
  }
  if (look.headband && !masked) {
    const band = flash ? mix(look.headband, '#fff', flash) : look.headband;
    ctx.save();
    ctx.rotate(look.eyes?.type === 'oneSharingan' ? 0 : 0);
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, -r * 0.42); ctx.lineTo(r * 1.0, -r * 0.5); ctx.lineTo(r * 1.0, -r * 0.82); ctx.lineTo(-r * 0.95, -r * 0.72); ctx.closePath();
    ctx.fillStyle = band; ctx.fill(); ctx.stroke();
    // Metal plate with an engraved swirl.
    ctx.beginPath(); ctx.rect(r * 0.3, -r * 0.86, r * 0.72, r * 0.42); ctx.fillStyle = '#c9d0dc'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r * 0.66, -r * 0.65, 3.2, 0.3, 5.6); ctx.stroke();
    ctx.lineWidth = 2.6;
    // Trailing tails at the back.
    ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.6);
    const sway = Math.sin(t * 6) * 4;
    ctx.quadraticCurveTo(-r * 1.6, -r * 0.4 + sway, -r * 2.1, -r * 0.1 + sway); ctx.lineTo(-r * 2.0, r * 0.1 + sway);
    ctx.quadraticCurveTo(-r * 1.5, -r * 0.2, -r * 0.95, -r * 0.45); ctx.closePath(); ctx.fillStyle = band; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  drawHair(ctx, look, r, true, flash);
  if (look.horns || look.horn) {
    ctx.fillStyle = flash ? '#fff' : '#f2efe8';
    const big = look.horns === 'momoshikiBig';
    const hornsAt = look.horn ? [[0.55, -0.9]] : [[0.25, -0.95], [0.7, -0.85]];
    for (const [hx, hy] of hornsAt) {
      ctx.beginPath(); ctx.moveTo(r * hx - 4, r * hy + 2); ctx.quadraticCurveTo(r * hx, r * hy - (big ? 26 : 14), r * hx + 7, r * hy - (big ? 30 : 16)); ctx.lineTo(r * hx + 5, r * hy + 3); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMask(ctx, look, r, flash) {
  const f = c => flash ? mix(c, '#fff', flash) : c;
  if (look.mask === 'tobi') {
    ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 1.02, r * 1.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = f('#ff8a1f'); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#a84a10';
    ctx.beginPath();
    for (let a = 0; a < 14; a += 0.2) { const rr = a * 1.25; const x = r * 0.62 + Math.cos(a) * rr, y = -r * 0.15 + Math.sin(a) * rr; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = '#1a1a22';
    ctx.beginPath(); ctx.arc(r * 0.62, -r * 0.15, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    return;
  }
  if (look.mask === 'war') {
    ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 1.02, r * 1.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = f('#f0eee6'); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (const [x, y] of [[0.1, -0.5], [0.5, 0.35], [0.0, 0.55]]) { ctx.beginPath(); ctx.arc(r * x, r * y, 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.8); ctx.lineTo(r * 0.6, -r * 0.3); ctx.lineTo(r * 0.75, r * 0.2); ctx.stroke();
    eye(ctx, r * 0.62, -r * 0.12, 0.95, look.eyes?.type || 'rinnegan');
    return;
  }
  // Spider masks cover the whole head.
  const base = look.mask === 'symbiote' ? '#16161c' : look.mask === 'ironSpider' ? '#c81f2a' : '#d6232c';
  ctx.beginPath(); ctx.ellipse(r * 0.12, r * 0.05, r * 1.05, r * 1.1, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(r, -r, -r, r);
  g.addColorStop(0, shade(f(base), 0.25)); g.addColorStop(1, shade(f(base), -0.3));
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  if (look.mask === 'spider' || look.mask === 'ironSpider') {
    ctx.strokeStyle = look.mask === 'ironSpider' ? rgba('#f2c14e', 0.9) : rgba('#2a0a0a', 0.75);
    ctx.lineWidth = 0.9;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.05, r * 0.28 * i, r * 0.3 * i, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); }
    for (let a = -1.4; a <= 1.4; a += 0.45) { ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.05); ctx.lineTo(r * 0.55 - Math.cos(a) * r * 1.3, r * 0.05 + Math.sin(a) * r * 1.3); ctx.stroke(); }
    ctx.strokeStyle = '#1a1a22';
  }
  // Big eye lenses.
  ctx.lineWidth = look.mask === 'symbiote' ? 1.5 : 3;
  for (const [x, w] of [[0.18, 0.62], [0.72, 0.78]]) {
    ctx.beginPath();
    if (look.mask === 'symbiote') { ctx.moveTo(r * (x - 0.3), -r * 0.05); ctx.lineTo(r * (x + 0.28), -r * 0.55); ctx.lineTo(r * (x + 0.22), r * 0.25); ctx.closePath(); }
    else ctx.ellipse(r * x, -r * 0.12, r * 0.24 * w * 1.4, r * 0.32, x > 0.5 ? -0.35 : 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#f4f7ff'; ctx.fill(); ctx.stroke();
  }
  ctx.lineWidth = 2.6;
}

// ---------- body extras ----------

function drawCloakBack(ctx, j, look, t, flash, swayV) {
  const c = look.cloak;
  if (!c) return;
  const col = flash ? mix(c.color, '#fff', flash) : c.color;
  const long = c.style === 'robe' ? 1.05 : c.style === 'poncho' ? 0.45 : c.style === 'cape' ? 0.95 : 0.75;
  const n = j.neck, h = j.hip;
  const len = 92 * long;
  const sway = Math.sin(t * 4) * 6 + swayV;
  ctx.beginPath();
  ctx.moveTo(n.x - 12, n.y + 4);
  ctx.quadraticCurveTo(h.x - 30 - sway * 0.5, h.y, h.x - 34 - sway, h.y + len);
  ctx.lineTo(h.x + 8 - sway * 0.6, h.y + len + 4);
  ctx.quadraticCurveTo(h.x + 6, h.y, n.x + 6, n.y + 6);
  ctx.closePath();
  const g = ctx.createLinearGradient(n.x, n.y, h.x - 30, h.y + len);
  g.addColorStop(0, shade(col, -0.05)); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  if (c.flames) hemFlames(ctx, h.x - 34 - sway, h.y + len, h.x + 8 - sway * 0.6, h.y + len + 4, c.trim);
  if (c.clouds) cloud(ctx, h.x - 18 - sway * 0.6, h.y + len * 0.45, 9, c.trim);
}

function hemFlames(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  ctx.fillStyle = color;
  const n = 6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    const ax = x1 + (x2 - x1) * a, ay = y1 + (y2 - y1) * a, bx = x1 + (x2 - x1) * b, by = y1 + (y2 - y1) * b;
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 - 2, ay - 22, (ax + bx) / 2 + 1, ay - 26);
    ctx.quadraticCurveTo((ax + bx) / 2 + 3, ay - 10, bx, by);
  }
  ctx.fill();
  ctx.restore();
}

function cloud(ctx, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x - s, y, s * 0.7, 0, Math.PI * 2); ctx.arc(x, y - s * 0.4, s * 0.85, 0, Math.PI * 2); ctx.arc(x + s, y, s * 0.7, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawCloakFront(ctx, j, look, flash) {
  const c = look.cloak;
  if (!c || c.style === 'cape') return;
  const col = flash ? mix(c.color, '#fff', flash) : c.color;
  const n = j.neck, h = j.hip;
  const a = j.torsoA, px = Math.cos(a), py = Math.sin(a);
  const long = c.style === 'robe' ? 100 : c.style === 'poncho' ? 30 : 70;
  ctx.beginPath();
  ctx.moveTo(n.x + px * 16, n.y + py * 16);
  ctx.lineTo(n.x - px * 16, n.y - py * 16);
  ctx.lineTo(h.x - px * 22, h.y - py * 22 + (c.style === 'poncho' ? -10 : long * 0.6));
  ctx.lineTo(h.x + px * 22 + 8, h.y + py * 22 + (c.style === 'poncho' ? -10 : long * 0.62));
  ctx.closePath();
  const g = ctx.createLinearGradient(n.x + px * 20, n.y, n.x - px * 20, n.y);
  g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.25));
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  if (c.style === 'robeOpen') {
    ctx.fillStyle = flash ? mix(look.skin, '#fff', flash) : look.skin;
    ctx.beginPath(); ctx.moveTo(n.x + px * 6, n.y + py * 6); ctx.lineTo(h.x + px * 4, h.y + py * 4); ctx.lineTo(n.x + px * 14, n.y + py * 14); ctx.closePath(); ctx.fill();
  }
  if (c.clouds) cloud(ctx, (n.x + h.x) / 2 + px * 4, (n.y + h.y) / 2 + 10, 7, c.trim);
  if (c.magatama) {
    ctx.fillStyle = '#1a1300';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(n.x + px * (12 - i * 6), n.y + py * (12 - i * 6) + 8, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (c.collar) {
    ctx.fillStyle = flash ? '#fff' : c.trim;
    ctx.beginPath(); ctx.moveTo(n.x - px * 14, n.y - 14); ctx.lineTo(n.x + px * 14, n.y - 10); ctx.lineTo(n.x + px * 10, n.y + 4); ctx.lineTo(n.x - px * 12, n.y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (c.flames && c.style !== 'poncho') hemFlames(ctx, h.x - px * 22, h.y + long * 0.6, h.x + px * 22 + 8, h.y + long * 0.62, c.trim);
}

function drawWaldoes(ctx, j, t, f) {
  // Four gold-and-red robotic legs from the upper back.
  const n = j.neck, base = { x: n.x - 10, y: n.y + 16 };
  ctx.save();
  ctx.lineCap = 'round';
  const active = f.state === 'cast' || f.state === 'attack' || f.state === 'air';
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const spread = (i % 2 ? 0.55 : 0.2) * side;
    const reach = active ? 1.2 : 0.85;
    const a1 = -Math.PI / 2 - 0.9 * side + spread + Math.sin(t * 3 + i) * 0.08;
    const k = { x: base.x + Math.cos(a1) * 42 * reach, y: base.y + Math.sin(a1) * 42 * reach };
    const a2 = a1 + 1.4 * side;
    const tip = { x: k.x + Math.cos(a2) * 48 * reach, y: k.y + Math.sin(a2) * 48 * reach };
    for (const [w, c] of [[7, '#1a1a22'], [5, '#c81f2a']]) {
      ctx.lineWidth = w; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(k.x, k.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.strokeStyle = '#f2c14e';
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(k.x, k.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    circle(ctx, k.x, k.y, 3.5, '#f2c14e', false);
  }
  ctx.restore();
}

function drawPattern(ctx, j, look) {
  if (look.pattern === 'spider' || look.pattern === 'ironSpider') {
    // Emblem on the chest.
    const a = j.torsoA, px = Math.cos(a), py = Math.sin(a);
    const cx = (j.neck.x * 0.65 + j.hip.x * 0.35) + px * 8, cy = (j.neck.y * 0.65 + j.hip.y * 0.35) + py * 8;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = look.pattern === 'ironSpider' ? '#f2c14e' : '#141418';
    ctx.beginPath(); ctx.ellipse(0, 0, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) for (const k of [-4, -1, 2, 5]) { ctx.beginPath(); ctx.moveTo(0, k * 0.6); ctx.lineTo(s * 8, k * 1.4 - 2); ctx.stroke(); }
    ctx.restore();
  } else if (look.pattern === 'symbiote') {
    const a = j.torsoA;
    const cx = (j.neck.x * 0.6 + j.hip.x * 0.4), cy = (j.neck.y * 0.6 + j.hip.y * 0.4);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = '#f4f4f8';
    ctx.beginPath(); ctx.ellipse(4, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(4 + s * 18, -18, 4 + s * 22, -8); ctx.lineTo(4 + s * 19, -9); ctx.quadraticCurveTo(4 + s * 14, -12, 4, -1); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, 4); ctx.quadraticCurveTo(4 + s * 16, 14, 4 + s * 18, 24); ctx.lineTo(4 + s * 15, 22); ctx.quadraticCurveTo(4 + s * 12, 14, 4, 6); ctx.fill(); }
    ctx.restore();
  }
}

function webLines(ctx, a, b, w) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len * w / 2, py = dx / len * w / 2;
  ctx.save();
  ctx.strokeStyle = rgba('#200808', 0.55);
  ctx.lineWidth = 0.8;
  for (let s = 0.2; s < 1; s += 0.25) {
    const x = a.x + dx * s, y = a.y + dy * s;
    ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.quadraticCurveTo(x + dx / len * 3, y + dy / len * 3, x - px, y - py); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}

function drawAura(ctx, j, color, t, strength = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = glowSprite(color, 128);
  const cx = (j.hip.x + j.neck.x) / 2, cy = (j.hip.y + j.neck.y) / 2;
  ctx.globalAlpha = 0.55 * strength;
  ctx.drawImage(glow, cx - 120, cy - 150, 240, 300);
  const fl = flameSprite(color);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ph = (t * 1.7 + i / n) % 1;
    const side = (i % 2 ? 1 : -1) * (14 + (i * 7) % 26);
    const x = cx + side + Math.sin(t * 5 + i) * 4;
    const y = j.hip.y + 60 - ph * 210;
    const s = (1 - ph) * 0.9 + 0.3;
    ctx.globalAlpha = (1 - ph) * 0.65 * strength;
    ctx.drawImage(fl, x - 18 * s, y - 50 * s, 36 * s, 72 * s);
  }
  ctx.restore();
}

function drawOrbs(ctx, j, t) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 8);
    const x = j.neck.x - 10 + Math.cos(a) * 60, y = j.neck.y + 10 + Math.sin(a) * 50 + Math.sin(t * 3 + i) * 2;
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
    g.addColorStop(0, '#5a5a6a'); g.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawConstruct(ctx, j, color, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.05;
  const cx = j.neck.x, cy = j.neck.y;
  ctx.drawImage(glowSprite(color, 128), cx - 170, cy - 200, 340, 420);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = shade(color, 0.4);
  ctx.lineWidth = 5;
  // Ribcage and skull of a towering chakra warrior.
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.ellipse(cx - 5, cy + 30 + i * 18, 70 - i * 6, 14, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx - 5, cy + 10); ctx.lineTo(cx - 5, cy + 120); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + 10, cy - 70, 42, 50, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = shade(color, 0.6);
  ctx.beginPath(); ctx.ellipse(cx + 26, cy - 76, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 30, cy - 110); ctx.quadraticCurveTo(cx - 10, cy - 150, cx + 10, cy - 118); ctx.stroke();
  ctx.restore();
}

function drawTendrils(ctx, j, t) {
  ctx.save();
  ctx.strokeStyle = '#121218';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45 + Math.sin(t * 4 + i) * 0.2;
    const sx = j.neck.x - 6, sy = j.neck.y + 30;
    ctx.lineWidth = 6 - i * 0.5;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + Math.cos(a) * 40 + Math.sin(t * 6 + i) * 10, sy + Math.sin(a) * 40, sx + Math.cos(a + 0.4) * 80, sy + Math.sin(a + 0.4) * 70);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- main ----------

export function drawFighter(ctx, f, opts = {}) {
  const t = opts.t ?? 0;
  const look = resolveLook(f);
  const build = { ...(BUILDS[look.build] || BUILDS.average) };
  const scale = look.small ? 0.92 : look.build === 'tall' ? 1.05 : 1;
  const p = opts.pose || animate(f, t);
  const j = solve(p, 1, build);
  const flash = opts.flash || 0;
  const form = f.form ? FORMS[f.form] : null;

  ctx.save();
  ctx.scale(f.facing * scale, scale);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (j.rot) { ctx.translate(0, -90); ctx.rotate(j.rot); ctx.translate(0, 90); }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#15151d';
  ctx.lineWidth = 2.6;

  // Auras behind the body.
  if (form?.aura) drawAura(ctx, j, form.aura, t, 1);
  else if (look.aura) drawAura(ctx, j, look.aura, t, 0.45);
  for (const b of f.buffs || []) if (!b.form && BUFF_AURA[b.aura]) drawAura(ctx, j, BUFF_AURA[b.aura], t + 0.37, 0.7);
  if (form?.construct) drawConstruct(ctx, j, form.construct, t);
  if (look.orbs || form?.orbs) drawOrbs(ctx, j, t);
  if (look.waldoes) drawWaldoes(ctx, j, t, f);
  if (form?.tendrils) drawTendrils(ctx, j, t);

  const top = look.top || look.skin;
  const sleeve = look.gi ? (look.top || look.skin) : top;
  const fore = look.gi || look.sleeves === 'short' ? look.skin : top;
  const hands = look.gloves || look.skin;
  const legs = look.bottom || '#333';
  const shoes = look.shoes || '#222';
  const cloak = look.cloak;
  const sleeveC = cloak && cloak.style !== 'cape' && cloak.style !== 'haori' ? cloak.color : sleeve;
  const swayV = -(f.vx || 0) * 0.01 * f.facing;

  drawCloakBack(ctx, j, look, t, flash, swayV);
  if (look.sword) {
    ctx.save();
    ctx.strokeStyle = '#15151d'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(j.hip.x - 26, j.hip.y + 6); ctx.lineTo(j.neck.x - 36, j.neck.y - 26); ctx.stroke();
    ctx.strokeStyle = '#5a4a7a'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(j.hip.x - 26, j.hip.y + 6); ctx.lineTo(j.neck.x - 36, j.neck.y - 26); ctx.stroke();
    ctx.restore();
  }
  if (look.gunbai) {
    ctx.save(); ctx.translate(j.neck.x - 26, j.neck.y + 40); ctx.rotate(-0.25); ctx.scale(0.75, 0.75);
    ctx.fillStyle = '#c8282f'; ctx.beginPath(); ctx.ellipse(0, -30, 26, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.ellipse(0, -40, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const { arm: [ua, fa], leg: [th, sh] } = build;
  // Back limbs (slightly darker for depth).
  ctx.save();
  ctx.filter = 'none';
  const dim = c => shade(c, -0.18);
  limb(ctx, j.armB.sh, j.armB.el, ua, ua * 0.82, dim(sleeveC), flash, build.bulge, 0.3);
  limb(ctx, j.armB.el, j.armB.hand, fa, fa * 0.7, dim(cloak?.style === 'robe' ? sleeveC : fore), flash, build.bulge * 0.8, 0.22);
  circle(ctx, j.armB.hand.x, j.armB.hand.y, 8, flash ? '#fff' : dim(hands));
  limb(ctx, j.legB.hip, j.legB.kn, th, th * 0.68, dim(legs), flash, build.bulge * 0.6, 0.3);
  limb(ctx, j.legB.kn, j.legB.ft, sh, sh * 0.62, dim(legs), flash, build.bulge, 0.28);
  foot(ctx, j.legB, dim(shoes), flash);
  ctx.restore();

  // Torso
  torsoPath(ctx, j, build.chest, build.waist);
  fillGrad(ctx, j, top, build.chest, flash);
  ctx.fill();
  ctx.stroke();
  // Costume details on the torso.
  ctx.save();
  torsoPath(ctx, j, build.chest, build.waist);
  ctx.clip();
  const a = j.torsoA, px = Math.cos(a), py = Math.sin(a), ux = Math.sin(a), uy = -Math.cos(a);
  if (look.topAccent && !look.gi && !look.pattern) {
    ctx.fillStyle = flash ? mix(look.topAccent, '#fff', flash) : look.topAccent;
    ctx.beginPath(); ctx.moveTo(j.neck.x - px * 30 - ux * 4, j.neck.y - py * 30 - uy * 4); ctx.lineTo(j.neck.x + px * 30 - ux * 4, j.neck.y + py * 30 - uy * 4);
    ctx.lineTo(j.neck.x + px * 30 - ux * 16, j.neck.y + py * 30 - uy * 16); ctx.lineTo(j.neck.x - px * 30 - ux * 16, j.neck.y - py * 30 - uy * 16); ctx.fill();
  }
  if (look.gi) {
    ctx.fillStyle = flash ? '#fff' : (look.top ? look.topAccent : look.skin);
    ctx.beginPath(); ctx.moveTo(j.neck.x - px * 2, j.neck.y - py * 2); ctx.lineTo(j.neck.x + px * 14, j.neck.y + py * 14); ctx.lineTo(j.neck.x + px * 4 - ux * 26, j.neck.y + py * 4 - uy * 26); ctx.closePath(); ctx.fill();
    if (!look.top) {
      ctx.strokeStyle = rgba('#8a5a3a', 0.6); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(j.neck.x + px * 6 - ux * 12, j.neck.y + py * 6 - uy * 12); ctx.lineTo(j.neck.x + px * 6 - ux * 34, j.neck.y + py * 6 - uy * 34); ctx.stroke();
    }
  }
  if (look.vest) {
    ctx.fillStyle = flash ? mix(look.vest, '#fff', flash) : look.vest;
    ctx.beginPath(); ctx.moveTo(j.neck.x - px * 18, j.neck.y - py * 18); ctx.lineTo(j.neck.x + px * 22, j.neck.y + py * 22); ctx.lineTo(j.hip.x + px * 20 - ux * 6, j.hip.y + py * 20 - uy * 6); ctx.lineTo(j.hip.x - px * 18, j.hip.y - py * 18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(look.vest, -0.4); ctx.lineWidth = 1.4;
    for (const k of [0.35, 0.55]) { ctx.strokeRect(j.hip.x + (j.neck.x - j.hip.x) * k + px * 4, j.hip.y + (j.neck.y - j.hip.y) * k - 4, 12, 9); }
  }
  if (look.pattern === 'spider') {
    ctx.fillStyle = flash ? '#fff' : '#1d3c9a';
    ctx.beginPath(); ctx.moveTo(j.hip.x - px * 30, j.hip.y - py * 30); ctx.lineTo(j.hip.x - px * 6 + ux * -4, j.hip.y); ctx.lineTo(j.neck.x - px * 14 - ux * 26, j.neck.y - uy * 26); ctx.lineTo(j.neck.x - px * 30, j.neck.y - py * 30); ctx.fill();
  }
  if (look.pattern === 'ironSpider') {
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(j.neck.x - px * 20, j.neck.y + 8); ctx.lineTo(j.hip.x + px * 4, j.hip.y - 10); ctx.lineTo(j.neck.x + px * 22, j.neck.y + 8); ctx.stroke();
  }
  // Muscle definition under tight clothing: pec line, sternum and ab rows, with a chest highlight.
  if (!flash) {
    const at = (k, o) => ({ x: j.hip.x + (j.neck.x - j.hip.x) * k + px * o, y: j.hip.y + (j.neck.y - j.hip.y) * k + py * o });
    const dark = rgba(shade(top, -0.6), 0.3);
    ctx.strokeStyle = dark; ctx.lineWidth = 2.2;
    const p0 = at(0.62, -14), p1 = at(0.6, 8), p2 = at(0.66, 26);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y + 4, p2.x, p2.y); ctx.stroke();
    const s0 = at(0.85, 8), s1 = at(0.2, 8);
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
    const hl = at(0.75, 14);
    ctx.fillStyle = rgba('#ffffff', 0.16);
    ctx.beginPath(); ctx.ellipse(hl.x, hl.y, 9, 5, a, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15151d';
  }
  ctx.restore();
  drawPattern(ctx, j, look);
  if (look.belt) {
    ctx.save();
    ctx.lineWidth = look.belt.rope ? 7 : 5;
    ctx.strokeStyle = flash ? '#fff' : look.belt.color;
    ctx.beginPath(); ctx.moveTo(j.hip.x - px * 16 + ux * 6, j.hip.y - py * 16 + uy * 6); ctx.lineTo(j.hip.x + px * 17 + ux * 6, j.hip.y + py * 17 + uy * 6); ctx.stroke();
    if (look.belt.rope) { ctx.beginPath(); ctx.arc(j.hip.x - px * 18 + ux * 6, j.hip.y + 4, 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  drawCloakFront(ctx, j, look, flash);

  // Front leg
  limb(ctx, j.legF.hip, j.legF.kn, th, th * 0.68, legs, flash, build.bulge * 0.6, 0.3);
  limb(ctx, j.legF.kn, j.legF.ft, sh, sh * 0.62, legs, flash, build.bulge, 0.28);
  if (look.pattern === 'spider') webLines(ctx, j.legF.hip, j.legF.kn, th);
  foot(ctx, j.legF, shoes, flash);

  drawHead(ctx, j, look, flash, t);

  // Front arm
  limb(ctx, j.armF.sh, j.armF.el, ua, ua * 0.82, sleeveC, flash, build.bulge, 0.3);
  limb(ctx, j.armF.el, j.armF.hand, fa, fa * 0.7, cloak?.style === 'robe' ? sleeveC : fore, flash, build.bulge * 0.8, 0.22);
  if (look.wristbands) limb(ctx, { x: j.armF.el.x + (j.armF.hand.x - j.armF.el.x) * 0.6, y: j.armF.el.y + (j.armF.hand.y - j.armF.el.y) * 0.6 }, j.armF.hand, fa * 0.95, fa * 0.9, look.wristbands, flash);
  if (look.pattern === 'spider') webLines(ctx, j.armF.sh, j.armF.el, ua);
  circle(ctx, j.armF.hand.x, j.armF.hand.y, 8.5, flash ? '#fff' : hands);
  if (look.palms && (f.state === 'cast' || f.state === 'guard')) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite('#c9a6ff', 64), j.armF.hand.x - 16, j.armF.hand.y - 16, 32, 32);
    ctx.restore();
    eye(ctx, j.armF.hand.x + 2, j.armF.hand.y, 0.6, 'rinnegan');
  }
  if (form?.sparks || f.status?.some(s => s.type === 'paralyze')) sparks(ctx, j, t, form?.sparks ? '#bff4ff' : '#9fe3ff');
  ctx.restore();
  return j;
}

function sparks(ctx, j, t, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    if (Math.sin(t * 37 + i * 11) < 0.2) continue;
    const cx = j.hip.x + Math.sin(t * 13 + i) * 30, cy = j.hip.y - 30 - Math.cos(t * 17 + i * 3) * 50;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) ctx.lineTo(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30);
    ctx.stroke();
  }
  ctx.restore();
}

// Render a fighter in a neutral pose onto its own canvas (select screen portraits).
export function drawPortrait(canvas, char, skin, { pose: poseName = 'stance', t = 0, zoom = 1.6, offsetY = 0 } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const f = { char, skin, facing: 1, state: poseName === 'victory' ? 'victory' : 'idle', stateT: 0, vx: 0, vy: 0, buffs: [], status: [], form: null };
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.98 + offsetY);
  ctx.scale(zoom * canvas.height / 400, zoom * canvas.height / 400);
  drawFighter(ctx, f, { t });
  ctx.restore();
}
