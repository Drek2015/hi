// In-fight HUD, drawn on the game canvas in the same chunky pixel style as the art.
import { spriteFor } from '../render/spriteset.js';

const FONT = '"Press Start 2P", monospace';
const INK = '#120c1a';

export class Hud {
  constructor() {
    this.trail = [1, 1];        // delayed red damage bar
    this.bannerT = 0;
    this.banner = null;
    this.lastPhase = null;
  }

  // Show a big centred banner for a moment.
  flash(text, color = '#ffffff', time = 1.1) { this.banner = { text, color, time, t: 0 }; }

  update(dt, world, player) {
    world.fighters.forEach((f, i) => {
      const r = f.hp / f.maxHp;
      this.trail[i] = r < this.trail[i] ? Math.max(r, this.trail[i] - dt * 0.35) : r;
    });
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.time) this.banner = null; }
    if (world.phase !== this.lastPhase) {
      const ph = world.phase;
      if (ph === 'intro') this.flash(`ROUND ${world.round}`, '#ffd84a', 1.4);
      if (ph === 'fight') this.flash('FIGHT!', '#ff5a3a', 0.9);
      if (ph === 'ko') this.flash('K.O.', '#ff3a3a', 2.2);
      if (ph === 'timeup') this.flash('TIME', '#ffd84a', 2.2);
      if (ph === 'matchEnd') this.flash(world.matchWinner === player ? 'YOU WIN' : 'YOU LOSE', world.matchWinner === player ? '#ffd84a' : '#8a9aff', 99);
      this.lastPhase = ph;
    }
  }

  draw(ctx, world, player, opts = {}) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const u = Math.max(1, Math.round(H / 400));       // one art pixel in screen pixels
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    world.fighters.forEach((f, i) => this.side(ctx, f, i, world, u, W));
    // Timer
    const time = Math.max(0, Math.ceil(world.timer));
    box(ctx, W / 2 - 22 * u, 6 * u, 44 * u, 26 * u, u);
    text(ctx, String(time).padStart(2, '0'), W / 2, 11 * u, 16 * u, time <= 10 ? '#ff5a3a' : '#ffffff', 'center', u);
    // Player's abilities
    if (opts.showSlots) this.slots(ctx, world.fighters[player], u, W, H);
    // Combo counters
    world.fighters.forEach((f, i) => {
      if (f.combo >= 2) {
        const x = i === 0 ? 14 * u : W - 14 * u;
        text(ctx, `${f.combo} HITS`, x, 74 * u, 12 * u, '#ffd84a', i === 0 ? 'left' : 'right', u);
        text(ctx, `${Math.round(f.comboDmg)} DMG`, x, 90 * u, 7 * u, '#ffffff', i === 0 ? 'left' : 'right', u);
      }
    });
    if (this.banner) {
      const b = this.banner;
      const pop = Math.min(1, b.t / 0.12);
      const size = Math.round((b.text.length > 6 ? 26 : 34) * u * (0.6 + 0.4 * pop) / u) * u;
      ctx.globalAlpha = b.time - b.t < 0.25 ? Math.max(0, (b.time - b.t) / 0.25) : 1;
      text(ctx, b.text, W / 2, H * 0.36, size, b.color, 'center', u * 2);
      ctx.globalAlpha = 1;
    }
    if (opts.fps) text(ctx, `${opts.fps} FPS`, W / 2, H - 14 * u, 6 * u, '#9fe3a0', 'center', u);
    ctx.restore();
  }

  side(ctx, f, i, world, u, W) {
    const left = i === 0;
    const pw = 34 * u, barW = Math.min(170 * u, W * 0.36);
    const x0 = left ? 8 * u : W - 8 * u - pw;
    // Portrait
    box(ctx, x0, 6 * u, pw, pw, u, f.char.color);
    const a = spriteFor({ char: f.char, skin: f.skin, form: f.form, state: 'idle' });
    if (a) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 + u, 7 * u, pw - 2 * u, pw - 2 * u); ctx.clip();
      const s = (pw * 1.9) / (a.h * 1.0);
      const w = a.img.width * s, h = a.img.height * s;
      ctx.translate(x0 + pw / 2, 7 * u - (a.ay - a.h) * s);
      if (!left) ctx.scale(-1, 1);
      ctx.drawImage(a.img, -a.ax * s, 0, w, h);
      ctx.restore();
    }
    const bx = left ? x0 + pw + 4 * u : x0 - 4 * u - barW;
    // Name
    text(ctx, f.char.name.toUpperCase(), left ? bx : bx + barW, 6 * u, 6 * u, '#ffffff', left ? 'left' : 'right', u);
    // HP
    const hp = f.hp / f.maxHp;
    bar(ctx, bx, 14 * u, barW, 10 * u, u, [[this.trail[i], '#c8283a'], [hp, hp > 0.3 ? '#ffd84a' : '#ff6a3a']], !left);
    // Energy and ultimate
    bar(ctx, bx, 26 * u, barW * 0.7, 5 * u, u, [[f.energy / 100, '#4fb6ff']], !left);
    const ultFull = f.ult >= 100;
    bar(ctx, left ? bx : bx + barW * 0.3, 33 * u, barW * 0.7, 5 * u, u, [[f.ult / 100, ultFull ? (Math.floor(world.time * 6) % 2 ? '#ffffff' : '#ff4af0') : '#c84aff']], !left);
    if (ultFull) text(ctx, 'ULT', left ? bx + barW * 0.7 + 4 * u : bx + barW * 0.3 - 4 * u, 32 * u, 6 * u, '#ff4af0', left ? 'left' : 'right', u);
    // Round wins
    for (let r = 0; r < world.roundsToWin; r++) {
      const px = left ? bx + r * 9 * u : bx + barW - (r + 1) * 9 * u + 2 * u;
      ctx.fillStyle = INK; ctx.fillRect(px, 41 * u, 7 * u, 7 * u);
      ctx.fillStyle = r < world.wins[i] ? '#ffd84a' : '#3a3450'; ctx.fillRect(px + u, 42 * u, 5 * u, 5 * u);
    }
  }

  slots(ctx, f, u, W, H) {
    const size = 30 * u, gap = 4 * u, n = 4;
    const x0 = W / 2 - (size * n + gap * (n - 1)) / 2, y = H - size - 8 * u;
    const keys = ['○', 'R1', 'L1', 'R2'];
    for (let i = 0; i < n; i++) {
      const def = f.slots[i];
      const x = x0 + i * (size + gap);
      box(ctx, x, y, size, size, u, def?.color || f.char.color);
      if (!def) continue;
      const cd = f.cooldowns[i], max = (def.cd ?? 1);
      const usable = i === 3 ? f.ult >= 100 : f.energy >= (def.cost ?? 0);
      text(ctx, initials(def.name), x + size / 2, y + 8 * u, 8 * u, usable ? '#ffffff' : '#7a7090', 'center', u);
      text(ctx, keys[i], x + size / 2, y + size - 9 * u, 5 * u, '#ffd84a', 'center', u);
      if (cd > 0) {
        ctx.fillStyle = 'rgba(10,6,20,0.7)';
        const h = Math.round((size - 2 * u) * Math.min(1, cd / max) / u) * u;
        ctx.fillRect(x + u, y + size - u - h, size - 2 * u, h);
        text(ctx, cd.toFixed(cd < 1 ? 1 : 0), x + size / 2, y + 10 * u, 7 * u, '#ffffff', 'center', u);
      }
    }
  }
}

function initials(name) {
  const w = name.replace(/[:'.]/g, '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

function box(ctx, x, y, w, h, u, accent) {
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2a2240'; ctx.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(x + u, y + h - 3 * u, w - 2 * u, 2 * u); }
}

// Layered fills: [fraction, colour] drawn in order over a dark frame.
function bar(ctx, x, y, w, h, u, layers, rtl) {
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2a2240'; ctx.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  const iw = w - 2 * u;
  for (const [frac, col] of layers) {
    const fw = Math.round(iw * Math.max(0, Math.min(1, frac)) / u) * u;
    ctx.fillStyle = col;
    ctx.fillRect(rtl ? x + u + iw - fw : x + u, y + u, fw, h - 2 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(rtl ? x + u + iw - fw : x + u, y + u, fw, u);
  }
}

function text(ctx, s, x, y, size, color, align, u) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  const o = Math.max(1, Math.round(u));
  ctx.fillStyle = INK;
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
