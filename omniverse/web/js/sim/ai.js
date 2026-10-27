// AI opponent. It "presses buttons" through the same input structure a player uses,
// so it can only do what a human could. Difficulty controls reaction time and decision quality.
import { DT, DIFFICULTY } from './constants.js';
import { emptyInput } from './fighter.js';

const RANGE = {
  projectile: 'far', beam: 'far', rain: 'far',
  rush: 'mid', teleport: 'mid', summon: 'mid', combo: 'close', pull: 'far',
  burst: 'close', grab: 'close', trap: 'close',
  buff: 'self', transform: 'self', shield: 'self', heal: 'self', clones: 'self', phase: 'defend', counter: 'defend',
};

export function abilityRange(def) { return def.range || RANGE[def.prim] || 'mid'; }

export class AIController {
  constructor(world, fighter, difficulty = 'medium') {
    this.w = world;
    this.f = fighter;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    this.think = 0;
    this.plan = null;      // { kind, t, ... }
    this.held = emptyInput();
    this.comboStep = 0;
  }

  input() {
    const f = this.f, w = this.w, d = this.d;
    const inp = emptyInput();
    inp.guard = this.held.guard; inp.jump = this.held.jump; inp.x = this.held.x; inp.y = this.held.y;
    if (w.phase !== 'fight' || !f.alive) return emptyInput();
    const e = w.enemyOf(f);
    if (!e) return inp;

    this.think -= DT;
    if (this.plan) this.plan.t -= DT;

    // Continue a combo the AI already committed to.
    if (f.state === 'attack' && f.hitIds.size > 0 && Math.random() < d.combo * 0.25) {
      if (f.moveId === 'roundhouse' && Math.random() < d.combo) this.pressAbility(inp, ['close', 'mid']);
      else inp.light = true;
    }

    if (this.think > 0) return inp;
    this.think = d.reaction * (0.6 + Math.random() * 0.8);

    const dx = e.x - f.x, adx = Math.abs(dx), dy = e.y - f.y;
    this.held = emptyInput();
    const hold = this.held;
    if (['hurt', 'tumble', 'down', 'guardbreak'].includes(f.state)) return inp;

    // Threats: incoming projectiles or an enemy swing in range.
    const threat = w.entities.find(en => en.owner.owner.side !== f.side && en.vx !== undefined && Math.sign(f.x - en.x) === Math.sign(en.vx) && Math.abs(f.x - en.x) < 420 && Math.abs(f.y - 90 - en.y) < 160);
    const swing = (e.state === 'attack' || e.state === 'cast') && adx < 260;
    if ((threat || swing) && Math.random() < d.ability * 0.5 && this.pressAbility(inp, ['defend'])) return inp;
    if ((threat || swing) && f.onGround) {
      const r = Math.random();
      if (r < d.dodge) { inp.dash = true; inp.x = -Math.sign(dx) * (Math.random() < 0.5 ? 1 : -1); return inp; }
      if (r < d.dodge + d.block) { hold.guard = true; inp.guard = true; hold.x = 0; this.think = Math.max(this.think, 0.25); return inp; }
      if (threat && r < d.dodge + d.block + 0.15) { inp.jumpP = inp.jump = true; hold.jump = true; return inp; }
    }

    // Ultimate when it will connect.
    if (f.ult >= 100 && f.slots[3] && adx < (abilityRange(f.slots[3]) === 'far' ? 900 : 380) && Math.random() < d.ability) {
      inp.x = Math.sign(dx); inp.ab[3] = true; return inp;
    }

    const aggressive = Math.random() < d.aggression;
    if (adx < 135 && Math.abs(dy) < 120) {
      // Close range: strike.
      if (!aggressive) { hold.x = -Math.sign(dx); inp.x = hold.x; return inp; }
      const r = Math.random();
      if (r < d.ability * 0.35 && this.pressAbility(inp, ['close', 'mid'])) return inp;
      inp.x = Math.sign(dx) * 0.3;
      if (r < 0.55) inp.light = true;
      else if (r < 0.75) { inp.heavy = true; if (dy < -60) inp.y = -1; }
      else if (r < 0.88) { inp.heavy = true; inp.y = -1; }
      else { inp.heavy = true; inp.y = 1; }
      this.think = Math.min(this.think, 0.12 + (1 - d.combo) * 0.2);
      return inp;
    }

    if (adx < 650) {
      if (Math.random() < d.ability * 0.6 && this.pressAbility(inp, adx < 350 ? ['mid', 'close', 'self'] : ['mid', 'far', 'self'])) return inp;
      if (aggressive) {
        hold.x = Math.sign(dx);
        if (Math.random() < 0.2 * d.speed) { inp.dash = true; inp.x = Math.sign(dx); }
        if (dy < -150 && f.onGround && Math.random() < 0.6) { inp.jumpP = true; hold.jump = true; }
      } else {
        // Footsies: step in and out, feint, or hop instead of standing frozen.
        const r = Math.random();
        if (r < 0.3) hold.guard = true;
        else if (r < 0.65) hold.x = Math.sign(dx) * (Math.random() < 0.5 ? 1 : -1);
        else if (r < 0.8 && f.onGround) { inp.jumpP = true; hold.jump = true; hold.x = Math.sign(dx); }
        else hold.x = -Math.sign(dx);
      }
      inp.x = hold.x; inp.jump = hold.jump; inp.guard = hold.guard;
      return inp;
    }

    // Far away: zone with projectiles, build energy, or close the gap.
    if (f.energy < 30 && Math.random() < 0.4 && f.onGround) { hold.guard = true; hold.y = 1; inp.guard = true; inp.y = 1; this.think = 0.6; return inp; }
    if (Math.random() < d.ability && this.pressAbility(inp, ['far', 'self'])) return inp;
    hold.x = Math.sign(dx) * d.speed;
    inp.x = hold.x;
    if (Math.random() < 0.15) { inp.dash = true; }
    if (dy < -150 && f.onGround) { inp.jumpP = true; hold.jump = true; }
    return inp;
  }

  pressAbility(inp, ranges) {
    const f = this.f;
    const opts = [];
    for (let i = 0; i < 3; i++) {
      const def = f.slots[i];
      if (!def || f.cooldowns[i] > 0 || f.energy < (def.cost ?? 0)) continue;
      if (def.ground && !f.onGround) continue;
      if (!ranges.includes(abilityRange(def))) continue;
      if (abilityRange(def) === 'self' && f.buffs.some(b => b.id === def.id)) continue;
      opts.push(i);
    }
    if (!opts.length) return false;
    const i = opts[Math.floor(Math.random() * opts.length)];
    const e = this.w.enemyOf(f);
    inp.x = Math.sign(e.x - f.x);
    inp.ab[i] = true;
    return true;
  }
}
