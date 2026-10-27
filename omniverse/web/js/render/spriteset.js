// Draws fighters from the supplied sprite art: picks the picture for the current action, and adds
// the motion that single poses can't show on their own (lunges, smears, hit shake, knockdowns).
import { SPRITE_ART, CHAR_SPRITES } from '../data/sprites.js';

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
  art.set(name, { img: c, flash: f, ax: n ? Math.round(sx / n) : w / 2, ay: bottom + 1, h: meta.h });
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

// Draw fighter f with its feet at screen point (x, y). `px` is screen pixels per art pixel;
// sprites are sized so a standing character is 100 art pixels tall.
export function drawSpriteFighter(ctx, f, x, y, px, { flash = false, alpha = 1, t = 0 } = {}) {
  const a = spriteFor(f);
  if (!a) return false;
  const s = (100 / a.h) * px;
  let ox = 0, oy = 0, quarter = 0;
  const step = n => Math.floor(t * n);
  switch (f.state) {
    case 'run': oy = step(10) % 2 ? -px : 0; break;
    case 'attack': if (f.move && f.moveT >= f.move.startup && f.moveT < f.move.startup + f.move.active + f.move.recovery * 0.4) ox = 6 * px; break;
    case 'hurt': if (f.stateT < 0.18) ox = (step(30) % 2 ? 2 : -2) * px; break;
    case 'charge': ox = (step(30) % 2 ? 1 : -1) * px; break;
    case 'down': quarter = -1; break;
    case 'tumble': quarter = -(step(12) % 4); break;
    case 'guardbreak': ox = (step(20) % 2 ? 2 : -2) * px; break;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x + ox * f.facing), Math.round(y + oy));
  ctx.scale(f.facing, 1);
  if (quarter) { ctx.translate(0, -a.img.height * s / 2 + (quarter === -1 ? a.img.height * s * 0.35 : 0)); ctx.rotate(quarter * Math.PI / 2); ctx.translate(0, a.img.height * s / 2 - (quarter === -1 ? a.img.height * s * 0.35 : 0)); }
  const dx = -a.ax * s, dy = -a.ay * s, dw = a.img.width * s, dh = a.img.height * s;
  // Speed smear behind attacks and dashes.
  if (f.state === 'dash' || (f.state === 'attack' && ox) || slotFor(f) === 'rush') {
    for (let i = 2; i >= 1; i--) { ctx.globalAlpha = alpha * 0.18 * (3 - i); ctx.drawImage(a.flash, dx - i * 8 * px, dy, dw, dh); }
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(flash ? a.flash : a.img, dx, dy, dw, dh);
  ctx.restore();
  return true;
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
