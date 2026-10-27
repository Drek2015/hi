// Opening sequence and the pre-fight versus splash, drawn on the game canvas at full resolution.
import { spriteFor } from '../render/spriteset.js';

const FONT = '"Press Start 2P", monospace';
const INK = '#120a1a';

function art(char, skinId, state = 'idle') {
  const skin = char.skins.find(k => k.id === skinId) || char.skins[0];
  return spriteFor({ char, skin, state, form: null, cast: null });
}

function drawArt(ctx, a, x, y, height, flip = false, silhouette = false) {
  if (!a) return;
  const s = height / a.h;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(silhouette ? a.flash : a.img, -a.ax * s, -a.ay * s, a.img.width * s, a.img.height * s);
  ctx.restore();
}

function text(ctx, s, x, y, size, color, align = 'center', outline = Math.max(3, size * 0.14)) {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = outline; ctx.strokeStyle = INK;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function speedLines(ctx, W, H, t, color, alpha, n = 40) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const y = ((i * 97) % 100) / 100 * H;
    const len = W * (0.15 + ((i * 53) % 30) / 100);
    const x = ((i * 211 + t * W * 3) % (W + len)) - len;
    ctx.fillRect(W - x, y, len, Math.max(2, H / 300));
  }
  ctx.restore();
}

const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export class Intro {
  constructor(chars, audio) {
    this.chars = chars;
    this.audio = audio;
    this.t = 0;
    this.done = false;
    this.cued = new Set();
    this.waves = [];
    for (let i = 0; i < chars.length; i += 4) this.waves.push(chars.slice(i, i + 4));
    this.waveLen = 0.62;
    this.logoAt = 0.5 + this.waves.length * this.waveLen;
    this.length = this.logoAt + 1.8;
  }

  skip() { this.done = true; }

  cue(name, at, sound) { if (this.t >= at && !this.cued.has(name)) { this.cued.add(name); this.audio?.play(sound); } }

  update(dt) {
    this.t += dt;
    this.waves.forEach((_, i) => this.cue('w' + i, 0.5 + i * this.waveLen, 'dash'));
    this.cue('logo', this.logoAt, 'boom');
    this.cue('clash', this.logoAt + 0.35, 'fight');
    if (this.t > this.length) this.done = true;
  }

  draw(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height, t = this.t;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, W, H);
    // Opening scan line
    if (t < 0.5) {
      const k = ease(t / 0.45);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, H / 2 - 2, W * k, 4);
    }
    // Roster waves: four slanted bands, each with a fighter
    const wi = Math.floor((t - 0.5) / this.waveLen);
    if (t >= 0.5 && wi < this.waves.length) {
      const wt = (t - 0.5) - wi * this.waveLen;
      const wave = this.waves[wi];
      speedLines(ctx, W, H, t, '#ffffff', 0.15);
      wave.forEach((c, i) => {
        const delay = i * 0.06;
        const k = ease((wt - delay) / 0.18);
        const out = wt > this.waveLen - 0.12 ? ease((wt - (this.waveLen - 0.12)) / 0.12) : 0;
        const bw = W / wave.length;
        const x0 = i * bw;
        const slide = (1 - k) * H * 1.2 * (i % 2 ? -1 : 1) - out * H * 1.2 * (i % 2 ? 1 : -1);
        ctx.save();
        ctx.translate(0, slide);
        ctx.beginPath();
        ctx.moveTo(x0 + bw * 0.18, 0); ctx.lineTo(x0 + bw * 1.18, 0); ctx.lineTo(x0 + bw * 0.82, H); ctx.lineTo(x0 - bw * 0.18, H); ctx.closePath();
        ctx.fillStyle = c.color; ctx.globalAlpha = 0.9; ctx.fill();
        ctx.globalAlpha = 1; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.save(); ctx.clip();
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g; ctx.fillRect(x0 - bw, 0, bw * 3, H);
        drawArt(ctx, art(c), x0 + bw * 0.5, H * 0.86, H * 0.62);
        ctx.restore();
        text(ctx, (c.short || c.name).toUpperCase(), x0 + bw * 0.5, H * 0.93, Math.min(H * 0.045, bw * 0.09), '#ffffff');
        ctx.restore();
      });
      if (wt < 0.05) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, W, H); }
    }
    // Logo slam
    if (t >= this.logoAt) {
      const lt = t - this.logoAt;
      const shake = lt < 0.3 ? (1 - lt / 0.3) * H * 0.02 : 0;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // Lineup silhouettes behind the logo
      const n = this.chars.length;
      this.chars.forEach((c, i) => {
        const x = W * (0.06 + 0.88 * (i + 0.5) / n);
        const k = ease((lt - 0.15 - i * 0.03) / 0.3);
        drawArt(ctx, art(c), x, H * (1.02 + (1 - k) * 0.4), H * 0.34, i >= n / 2, false);
      });
      speedLines(ctx, W, H, t, '#ffd84a', 0.12, 30);
      const s = lt < 0.12 ? 3 - 2 * (lt / 0.12) : 1;
      ctx.save();
      ctx.translate(W / 2, H * 0.36); ctx.scale(s, s);
      text(ctx, 'OMNIVERSE', 6, 6, H * 0.12, '#c8361f', 'center', H * 0.02);
      text(ctx, 'OMNIVERSE', 0, 0, H * 0.12, '#ffd84a', 'center', H * 0.02);
      ctx.restore();
      if (lt > 0.35) {
        const k = ease((lt - 0.35) / 0.25);
        text(ctx, 'CLASH', W / 2 + (1 - k) * W, H * 0.53, H * 0.1, '#ffffff', 'center', H * 0.018);
      }
      if (lt < 0.18) { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - lt / 0.18)})`; ctx.fillRect(-W, -H, W * 3, H * 3); }
    }
    ctx.restore();
    if (t > 0.3) text(ctx, 'TAP TO SKIP', W - H * 0.04, H * 0.05, H * 0.025, 'rgba(255,255,255,0.6)', 'right', 3);
  }
}

// Pre-fight splash: both fighters slide in, VS slams, arena name.
export class Versus {
  constructor(p1, p1Skin, p2, p2Skin, arenaName, difficulty, audio) {
    Object.assign(this, { p1, p1Skin, p2, p2Skin, arenaName, difficulty, audio });
    this.t = 0; this.length = 2.1; this.done = false; this.cued = false;
  }

  skip() { this.done = true; }

  update(dt) {
    this.t += dt;
    if (!this.cued && this.t > 0.35) { this.cued = true; this.audio?.play('boom'); }
    if (this.t > this.length) this.done = true;
  }

  draw(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height, t = this.t;
    const out = t > this.length - 0.25 ? ease((t - (this.length - 0.25)) / 0.25) : 0;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1 - out;
    ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, W, H);
    const k = ease(t / 0.3);
    for (const [side, c, skin] of [[0, this.p1, this.p1Skin], [1, this.p2, this.p2Skin]]) {
      const dir = side ? 1 : -1;
      ctx.save();
      ctx.translate(dir * (1 - k) * W * 0.6, 0);
      ctx.beginPath();
      if (side) { ctx.moveTo(W * 0.56, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.44, H); }
      else { ctx.moveTo(0, 0); ctx.lineTo(W * 0.56, 0); ctx.lineTo(W * 0.44, H); ctx.lineTo(0, H); }
      ctx.closePath();
      ctx.fillStyle = c.color; ctx.fill();
      ctx.save(); ctx.clip();
      speedLines(ctx, W, H, t * (side ? -1 : 1), '#ffffff', 0.18, 30);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      drawArt(ctx, art(c, skin, 'victory'), side ? W * 0.76 : W * 0.24, H * 0.98, H * 0.82, side === 1);
      ctx.restore();
      text(ctx, (c.short || c.name).toUpperCase(), side ? W * 0.97 : W * 0.03, H * 0.1, H * 0.065, '#ffffff', side ? 'right' : 'left', H * 0.012);
      text(ctx, side ? 'CPU · ' + this.difficulty.toUpperCase() : 'PLAYER 1', side ? W * 0.97 : W * 0.03, H * 0.18, H * 0.03, '#ffd84a', side ? 'right' : 'left', 4);
      ctx.restore();
    }
    ctx.lineWidth = H * 0.012; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(W * 0.56, 0); ctx.lineTo(W * 0.44, H); ctx.stroke();
    if (t > 0.3) {
      const vt = t - 0.3;
      const s = vt < 0.12 ? 3 - 2 * (vt / 0.12) : 1 + Math.sin(vt * 10) * 0.02;
      ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.scale(s, s);
      text(ctx, 'VS', 0, 0, H * 0.2, '#ffd84a', 'center', H * 0.03);
      ctx.restore();
      if (vt < 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - vt / 0.15)})`; ctx.fillRect(0, 0, W, H); }
    }
    if (t > 0.6) text(ctx, this.arenaName.toUpperCase(), W / 2, H * 0.92, H * 0.035, '#ffffff', 'center', 5);
    ctx.restore();
  }
}
