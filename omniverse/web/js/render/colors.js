// Small color helpers shared by the renderer.
const cache = new Map();

export function rgb(hex) {
  let c = cache.get(hex);
  if (c) return c;
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  c = v;
  cache.set(hex, c);
  return c;
}

export function toHex([r, g, b]) {
  const f = x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

// amt > 0 lightens toward white, amt < 0 darkens toward black.
export function shade(hex, amt) {
  const c = rgb(hex);
  return toHex(c.map(v => amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
}

export function mix(a, b, t) {
  const ca = rgb(a), cb = rgb(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Cached soft glow sprites (radial gradients) for additive effects.
const glowCache = new Map();
export function glowSprite(hex, size = 128, hard = 0.0) {
  const key = hex + size + hard;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgba(shade(hex, 0.6), 1));
  grad.addColorStop(Math.max(0.05, hard), rgba(hex, 0.9));
  grad.addColorStop(0.45, rgba(hex, 0.35));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

// Teardrop flame sprite for auras and fire.
const flameCache = new Map();
export function flameSprite(hex) {
  let c = flameCache.get(hex);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  grad.addColorStop(0, rgba(shade(hex, 0.7), 1));
  grad.addColorStop(0.35, rgba(hex, 0.85));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(58, 60, 62, 100, 32, 124);
  g.bezierCurveTo(2, 100, 6, 60, 32, 4);
  g.fill();
  flameCache.set(hex, c);
  return c;
}
