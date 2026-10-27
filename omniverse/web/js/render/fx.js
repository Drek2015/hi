// Ability visuals and particles. Every entity `fx` id maps to a drawing style and palette.
import { glowSprite, flameSprite, rgba, shade } from './colors.js';

// fx id -> { style, color, color2 }
export const FX = {
  rasengan: { style: 'spiral', color: '#5fd0ff', color2: '#ffffff' },
  bigRasengan: { style: 'spiral', color: '#4fb6ff', color2: '#e8fbff', scale: 1.4 },
  planetary: { style: 'spiral', color: '#5fd0ff', color2: '#ffffff' },
  rasenshuriken: { style: 'shuriken', color: '#9fe8ff', color2: '#ffffff' },
  lavaShuriken: { style: 'shuriken', color: '#ff7a2a', color2: '#ffe0a0' },
  uzuhiko: { style: 'needle', color: '#bfe8ff', color2: '#ffffff' },
  lightningRasengan: { style: 'spiral', color: '#9fe3ff', color2: '#ffffff', sparks: true },
  tailedBomb: { style: 'darkOrb', color: '#3a1a40', color2: '#ff7ab0' },
  truthOrb: { style: 'darkOrb', color: '#121216', color2: '#9a9ab0' },
  karmaOrb: { style: 'darkOrb', color: '#2a0f40', color2: '#b98aff' },
  spiritBomb: { style: 'orb', color: '#8fe0ff', color2: '#ffffff', scale: 1 },
  ki: { style: 'orb', color: '#ffe06a', color2: '#ffffff' },
  chidori: { style: 'bolt', color: '#9fe3ff', color2: '#ffffff' },
  lightningBurst: { style: 'bolt', color: '#9fe3ff', color2: '#ffffff' },
  lightningHound: { style: 'bolt', color: '#9fe3ff', color2: '#ffffff', scale: 1.3 },
  purpleLightning: { style: 'bolt', color: '#b98aff', color2: '#ffffff' },
  kamuiRaikiri: { style: 'bolt', color: '#7ad7ff', color2: '#ffffff' },
  bolt: { style: 'bolt', color: '#bfeaff', color2: '#ffffff' },
  senbon: { style: 'needle', color: '#9fe3ff', color2: '#ffffff' },
  fireball: { style: 'fire', color: '#ff7a1a', color2: '#ffe28a' },
  lava: { style: 'fire', color: '#ff4a1a', color2: '#ffb84a' },
  amaterasu: { style: 'fire', color: '#2a0a1a', color2: '#7a1a3a', dark: true },
  blackSpikes: { style: 'spikes', color: '#1a0a14', color2: '#7a1a3a' },
  fireBeam: { style: 'beamFire', color: '#ff6a1a', color2: '#ffe28a' },
  fireBurst: { style: 'ring', color: '#ff7a1a', color2: '#ffe28a' },
  kamehameha: { style: 'beam', color: '#4fc4ff', color2: '#ffffff' },
  kamehamehaRed: { style: 'beam', color: '#ff4a4a', color2: '#ffe0e0' },
  lightningBeam: { style: 'beamBolt', color: '#9fe3ff', color2: '#ffffff' },
  indraArrow: { style: 'beam', color: '#a678ff', color2: '#f2e8ff' },
  susanooArrow: { style: 'needle', color: '#a678ff', color2: '#f2e8ff', scale: 1.6 },
  kunai: { style: 'blade', color: '#c9d0dc', color2: '#ffffff' },
  shuriken: { style: 'star', color: '#c9d0dc', color2: '#ffffff' },
  kamuiShuriken: { style: 'star', color: '#3a2a5a', color2: '#9ad8ff', scale: 1.6 },
  web: { style: 'web', color: '#f4f6fa', color2: '#ffffff' },
  webBall: { style: 'web', color: '#f4f6fa', color2: '#ffffff', scale: 1.3 },
  webLine: { style: 'web', color: '#f4f6fa', color2: '#ffffff', line: true },
  taserWeb: { style: 'web', color: '#bfeaff', color2: '#ffffff', sparks: true },
  chain: { style: 'blade', color: '#8a8f9a', color2: '#ffffff', line: true },
  symbiote: { style: 'tendril', color: '#14141c', color2: '#5a5a80' },
  wind: { style: 'crescent', color: '#c8f2ff', color2: '#ffffff' },
  waterDragon: { style: 'orb', color: '#3a8aff', color2: '#cfe8ff', scale: 1.1 },
  water: { style: 'ring', color: '#3a8aff', color2: '#cfe8ff' },
  rod: { style: 'blade', color: '#1a1622', color2: '#c9a6ff' },
  cube: { style: 'cube', color: '#16141c', color2: '#c9a6ff' },
  kamui: { style: 'vortex', color: '#1a1030', color2: '#ff9a4a' },
  shinra: { style: 'ring', color: '#e8e0ff', color2: '#ffffff' },
  chibaku: { style: 'vortex', color: '#3a3040', color2: '#c8c0e8' },
  genjutsu: { style: 'ring', color: '#ff2a3a', color2: '#ffd0d0' },
  timeStop: { style: 'ring', color: '#9a6bff', color2: '#e8dcff' },
  solarFlare: { style: 'ring', color: '#ffffff', color2: '#fffbe0', flash: true },
  planetary2: { style: 'ring', color: '#5fd0ff', color2: '#ffffff' },
  waldo: { style: 'ring', color: '#f2c14e', color2: '#ffffff' },
  impact: { style: 'ring', color: '#ffffff', color2: '#ffe8a0' },
  fist: { style: 'ring', color: '#ffe8a0', color2: '#ffffff' },
  dragonFist: { style: 'spiral', color: '#ffcf33', color2: '#fff6c0' },
  slash: { style: 'slash', color: '#e8f2ff', color2: '#ffffff' },
  slashBig: { style: 'slash', color: '#bfe8ff', color2: '#ffffff', scale: 1.8 },
  susanooSword: { style: 'slash', color: '#a678ff', color2: '#f2e8ff', scale: 2.4 },
  kirin: { style: 'pillar', color: '#bfeaff', color2: '#ffffff' },
  toad: { style: 'toad', color: '#c8501f', color2: '#ffd0a0' },
  paw: { style: 'paw', color: '#ff9a1f', color2: '#ffe08a' },
  woodSpikes: { style: 'spikes', color: '#7a5233', color2: '#c99a6a' },
  woodGolem: { style: 'slam', color: '#7a5233', color2: '#c99a6a' },
  gedo: { style: 'slam', color: '#6a5a7a', color2: '#b9a3e8' },
  explosiveTag: { style: 'tag', color: '#f2e8c8', color2: '#c8282f' },
  webTrap: { style: 'webTrap', color: '#f4f6fa', color2: '#ffffff' },
  hounds: { style: 'tag', color: '#8a7a6a', color2: '#2a2a2a' },
  smoke: { style: 'smoke', color: '#e8e8f0', color2: '#ffffff' },
  sage: { style: 'aura', color: '#ff9a3a' },
  kcm: { style: 'aura', color: '#ffb31a' }, kcmHeal: { style: 'aura', color: '#ffcf33' },
  ssj: { style: 'aura', color: '#ffd84a' }, ssj2: { style: 'aura', color: '#ffd84a' }, ssj3: { style: 'aura', color: '#ffd84a' },
  ssg: { style: 'aura', color: '#ff4a3a' }, ssb: { style: 'aura', color: '#3fd0ff' }, ui: { style: 'aura', color: '#d8e0ff' },
  kiAura: { style: 'aura', color: '#ffe06a' }, karma: { style: 'aura', color: '#9a5bff' }, baryon: { style: 'aura', color: '#ff3b5c' },
  susanoo: { style: 'aura', color: '#9a6bff' }, susanooBlue: { style: 'aura', color: '#4fb6ff' }, tenTails: { style: 'aura', color: '#d8d8f0' },
  sixpaths: { style: 'aura', color: '#ffd84a' },
  absorbPalm: { style: 'ring', color: '#c9a6ff', color2: '#ffffff' },
  // Minato / Madara
  raijin: { style: 'ring', color: '#ffd84a', color2: '#fff6c0' },
  gunbai: { style: 'ring', color: '#c8282f', color2: '#ffe0e0' },
  meteor: { style: 'darkOrb', color: '#5a3a2a', color2: '#ff9a4a', scale: 2.2 },
  // Iron Man
  repulsor: { style: 'orb', color: '#9fe8ff', color2: '#ffffff' },
  unibeam: { style: 'beam', color: '#9fe8ff', color2: '#ffffff' },
  laser: { style: 'beam', color: '#ff4a4a', color2: '#ffd0d0' },
  missile: { style: 'fire', color: '#ff8a3a', color2: '#ffe0a0' },
  flare: { style: 'ring', color: '#ff9a3a', color2: '#ffe0a0' },
  nanoBlade: { style: 'slash', color: '#ff5a5a', color2: '#ffe0e0' },
  nanoShield: { style: 'aura', color: '#ff5a3a' },
  nanoHeal: { style: 'aura', color: '#ffd84a' },
  thruster: { style: 'fire', color: '#7fd0ff', color2: '#ffffff' },
  arc: { style: 'aura', color: '#7fd0ff' },
  snap: { style: 'ring', color: '#ffd84a', color2: '#ffffff', flash: true },
  // Captain America
  shieldThrow: { style: 'star', color: '#d8283a', color2: '#2a5ad8', scale: 1.4 },
  vibranium: { style: 'ring', color: '#cfd8ff', color2: '#ffffff' },
  resolve: { style: 'aura', color: '#4f8aff' },
  // Thor
  mjolnir: { style: 'blade', color: '#9aa2b8', color2: '#ffffff', scale: 1.4 },
  stormbreaker: { style: 'blade', color: '#c87a3a', color2: '#bfeaff', scale: 1.8 },
  thunder: { style: 'pillar', color: '#bfeaff', color2: '#ffffff' },
  thunderClap: { style: 'ring', color: '#9fe3ff', color2: '#ffffff' },
  thunderAura: { style: 'aura', color: '#9fe3ff' },
  bifrost: { style: 'pillar', color: '#ff9af0', color2: '#9ff0ff' },
};

export function fxInfo(id) {
  if (!id) return { style: 'orb', color: '#ffffff', color2: '#ffffff' };
  if (FX[id]) return FX[id];
  const base = id.replace(/(Boom|Out|In|Hit)$/, '');
  return FX[base] || { style: 'ring', color: '#ffffff', color2: '#ffffff' };
}

// ---------- particles ----------

export class ParticleSystem {
  constructor() { this.p = []; this.texts = []; }

  add(o) { if (this.p.length < 1400) this.p.push({ life: 0.5, t: 0, vx: 0, vy: 0, g: 0, drag: 0, size: 10, size1: 0, color: '#fff', alpha: 1, kind: 'glow', rot: 0, vr: 0, ...o }); }

  burst(x, y, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const s = (o.speed ?? 600) * (0.35 + Math.random() * 0.65);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (o.life ?? 0.4) * (0.6 + Math.random() * 0.6), size: o.size ?? 10, size1: o.size1 ?? 0, color, g: o.g ?? 0, drag: o.drag ?? 3, kind: o.kind ?? 'glow' });
    }
  }

  text(x, y, str, color, big = false) {
    this.texts.push({ x, y, str, color, t: 0, life: 0.9, big });
  }

  update(dt) {
    for (const q of this.p) {
      q.t += dt;
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vy = q.vy * k + q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    }
    this.p = this.p.filter(q => q.t < q.life);
    for (const s of this.texts) { s.t += dt; s.y -= 90 * dt; }
    this.texts = this.texts.filter(s => s.t < s.life);
  }

  draw(ctx) {
    ctx.save();
    for (const q of this.p) {
      const u = q.t / q.life;
      const size = q.size + (q.size1 - q.size) * u;
      if (q.kind === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (1 - u) * 0.5 * q.alpha;
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, size, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = q.color; ctx.lineWidth = size * 0.3;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke();
      } else if (q.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - u) * q.alpha;
        ctx.strokeStyle = q.color; ctx.lineWidth = 6 * (1 - u) + 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, size, 0, Math.PI * 2); ctx.stroke();
      } else if (q.kind === 'line') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - u) * 0.8;
        ctx.strokeStyle = q.color; ctx.lineWidth = q.w ?? 3;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.dx, q.y + q.dy); ctx.stroke();
      } else if (q.kind === 'flame') {
        ctx.globalCompositeOperation = q.dark ? 'source-over' : 'lighter';
        ctx.globalAlpha = (1 - u) * 0.9;
        const img = flameSprite(q.color);
        ctx.drawImage(img, q.x - size / 2, q.y - size, size, size * 2);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - u) * q.alpha;
        const img = glowSprite(q.color, 64);
        ctx.drawImage(img, q.x - size, q.y - size, size * 2, size * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const s of this.texts) {
      const u = s.t / s.life;
      ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const sc = s.big ? 1.4 : 1;
      ctx.font = `${Math.round(36 * sc * (u < 0.1 ? 1 + (0.1 - u) * 5 : 1))}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#120a1a';
      ctx.strokeText(s.str, s.x, s.y);
      ctx.fillStyle = s.color;
      ctx.fillText(s.str, s.x, s.y);
    }
    ctx.restore();
  }
}

// ---------- entity drawing ----------

function lightning(ctx, x1, y1, x2, y2, color, width, jag = 22, depth = 0) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const n = Math.max(3, Math.floor(len / 30));
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (Math.random() - 0.5) * jag;
    ctx.lineTo(x1 + dx * t - dy / len * off, y1 + dy * t + dx / len * off);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function glow(ctx, x, y, r, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color, 128), x - r, y - r, r * 2, r * 2);
}

export function drawEntity(ctx, e, time) {
  const info = fxInfo(e.fx);
  const t = e.t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  switch (e.kind) {
    case 'beam': if (e.ex !== undefined) drawBeam(ctx, e, info, time); break;
    case 'strike': drawStrike(ctx, e, info, time); break;
    case 'trap': drawTrap(ctx, e, info, time); break;
    case 'proj': if (!(e.delay > 0)) drawProjectile(ctx, e, info, time); break;
    case 'rush': drawRush(ctx, e, info, time); break;
    case 'burst': drawBurst(ctx, e, info, time); break;
    default: drawVisual(ctx, e, info, time);
  }
  ctx.restore();
}

function drawProjectile(ctx, e, info, time) {
  const r = e.r * (info.scale ?? 1);
  const ang = Math.atan2(e.vy, e.vx);
  switch (info.style) {
    case 'spiral': case 'orb': {
      glow(ctx, e.x, e.y, r * 2.6, info.color, 0.9);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = info.color2; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(e.x, e.y, r * (0.4 + i * 0.16), e.spin + i * 1.6, e.spin + i * 1.6 + 2.2); ctx.stroke();
      }
      glow(ctx, e.x, e.y, r * 1.1, info.color2, 1);
      if (info.sparks) for (let i = 0; i < 2; i++) lightning(ctx, e.x, e.y, e.x + (Math.random() - 0.5) * r * 3, e.y + (Math.random() - 0.5) * r * 3, '#e8f8ff', 2, 10);
      break;
    }
    case 'darkOrb': {
      glow(ctx, e.x, e.y, r * 2.4, info.color2, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(e.x - r * 0.3, e.y - r * 0.3, r * 0.1, e.x, e.y, r);
      g.addColorStop(0, shade(info.color, 0.3)); g.addColorStop(1, info.color);
      ctx.fillStyle = g; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = info.color2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, e.spin, e.spin + 4); ctx.stroke();
      break;
    }
    case 'shuriken': {
      glow(ctx, e.x, e.y, r * 3.2, info.color, 0.8);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = info.color2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin * 1.6);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.quadraticCurveTo(r * 1.4, -r * 0.6, r * 2.4, 0); ctx.quadraticCurveTo(r * 1.2, -r * 0.05, 0, r * 0.3); ctx.fill();
      }
      ctx.restore();
      glow(ctx, e.x, e.y, r * 1.2, '#ffffff', 1);
      break;
    }
    case 'needle': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
      ctx.globalAlpha = 0.6; ctx.drawImage(glowSprite(info.color, 64), -r * 4, -r * 1.2, r * 6, r * 2.4);
      ctx.globalAlpha = 1; ctx.strokeStyle = info.color2; ctx.lineWidth = Math.max(2, r * 0.25);
      ctx.beginPath(); ctx.moveTo(-r * 3, 0); ctx.lineTo(r * 1.5, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'bolt': {
      glow(ctx, e.x, e.y, r * 2.4, info.color, 0.8);
      for (let i = 0; i < 4; i++) lightning(ctx, e.x - Math.cos(ang) * r * 2, e.y - Math.sin(ang) * r * 2, e.x + (Math.random() - 0.5) * r * 2, e.y + (Math.random() - 0.5) * r * 2, i ? info.color : info.color2, i ? 2 : 3.5, 14);
      break;
    }
    case 'fire': {
      for (let i = 0; i < 6; i++) {
        const k = i / 6;
        ctx.globalCompositeOperation = info.dark ? 'source-over' : 'lighter';
        ctx.globalAlpha = (1 - k) * 0.9;
        const img = flameSprite(i % 2 ? info.color : info.color2);
        const bx = e.x - Math.cos(ang) * r * k * 2.2, by = e.y - Math.sin(ang) * r * k * 2.2;
        const s = r * (1.8 - k) * (0.9 + Math.random() * 0.2);
        ctx.drawImage(img, bx - s / 2, by - s, s, s * 2);
      }
      break;
    }
    case 'blade': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = info.color; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.2, -r * 0.35); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 0.2, r * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (info.line) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.owner.x, e.owner.y - 110); ctx.stroke(); }
      break;
    }
    case 'star': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin * 2);
      glow(ctx, 0, 0, r * 2, info.color2, 0.4);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = info.color; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r * 1.1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'web': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba(info.color, 0.9); ctx.lineWidth = 2;
      if (info.line || e.pull) { ctx.beginPath(); ctx.moveTo(e.owner.x + e.owner.facing * 40, e.owner.y - 120); ctx.lineTo(e.x, e.y); ctx.stroke(); }
      ctx.save(); ctx.translate(e.x, e.y);
      for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.2, 0); ctx.stroke(); }
      for (const rr of [0.45, 0.85]) { ctx.beginPath(); ctx.arc(0, 0, r * rr, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      if (info.sparks) { ctx.globalCompositeOperation = 'lighter'; lightning(ctx, e.x - r, e.y, e.x + r, e.y, '#bfeaff', 2, 16); }
      break;
    }
    case 'tendril': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = info.color; ctx.lineCap = 'round';
      const ox = e.owner.x + e.owner.facing * 40, oy = e.owner.y - 120;
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 8 - i * 2;
        ctx.beginPath(); ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo((ox + e.x) / 2 + Math.sin(time * 12 + i) * 30, (oy + e.y) / 2 + Math.cos(time * 10 + i) * 30, e.x, e.y); ctx.stroke();
      }
      break;
    }
    case 'crescent': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
      ctx.globalAlpha = 0.85; ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.4, -1.3, 1.3); ctx.arc(-r * 0.6, 0, r * 1.2, 1.2, -1.2, true); ctx.fill();
      ctx.restore();
      break;
    }
    default:
      glow(ctx, e.x, e.y, r * 2, info.color, 1);
  }
}

function drawBeam(ctx, e, info, time) {
  const x1 = e.x, y1 = e.y, x2 = e.ex, y2 = e.ey;
  const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  const w = e.width * (0.85 + Math.sin(time * 40) * 0.08) * Math.min(1, e.grow * 1.4);
  const fade = Math.min(1, (e.life - e.t) / 0.15);
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang);
  ctx.globalAlpha = fade;
  if (info.style === 'beamBolt') {
    for (let i = 0; i < 4; i++) lightning(ctx, 0, 0, len, (Math.random() - 0.5) * 20, i ? info.color : info.color2, i ? 3 : 6, 40);
    ctx.drawImage(glowSprite(info.color, 128), -w, -w, w * 2, w * 2);
  } else if (info.style === 'beamFire') {
    for (let i = 0; i < 16; i++) {
      const k = (i / 16 + time * 2) % 1;
      const img = flameSprite(i % 2 ? info.color : info.color2);
      const s = w * (0.8 + k * 0.6);
      ctx.save(); ctx.translate(k * len, Math.sin(time * 20 + i) * 6); ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = fade * 0.8; ctx.drawImage(img, -s / 2, -s, s, s * 2); ctx.restore();
    }
  } else {
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    g.addColorStop(0, rgba(info.color, 0)); g.addColorStop(0.25, rgba(info.color, 0.85)); g.addColorStop(0.5, info.color2); g.addColorStop(0.75, rgba(info.color, 0.85)); g.addColorStop(1, rgba(info.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -w * 0.3); ctx.lineTo(len, -w / 2); ctx.arc(len, 0, w / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, w * 0.3); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = fade * 0.9;
    ctx.drawImage(glowSprite(info.color, 128), -w * 0.8, -w * 0.8, w * 1.6, w * 1.6);
    ctx.drawImage(glowSprite(info.color, 128), len - w, -w, w * 2, w * 2);
    // Spiral lines running along the beam.
    ctx.strokeStyle = rgba(info.color2, 0.6); ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let x = 0; x < len; x += 20) { const y = Math.sin(x * 0.03 - time * 30 + i * 2) * w * 0.32; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRush(ctx, e, info, time) {
  const o = e.owner;
  const x = e.x ?? o.x, y = e.y ?? o.y - 110;
  if (info.style === 'bolt') {
    glow(ctx, x, y, 70, info.color, 0.9);
    for (let i = 0; i < 6; i++) lightning(ctx, x, y, x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 140, i ? info.color : info.color2, i ? 2 : 3.5, 18);
  } else if (info.style === 'spiral') {
    glow(ctx, x, y, 80, info.color, 0.9);
    ctx.globalAlpha = 1; ctx.strokeStyle = info.color2; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x, y, 18 + i * 7, time * 22 + i * 1.6, time * 22 + i * 1.6 + 2.2); ctx.stroke(); }
    glow(ctx, x, y, 30, '#ffffff', 1);
  } else if (info.style === 'darkOrb') {
    glow(ctx, x, y, 90, info.color2, 0.7);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = info.color;
    ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
  } else {
    glow(ctx, x, y, 60, info.color, 0.8);
  }
  // Speed streaks behind the user.
  ctx.globalAlpha = 0.5; ctx.strokeStyle = info.color2 || '#fff'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { const yy = o.y - 40 - i * 36; ctx.beginPath(); ctx.moveTo(o.x - o.facing * 40, yy); ctx.lineTo(o.x - o.facing * (140 + i * 30), yy); ctx.stroke(); }
}

function drawBurst(ctx, e, info, time) {
  if (e.delay > 0) return;
  const u = Math.min(1, e.t / e.life);
  const r = e.r;
  switch (info.style) {
    case 'vortex': {
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) {
        ctx.rotate(time * 6 + i);
        ctx.globalAlpha = 0.5 * (1 - u * 0.6);
        ctx.strokeStyle = i % 2 ? info.color : info.color2; ctx.lineWidth = 6;
        ctx.beginPath();
        for (let a = 0; a < 9; a += 0.25) { const rr = r * (1 - a / 9); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9); }
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'bolt':
      glow(ctx, e.x, e.y, r * 1.3, info.color, 1 - u);
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; lightning(ctx, e.x, e.y, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, info.color2, 2.5, 18); }
      break;
    case 'spiral':
      for (let i = 0; i < 5; i++) {
        const a = time * 8 + i * 1.256;
        const x = e.x + Math.cos(a) * r * 0.6, y = e.y + Math.sin(a) * r * 0.6;
        glow(ctx, x, y, 40, info.color, 1 - u * 0.5);
      }
      glow(ctx, e.x, e.y, r * 0.6, info.color2, 0.8 * (1 - u));
      break;
    case 'aura':
      glow(ctx, e.x, e.y, r * (1 + u), info.color, 1 - u);
      break;
    case 'tendril':
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = info.color; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * 6.28 + time;
        ctx.lineWidth = 7; ctx.globalAlpha = 1 - u;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(e.x + Math.cos(a + 0.5) * r * 0.5, e.y + Math.sin(a + 0.5) * r * 0.5, e.x + Math.cos(a) * r * u * 1.2, e.y + Math.sin(a) * r * u * 1.2); ctx.stroke();
      }
      break;
    default: {
      // Shockwave ring with a hot core.
      glow(ctx, e.x, e.y, r * (0.6 + u * 0.7), info.color, (1 - u) * (info.flash ? 1 : 0.85));
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = info.color2; ctx.lineWidth = 10 * (1 - u) + 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * (0.3 + u * 0.8), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = info.color; ctx.lineWidth = 5 * (1 - u) + 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * (0.15 + u * 1.05), 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawStrike(ctx, e, info, time) {
  const pre = Math.min(1, e.t / Math.max(0.01, e.delay));
  const post = e.t > e.delay ? Math.min(1, (e.t - e.delay) / Math.max(0.1, e.life - e.delay)) : 0;
  const x = e.x, y = e.y, w = e.w, h = e.h, dir = e.dir || 1;
  // Telegraph on the ground.
  if (e.t < e.delay) {
    ctx.globalAlpha = 0.25 + pre * 0.35;
    ctx.fillStyle = info.color;
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
  const alpha = e.t < e.delay ? pre : 1 - post * 0.9;
  switch (info.style) {
    case 'pillar': {
      if (e.t < e.delay) { glow(ctx, x, y - h, 140, info.color, pre); break; }
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite(info.color, 128), x - w, y - h, w * 2, h);
      for (let i = 0; i < 5; i++) lightning(ctx, x + (Math.random() - 0.5) * 40, y - h - 200, x + (Math.random() - 0.5) * 60, y, i ? info.color : info.color2, i ? 4 : 10, 60);
      break;
    }
    case 'cube': {
      const drop = e.t < e.delay ? (1 - pre) * 600 : 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, alpha + 0.3);
      ctx.fillStyle = info.color; ctx.strokeStyle = info.color2; ctx.lineWidth = 3;
      ctx.fillRect(x - w / 2, y - h - drop, w, h); ctx.strokeRect(x - w / 2, y - h - drop, w, h);
      ctx.beginPath(); ctx.moveTo(x - w / 2, y - h - drop); ctx.lineTo(x - w / 2 + 30, y - h - 30 - drop); ctx.lineTo(x + w / 2 + 30, y - h - 30 - drop); ctx.lineTo(x + w / 2, y - h - drop); ctx.stroke();
      break;
    }
    case 'slash': {
      if (e.t < e.delay) break;
      ctx.globalAlpha = alpha;
      ctx.save(); ctx.translate(x, y - h / 2); ctx.scale(dir, 1);
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, rgba(info.color, 0)); g.addColorStop(0.5, info.color2); g.addColorStop(1, rgba(info.color, 0.2));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, -0.5, -1.2, 1.9); ctx.ellipse(-w * 0.06, h * 0.05, w * 0.42, h * 0.38, -0.5, 1.9, -1.2, true); ctx.fill();
      ctx.restore();
      break;
    }
    case 'spikes': {
      const k = e.t < e.delay ? 0 : Math.min(1, (e.t - e.delay) * 8);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
      ctx.fillStyle = info.color; ctx.strokeStyle = '#120a0a'; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const sx = x - w / 2 + (i + 0.5) * w / 7, sh = h * (0.5 + ((i * 37) % 10) / 20) * k;
        ctx.beginPath(); ctx.moveTo(sx - 18, y); ctx.lineTo(sx + (i % 2 ? 10 : -10), y - sh); ctx.lineTo(sx + 18, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'toad': {
      const drop = e.t < e.delay ? (1 - pre) * 900 : 0;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, alpha + 0.2);
      ctx.fillStyle = info.color; ctx.strokeStyle = '#2a0a00'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.4 - drop, w * 0.55, h * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd36a';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * w * 0.22, y - h * 0.78 - drop, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(x + s * w * 0.22 - 14, y - h * 0.78 - drop - 3, 28, 6); ctx.fillStyle = '#ffd36a'; }
      ctx.fillStyle = '#5a2a10'; ctx.fillRect(x - w * 0.5, y - h * 0.45 - drop, w, 22);
      break;
    }
    case 'paw': {
      ctx.globalAlpha = alpha;
      const reach = e.t < e.delay ? pre * 0.4 : 1;
      ctx.drawImage(glowSprite(info.color, 128), x - w / 2 - dir * 80, y - h - 40, w * reach + 160, h + 80);
      ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.ellipse(x + dir * w * 0.35 * reach, y - h * 0.5, w * 0.22, h * 0.48, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + dir * (w * 0.5 * reach + 20), y - h * 0.85 + i * h * 0.22, 26, 16, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'slam': {
      const drop = e.t < e.delay ? (1 - pre) * 500 : 0;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, alpha + 0.2);
      ctx.fillStyle = info.color; ctx.strokeStyle = '#1a0a0a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(x - w * 0.35, y - h - drop, w * 0.7, h * 0.85, 40); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(x - w * 0.35 + i * w * 0.18, y - h * 0.25 - drop, w * 0.15, h * 0.25, 18); ctx.fill(); ctx.stroke(); }
      break;
    }
    default:
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite(info.color, 128), x - w / 2, y - h, w, h);
  }
}

function drawTrap(ctx, e, info, time) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(1, e.t * 4) * (e.life - e.t < 0.5 ? (e.life - e.t) * 2 : 1);
  if (info.style === 'webTrap') {
    ctx.strokeStyle = info.color; ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(e.x, e.y - 6); ctx.lineTo(e.x + i * e.w / 6, e.y); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(e.x, e.y - 3, e.w / 2, 8, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (info.style === 'tag') {
    ctx.fillStyle = info.color; ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2;
    ctx.fillRect(e.x - 14, e.y - 34, 28, 34); ctx.strokeRect(e.x - 14, e.y - 34, 28, 34);
    ctx.fillStyle = info.color2; ctx.fillRect(e.x - 4, e.y - 30, 8, 26);
    if (Math.sin(time * 12) > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, e.x, e.y - 18, 30, '#ff5a3a', 0.6); }
  } else if (info.style === 'spikes' || info.style === 'blade') {
    ctx.fillStyle = info.color; ctx.strokeStyle = '#1a0a0a';
    for (let i = 0; i < 4; i++) { const sx = e.x - e.w / 2 + (i + 0.5) * e.w / 4; ctx.beginPath(); ctx.moveTo(sx - 8, e.y); ctx.lineTo(sx, e.y - 26); ctx.lineTo(sx + 8, e.y); ctx.fill(); ctx.stroke(); }
  } else {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, e.x, e.y - 10, e.w / 2, info.color, 0.6);
  }
}

function drawVisual(ctx, e, info, time) {
  const u = e.t / e.life;
  if (e.fx === 'smoke') {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3;
      ctx.globalAlpha = (1 - u) * 0.7;
      ctx.fillStyle = i % 2 ? '#f2f2f6' : '#d8d8e2';
      ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 40 * (0.5 + u), e.y + Math.sin(a) * 50 * (0.5 + u), 34 * (0.6 + u * 0.8), 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (info.style === 'vortex' || e.fx?.startsWith('kamui')) {
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.globalCompositeOperation = 'source-over';
    const r = (e.r || 100) * (e.fx.endsWith('Out') ? 1 - u : u < 0.5 ? u * 2 : 1);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(time * 8);
      ctx.globalAlpha = 0.45 * (1 - u * 0.5);
      ctx.strokeStyle = i % 2 ? '#2a1a40' : '#ff9a4a'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let a = 0; a < 8; a += 0.3) { const rr = r * (1 - a / 8); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (info.style === 'web' && e.fx === 'webZipOut') return;
  glow(ctx, e.x, e.y, (e.r || 90) * (1 + u * 0.5), info.color || '#fff', (1 - u) * 0.8);
  ctx.globalAlpha = 1 - u;
  ctx.strokeStyle = info.color2 || '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(e.x, e.y, 60 + u * 80, 0, Math.PI * 2); ctx.stroke();
}
