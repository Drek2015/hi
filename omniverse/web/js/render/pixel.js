// Pixel-art pipeline. Fighters are drawn with the vector rig into a small sprite canvas
// (about 100 px tall), then cleaned up into pixel art: hard alpha (with ordered dithering for
// glows), colors snapped to the character's own palette, and a 1-px dark outline.
import { drawFighter } from './drawFighter.js';

export const UNIT = 2;              // world units per art pixel; fighters' bodies are about 100 px tall
export const SPRITE = 240;          // sprite canvas size (room for hair, auras, weapons, Susanoo)
const FOOT_X = SPRITE / 2, FOOT_Y = 190;
const OUTLINE = [18, 12, 24];

// 4x4 Bayer matrix, normalised to 0..255 thresholds.
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) * 16);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const palettes = new Map();

// Build a palette from the most common colors in a sprite, keeping rare but distinct colors (eyes, marks).
function buildPalette(d) {
  const hist = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 230) continue;
    const key = (d[i] >> 2) << 12 | (d[i + 1] >> 2) << 6 | (d[i + 2] >> 2);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const cols = [...hist].sort((a, b) => b[1] - a[1]);
  const pal = [OUTLINE];
  for (const [key, n] of cols) {
    if (n < 2 || pal.length >= 40) break;
    const c = [((key >> 12) & 63) << 2, ((key >> 6) & 63) << 2, (key & 63) << 2];
    const minD = Math.min(...pal.map(p => dist(p, c)));
    if (minD > (n > 30 ? 260 : 900)) pal.push(c);
  }
  return { cols: pal, cache: new Map() };
}

function dist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
}

function nearest(pal, r, g, b) {
  const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
  let c = pal.cache.get(key);
  if (c) return c;
  let best = pal.cols[0], bd = Infinity;
  for (const p of pal.cols) { const dd = dist(p, [r, g, b]); if (dd < bd) { bd = dd; best = p; } }
  pal.cache.set(key, best);
  return best;
}

// Turn a soft-edged RGBA image into pixel art in place.
export function pixelate(img, pal, { outline = true, glowDither = true } = {}) {
  const { data: d, width: w, height: h } = img;
  const solid = new Uint8Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const a = d[i + 3];
    if (a >= 200) { solid[y * w + x] = 1; d[i + 3] = 255; }
    else if (glowDither && a > 24 && a > BAYER[(y & 3) * 4 + (x & 3)] * 0.8) d[i + 3] = 255;
    else { d[i + 3] = 0; continue; }
    if (pal) { const c = nearest(pal, d[i], d[i + 1], d[i + 2]); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
  }
  if (!outline) return;
  // Rim light along top edges and a shadow band along bottom edges, the classic pixel-art read.
  for (let y = 2; y < h - 2; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (!solid[p]) continue;
    const i = p * 4;
    if (d[i] + d[i + 1] + d[i + 2] < 90) continue;
    if (!solid[p - w]) { d[i] = d[i] + (255 - d[i]) * 0.28; d[i + 1] = d[i + 1] + (255 - d[i + 1]) * 0.28; d[i + 2] = d[i + 2] + (255 - d[i + 2]) * 0.22; }
    else if (!solid[p + w] || !solid[p + 2 * w]) { d[i] *= 0.72; d[i + 1] *= 0.7; d[i + 2] *= 0.78; }
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (solid[p] || d[p * 4 + 3]) continue;
    if (solid[p - 1] || solid[p + 1] || solid[p - w] || solid[p + w]) {
      d[p * 4] = OUTLINE[0]; d[p * 4 + 1] = OUTLINE[1]; d[p * 4 + 2] = OUTLINE[2]; d[p * 4 + 3] = 255;
    }
  }
}

// Bakes fighters to pixel sprites. One scratch canvas is reused for every fighter.
export class SpriteBaker {
  constructor() {
    this.c = canvas(SPRITE, SPRITE);
    this.g = this.c.getContext('2d', { willReadFrequently: true });
  }

  bake(f, opts = {}) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, SPRITE, SPRITE);
    g.setTransform(1 / UNIT, 0, 0, 1 / UNIT, FOOT_X, FOOT_Y);
    drawFighter(g, f, { t: opts.t ?? 0, pose: opts.pose, flash: 0 });
    const img = g.getImageData(0, 0, SPRITE, SPRITE);
    const key = `${f.char.id}/${f.skin.id}/${f.form || ''}`;
    let pal = palettes.get(key);
    if (!pal) { pal = buildPalette(img.data); palettes.set(key, pal); }
    pixelate(img, pal);
    if (opts.flash) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.putImageData(img, 0, 0);
    return this.c;
  }

  // Draw a fighter at art-pixel position (px, py) of its feet.
  draw(ctx, f, px, py, opts = {}) {
    const c = this.bake(f, opts);
    ctx.drawImage(c, Math.round(px) - FOOT_X, Math.round(py) - FOOT_Y);
  }
}

// Posterize a painted backdrop with ordered dithering, so gradients turn into pixel-art bands.
export function ditherCanvas(c, levels = 10) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data, w = c.width;
  const step = 255 / (levels - 1);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const x = p % w, y = (p / w) | 0;
    const th = BAYER[(y & 3) * 4 + (x & 3)] / 256 - 0.5;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round(d[i + k] / step + th) * step));
    d[i + 3] = d[i + 3] < 128 ? 0 : 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Portrait for menus: bake in a pose, then upscale with hard pixels.
const portraitBaker = { b: null };
export function drawPixelPortrait(target, char, skin, { pose = 'stance', zoom = 1, t = 0 } = {}) {
  portraitBaker.b ||= new SpriteBaker();
  const f = { char, skin, facing: 1, state: pose === 'victory' ? 'victory' : 'idle', stateT: 0, animT: t, vx: 0, vy: 0, buffs: [], status: [], form: null };
  const c = portraitBaker.b.bake(f, { t });
  const ctx = target.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  // Crop around the body (feet at FOOT_Y, about 110 px tall).
  const crop = 128 / zoom;
  const sx = FOOT_X - crop / 2, sy = FOOT_Y + 6 - crop;
  const s = Math.max(1, Math.floor(Math.min(target.width, target.height) / crop));
  const dw = crop * s;
  ctx.drawImage(c, sx, sy, crop, crop, Math.round((target.width - dw) / 2), target.height - dw, dw, dw);
}
