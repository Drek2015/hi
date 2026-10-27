// Draws fighters from the supplied sprite art: picks the picture for the current action, and adds
// the motion that single poses can't show on their own (lunges, smears, hit shake, knockdowns).
import { SPRITE_ART, CHAR_SPRITES } from '../data/sprites.js';
import { drawCharge } from './charge.js';

const art = new Map();   // name -> { img, flash, ax, ay, h }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function prepare(name, img) {
  const meta = SPRITE_ART[name];
  const w = img.naturalWidth, h = img.naturalHeight;
  // Normalise every picture to face right.
  const c = canvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  if (meta.face === 'left') { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h);
  // Anchor: horizontal centre of the torso band, bottom of the feet.
  let bottom = 0, sx = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d.data[(y * w + x) * 4 + 3] < 128) continue;
    bottom = Math.max(bottom, y);
    if (y > h * 0.35 && y < h * 0.7) { sx += x; n++; }
  }
  // White silhouette for hit flashes.
  const f = canvas(w, h), fg = f.getContext('2d');
  const fd = fg.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 127) { fd.data[i] = 255; fd.data[i + 1] = 255; fd.data[i + 2] = 255; fd.data[i + 3] = 255; }
  fg.putImageData(fd, 0, 0);
  const hand = meta.hand && { x: meta.face === 'left' ? w - 1 - meta.hand[0] : meta.hand[0], y: meta.hand[1] };
  art.set(name, { img: c, flash: f, ax: n ? Math.round(sx / n) : w / 2, ay: bottom + 1, h: meta.h, hand });
}

export function loadSprites(base = 'assets/sprites/') {
  return Promise.all(Object.keys(SPRITE_ART).map(name => new Promise(res => {
    const img = new Image();
    img.onload = () => { prepare(name, img); res(); };
    img.onerror = () => res();
    img.src = `${base}${name}.png`;
  })));
}

export function hasSprites(char) { return !!CHAR_SPRITES[char.id]; }

function setFor(f) {
  const cs = CHAR_SPRITES[f.char.id];
  if (!cs) return null;
  const form = f.form && cs.forms?.[f.form];
  const skin = cs.skins?.[f.skin.id];
  return { ...cs.base, ...(skin || {}), ...(form ? (form.all ? { all: form.all } : form) : {}) };
}

const STRIKE_ANIMS = new Set(['thrust', 'throw', 'punch', 'kick', 'slash', 'uppercut', 'grab']);
const BEAM_ANIMS = new Set(['kamehameha', 'shoot', 'bow', 'ultimate']);

// Which slot to show, and how far into the action we are.
function slotFor(f) {
  // Round and match winners strike their victory pose.
  const w = f.world;
  if (w && !f.isClone && f.alive && (w.phase === 'matchEnd' ? w.matchWinner === f.side : (w.phase === 'ko' || w.phase === 'timeup') && w.roundWinner === f.side && w.phaseT > 0.6)) return 'victory';
  switch (f.state) {
    case 'guard': case 'charge': case 'getup': return 'crouch';
    case 'air': return f.stateT < 0.07 && f.vy < 0 ? 'crouch' : 'stand';   // take-off squat
    case 'dash': return 'rush';
    case 'victory': return 'victory';
    case 'attack': {
      const m = f.move;
      if (!m) return 'stand';
      return f.moveT < m.startup * 0.6 ? 'crouch' : 'strike';
    }
    case 'cast': {
      const c = f.cast;
      if (!c) return 'stand';
      const p = c.def.prim, a = c.def.anim;
      if (p === 'rush' || p === 'combo' || a === 'dash') return 'rush';
      if (c.t < (c.def.windup ?? 0.12) * 0.5) return 'crouch';
      if (STRIKE_ANIMS.has(a)) return 'strike';
      if (BEAM_ANIMS.has(a) || p === 'beam' || p === 'projectile') return 'beam';
      return 'sign';
    }
    default: return 'stand';
  }
}

export function spriteFor(f) {
  const set = setFor(f);
  if (!set) return null;
  const slot = slotFor(f);
  let name = set.all || set[slot] || set.stand;
  // Some abilities have their own picture (Minato's Rasengan, Kakashi's Chidori...).
  const fxMap = !set.all && CHAR_SPRITES[f.char.id].fx;
  if (fxMap && f.state === 'cast' && f.cast && slot !== 'crouch') {
    const key = f.cast.def.fx || f.cast.def.id;
    const hit = fxMap.find(([re]) => re.test(key) || re.test(f.cast.def.id));
    if (hit) name = hit[1];
  }
  return art.get(name) || art.get(set.stand) || null;
}

// Silhouettes tinted to a colour, for afterimages.
const tints = new Map();
function tinted(a, color) {
  const key = a.img.width + 'x' + a.img.height + color + (a.ax | 0);
  let c = tints.get(key);
  if (c) return c;
  c = canvas(a.img.width, a.img.height);
  const g = c.getContext('2d');
  g.drawImage(a.flash, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  tints.set(key, c);
  return c;
}

const motion = new WeakMap();
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

// Secondary motion layered on the supplied art: lean, squash and stretch, spins, knockdowns.
// None of it redraws the sprite; it only moves, tilts and scales it.
function updateMotion(f, dt, t) {
  let m = motion.get(f);
  if (!m) { m = { sq: 0, lean: 0, spin: 0, wasGround: true, lastVy: 0, trail: [], prevState: f.state }; motion.set(f, m); }
  if (dt <= 0) return m;
  // Landing squash and take-off stretch.
  if (!m.wasGround && f.onGround) m.sq = -Math.min(0.26, 0.08 + Math.max(0, m.lastVy) / 9000);
  if (m.wasGround && !f.onGround && f.vy < -500) m.sq = 0.16;
  if (f.state === 'hurt' && m.prevState !== 'hurt') m.sq = -0.12;
  if (f.state === 'attack' && m.prevState !== 'attack') m.sq = -0.06;
  m.sq *= Math.exp(-dt * 13);
  // Lean toward where the body is going.
  let lean = 0;
  switch (f.state) {
    case 'run': lean = 0.11 * Math.min(1, Math.abs(f.vx) / 640); break;
    case 'dash': lean = 0.26; break;
    case 'attack': lean = f.move && f.moveT >= f.move.startup ? 0.13 : -0.06; break;
    case 'hurt': lean = -0.24; break;
    case 'guardbreak': lean = -0.3; break;
    case 'guard': lean = -0.06; break;
    case 'charge': lean = 0.04; break;
    case 'air': lean = f.vy < 0 ? -0.05 : 0.07; break;
    case 'cast': lean = f.cast && f.cast.t > (f.cast.def.windup ?? 0.12) ? 0.08 : -0.08; break;
  }
  m.lean = approach(m.lean, lean, 16, dt);
  // Spins while launched, flat on the back when knocked down, rolling back up on get-up.
  if (f.state === 'tumble') m.spin -= dt * (8 + Math.hypot(f.vx, f.vy) / 160);
  else {
    let target = 0;
    if (f.state === 'down') target = -Math.PI / 2;
    // Unwind the spin to the nearest equivalent angle before settling.
    const full = Math.PI * 2;
    while (m.spin - target > Math.PI) m.spin -= full;
    while (target - m.spin > Math.PI) m.spin += full;
    m.spin = approach(m.spin, target, f.state === 'down' ? 22 : 12, dt);
  }
  m.wasGround = f.onGround; m.lastVy = f.vy; m.prevState = f.state;
  return m;
}

// Draw fighter f with its feet at screen point (x, y). `px` is screen pixels per art pixel;
// sprites are sized so a standing character is 100 art pixels tall.
export function drawSpriteFighter(ctx, f, x, y, px, { flash = false, alpha = 1, t = 0, dt = 0, trailColor = '#ffffff' } = {}) {
  const a = spriteFor(f);
  if (!a) return false;
  const m = updateMotion(f, dt, t);
  const s = (100 / a.h) * px;
  const bh = 100 * px;
  let ox = 0, oy = 0, sx = 1, sy = 1;
  const step = n => Math.floor(t * n);
  switch (f.state) {
    case 'idle': sy += 0.012 * Math.sin(t * 3.4); break;
    case 'run': { const ph = Math.abs(Math.sin(t * 13)); oy = -ph * 3 * px; sy += 0.04 * ph - 0.02; break; }
    case 'attack': {
      const mv = f.move;
      if (mv && f.moveT >= mv.startup) { const k = Math.min(1, (f.moveT - mv.startup) / Math.max(0.01, mv.active + mv.recovery * 0.5)); ox = 10 * px * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.6) * 2.5); }
      break;
    }
    case 'hurt': if (f.stateT < 0.2) ox = (step(30) % 2 ? 2.5 : -2.5) * px; break;
    case 'charge': ox = (step(30) % 2 ? 1 : -1) * px; break;
    case 'guardbreak': ox = (step(20) % 2 ? 3 : -3) * px; break;
  }
  sx *= 1 - m.sq * 0.55; sy *= 1 + m.sq;
  const lying = Math.abs(Math.sin(m.spin));
  const fx = Math.round(x + ox * f.facing), fy = Math.round(y + oy);

  // Afterimages: the last few positions in the fighter's colour.
  const fast = f.state === 'dash' || f.state === 'tumble' || slotFor(f) === 'rush' || Math.abs(f.vx) > 1200;
  if (dt > 0) {
    if (fast) m.trail.push({ x: fx, y: fy, spin: m.spin, lean: m.lean, a, facing: f.facing });
    if (m.trail.length > 5 || (!fast && m.trail.length)) m.trail.shift();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const pose = (g, p, img, al) => {
    g.save();
    g.translate(p.x, p.y);
    g.scale(p.facing, 1);
    g.rotate(p.lean);
    g.translate(0, (Math.abs(Math.sin(p.spin)) * bh * 0.33));
    g.scale(sx, sy);
    g.translate(0, -bh * 0.5); g.rotate(p.spin); g.translate(0, bh * 0.5);
    g.globalAlpha = al;
    g.drawImage(img, -p.a.ax * s, -p.a.ay * s, p.a.img.width * s, p.a.img.height * s);
    if (p.charge && p.a.hand) drawCharge(g, (p.a.hand.x - p.a.ax) * s, (p.a.hand.y - p.a.ay) * s, bh, p.charge, t);
    g.restore();
  };
  m.trail.forEach((p, i) => pose(ctx, p, tinted(p.a, trailColor), alpha * 0.1 * (i + 1)));
  // Abilities gather energy in the hand the artwork shows.
  let charge = null;
  if (f.state === 'cast' && f.cast && !flash) {
    const c = f.cast, w = c.def.windup ?? 0.12;
    charge = { fx: c.def.fx || c.def.id, k: Math.min(1, c.t / Math.max(0.05, w)), held: c.channel && !c.channel.done, color: c.def.color };
  }
  pose(ctx, { x: fx, y: fy, spin: m.spin, lean: m.lean, a, facing: f.facing, charge }, flash ? a.flash : a.img, alpha);
  ctx.restore();
  return lying;
}

// Menu portrait: the character's standing picture, scaled by whole pixels.
export function drawSpritePortrait(target, char, skin) {
  const a = spriteFor({ char, skin, state: 'idle', form: null });
  const g = target.getContext('2d');
  g.clearRect(0, 0, target.width, target.height);
  if (!a) return false;
  g.imageSmoothingEnabled = false;
  const k = Math.min(target.width / a.img.width, target.height / a.img.height);
  const w = a.img.width * k, h = a.img.height * k;
  g.drawImage(a.img, (target.width - w) / 2, target.height - h, w, h);
  return true;
}
