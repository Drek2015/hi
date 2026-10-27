// Ability primitives. Every ability in the roster is one of these with its own parameters
// and visual effect id; the renderer draws each entity by its `fx`.
import { DT, PHYS } from './constants.js';

let nextId = 1;

function scaleDmg(f, p, boost) {
  return (p.dmg ?? 0) * f.owner.mod('dmg') * (1 + (boost.dmg || 0)) * (f.owner.dmgFactor ?? 1);
}

function handPos(f, dy = -118, dx = 46) {
  return { x: f.x + f.facing * dx, y: f.y + dy };
}

function circleBox(cx, cy, r, b) {
  const nx = Math.max(b.x1, Math.min(cx, b.x2)), ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

function boxBox(a, b) { return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1; }

class Entity {
  constructor(owner, fx) {
    this.id = nextId++;
    this.owner = owner;
    this.fx = fx;
    this.t = 0;
    this.dead = false;
    this.hit = new Map();      // target -> time of last hit
  }
  canHit(target, interval) {
    const last = this.hit.get(target);
    return last === undefined || (interval && this.t - last >= interval);
  }
}

export class Projectile extends Entity {
  get kind() { return 'proj'; }
  constructor(owner, o) {
    super(owner, o.fx);
    Object.assign(this, { x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: o.r, dmg: o.dmg, kb: o.kb, stun: o.stun, life: o.life ?? 2.2,
      gravity: o.gravity ?? 0, homing: o.homing ?? 0, pierce: o.pierce ?? 0, explode: o.explode, status: o.status, pull: o.pull,
      multi: o.multi, unblockable: o.unblockable, delay: o.delay ?? 0, spin: 0, power: o.power ?? 1, onHit: o.onHit, clash: o.clash ?? true });
  }
  update(w) {
    if (this.delay > 0) { this.delay -= DT; return; }
    this.t += DT;
    if (this.t > this.life) { this.die(w); return; }
    if (this.homing) {
      const tgt = w.enemyOf(this.owner);
      if (tgt) {
        const a = Math.atan2(tgt.y - 100 - this.y, tgt.x - this.x), sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx);
        let d = a - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const na = cur + Math.max(-this.homing * DT, Math.min(this.homing * DT, d));
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    this.vy += this.gravity * DT;
    this.x += this.vx * DT; this.y += this.vy * DT;
    this.spin += DT * 18;
    if (this.y > -this.r * 0.5 && this.gravity >= 0 && this.vy > 0) { this.die(w); return; }
    if (this.x < w.left - 300 || this.x > w.right + 300 || this.y < w.ceiling - 600) { this.dead = true; return; }
    for (const target of w.targetsOf(this.owner)) {
      if (!this.canHit(target, this.multi)) continue;
      if (!circleBox(this.x, this.y, this.r, target.hurtbox())) continue;
      this.hit.set(target, this.t);
      const res = target.takeHit({ dmg: this.dmg, kb: [Math.abs(this.kb[0]), this.kb[1]], dir: Math.sign(this.vx) || this.owner.facing, stun: this.stun, x: this.x, y: this.y, projectile: true, status: this.status, unblockable: this.unblockable, energy: 1 }, this.owner);
      if (res === 'hit' && this.pull) { target.vx = Math.sign(this.owner.x - target.x) * this.pull; target.vy = -260; target.onGround = false; w.emit('pull', { f: target, from: this.owner }); }
      if (res !== 'miss') {
        if (this.onHit) this.onHit(w, target, res);
        if (this.pierce-- <= 0) { this.die(w); return; }
      }
    }
  }
  die(w) {
    if (this.dead) return;
    this.dead = true;
    if (this.explode) {
      const b = new Burst(this.owner, { x: this.x, y: this.y, r: this.explode.r, dmg: this.explode.dmg, kb: this.explode.kb ?? 700, stun: 0.5, fx: this.explode.fx || this.fx + 'Boom', life: 0.55, status: this.status });
      b.sig = this.sig; b.sigColor = this.sigColor;
      w.add(b);
    }
    else w.emit('fizzle', { x: this.x, y: this.y, fx: this.fx });
  }
}

export class Burst extends Entity {
  get kind() { return 'burst'; }
  constructor(owner, o) {
    super(owner, o.fx);
    Object.assign(this, { x: o.x, y: o.y, r: o.r, dmg: o.dmg, kb: o.kb, stun: o.stun ?? 0.5, life: o.life ?? 0.4, status: o.status,
      ticks: o.ticks ?? 1, interval: o.interval ?? 0.1, pull: o.pull, follow: o.follow, unblockable: o.unblockable, delay: o.delay ?? 0 });
    this.hits = 0;
  }
  update(w) {
    if (this.delay > 0) { this.delay -= DT; return; }
    if (this.t === 0) w.emit('burst', { x: this.x, y: this.y, r: this.r, fx: this.fx, big: this.r > 220 });
    this.t += DT;
    if (this.follow) { this.x = this.owner.x; this.y = this.owner.y - 100; }
    if (this.t > this.life) { this.dead = true; return; }
    const active = this.t < (this.ticks > 1 ? this.life : 0.12);
    if (!active) return;
    for (const target of w.targetsOf(this.owner)) {
      if (this.pull) {
        const dx = this.x - target.x, dy = this.y - (target.y - 90), d = Math.hypot(dx, dy);
        if (d < this.r * 1.6 && d > 30) { target.vx += dx / d * this.pull * DT; target.vy += dy / d * this.pull * DT * 0.5; }
      }
      const hb = target.hurtbox();
      if (!circleBox(this.x, this.y, this.r, hb)) continue;
      if (!this.canHit(target, this.ticks > 1 ? this.interval : 0)) continue;
      this.hit.set(target, this.t);
      const dir = Math.sign(target.x - this.x) || this.owner.facing;
      const kbx = this.pull ? 60 : this.kb * 0.8, kby = this.pull ? -120 : -this.kb * 0.55;
      target.takeHit({ dmg: this.dmg / this.ticks, kb: [kbx, kby], dir, stun: this.stun, x: this.x, y: this.y, status: this.status, unblockable: this.unblockable, energy: 1 }, this.owner);
    }
  }
}

// A large delayed strike shaped like a box: summons, giant swords, paws, meteors.
export class Strike extends Entity {
  get kind() { return 'strike'; }
  constructor(owner, o) {
    super(owner, o.fx);
    Object.assign(this, { x: o.x, y: o.y, w: o.w, h: o.h, dmg: o.dmg, kb: o.kb, stun: o.stun ?? 0.6, delay: o.delay ?? 0.25, life: o.life ?? 0.9,
      dir: o.dir ?? owner.facing, status: o.status, unblockable: o.unblockable, ticks: o.ticks ?? 1, interval: o.interval ?? 0.15, vx: o.vx ?? 0 });
  }
  update(w) {
    this.t += DT;
    this.x += this.vx * DT;
    if (this.t > this.life) { this.dead = true; return; }
    if (this.t < this.delay) return;
    if (!this.landed) { this.landed = true; w.emit('strike', { x: this.x, y: this.y, fx: this.fx, w: this.w }); }
    if (this.t > this.delay + (this.ticks > 1 ? this.ticks * this.interval : 0.12)) return;
    const box = { x1: this.x - this.w / 2, x2: this.x + this.w / 2, y1: this.y - this.h, y2: this.y };
    for (const target of w.targetsOf(this.owner)) {
      if (!boxBox(box, target.hurtbox())) continue;
      if (!this.canHit(target, this.ticks > 1 ? this.interval : 0)) continue;
      this.hit.set(target, this.t);
      target.takeHit({ dmg: this.dmg / this.ticks, kb: this.kb, dir: Math.sign(target.x - this.x) || this.dir, stun: this.stun, x: target.x, y: target.y - 100, status: this.status, unblockable: this.unblockable, energy: 1 }, this.owner);
    }
  }
}

export class Beam extends Entity {
  get kind() { return 'beam'; }
  constructor(owner, o, cast) {
    super(owner, o.fx);
    Object.assign(this, { len: o.len, width: o.width, life: o.time, dmg: o.dmg, kb: o.kb, stun: o.stun ?? 0.3, angle: o.angle ?? 0, interval: 0.08, status: o.status, unblockable: o.unblockable });
    this.cast = cast;
    this.grow = 0;
  }
  origin() { const p = handPos(this.owner, -116 + (this.oy ?? 0), 40); return p; }
  update(w) {
    this.t += DT;
    const o = this.owner;
    if (this.t > this.life || !o.alive || o.state !== 'cast') { this.dead = true; if (this.cast?.channel) this.cast.channel.done = true; return; }
    this.grow = Math.min(1, this.t / 0.12);
    const { x, y } = this.origin();
    const dir = o.facing, a = this.angle * Math.PI / 180;
    const ex = x + Math.cos(a) * dir * this.len * this.grow, ey = y + Math.sin(a) * this.len * this.grow;
    this.x = x; this.y = y; this.ex = ex; this.ey = ey;
    o.vx *= 0.8; if (!o.onGround) o.vy *= 0.85;
    const ticks = Math.max(1, Math.round(this.life / this.interval));
    for (const target of w.targetsOf(o)) {
      if (!this.canHit(target, this.interval)) continue;
      const hb = target.hurtbox();
      // Sample along the beam.
      let touching = false;
      for (let s = 0; s <= 1; s += 0.05) if (circleBox(x + (ex - x) * s, y + (ey - y) * s, this.width / 2, hb)) { touching = true; break; }
      if (!touching) continue;
      this.hit.set(target, this.t);
      const last = this.t + this.interval >= this.life;
      target.takeHit({ dmg: this.dmg / ticks, kb: last ? this.kb : [120, -40], dir, stun: last ? this.stun + 0.2 : 0.18, x: (hb.x1 + hb.x2) / 2, y: hb.y1 + 80, projectile: true, status: this.status, unblockable: this.unblockable, energy: 0.5 }, o);
    }
  }
}

// Owner rushes forward with a hitbox on the leading hand (Chidori, Rasengan charge, Spirit dash).
export class Rush extends Entity {
  get kind() { return 'rush'; }
  constructor(owner, o, cast) {
    super(owner, o.fx);
    Object.assign(this, { speed: o.speed, life: o.time, dmg: o.dmg, kb: o.kb, stun: o.stun ?? 0.6, multi: o.multi, status: o.status, angle: o.angle ?? 0 });
    this.cast = cast;
  }
  update(w) {
    this.t += DT;
    const o = this.owner;
    if (this.t > this.life || !o.alive || o.state !== 'cast') { this.end(o); return; }
    const a = this.angle * Math.PI / 180;
    o.vx = Math.cos(a) * this.speed * o.facing;
    o.vy = this.angle ? Math.sin(a) * this.speed : Math.min(o.vy, 0) * 0.2;
    o.invuln = Math.max(o.invuln, 0.02);
    const p = handPos(o, -110, 52);
    this.x = p.x; this.y = p.y;
    for (const target of w.targetsOf(o)) {
      if (!circleBox(p.x, p.y, 70, target.hurtbox()) || !this.canHit(target, this.multi)) continue;
      this.hit.set(target, this.t);
      target.takeHit({ dmg: this.multi ? this.dmg / 4 : this.dmg, kb: this.kb, dir: o.facing, stun: this.stun, x: p.x, y: p.y, status: this.status, energy: 2 }, o);
      if (!this.multi) { w.emit('rushImpact', { x: p.x, y: p.y, fx: this.fx }); this.end(o); return; }
    }
  }
  end(o) { this.dead = true; o.vx *= 0.3; if (this.cast?.channel) this.cast.channel.done = true; }
}

export class Trap extends Entity {
  get kind() { return 'trap'; }
  constructor(owner, o) {
    super(owner, o.fx);
    Object.assign(this, { x: o.x, y: o.y, w: o.w, h: o.h, dmg: o.dmg, kb: o.kb ?? [80, -200], stun: o.stun ?? 0.5, life: o.life ?? 6, status: o.status });
  }
  update(w) {
    this.t += DT;
    if (this.t > this.life) { this.dead = true; return; }
    if (this.t < 0.3) return;
    const box = { x1: this.x - this.w / 2, x2: this.x + this.w / 2, y1: this.y - this.h, y2: this.y };
    for (const target of w.targetsOf(this.owner)) {
      if (!boxBox(box, target.hurtbox())) continue;
      target.takeHit({ dmg: this.dmg, kb: this.kb, stun: this.stun, x: this.x, y: this.y - 30, status: this.status, unblockable: true }, this.owner);
      w.emit('trap', { x: this.x, y: this.y, fx: this.fx });
      this.dead = true;
      return;
    }
  }
}

// Purely visual afterimage attached to an event (warp swirl, aura flare...).
export class Visual extends Entity {
  get kind() { return 'visual'; }
  constructor(owner, o) { super(owner, o.fx); Object.assign(this, { x: o.x, y: o.y, life: o.life ?? 0.5, r: o.r ?? 100, follow: o.follow }); }
  update() {
    this.t += DT;
    if (this.follow) { this.x = this.owner.x; this.y = this.owner.y - 90; }
    if (this.t > this.life) this.dead = true;
  }
}

// ---------- casting ----------

export function castAbility(w, f, def, boost, cast) {
  const firstNew = w.entities.length;
  const p = def.params || {};
  const size = 1 + (boost.size || 0);
  const dmg = scaleDmg(f, p, boost);
  const aim = cast.aimY < -0.5 ? -1 : cast.aimY > 0.5 && !f.onGround ? 1 : 0;
  const enemy = w.enemyOf(f);
  switch (def.prim) {
    case 'projectile': {
      const count = (p.count ?? 1) + (boost.count || 0);
      const base = (p.angle ?? 0) + aim * (p.aimable === false ? 0 : 28);
      for (let i = 0; i < count; i++) {
        const spread = count > 1 ? (i - (count - 1) / 2) * (p.spread ?? 8) : 0;
        const a = (base + spread) * Math.PI / 180;
        const from = handPos(f, p.oy ?? -118, p.ox ?? 50);
        w.add(new Projectile(f, {
          x: from.x, y: from.y, vx: Math.cos(a) * p.speed * f.facing, vy: Math.sin(a) * p.speed,
          r: (p.r ?? 30) * size, dmg: dmg / (p.split ? count : 1), kb: p.kb ?? [500, -250], stun: p.stun ?? 0.45, life: p.life,
          gravity: p.gravity, homing: p.homing, pierce: p.pierce, status: p.status, unblockable: p.unblockable, multi: p.multi,
          explode: p.explode && { ...p.explode, r: p.explode.r * size, dmg: scaleDmg(f, p.explode, boost) }, fx: def.fx, delay: (p.stagger ?? 0) * i,
          pull: p.pull,
        }));
      }
      break;
    }
    case 'rain': {
      const tx = enemy ? enemy.x : f.x + f.facing * 300;
      const n = (p.count ?? 6) + (boost.count || 0);
      for (let i = 0; i < n; i++) {
        const x = tx + (Math.random() - 0.5) * (p.area ?? 500);
        w.add(new Projectile(f, { x: x - (p.slant ?? 0), y: w.ceiling + 40, vx: p.slant ?? 0, vy: p.speed ?? 1500, r: (p.r ?? 26) * size, dmg: dmg / n, kb: p.kb ?? [120, -200], stun: p.stun ?? 0.3, gravity: 0, fx: def.fx, delay: i * (p.stagger ?? 0.06), life: 3, status: p.status, explode: p.explode && { ...p.explode, dmg: scaleDmg(f, p.explode, boost) / n } }));
      }
      break;
    }
    case 'beam': {
      const b = new Beam(f, { len: (p.len ?? 900) * size, width: (p.width ?? 70) * size, time: p.time ?? 0.9, dmg, kb: p.kb ?? [900, -300], stun: p.stun, fx: def.fx, angle: (p.angle ?? 0) + aim * 25, status: p.status, unblockable: p.unblockable }, cast);
      cast.channel = { done: false };
      w.add(b);
      break;
    }
    case 'rush': {
      cast.channel = { done: false };
      w.add(new Rush(f, { speed: p.speed ?? 1500, time: p.time ?? 0.3, dmg, kb: p.kb ?? [950, -420], stun: p.stun, multi: p.multi, fx: def.fx, status: p.status, angle: (p.angle ?? 0) + aim * 30 }, cast));
      break;
    }
    case 'burst': {
      const at = p.at === 'enemy' && enemy ? { x: enemy.x, y: enemy.y - 90 } : { x: f.x + f.facing * (p.offset ?? 0), y: f.y - (p.oy ?? 90) };
      w.add(new Burst(f, { x: at.x, y: at.y, r: (p.r ?? 180) * size, dmg, kb: p.kb ?? 800, stun: p.stun, fx: def.fx, life: p.life ?? 0.5, ticks: p.ticks, interval: p.interval, pull: p.pull, follow: p.follow, status: p.status, unblockable: p.unblockable, delay: p.delay }));
      break;
    }
    case 'summon': {
      const x = p.at === 'enemy' && enemy ? enemy.x : f.x + f.facing * (p.offset ?? 220);
      w.add(new Strike(f, { x, y: p.air ? (enemy ? enemy.y : 0) : 0, w: (p.w ?? 300) * size, h: (p.h ?? 300) * size, dmg, kb: p.kb ?? [700, -700], stun: p.stun, delay: p.delay ?? 0.3, life: p.life ?? 1.0, fx: def.fx, dir: f.facing, status: p.status, unblockable: p.unblockable, ticks: p.ticks, interval: p.interval, vx: (p.vx ?? 0) * f.facing }));
      break;
    }
    case 'teleport': {
      const tgt = enemy;
      w.add(new Visual(f, { x: f.x, y: f.y - 90, fx: def.fx + 'Out', life: 0.4 }));
      if (p.to === 'behind' && tgt) { f.x = tgt.x - tgt.facing * 110; f.y = Math.min(tgt.y, 0); f.facing = tgt.facing; }
      else if (p.to === 'above' && tgt) { f.x = tgt.x; f.y = tgt.y - 260; f.vy = 0; f.onGround = false; }
      else { f.x += f.facing * (p.dist ?? 450); }
      f.x = Math.max(w.left + 40, Math.min(w.right - 40, f.x));
      if (f.y > 0) f.y = 0;
      f.onGround = f.y >= 0;
      f.invuln = Math.max(f.invuln, 0.15);
      w.add(new Visual(f, { x: f.x, y: f.y - 90, fx: def.fx + 'In', life: 0.4 }));
      if (p.strike && tgt) w.add(new Burst(f, { x: f.x + f.facing * 70, y: f.y - 100, r: 90, dmg, kb: p.kb ?? 700, stun: p.stun ?? 0.55, fx: def.fx + 'Hit', life: 0.3, delay: 0.06 }));
      w.emit('teleport', { f, fx: def.fx });
      break;
    }
    case 'phase':
      f.intangible = (p.time ?? 1.2) * size;
      f.phaseSig = def.id; f.phaseFx = def.fx;
      w.add(new Visual(f, { x: f.x, y: f.y - 90, fx: def.fx, life: f.intangible, follow: true }));
      if (p.dmg) w.add(new Burst(f, { x: f.x, y: f.y - 90, r: 120, dmg, kb: 300, fx: def.fx + 'Hit', follow: true, ticks: 4, interval: 0.25, life: f.intangible }));
      break;
    case 'clones': {
      const n = (p.count ?? 2) + (boost.count || 0);
      for (let i = 0; i < n; i++) w.spawnClone(f, { offset: (i + 1) * 90 * (i % 2 ? -1 : 1), life: (p.time ?? 6) * size, hp: p.hp ?? 120, fx: def.fx, explode: p.explode && scaleDmg(f, p.explode, boost) });
      break;
    }
    case 'buff':
    case 'transform': {
      const time = (p.time ?? 8) * size;
      f.buffs = f.buffs.filter(b => b.id !== def.id && !(def.prim === 'transform' && b.form));
      f.buffs.push({ id: def.id, mods: p.mods || {}, t: time, aura: def.fx, form: def.prim === 'transform' ? (p.form || def.fx) : null });
      if (def.prim === 'transform') { f.form = p.form || def.fx; if (p.heal) f.hp = Math.min(f.maxHp, f.hp + p.heal); w.emit('transform', { f, form: f.form }); }
      if (p.energy) f.energy = Math.min(100, f.energy + p.energy);
      if (p.burst) w.add(new Burst(f, { x: f.x, y: f.y - 90, r: p.burst.r ?? 200, dmg: scaleDmg(f, p.burst, boost), kb: p.burst.kb ?? 600, fx: def.fx + 'Boom', life: 0.4 }));
      break;
    }
    case 'shield':
      f.shield = { hp: (p.hp ?? 200) * size, t: p.time ?? 4, fx: def.fx, sig: def.id, max: (p.hp ?? 200) * size };
      if (p.reflect) f.shield.reflect = true;
      w.emit('shieldUp', { f, fx: def.fx });
      break;
    case 'trap':
      w.add(new Trap(f, { x: f.x + f.facing * (p.offset ?? 140), y: f.onGround ? f.y : 0, w: (p.w ?? 120) * size, h: p.h ?? 40, dmg, stun: p.stun ?? 1.2, status: p.status, fx: def.fx, life: p.life ?? 8 }));
      break;
    case 'grab': {
      if (enemy && Math.abs(enemy.x - f.x) < (p.range ?? 150) && Math.abs(enemy.y - f.y) < 140 && enemy.invuln <= 0 && enemy.intangible <= 0) {
        enemy.x = f.x + f.facing * 70;
        enemy.takeHit({ dmg, kb: p.kb ?? [700, -700], dir: f.facing, stun: p.stun ?? 0.7, x: enemy.x, y: enemy.y - 100, unblockable: true, status: p.status }, f);
        w.emit('grab', { f, target: enemy, fx: def.fx });
      } else w.emit('whiff', { f });
      break;
    }
    case 'heal':
      f.hp = Math.min(f.maxHp, f.hp + (p.hp ?? 100) * size);
      f.energy = Math.min(100, f.energy + (p.energy ?? 0));
      w.add(new Visual(f, { x: f.x, y: f.y - 90, fx: def.fx, life: 0.8, follow: true }));
      break;
    case 'counter':
      // Handled when hit during the window (Fighter.takeHit -> world.counterTriggered).
      w.add(new Visual(f, { x: f.x, y: f.y - 90, fx: def.fx, life: p.window ?? 0.6, follow: true }));
      break;
    case 'combo': {
      // A scripted multi-hit sequence on a short-range target (barrages, taijutsu chains).
      cast.channel = { done: false };
      w.add(new Rush(f, { speed: p.speed ?? 900, time: p.time ?? 0.45, dmg, kb: p.kb ?? [700, -500], stun: p.stun ?? 0.6, multi: 0.09, fx: def.fx, status: p.status }, cast));
      break;
    }
    default:
      break;
  }
  // Tag what this ability spawned so the renderer can give it the ability's own look.
  for (let i = firstNew; i < w.entities.length; i++) { w.entities[i].sig = def.id; w.entities[i].sigColor = def.color; }
  w.emit('abilityFired', { f, def, x: f.x, y: f.y });
}

export { PHYS };
