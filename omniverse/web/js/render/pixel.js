// Shared pixel-art constants and helpers for the arena art.
export const UNIT = 2;   // world units per art pixel; a standing fighter is 100 art pixels tall

// 4x4 Bayer matrix, normalised to 0..255 thresholds.
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) * 16);

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
