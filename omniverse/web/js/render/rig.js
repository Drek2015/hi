// Skeletal animation: poses are joint angles, animations blend keyframed poses with easing.
// Angles in radians. Limbs hang straight down at 0; positive swings forward (toward facing).

export const BONES = {
  hip: 98, torso: 58, neck: 7, head: 22,
  upperArm: 33, foreArm: 31, thigh: 48, shin: 48,
};

const BASE = {
  rootX: 0, rootY: 0, rot: 0,        // whole-body offset and rotation (tumbles, knockdowns)
  torso: 0.06, head: 0,
  fs: 0.2, fe: 0.4,                  // front shoulder / elbow
  bs: -0.15, be: 0.4,                // back shoulder / elbow
  fh: 0.12, fk: -0.1,                // front hip / knee
  bh: -0.12, bk: -0.1,               // back hip / knee
  crouch: 0,                          // lowers hips
};

export function pose(o) { return { ...BASE, ...o }; }

const easeOut = t => 1 - (1 - t) ** 3;
// Arcade-style timing: whip into the next key pose in the first quarter, then hold it.
const snap = t => t >= 0.25 ? 1 : easeOut(t / 0.25);
// Cycles run on held frames (12 per second) instead of smooth motion.
const frame = (t, fps = 12) => Math.floor(t * fps) / fps;

export function lerpPose(a, b, t) {
  const out = {};
  for (const k in BASE) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// Keyframes: [[time0to1, pose], ...]
function track(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, p0] = frames[i - 1], [t1, p1] = frames[i];
      return lerpPose(p0, p1, snap((t - t0) / (t1 - t0)));
    }
  }
  return frames[frames.length - 1][1];
}

const STANCE = pose({ torso: 0.14, head: -0.05, fs: 1.0, fe: 1.75, bs: 0.55, be: 2.0, fh: 0.32, fk: -0.42, bh: -0.32, bk: -0.3, crouch: 7 });

const P = {
  stance: STANCE,
  jabWind: pose({ ...STANCE, torso: 0.08, fs: 0.7, fe: 2.2 }),
  jabHit: pose({ ...STANCE, torso: 0.3, fs: 1.62, fe: 0.05, bs: 0.3, be: 2.1 }),
  crossWind: pose({ ...STANCE, torso: 0.0, bs: 0.2, be: 2.3 }),
  crossHit: pose({ ...STANCE, torso: 0.38, bs: 1.62, be: 0.05, fs: 0.6, fe: 2.0, bh: -0.5, bk: -0.1 }),
  roundWind: pose({ ...STANCE, torso: -0.1, fh: -0.2, fk: -1.2, fs: 0.3, bs: 0.8 }),
  roundHit: pose({ torso: -0.35, head: 0.15, fs: -0.4, fe: 0.6, bs: 0.9, be: 0.5, fh: 1.75, fk: -0.05, bh: -0.1, bk: -0.25, crouch: 0 }),
  smashWind: pose({ torso: -0.25, head: -0.1, fs: -0.9, fe: 1.4, bs: -1.4, be: 1.2, fh: 0.2, fk: -0.4, bh: -0.5, bk: -0.4, crouch: 12 }),
  smashHit: pose({ torso: 0.5, head: 0.1, fs: 1.7, fe: 0.0, bs: 1.2, be: 0.2, fh: 0.7, fk: -0.6, bh: -0.7, bk: -0.1, crouch: 16 }),
  upWind: pose({ torso: 0.35, fs: -0.3, fe: 1.8, bs: 0.6, be: 1.9, fh: 0.5, fk: -1.0, bh: -0.4, bk: -0.6, crouch: 22 }),
  upHit: pose({ torso: -0.2, head: -0.3, fs: 2.9, fe: 0.1, bs: 0.2, be: 1.4, fh: 0.25, fk: -0.1, bh: -0.25, bk: -0.2, crouch: -6 }),
  sweepHit: pose({ rootY: 40, torso: 0.6, head: 0.2, fs: 1.4, fe: 0.2, bs: -0.6, be: 0.5, fh: 1.5, fk: 0, bh: -0.4, bk: -1.8, crouch: 30 }),
  airkickHit: pose({ torso: -0.2, fs: -0.6, fe: 1.2, bs: 0.8, be: 1.2, fh: 1.45, fk: -0.05, bh: -0.3, bk: -1.4 }),
  axeWind: pose({ torso: -0.3, fs: 2.4, fe: 0.4, bs: 2.2, be: 0.4, fh: 0.6, fk: -1.2, bh: -0.2, bk: -1.0 }),
  axeHit: pose({ torso: 0.55, head: 0.2, fs: 1.1, fe: 0.1, bs: 1.0, be: 0.2, fh: 1.0, fk: -0.1, bh: -0.5, bk: -1.0 }),
  flipHit: pose({ rot: -Math.PI * 1.2, torso: 0.2, fs: 2.6, fe: 0.2, bs: 2.2, be: 0.3, fh: 0.9, fk: -0.4, bh: 0.4, bk: -1.0 }),
  dash: pose({ torso: 0.72, head: -0.4, fs: -1.3, fe: 0.3, bs: -1.5, be: 0.2, fh: 0.5, fk: -0.9, bh: -0.9, bk: -0.6, crouch: 14 }),
  air: pose({ torso: 0.05, fs: 1.2, fe: 1.2, bs: -0.6, be: 0.9, fh: 0.8, fk: -1.4, bh: -0.1, bk: -0.9 }),
  fall: pose({ torso: -0.08, head: 0.05, fs: 2.2, fe: 0.6, bs: 1.6, be: 0.6, fh: 0.3, fk: -0.6, bh: -0.25, bk: -0.4 }),
  guard: pose({ torso: 0.05, head: 0.15, fs: 1.4, fe: 2.4, bs: 1.25, be: 2.5, fh: 0.3, fk: -0.4, bh: -0.32, bk: -0.3, crouch: 12 }),
  charge: pose({ torso: 0.1, head: -0.2, fs: 0.3, fe: 1.2, bs: -0.3, be: 1.2, fh: 0.55, fk: -0.9, bh: -0.55, bk: -0.9, crouch: 30 }),
  hurt: pose({ torso: -0.42, head: -0.45, fs: -0.6, fe: 0.4, bs: 0.7, be: 0.5, fh: 0.4, fk: -0.3, bh: -0.25, bk: -0.4 }),
  tumble: pose({ torso: -0.3, head: -0.5, fs: 2.2, fe: 0.4, bs: -1.5, be: 0.6, fh: 0.9, fk: -1.2, bh: -0.6, bk: -0.8 }),
  down: pose({ rot: -Math.PI / 2, rootY: 76, rootX: -40, torso: 0, head: 0.3, fs: 2.6, fe: 0.3, bs: 2.4, be: 0.5, fh: 0.2, fk: -0.4, bh: 0.1, bk: -0.2 }),
  victory: pose({ torso: -0.05, head: -0.25, fs: 2.9, fe: 0.3, bs: 0.2, be: 2.3, fh: 0.1, fk: 0, bh: -0.2, bk: 0 }),
  thrustWind: pose({ torso: -0.05, fs: -0.6, fe: 1.8, bs: 0.6, be: 2.2, fh: 0.35, fk: -0.6, bh: -0.4, bk: -0.3, crouch: 14 }),
  thrustHit: pose({ torso: 0.45, head: 0.1, fs: 1.55, fe: 0.0, bs: -0.6, be: 0.6, fh: 0.85, fk: -0.7, bh: -0.8, bk: -0.1, crouch: 18 }),
  throwWind: pose({ torso: -0.3, fs: 2.6, fe: 1.4, bs: 0.8, be: 0.6, fh: 0.4, fk: -0.4, bh: -0.4, bk: -0.3, crouch: 8 }),
  throwHit: pose({ torso: 0.4, fs: 1.3, fe: 0.0, bs: -0.5, be: 0.5, fh: 0.5, fk: -0.6, bh: -0.6, bk: -0.2, crouch: 12 }),
  sign: pose({ torso: 0.05, head: 0.1, fs: 1.1, fe: 2.4, bs: 1.0, be: 2.5, fh: 0.25, fk: -0.25, bh: -0.25, bk: -0.2, crouch: 6 }),
  blow: pose({ torso: 0.2, head: 0.15, fs: 1.0, fe: 2.6, bs: 0.3, be: 1.6, fh: 0.4, fk: -0.5, bh: -0.45, bk: -0.3, crouch: 10 }),
  stare: pose({ torso: -0.05, head: -0.1, fs: 1.3, fe: 2.6, bs: -0.2, be: 0.3, fh: 0.15, fk: -0.1, bh: -0.15, bk: -0.1 }),
  slamWind: pose({ torso: -0.3, head: -0.2, fs: 2.8, fe: 0.3, bs: 2.7, be: 0.3, fh: 0.2, fk: -0.2, bh: -0.2, bk: -0.2 }),
  slamHit: pose({ torso: 0.9, head: 0.3, fs: 1.0, fe: 0.1, bs: 0.9, be: 0.1, fh: 0.9, fk: -1.4, bh: -0.5, bk: -1.2, crouch: 38 }),
  burst: pose({ torso: -0.15, head: -0.3, fs: 2.0, fe: 0.1, bs: -2.0, be: 0.1, fh: 0.5, fk: -0.3, bh: -0.5, bk: -0.3, crouch: 4 }),
  bow: pose({ torso: 0.0, head: 0.05, fs: 1.57, fe: 0.0, bs: 1.4, be: 2.6, fh: 0.4, fk: -0.4, bh: -0.4, bk: -0.3, crouch: 8 }),
  slashWind: pose({ torso: -0.2, fs: 2.7, fe: 0.6, bs: 1.0, be: 1.6, fh: 0.4, fk: -0.5, bh: -0.5, bk: -0.4, crouch: 10 }),
  slashHit: pose({ torso: 0.55, head: 0.15, fs: 0.6, fe: 0.1, bs: -0.4, be: 0.8, fh: 0.9, fk: -0.8, bh: -0.8, bk: -0.2, crouch: 18 }),
  shoot: pose({ torso: 0.1, head: 0.05, fs: 1.6, fe: 0.0, bs: 0.4, be: 1.8, fh: 0.3, fk: -0.35, bh: -0.3, bk: -0.3, crouch: 8 }),
  kame1: pose({ torso: -0.2, head: 0.1, fs: -0.9, fe: 1.4, bs: -1.0, be: 1.5, fh: 0.5, fk: -0.7, bh: -0.6, bk: -0.4, crouch: 18 }),
  kame2: pose({ torso: 0.3, head: 0.05, fs: 1.55, fe: 0.05, bs: 1.5, be: 0.1, fh: 0.6, fk: -0.6, bh: -0.7, bk: -0.2, crouch: 18 }),
  pose: pose({ torso: -0.1, head: -0.2, fs: 2.1, fe: 1.5, bs: -0.5, be: 1.6, fh: 0.4, fk: -0.2, bh: -0.4, bk: -0.2 }),
  grab: pose({ torso: 0.35, fs: 1.5, fe: 0.4, bs: 1.4, be: 0.5, fh: 0.5, fk: -0.5, bh: -0.5, bk: -0.3, crouch: 14 }),
  ultWind: pose({ torso: -0.3, head: -0.5, fs: 2.9, fe: 0.2, bs: 2.8, be: 0.2, fh: 0.3, fk: -0.3, bh: -0.3, bk: -0.3, crouch: 4 }),
};

// Running cycle; `ninja` runs with arms trailing behind.
function run(t, ninja, speed) {
  const ph = t * 11 * Math.max(0.7, speed);
  const s = Math.sin(ph), c = Math.cos(ph);
  return pose({
    rootY: -Math.abs(c) * 7, torso: ninja ? 0.55 : 0.28, head: ninja ? -0.35 : -0.12,
    fs: ninja ? -1.35 + s * 0.08 : -s * 0.95, fe: ninja ? 0.15 : 1.25,
    bs: ninja ? -1.45 - s * 0.08 : s * 0.95, be: ninja ? 0.2 : 1.25,
    fh: s * 0.95 + 0.1, fk: -0.35 - Math.max(0, -s) * 1.3,
    bh: -s * 0.95 + 0.1, bk: -0.35 - Math.max(0, s) * 1.3,
    crouch: 6,
  });
}

function idle(t) {
  const b = Math.sin(t * 2.6);
  return pose({ ...STANCE, rootY: b * 1.6, torso: STANCE.torso + b * 0.02, fs: STANCE.fs + b * 0.04, bs: STANCE.bs - b * 0.04, crouch: STANCE.crouch + b * 1.5 });
}

const MOVE_KEYS = {
  jab: [P.jabWind, P.jabHit], cross: [P.crossWind, P.crossHit], roundhouse: [P.roundWind, P.roundHit],
  smash: [P.smashWind, P.smashHit], uppercut: [P.upWind, P.upHit], sweep: [P.charge, P.sweepHit],
  airkick: [P.air, P.airkickHit], axe: [P.axeWind, P.axeHit], flip: [P.air, P.flipHit], dashstrike: [P.dash, P.thrustHit],
};

const CAST_KEYS = {
  thrust: [P.thrustWind, P.thrustHit], throw: [P.throwWind, P.throwHit], sign: [P.sign, P.sign], blow: [P.blow, P.blow],
  stare: [P.stare, P.stare], slam: [P.slamWind, P.slamHit], burst: [P.sign, P.burst], guard: [P.guard, P.guard],
  bow: [P.bow, P.bow], slash: [P.slashWind, P.slashHit], punch: [P.smashWind, P.smashHit], kick: [P.roundWind, P.roundHit],
  shoot: [P.shoot, P.shoot], kamehameha: [P.kame1, P.kame2], pose: [P.pose, P.pose], grab: [P.grab, P.grab],
  dash: [P.dash, P.dash], uppercut: [P.upWind, P.upHit], cast: [P.sign, P.thrustHit], ultimate: [P.ultWind, P.thrustHit],
};

// Pick the pose for a fighter this frame.
export function animate(f, t) {
  const ninja = f.char.universe === 'Naruto' || f.char.universe === 'Boruto';
  switch (f.state) {
    case 'idle': return idle(frame(t, 8));
    case 'run': return run(frame(t, 14), ninja, Math.abs(f.vx) / 640);
    case 'air': {
      // Three held frames: rising, apex, falling.
      return f.vy < -350 ? P.air : f.vy < 350 ? lerpPose(P.air, P.fall, 0.5) : P.fall;
    }
    case 'dash': return P.dash;
    case 'guard': return P.guard;
    case 'charge': { const p = { ...P.charge }; p.rootY += Math.sin(t * 40) * 1; return p; }
    case 'hurt': return f.stateT < 0.22 ? P.hurt : lerpPose(P.hurt, STANCE, snap((f.stateT - 0.22) / 0.2));
    case 'tumble': { const p = { ...P.tumble }; p.rot = -f.stateT * 9 * Math.sign(f.vx || 1) * f.facing; return p; }
    case 'down': return P.down;
    case 'getup': return lerpPose(P.down, STANCE, snap(Math.min(1, f.stateT / 0.22)));
    case 'guardbreak': { const p = lerpPose(P.hurt, P.tumble, 0.3); p.head += Math.sin(t * 20) * 0.1; return p; }
    case 'attack': {
      const m = f.move;
      if (!m) return STANCE;
      const keys = MOVE_KEYS[f.moveId] || [P.jabWind, P.jabHit];
      const total = m.startup + m.active + m.recovery;
      const s = m.startup / total, a = (m.startup + m.active) / total;
      const from = f.onGround ? STANCE : P.air;
      return track([[0, from], [s * 0.9, keys[0]], [s + 0.0001, keys[1]], [a + (1 - a) * 0.45, keys[1]], [1, from]], f.moveT / total);
    }
    case 'cast': {
      const c = f.cast;
      if (!c) return STANCE;
      const keys = CAST_KEYS[c.def.anim] || CAST_KEYS.cast;
      const w = c.def.windup ?? 0.12, r = c.def.recover ?? 0.22;
      if (c.channel && !c.channel.done) {
        const k = Math.min(1, c.t / Math.max(0.01, w));
        const p = k < 1 ? lerpPose(keys[0], keys[1], snap(k)) : { ...keys[1] };
        if (c.def.prim === 'rush' || c.def.prim === 'combo') return lerpPose(P.dash, keys[1], 0.5);
        return p;
      }
      const total = w + r;
      return track([[0, f.onGround ? STANCE : P.air], [w / total * 0.95, keys[0]], [w / total, keys[1]], [Math.min(1, (w + r * 0.6) / total), keys[1]], [1, f.onGround ? STANCE : P.air]], c.t / total);
    }
    case 'victory': return P.victory;
    default: return STANCE;
  }
}

// Forward kinematics: returns joint positions in fighter-local space (feet at 0,0, facing +x, y up negative).
export function solve(p, scale = 1, build) {
  const B = BONES;
  const hipW = build.hipW ?? 10, sh = build.shoulderW ?? 14;
  const hipY = -(B.hip - p.crouch) * scale + p.rootY;
  const hip = { x: p.rootX, y: hipY };
  const tLen = B.torso * scale * (build.torsoMul ?? 1);
  const neck = { x: hip.x + Math.sin(p.torso) * tLen, y: hip.y - Math.cos(p.torso) * tLen };
  const headC = { x: neck.x + Math.sin(p.torso + p.head) * (B.neck + B.head) * scale, y: neck.y - Math.cos(p.torso + p.head) * (B.neck + B.head) * scale };
  const shoulderBase = { x: hip.x + Math.sin(p.torso) * tLen * 0.88, y: hip.y - Math.cos(p.torso) * tLen * 0.88 };
  const arm = (s, e, offset) => {
    const sx = shoulderBase.x + offset, sy = shoulderBase.y;
    const a1 = p.torso * 0.3 + s;
    const el = { x: sx + Math.sin(a1) * B.upperArm * scale, y: sy + Math.cos(a1) * B.upperArm * scale };
    const a2 = a1 + e;
    const hand = { x: el.x + Math.sin(a2) * B.foreArm * scale, y: el.y + Math.cos(a2) * B.foreArm * scale };
    return { sh: { x: sx, y: sy }, el, hand, a2 };
  };
  const leg = (h, k, offset) => {
    const hx = hip.x + offset, hy = hip.y;
    const kn = { x: hx + Math.sin(h) * B.thigh * scale, y: hy + Math.cos(h) * B.thigh * scale };
    const a2 = h + k;
    const ft = { x: kn.x + Math.sin(a2) * B.shin * scale, y: kn.y + Math.cos(a2) * B.shin * scale };
    return { hip: { x: hx, y: hy }, kn, ft, a2 };
  };
  return {
    hip, neck, head: headC, torsoA: p.torso, headA: p.torso + p.head,
    armF: arm(p.fs, p.fe, sh * 0.25), armB: arm(p.bs, p.be, -sh * 0.25),
    legF: leg(p.fh, p.fk, hipW * 0.3), legB: leg(p.bh, p.bk, -hipW * 0.3),
    rot: p.rot,
  };
}
