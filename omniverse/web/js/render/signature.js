// Per-move and per-ability body motion layered on the supplied sprites. Every basic attack has its
// own motion, and every ability gets a motion built from its type plus a stable variation picked
// from its id, so two abilities of the same kind still move differently.

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const bell = u => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
const TAU = Math.PI * 2;

// Result fields, in body heights / radians: dx (forward), dy (down), spin, sx, sy, alpha.
const NONE = { dx: 0, dy: 0, spin: 0, sx: 1, sy: 1, alpha: 1 };

function attackMotion(f) {
  const m = f.move;
  if (!m) return NONE;
  const t = f.moveT, su = m.startup, act = su + m.active, end = act + m.recovery;
  const wind = Math.min(1, t / su);                       // 0..1 during startup
  const hit = t < su ? 0 : Math.min(1, (t - su) / Math.max(0.01, end - su));
  const o = { ...NONE };
  switch (f.moveId) {
    case 'jab': o.dx = -0.03 * wind + 0.09 * bell(hit * 1.4); break;
    case 'cross': o.dx = -0.05 * wind + 0.15 * bell(hit * 1.3); o.sx = 1 + 0.08 * bell(hit * 1.3); break;
    case 'roundhouse': o.spin = t < su ? 0.15 * wind : -TAU * ease(hit * 1.4); o.dy = -0.05 * bell(hit); break;
    case 'smash': o.dy = t < su ? -0.08 * wind : 0.04 * bell(hit * 2); o.sy = t < su ? 1 + 0.08 * wind : 1 - 0.12 * bell(hit * 2); o.sx = 2 - o.sy; o.dx = 0.12 * bell(hit); break;
    case 'uppercut': o.dy = t < su ? 0.08 * wind : -0.3 * bell(hit); o.spin = t < su ? 0.2 * wind : -0.45 * bell(hit); o.sy = 1 + 0.1 * bell(hit); break;
    case 'sweep': o.dy = 0.2 * Math.max(wind, bell(hit)); o.spin = 0.5 * Math.max(wind, bell(hit)); o.dx = 0.16 * bell(hit); break;
    case 'airkick': o.spin = 0.6 * Math.max(wind, bell(hit)); o.dx = 0.08 * bell(hit); break;
    case 'axe': o.spin = TAU * ease(Math.min(1, (t / end) * 1.3)); break;
    case 'flip': o.spin = -TAU * ease(Math.min(1, (t / end) * 1.2)); o.dy = -0.08 * bell(t / end); break;
    case 'dashstrike': o.dx = 0.28 * bell(hit * 1.2); o.sx = 1 + 0.22 * bell(hit * 1.2); o.sy = 1 - 0.12 * bell(hit * 1.2); break;
  }
  return o;
}

function castMotion(f) {
  const c = f.cast;
  if (!c) return NONE;
  const def = c.def, h = hash(def.id);
  const v = h % 3;                                       // variant within the ability type
  const dir = h & 8 ? 1 : -1;
  const w = def.windup ?? 0.12, rec = def.recover ?? 0.22;
  const t = c.t, wind = Math.min(1, t / Math.max(0.02, w));
  const after = t < w ? 0 : Math.min(1, (t - w) / Math.max(0.05, rec));
  const held = c.channel && !c.channel.done;
  const o = { ...NONE };
  switch (def.prim) {
    case 'projectile': case 'rain':
      if (v === 0) { o.dx = -0.06 * wind + -0.08 * bell(after); }                 // wind up, recoil
      else if (v === 1) { o.dy = -0.12 * bell(Math.min(1, t / (w + rec))); o.spin = dir * 0.25 * bell(after); }   // hop and throw
      else { o.spin = t < w ? -dir * 0.35 * wind : dir * TAU * 0.25 * bell(after); }   // wind-up twist
      break;
    case 'beam':
      o.dx = -0.04 * wind - (held ? 0.03 + 0.012 * Math.sin(t * 60) : 0);
      o.sy = 1 - 0.06 * wind; o.sx = 1 + 0.04 * wind;
      if (v === 1) o.dy = -0.1 * wind;                                              // fires from mid-air
      break;
    case 'rush':
      o.sx = 1 + 0.25 * (held ? 1 : wind); o.sy = 1 - 0.12 * (held ? 1 : wind);
      if (v === 1) o.spin = held ? dir * 0.25 : 0;                                  // corkscrew lunge
      if (v === 2) o.dy = held ? -0.06 * Math.sin(t * 30) : 0;
      break;
    case 'combo':
      // Flurry: rapid alternating twists.
      o.spin = (Math.floor(t * 18) % 2 ? 1 : -1) * (0.18 + 0.08 * v);
      o.dx = 0.06 * Math.sin(t * 36);
      break;
    case 'burst':
      o.dy = t < w ? -0.18 * wind : -0.18 * (1 - ease(after));
      o.sx = o.sy = 1 + 0.12 * bell(after);
      if (v === 2) o.spin = dir * TAU * ease(after);
      break;
    case 'summon':
      // Leap up, then slam a palm into the ground.
      o.dy = t < w ? -0.35 * ease(wind) : 0.02 * bell(after * 2);
      o.sy = t < w ? 1.06 : 1 - 0.15 * bell(after * 2); o.sx = 2 - o.sy;
      break;
    case 'teleport':
      o.sx = t < w ? 1 - 0.9 * wind : 0.1 + 0.9 * ease(after * 1.5);
      o.sy = t < w ? 1 + 0.4 * wind : 1.4 - 0.4 * ease(after * 1.5);
      o.alpha = t < w ? 1 - 0.6 * wind : 0.4 + 0.6 * ease(after * 1.5);
      break;
    case 'transform': case 'buff':
      o.dy = -0.12 * bell(Math.min(1, t / (w + rec)));
      o.sx = o.sy = 1 + 0.08 * bell(Math.min(1, t / (w + rec))) + 0.02 * Math.sin(t * 50);
      if (v === 1) o.spin = dir * TAU * ease(Math.min(1, t / (w + rec)));
      break;
    case 'shield': case 'counter':
      o.sy = 0.92; o.sx = 1.05; o.dx = -0.05; o.dy = 0.04;
      break;
    case 'clones':
      o.spin = dir * TAU * ease(Math.min(1, t / (w + rec)));
      break;
    case 'grab':
      o.dx = 0.22 * bell(Math.min(1, t / (w + rec)) * 1.2); o.sx = 1 + 0.12 * bell(t / (w + rec));
      break;
    case 'heal':
      o.dy = -0.08 - 0.03 * Math.sin(t * 8);
      break;
    case 'trap':
      o.dy = 0.1 * wind; o.spin = 0.3 * wind;
      break;
    case 'phase':
      o.alpha = 0.6 + 0.3 * Math.sin(t * 50);
      break;
  }
  if (def.kind === 'ultimate') { o.sx *= 1.06; o.sy *= 1.06; }
  return o;
}

export function actionMotion(f) {
  if (f.state === 'attack') return attackMotion(f);
  if (f.state === 'cast') return castMotion(f);
  return NONE;
}

// Swing arcs for basic attacks: a crescent swept in front of the fighter, shaped per move.
const ARCS = {
  jab: { a0: -0.15, a1: 0.15, r: 0.55, w: 0.08 },
  cross: { a0: -0.25, a1: 0.25, r: 0.68, w: 0.1 },
  roundhouse: { a0: -2.6, a1: 0.6, r: 0.7, w: 0.14 },
  smash: { a0: -1.6, a1: 0.5, r: 0.8, w: 0.18 },
  uppercut: { a0: 0.9, a1: -1.6, r: 0.75, w: 0.14 },
  sweep: { a0: 0.9, a1: 0.1, r: 0.8, w: 0.12, oy: 0.35 },
  airkick: { a0: 0.7, a1: -0.1, r: 0.7, w: 0.12 },
  axe: { a0: -1.8, a1: 1.2, r: 0.75, w: 0.16 },
  flip: { a0: 2.2, a1: -2.2, r: 0.65, w: 0.13 },
  dashstrike: { a0: -0.08, a1: 0.08, r: 1.0, w: 0.1, long: true },
};

// Draw the arc for fighter f at screen (x, y) with body height bh (screen pixels).
export function drawSwing(ctx, f, x, y, bh, color) {
  const m = f.move, arc = ARCS[f.moveId];
  if (!m || !arc || f.moveT < m.startup) return;
  const u = (f.moveT - m.startup) / Math.max(0.01, m.active + m.recovery * 0.5);
  if (u > 1) return;
  const head = Math.min(1, u * 1.8), tail = Math.max(0, u * 1.8 - 0.55);
  const cx = x, cy = y - bh * (0.55 - (arc.oy || 0));
  const R = bh * arc.r;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(f.facing, 1);
  ctx.globalAlpha = 1 - Math.max(0, u - 0.6) * 2.5;
  const a0 = arc.a0 + (arc.a1 - arc.a0) * tail, a1 = arc.a0 + (arc.a1 - arc.a0) * head;
  if (arc.long) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(R * 0.1 * tail, -bh * 0.02, R * head, bh * 0.04);
    ctx.fillStyle = color; ctx.fillRect(R * 0.1 * tail, -bh * 0.035, R * head, bh * 0.012);
  } else {
    const ccw = arc.a1 < arc.a0;
    ctx.lineCap = 'butt';
    for (const [col, k] of [[color, 1], ['#ffffff', 0.45]]) {
      ctx.strokeStyle = col; ctx.lineWidth = bh * arc.w * k;
      ctx.beginPath(); ctx.arc(0, 0, R, a0, a1, ccw); ctx.stroke();
    }
  }
  ctx.restore();
}
