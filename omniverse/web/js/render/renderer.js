// Composites a World onto a canvas: camera, backdrop, fighters, entities, particles, screen effects.
// Everything is drawn at art resolution (one art pixel = UNIT world units, fighters ~100 px tall)
// into a low-res canvas, then scaled up with hard pixels.
import { arenaArt, buildStage, drawBackdrop } from './arenas.js';
import { drawEntity, fxInfo, ParticleSystem } from './fx.js';
import { glowSprite, rgba } from './colors.js';
import { UNIT } from './pixel.js';
import { drawSpriteFighter } from './spriteset.js';

const TARGET_ART_H = 400;   // art pixels tall; screens scale up by a whole number when they can

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.low = document.createElement('canvas');
    this.lctx = this.low.getContext('2d', { alpha: false });
    this.fxLow = document.createElement('canvas');
    this.fctx = this.fxLow.getContext('2d');
    this.cam = { x: 0, y: -280 };
    this.shake = 0;
    this.particles = new ParticleSystem();
    this.hitFlash = new Map();
    this.screenFlash = 0; this.screenFlashColor = '#ffffff';
    this.time = 0;
  }

  bind(world) {
    this.world = world;
    this.art = arenaArt(world.arena.theme);
    this.stage = buildStage(this.art, world.arena);
    this.particles = new ParticleSystem();
    this.hitFlash.clear();
    this.cam = { x: 0, y: -280 };
  }

  resizeLow() {
    const W = this.canvas.width, H = this.canvas.height;
    // Fixed art height; 1440-px phone screens get an exact 3x scale.
    const k = H / TARGET_ART_H;
    const lw = Math.round(W / k), lh = TARGET_ART_H;
    if (this.low.width !== lw || this.low.height !== lh) {
      this.low.width = this.fxLow.width = lw; this.low.height = this.fxLow.height = lh; this.vignette = null;
    }
    this.k = k;
  }

  updateCamera(dt) {
    const w = this.world, fs = w.fighters;
    const viewW = this.low.width * UNIT, viewH = this.low.height * UNIT;
    let tx = fs.reduce((s, f) => s + f.x, 0) / fs.length;
    // Ground sits near the bottom; rise only when someone is high up.
    let ty = Math.min(-viewH * 0.35, Math.min(...fs.map(f => f.y)) - 240 + viewH * 0.5 - 60);
    if (w.flash && w.flash.t < 0.7) tx = tx * 0.5 + w.flash.f.x * 0.5;
    const half = viewW / 2;
    if (viewW >= w.right - w.left + 500) tx = 0;
    else tx = Math.max(w.left - 250 + half, Math.min(w.right + 250 - half, tx));
    const k = 1 - Math.exp(-dt * 5);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  consumeEvents() {
    const P = this.particles;
    for (const e of this.world.events) {
      switch (e.type) {
        case 'hit': {
          const big = e.dmg > 70;
          const col = e.crit ? '#ffd23a' : '#fff4d8';
          P.burst(e.x, e.y, big ? 18 : 10, col, { kind: 'spark', speed: big ? 1300 : 900, size: big ? 18 : 12, life: 0.25 });
          P.add({ x: e.x, y: e.y, kind: 'ring', size: 10, size1: big ? 120 : 70, life: 0.22, color: col });
          P.add({ x: e.x, y: e.y, kind: 'glow', size: big ? 90 : 55, size1: 10, life: 0.15, color: col });
          P.text(e.x + (Math.random() - 0.5) * 40, e.y - 40, Math.round(e.dmg) + (e.crit ? '!' : ''), e.crit ? '#ffd23a' : '#ffffff', big || e.crit);
          this.hitFlash.set(e.f, 0.12);
          this.shake = Math.max(this.shake, Math.min(26, 4 + e.dmg * 0.12));
          break;
        }
        case 'guard': P.burst(e.f.x + e.f.facing * 40, e.f.y - 110, 8, '#8fd8ff', { kind: 'spark', speed: 700, size: 10, life: 0.2 }); P.add({ x: e.f.x + e.f.facing * 40, y: e.f.y - 110, kind: 'ring', size: 40, size1: 90, life: 0.2, color: '#8fd8ff' }); break;
        case 'parry': P.text(e.f.x, e.f.y - 230, 'PARRY', '#7fffd0', true); P.add({ x: e.f.x, y: e.f.y - 100, kind: 'ring', size: 30, size1: 200, life: 0.3, color: '#7fffd0' }); this.flashScreen('#7fffd0', 0.25); break;
        case 'guardBreak': P.text(e.f.x, e.f.y - 230, 'GUARD BREAK', '#ff7a5a', true); P.burst(e.f.x, e.f.y - 100, 20, '#8fd8ff', { kind: 'spark', speed: 1100, size: 14 }); this.shake = Math.max(this.shake, 16); break;
        case 'shieldHit': P.add({ x: e.x, y: e.y, kind: 'ring', size: 60, size1: 130, life: 0.2, color: '#9fe3ff' }); break;
        case 'counter': P.text(e.f.x, e.f.y - 230, 'COUNTER', '#ffd23a', true); this.flashScreen('#ffffff', 0.3); break;
        case 'burst': case 'strike': case 'rushImpact': case 'trap': case 'fizzle': {
          const fx = fxInfo(e.fx);
          const r = e.r || e.w || 90;
          P.burst(e.x, e.y, e.big ? 30 : 14, fx.color, { speed: e.big ? 1200 : 700, size: e.big ? 26 : 16, life: 0.45 });
          P.burst(e.x, e.y, 8, fx.color2 || fx.color, { kind: 'spark', speed: 1000, size: 14, life: 0.3 });
          if (e.type !== 'fizzle') P.add({ x: e.x, y: e.y, kind: 'ring', size: r * 0.3, size1: r * 1.3, life: 0.35, color: fx.color });
          if (e.type === 'strike' || e.big) { P.burst(e.x, e.y, 12, '#5a4a40', { kind: 'smoke', speed: 400, size: 30, size1: 70, life: 0.8, g: -100 }); this.shake = Math.max(this.shake, e.big ? 22 : 12); }
          break;
        }
        case 'clash': P.burst(e.x, e.y, 26, '#ffffff', { kind: 'spark', speed: 1500, size: 18 }); P.add({ x: e.x, y: e.y, kind: 'ring', size: 20, size1: 220, life: 0.35, color: '#ffffff' }); this.shake = Math.max(this.shake, 18); this.flashScreen('#ffffff', 0.25); break;
        case 'land': dust(P, e.f.x, e.f.y, e.v > 900 ? 10 : 5); break;
        case 'bounce': dust(P, e.f.x, e.f.y, 14); this.shake = Math.max(this.shake, 10); break;
        case 'jump': if (e.ground) dust(P, e.f.x, e.f.y, 5); else P.add({ x: e.f.x, y: e.f.y, kind: 'ring', size: 20, size1: 60, life: 0.2, color: '#ffffff', alpha: 0.6 }); break;
        case 'dash': for (let i = 0; i < 5; i++) P.add({ x: e.f.x - e.f.facing * i * 26, y: e.f.y - 90, kind: 'line', dx: -e.f.facing * 120, dy: (Math.random() - 0.5) * 40, life: 0.18, color: '#ffffff', w: 3 }); dust(P, e.f.x, e.f.y, 4); break;
        case 'teleport': case 'poof': {
          const x = e.f ? e.f.x : e.x, y = e.f ? e.f.y - 90 : e.y;
          P.burst(x, y, 14, '#e8e4ee', { kind: 'smoke', speed: 300, size: 30, size1: 60, life: 0.6 });
          break;
        }
        case 'transform': {
          const fx = fxInfo(e.form);
          P.add({ x: e.f.x, y: e.f.y - 100, kind: 'ring', size: 40, size1: 380, life: 0.5, color: fx.color });
          P.burst(e.f.x, e.f.y - 100, 40, fx.color, { speed: 1300, size: 22, life: 0.6 });
          this.flashScreen(fx.color, 0.35); this.shake = Math.max(this.shake, 14);
          break;
        }
        case 'shieldUp': P.add({ x: e.f.x, y: e.f.y - 100, kind: 'ring', size: 40, size1: 140, life: 0.3, color: fxInfo(e.fx).color }); break;
        case 'grab': P.text(e.target.x, e.target.y - 220, 'GRAB', '#ffffff'); break;
        case 'pull': P.add({ x: e.f.x, y: e.f.y - 100, kind: 'ring', size: 20, size1: 80, life: 0.2, color: '#ffffff' }); break;
        case 'ultimate': this.flashScreen(e.def.color || '#ffffff', 0.5); this.shake = Math.max(this.shake, 10); break;
        case 'ko': this.shake = Math.max(this.shake, 30); this.flashScreen('#ffffff', 0.6); break;
      }
    }
  }

  flashScreen(color, a) { this.screenFlashColor = color; this.screenFlash = Math.max(this.screenFlash, a); }

  statusFx(f, dt) {
    for (const s of f.status) {
      if (s.type === 'burn' && Math.random() < dt * 30) this.particles.add({ x: f.x + (Math.random() - 0.5) * 50, y: f.y - Math.random() * 160, vy: -160, kind: 'flame', size: 26, size1: 8, life: 0.4, color: '#ff7a2a' });
      if (s.type === 'paralyze' && Math.random() < dt * 14) this.particles.burst(f.x, f.y - 100, 2, '#bff4ff', { kind: 'spark', speed: 500, size: 10, life: 0.15 });
      if (s.type === 'slow' && Math.random() < dt * 8) this.particles.add({ x: f.x + (Math.random() - 0.5) * 60, y: f.y - Math.random() * 150, vy: 40, kind: 'glow', size: 10, size1: 2, life: 0.6, color: '#7a8aff' });
    }
  }

  // dt is real (unscaled) frame time; worldDt is the sim time that elapsed.
  render(dt, worldDt) {
    const w = this.world;
    this.resizeLow();
    const ctx = this.lctx, W = this.low.width, H = this.low.height;
    this.time += worldDt;
    const t = this.time;
    this.consumeEvents();
    w.events.length = 0;
    this.updateCamera(dt);
    for (const [f, v] of this.hitFlash) { const n = v - dt; if (n <= 0) this.hitFlash.delete(f); else this.hitFlash.set(f, n); }
    for (const f of [...w.fighters, ...w.clones]) this.statusFx(f, worldDt);
    this.particles.update(worldDt);

    const sh = this.shake;
    this.shake = Math.max(0, this.shake - dt * 70);
    const sx = Math.round((Math.random() - 0.5) * sh / UNIT), sy = Math.round((Math.random() - 0.5) * sh / UNIT);
    const cam = { x: Math.round(this.cam.x / UNIT) * UNIT, y: Math.round(this.cam.y / UNIT) * UNIT };
    // World point -> art pixel.
    const ox = Math.round(W / 2 - cam.x / UNIT) + sx, oy = Math.round(H / 2 - cam.y / UNIT) + sy;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackdrop(ctx, this.art, { x: cam.x - sx * UNIT * 0.6, y: cam.y - sy * UNIT * 0.6 }, W, H, t);
    ctx.drawImage(this.stage.img, ox + Math.round(this.stage.x0 / UNIT), oy + Math.round(this.stage.y0 / UNIT));

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(1 / UNIT, 1 / UNIT);
    this.art.floorAnim?.(ctx, w.left, w.right, t);

    // Shadows: flat dithered-looking ovals.
    for (const f of [...w.fighters, ...w.clones]) {
      const ground = groundBelow(w, f);
      const h = Math.max(0, ground - f.y);
      const s = Math.max(0.3, 1 - h / 700);
      ctx.fillStyle = rgba('#000000', 0.35 * s);
      const hw = Math.round(24 * s) * UNIT;
      ctx.fillRect(f.x - hw, ground - UNIT, hw * 2, UNIT * 3);
      ctx.fillRect(f.x - hw + UNIT * 3, ground - UNIT * 2, hw * 2 - UNIT * 6, UNIT * 5);
    }

    const back = [], front = [];
    for (const e of w.entities) (e.kind === 'trap' ? back : front).push(e);
    for (const e of back) drawEntity(ctx, e, t);
    ctx.restore();

    // Background done: scale it up with hard pixels, then draw fighters at full resolution so
    // the supplied sprite art keeps its exact pixels.
    const out = this.ctx, k = this.k;
    out.imageSmoothingEnabled = false;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);

    for (const f of [...w.clones, ...w.fighters]) {
      const px = (ox + f.x / UNIT) * k, py = (oy + f.y / UNIT) * k;
      let alpha = f.isClone ? 0.75 : 1;
      if (f.intangible > 0) alpha = 0.45 + Math.sin(t * 40) * 0.15;
      const aura = f.form ? fxInfo(f.form).color : null;
      if (aura) {
        out.globalCompositeOperation = 'lighter';
        out.globalAlpha = 0.45 + Math.sin(t * 9) * 0.1;
        out.drawImage(glowSprite(aura, 64), px - 70 * k, py - 130 * k, 140 * k, 150 * k);
        out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
      }
      drawSpriteFighter(out, f, px, py, k, { flash: this.hitFlash.has(f), alpha, t: f.animT });
    }

    // Effects layer at art resolution, scaled up over the fighters.
    const fx = this.fctx;
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, W, H);
    fx.save();
    fx.translate(ox, oy);
    fx.scale(1 / UNIT, 1 / UNIT);
    for (const f of w.fighters) if (f.shield) {
      const c = fxInfo(f.shield.fx).color;
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = 0.25 + 0.35 * (f.shield.hp / f.shield.max);
      fx.drawImage(glowSprite(c, 64), f.x - 144, f.y - 256, 288, 288);
      fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
    }
    for (const e of front) drawEntity(fx, e, t);
    this.particles.draw(fx);
    fx.restore();
    for (const f of w.fighters) if (f.shield) pixelRing(fx, Math.round(ox + f.x / UNIT), Math.round(oy + f.y / UNIT - 56), 64, fxInfo(f.shield.fx).color);
    if (w.flash && w.flash.t < 0.9) drawCutIn(fx, W, H, w.flash);
    if (this.screenFlash > 0) {
      fx.globalCompositeOperation = 'lighter';
      fx.fillStyle = rgba(this.screenFlashColor, Math.min(0.6, this.screenFlash));
      fx.fillRect(0, 0, W, H);
      fx.globalCompositeOperation = 'source-over';
      this.screenFlash -= dt * 2.5;
    }
    if (!this.vignette) this.vignette = makeVignette(W, H);
    fx.drawImage(this.vignette, 0, 0);
    out.drawImage(this.fxLow, 0, 0, this.canvas.width, this.canvas.height);
  }
}

// Midpoint circle: a crisp 1-px ring.
function pixelRing(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + a, cy + b, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

function dust(P, x, y, n) {
  for (let i = 0; i < n; i++) {
    const d = i % 2 ? 1 : -1;
    P.add({ x: x + d * 10, y: y - 6, vx: d * (150 + Math.random() * 250), vy: -40 - Math.random() * 80, kind: 'smoke', size: 12, size1: 34, life: 0.45, drag: 4, color: '#c8bca8' });
  }
}

// Nearest surface at or below the feet.
function groundBelow(w, f) {
  let g = Infinity;
  for (const p of w.platforms) if (f.x >= p.x1 && f.x <= p.x2 && p.y >= f.y - 1) g = Math.min(g, p.y);
  return g === Infinity ? 0 : g;
}

function drawCutIn(ctx, W, H, fl) {
  const u = fl.t / 0.9;
  const inK = Math.min(1, fl.t / 0.12), outK = u > 0.8 ? (1 - u) / 0.2 : 1;
  const k = inK * outK;
  ctx.save();
  ctx.fillStyle = rgba('#000000', 0.45 * k);
  ctx.fillRect(0, 0, W, H);
  const bandH = H * 0.2, y = H * 0.38;
  ctx.translate((1 - inK) * -W, 0);
  ctx.fillStyle = rgba(fl.color, 0.85 * k);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y - bandH * 0.25); ctx.lineTo(W, y + bandH * 0.75); ctx.lineTo(0, y + bandH); ctx.closePath(); ctx.fill();
  // Speed lines
  ctx.strokeStyle = rgba('#ffffff', 0.5 * k); ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const ly = y + ((i * 37) % bandH), lx = ((i * 211 + fl.t * 3000) % (W + 400)) - 200;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 220, ly - 20); ctx.stroke();
  }
  ctx.globalAlpha = k;
  ctx.font = `${Math.max(8, Math.round(bandH * 0.3 / 8) * 8)}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#120a1a';
  const tx = W / 2 + (u - 0.5) * 60;
  ctx.strokeText(fl.name.toUpperCase(), tx, y + bandH * 0.42);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(fl.name.toUpperCase(), tx, y + bandH * 0.42);
  ctx.restore();
}

function makeVignette(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  return c;
}
