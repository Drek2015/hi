// Stage events: each arena changes over a match (weather, light, gravity) and throws its own
// hazards at both fighters every so often, always telegraphed first so they can be dodged.
import { DT } from './constants.js';

// The attacker for environmental hits: neutral, so it can hit either side.
class Nature {
  constructor() {
    Object.assign(this, { side: -1, x: 0, y: 0, facing: 1, state: 'idle', combo: 0, comboT: 0, comboDmg: 0, hp: 1, maxHp: 1, ult: 0, energy: 0, dmgFactor: 1, isClone: false, alive: true });
    this.owner = this;
  }
  mod(k) { return k === 'dmg' || k === 'ultGain' || k === 'def' || k === 'speed' ? 1 : 0; }
  setState() {}
}

let nextId = 1;

// One hazard: `tele` seconds of warning, then `active` seconds where it can hit.
class Hazard {
  constructor(type, o) { Object.assign(this, { id: 'hz' + nextId++, type, t: 0, tele: 1.2, active: 0.4, dead: false, hitSet: new Set() }, o); }
  get kind() { return 'hazard'; }
  get hazard() { return true; }
  get live() { return this.t >= this.tele && this.t < this.tele + this.active; }
}

const rand = (a, b) => a + Math.random() * (b - a);
// A spot near one of the fighters, so hazards land where the fight is.
const near = w => w.fighters[Math.floor(Math.random() * w.fighters.length)].x;
const clampX = (w, x, m) => Math.max(w.left + m, Math.min(w.right - m, x));

// Hazard types: what they hit and how. Drawn by render/hazards.js.
const TYPES = {
  // A boulder breaks off a statue and falls on a marked spot.
  boulder: { tele: 1.1, active: 0.9, setup(h, w) { h.x = clampX(w, near(w) + rand(-160, 160), 150); h.y = w.ceiling; h.vy = 0; h.r = 70; },
    tick(h, w) { if (h.t < h.tele) return; h.vy += 5200 * DT; h.y += h.vy * DT; if (h.y > -h.r) { h.y = -h.r; if (!h.landed) { h.landed = true; w.emit('hzImpact', { x: h.x, y: 0, r: 260, color: '#8d8576', big: true }); } h.active = Math.min(h.active, h.t - h.tele + 0.15); } },
    box: h => ({ x1: h.x - h.r, x2: h.x + h.r, y1: h.y - h.r, y2: h.y + h.r }), hit: { dmg: 70, kb: [300, -700], stun: 0.5 } },
  // The waterfall surges and a wave rolls across the whole floor: jump it.
  wave: { tele: 1.4, active: 1.6, setup(h, w) { h.dir = Math.random() < 0.5 ? 1 : -1; h.x = h.dir > 0 ? w.left - 100 : w.right + 100; },
    tick(h, w) { if (h.t >= h.tele) h.x += h.dir * 1900 * DT; },
    box: h => ({ x1: h.x - 90, x2: h.x + 90, y1: -110, y2: 10 }), hit: { dmg: 55, kb: [700, -900], stun: 0.6, unblockable: true } },
  // Storm lightning strikes a marked column.
  lightning: { tele: 0.9, active: 0.25, setup(h, w) { h.x = clampX(w, near(w) + rand(-120, 120), 80); },
    box: h => ({ x1: h.x - 70, x2: h.x + 70, y1: -2000, y2: 20 }), hit: { dmg: 80, kb: [200, -600], stun: 0.7, status: { type: 'paralyze', time: 0.6 } } },
  // A jet strafes the rooftop: a laser sight sweeps, then a line of fire follows it.
  strafe: { tele: 1.3, active: 1.0, setup(h, w) { h.dir = Math.random() < 0.5 ? 1 : -1; h.x0 = h.dir > 0 ? w.left : w.right; h.x = h.x0; h.len = w.right - w.left; },
    tick(h, w) { const u = h.t < h.tele ? h.t / h.tele : (h.t - h.tele) / h.active; h.x = h.x0 + h.dir * h.len * Math.min(1, u); },
    box: h => ({ x1: h.x - 60, x2: h.x + 60, y1: -200, y2: 10 }), hit: { dmg: 60, kb: [400, -500], stun: 0.5 } },
  // A Chitauri portal tears open and drops wreckage.
  portal: { tele: 1.5, active: 1.8, setup(h, w) { h.x = clampX(w, near(w) + rand(-200, 200), 300); h.y = -700; h.debris = []; },
    tick(h, w) {
      if (h.t < h.tele) return;
      if (h.debris.length < 5 && Math.random() < DT * 6) h.debris.push({ x: h.x + rand(-120, 120), y: h.y, vx: rand(-500, 500), vy: rand(100, 400), r: rand(28, 46), hit: new Set() });
      for (const d of h.debris) { d.vy += 3600 * DT; d.x += d.vx * DT; d.y += d.vy * DT; if (d.y > -d.r && !d.done) { d.done = true; d.y = -d.r; w.emit('hzImpact', { x: d.x, y: 0, r: 140, color: '#5a6278' }); } }
    },
    boxes: h => h.debris.filter(d => !d.done).map(d => ({ x1: d.x - d.r, x2: d.x + d.r, y1: d.y - d.r, y2: d.y + d.r })), hit: { dmg: 45, kb: [300, -500], stun: 0.4 } },
  // The tower's arc reactor overloads: a shockwave runs out along the roof both ways.
  overload: { tele: 1.4, active: 1.0, setup(h) { h.x = 0; h.r = 0; },
    tick(h) { if (h.t >= h.tele) h.r = (h.t - h.tele) * 1800; },
    boxes: h => [{ x1: -h.r - 60, x2: -h.r + 60, y1: -90, y2: 10 }, { x1: h.r - 60, x2: h.r + 60, y1: -90, y2: 10 }], hit: { dmg: 55, kb: [600, -700], stun: 0.5, unblockable: true } },
  // Crystal spires burst up from glowing spots in the floor.
  crystals: { tele: 1.2, active: 0.5, setup(h, w) { h.spots = [...w.fighters.map(f => clampX(w, f.x + rand(-90, 90), 120)), rand(w.left + 120, w.right - 120), rand(w.left + 120, w.right - 120)]; },
    boxes: h => h.spots.map(x => ({ x1: x - 55, x2: x + 55, y1: -260, y2: 10 })), hit: { dmg: 65, kb: [150, -1000], stun: 0.6 } },
  // Small chakra meteors rain across the dimension.
  meteors: { tele: 1.0, active: 2.2, setup(h, w) { h.rocks = []; h.w = w; },
    tick(h, w) {
      if (h.t < h.tele) return;
      if (Math.random() < DT * 7) h.rocks.push({ x: rand(w.left, w.right) - 300, y: w.ceiling, vx: 500, vy: 1400, r: 26 });
      for (const d of h.rocks) { d.x += d.vx * DT; d.y += d.vy * DT; if (d.y > -d.r && !d.done) { d.done = true; w.emit('hzImpact', { x: d.x, y: -10, r: 110, color: '#e0a8ff' }); } }
    },
    boxes: h => h.rocks.filter(d => !d.done).map(d => ({ x1: d.x - d.r, x2: d.x + d.r, y1: d.y - d.r, y2: d.y + d.r })), hit: { dmg: 35, kb: [250, -400], stun: 0.35 } },
};

// Per arena: hazards that can happen, and the weather/light cycle.
const STAGES = {
  valley: { hazards: ['boulder', 'wave', 'lightning'], weathers: ['clear', 'rain', 'storm', 'dusk'] },
  tower: { hazards: ['strafe', 'portal', 'overload'], weathers: ['night', 'fog', 'searchlights', 'fireworks'] },
  kara: { hazards: ['crystals', 'meteors', 'gravity'], weathers: ['calm', 'eclipse', 'aurora'] },
};

// For the AI: how to get out of the way of h, if f is in its path ('jump', a direction, or null).
export function hazardThreat(h, f) {
  const soon = h.t > h.tele - 0.5 && h.t < h.tele + h.active;
  if (!soon) return null;
  switch (h.type) {
    case 'wave': return Math.sign(f.x - h.x) === h.dir && Math.abs(f.x - h.x) < 520 ? 'jump' : null;
    case 'overload': return Math.abs(Math.abs(f.x) - h.r) < 420 && Math.abs(f.x) > h.r ? 'jump' : null;
    case 'boulder': return Math.abs(f.x - h.x) < h.r + 70 ? (Math.sign(f.x - h.x) || 1) : null;
    case 'lightning': return Math.abs(f.x - h.x) < 130 ? (Math.sign(f.x - h.x) || 1) : null;
    case 'strafe': return Math.sign(h.x - f.x) === -h.dir || Math.abs(h.x - f.x) > 400 ? null : 'jump';
    case 'crystals': { const x = h.spots.find(x => Math.abs(f.x - x) < 110); return x === undefined ? null : (Math.sign(f.x - x) || 1); }
    default: return null;
  }
}

export class StageEvents {
  constructor(world) {
    this.w = world;
    this.stage = STAGES[world.arena.theme] || STAGES.valley;
    this.nature = new Nature();
    this.timer = rand(9, 14);
    this.weather = this.stage.weathers[0];
    this.weatherT = rand(16, 24);
    this.mix = 1;              // 0..1 blend into the current weather (renderer fades between)
    this.prevWeather = this.weather;
    this.gravityT = 0;
    this.flash = 0;
  }

  update() {
    const w = this.w;
    // Weather and light change on their own schedule, fights or not.
    this.weatherT -= DT;
    this.mix = Math.min(1, this.mix + DT / 3);
    if (this.weatherT <= 0) {
      const options = this.stage.weathers.filter(x => x !== this.weather);
      this.prevWeather = this.weather;
      this.weather = options[Math.floor(Math.random() * options.length)];
      this.mix = 0;
      this.weatherT = rand(18, 30);
      w.emit('weather', { weather: this.weather });
    }
    if (this.weather === 'storm' && Math.random() < DT * 0.25) this.flash = 1;
    this.flash = Math.max(0, this.flash - DT * 3);
    // Low gravity spell in the Otsutsuki dimension.
    if (this.gravityT > 0) { this.gravityT -= DT; w.gravityScale = 0.45; if (this.gravityT <= 0) { w.gravityScale = 1; w.emit('gravity', { on: false }); } }

    if (w.phase !== 'fight') return;
    this.timer -= DT;
    if (this.timer <= 0) {
      this.timer = rand(11, 18);
      let type = this.stage.hazards[Math.floor(Math.random() * this.stage.hazards.length)];
      if (type === 'lightning' && this.weather !== 'storm' && this.weather !== 'rain') { this.weather = 'storm'; this.mix = 0; this.weatherT = rand(14, 20); }
      this.spawn(type);
    }
  }

  spawn(type) {
    const w = this.w;
    if (type === 'gravity') { this.gravityT = 7; w.emit('gravity', { on: true }); return; }
    const T = TYPES[type];
    const h = new Hazard(type, { tele: T.tele, active: T.active });
    T.setup(h, w);
    w.hazards.push(h);
    w.emit('hazard', { type2: type });
    if (type === 'lightning') { // storms strike twice
      const h2 = new Hazard(type, { tele: T.tele + 0.8, active: T.active }); T.setup(h2, w); w.hazards.push(h2);
    }
  }

  // Move hazards and apply their hits.
  step() {
    const w = this.w;
    for (const h of w.hazards) {
      h.t += DT;
      const T = TYPES[h.type];
      T.tick?.(h, w);
      if (h.t > h.tele + h.active + 0.6) { h.dead = true; continue; }
      if (!h.live) continue;
      const boxes = T.boxes ? T.boxes(h) : [T.box(h)];
      for (const f of [...w.fighters, ...w.clones]) {
        if (h.hitSet.has(f) || !f.alive) continue;
        const hb = f.hurtbox();
        if (!boxes.some(b => b.x1 < hb.x2 && b.x2 > hb.x1 && b.y1 < hb.y2 && b.y2 > hb.y1)) continue;
        h.hitSet.add(f);
        const n = this.nature;
        n.x = f.x + f.facing; n.facing = -f.facing; n.combo = 0;  // from in front, so a guard can catch it
        f.takeHit({ ...T.hit, kb: [...T.hit.kb], dir: h.dir || Math.sign(f.x - (h.x ?? 0)) || 1, x: f.x, y: f.y - 100 }, n);
      }
    }
    w.hazards = w.hazards.filter(h => !h.dead);
  }
}
