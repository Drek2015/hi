// A fighter: movement, basic moves, guard/dodge, hit reactions, resources and ability casting.
import { DT, PHYS, MATCH } from './constants.js';
import { MOVES, pickLight, pickHeavy } from './moves.js';
import { castAbility } from './abilities.js';

const CONTROL_STATES = new Set(['idle', 'run', 'air']);
const ADDITIVE = new Set(['cdr', 'armor', 'lifesteal', 'crit', 'airJumps']);

export function emptyInput() {
  return { x: 0, y: 0, jump: false, jumpP: false, light: false, heavy: false, guard: false, dash: false, ab: [false, false, false, false] };
}

// Combine passive mods into one stats object.
export function computeStats(char, passives, skin) {
  const s = { dmg: 1, def: 1, speed: 1, hp: MATCH.HP, regen: 1, cdr: 0, airJumps: 1, lifesteal: 0, armor: 0, ultGain: 1, crit: 0, boost: {} };
  const base = char.stats || {};
  s.dmg *= base.power ?? 1; s.def *= base.defense ?? 1; s.speed *= base.speed ?? 1; s.hp = Math.round(s.hp * (base.hp ?? 1));
  s.regen *= base.energy ?? 1;
  const mods = [...passives.map(p => p.mods || {}), skin?.mods || {}];
  for (const m of mods) {
    if (m.dmg) s.dmg *= 1 + m.dmg;
    if (m.def) s.def *= 1 + m.def;
    if (m.speed) s.speed *= 1 + m.speed;
    if (m.hp) s.hp += m.hp;
    if (m.regen) s.regen *= 1 + m.regen;
    if (m.cdr) s.cdr = Math.min(0.5, s.cdr + m.cdr);
    if (m.airJumps) s.airJumps += m.airJumps;
    if (m.lifesteal) s.lifesteal += m.lifesteal;
    if (m.armor) s.armor = Math.min(0.8, s.armor + m.armor);
    if (m.ultGain) s.ultGain *= 1 + m.ultGain;
    if (m.crit) s.crit += m.crit;
    if (m.boost) for (const [id, b] of Object.entries(m.boost)) {
      const cur = s.boost[id] || (s.boost[id] = { dmg: 0, size: 0, cd: 0, count: 0 });
      for (const k of Object.keys(b)) cur[k] = (cur[k] || 0) + b[k];
    }
  }
  return s;
}

export class Fighter {
  constructor(world, opts) {
    this.world = world;
    this.char = opts.char;
    this.skin = opts.skin;
    this.side = opts.side;
    this.slots = opts.slots;            // 4 ability defs (null allowed); slot 3 is the ultimate
    this.passives = opts.passives || [];
    this.stats = computeStats(this.char, this.passives, this.skin);
    this.isClone = !!opts.isClone;
    this.owner = opts.owner || this;
    this.id = opts.id;
    if (this.isClone) this.hp = opts.hp ?? 150;
    this.reset(opts.x ?? 0);
  }

  reset(x) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1;
    this.onGround = true; this.coyote = 0; this.jumpsLeft = this.stats.airJumps;
    this.state = 'idle'; this.stateT = 0;
    this.hp = this.isClone ? this.hp ?? 200 : this.stats.hp;
    this.maxHp = this.isClone ? this.hp : this.stats.hp;
    this.energy = this.isClone ? 0 : 40;
    this.ult = 0;
    this.guardHp = MATCH.GUARD_MAX;
    this.move = null; this.moveId = null; this.moveT = 0; this.hitIds = new Set(); this.chainReady = false; this.chainQueued = null;
    this.cast = null;
    this.stun = 0; this.invuln = 0; this.intangible = 0;
    this.dashT = 0; this.dashCd = 0;
    this.cooldowns = [0, 0, 0, 0];
    this.combo = 0; this.comboT = 0; this.comboDmg = 0;
    this.status = [];        // {type, t, dps, from}
    this.buffs = [];         // {mods, t, aura, form}
    this.form = null;        // visual/stat transformation
    this.formT = 0;
    this.shield = null;
    this.jumpBuffer = 0; this.dropThrough = 0; this.jumpCut = false;
    this.anim = 'idle'; this.animT = 0;
    this.lastInput = null;
    this.ko = false;
  }

  get alive() { return this.hp > 0; }

  mod(key) {
    let v = this.stats[key];
    for (const b of this.buffs) {
      const m = b.mods?.[key];
      if (m) v = ADDITIVE.has(key) ? v + m : v * (1 + m);
    }
    return v;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  hasStatus(t) { return this.status.some(s => s.type === t); }

  update(inp) {
    const w = this.world;
    this.lastInput = inp;
    this.stateT += DT; this.animT += DT;
    if (this.invuln > 0) this.invuln -= DT;
    if (this.intangible > 0) this.intangible -= DT;
    if (this.dashCd > 0) this.dashCd -= DT;
    if (this.dropThrough > 0) this.dropThrough -= DT;
    if (this.jumpBuffer > 0) this.jumpBuffer -= DT;
    if (this.comboT > 0) { this.comboT -= DT; if (this.comboT <= 0) { this.combo = 0; this.comboDmg = 0; } }
    for (let i = 0; i < 4; i++) if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - DT);

    // Resources
    if (!this.isClone) {
      const regen = MATCH.ENERGY_REGEN * this.mod('regen') * (this.state === 'charge' ? 7 : 1);
      this.energy = Math.min(MATCH.ENERGY_MAX, this.energy + regen * DT);
      if (this.state !== 'guard') this.guardHp = Math.min(MATCH.GUARD_MAX, this.guardHp + MATCH.GUARD_REGEN * DT);
    }

    // Status effects
    for (const s of this.status) {
      s.t -= DT;
      if (s.dps) this.hp = Math.max(this.isClone ? 0 : 1, this.hp - s.dps * DT);
    }
    this.status = this.status.filter(s => s.t > 0);
    for (const b of this.buffs) b.t -= DT;
    const ending = this.buffs.filter(b => b.t <= 0);
    if (ending.length) {
      this.buffs = this.buffs.filter(b => b.t > 0);
      if (ending.some(b => b.form)) { this.form = this.buffs.find(b => b.form)?.form ?? null; w.emit('formEnd', { f: this }); }
    }
    if (this.shield) { this.shield.t -= DT; if (this.shield.t <= 0 || this.shield.hp <= 0) this.shield = null; }

    if (!this.alive) { this.physics(emptyInput(), false); return; }

    if (inp.jumpP) this.jumpBuffer = PHYS.BUFFER;

    const rooted = this.hasStatus('root') || this.hasStatus('paralyze');

    switch (this.state) {
      case 'hurt':
      case 'tumble':
        this.stun -= DT;
        if (this.stun <= 0) {
          if (this.onGround) this.setState('idle');
          else if (this.state === 'tumble') { /* stays tumbling until landing */ } else this.setState('air');
        }
        break;
      case 'down':
        this.vx *= 0.85;
        if (this.stateT > 0.42) { this.setState('getup'); this.invuln = 0.35; }
        break;
      case 'getup':
        if (this.stateT > 0.22) this.setState('idle');
        break;
      case 'guardbreak':
        if (this.stateT > 0.9) this.setState('idle');
        break;
      case 'dash':
        this.dashT -= DT;
        this.vx = this.facing * PHYS.DASH_SPEED * Math.min(1.15, this.mod('speed'));
        if (this.stateT < 0.12) this.invuln = Math.max(this.invuln, 0.02);
        if (inp.light && this.onGround) { this.startMove('dashstrike'); break; }
        if (this.dashT <= 0) { this.vx *= 0.45; this.setState(this.onGround ? 'idle' : 'air'); }
        break;
      case 'attack':
        this.updateMove(inp);
        break;
      case 'cast':
        this.updateCast(inp);
        break;
      case 'guard':
      case 'charge':
        if (!inp.guard) { this.setState('idle'); break; }
        if (inp.dash && this.dashCd <= 0) { this.startDash(inp.x); break; }
        this.setState(inp.y > 0.6 && this.onGround ? 'charge' : 'guard');
        break;
      default:
        if (rooted) break;
        if (inp.dash && this.dashCd <= 0 && Math.abs(inp.x) > 0.3) { this.startDash(inp.x); break; }
        if (inp.guard && this.onGround) { this.setState(inp.y > 0.6 ? 'charge' : 'guard'); this.vx *= 0.3; break; }
        for (let i = 0; i < 4; i++) if (inp.ab[i] && this.tryCast(i, inp)) break;
        if (this.state === 'cast') break;
        if (inp.light) { this.startMove(pickLight(this, inp)); break; }
        if (inp.heavy) { this.startMove(pickHeavy(this, inp)); break; }
        break;
    }

    this.physics(inp, CONTROL_STATES.has(this.state) && !rooted);

    if (CONTROL_STATES.has(this.state)) {
      if (this.onGround) this.setState(Math.abs(this.vx) > 40 ? 'run' : 'idle');
      else this.setState('air');
    }
  }

  physics(inp, control) {
    const w = this.world;
    const speedMul = this.mod('speed') * (this.hasStatus('slow') ? 0.55 : 1);
    if (control) {
      if (Math.abs(inp.x) > 0.15) this.facing = Math.sign(inp.x);
      const target = inp.x * (this.onGround ? PHYS.RUN : PHYS.AIR_SPEED) * speedMul;
      const acc = (this.onGround ? PHYS.GROUND_ACCEL : PHYS.AIR_ACCEL) * DT;
      if (Math.abs(inp.x) > 0.15) this.vx += Math.max(-acc, Math.min(acc, target - this.vx));
      else if (this.onGround) this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), PHYS.FRICTION * DT);

      // Jumping with buffer, coyote time and variable height.
      if (this.jumpBuffer > 0) {
        if (this.onGround && inp.y > 0.6 && w.onThinPlatform(this)) {
          this.dropThrough = 0.25; this.onGround = false; this.y += 4; this.jumpBuffer = 0;
        } else if (this.onGround || this.coyote > 0) {
          this.vy = -PHYS.JUMP * Math.sqrt(speedMul); this.onGround = false; this.coyote = 0; this.jumpBuffer = 0; this.jumpCut = false;
          w.emit('jump', { f: this, ground: true });
        } else if (this.jumpsLeft > 0) {
          this.vy = -PHYS.AIR_JUMP; this.jumpsLeft--; this.jumpBuffer = 0; this.jumpCut = false;
          w.emit('jump', { f: this, ground: false });
        }
      }
      if (!inp.jump && this.vy < 0 && !this.jumpCut && !this.onGround) { this.vy *= PHYS.JUMP_CUT; this.jumpCut = true; }
    } else if (this.onGround && this.state !== 'dash') {
      this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), PHYS.FRICTION * 0.6 * DT);
    }

    // Gravity
    if (!this.onGround) {
      let g = PHYS.GRAVITY * (w.gravityScale ?? 1);
      if (this.state === 'cast' && this.cast?.def.hover) g *= 0.05;
      if (control && inp.y > 0.6 && this.vy > -200) g += PHYS.FAST_FALL;
      if (this.state === 'dash') g *= 0.15;
      this.vy = Math.min(PHYS.MAX_FALL * (control && inp.y > 0.6 ? 1.4 : 1), this.vy + g * DT);
    }

    const prevY = this.y;
    this.x += this.vx * DT;
    this.y += this.vy * DT;

    // Walls
    const half = PHYS.WIDTH / 2;
    if (this.x < w.left + half) { this.x = w.left + half; if (this.state === 'tumble') this.vx = Math.abs(this.vx) * 0.5; else this.vx = Math.max(0, this.vx); }
    if (this.x > w.right - half) { this.x = w.right - half; if (this.state === 'tumble') this.vx = -Math.abs(this.vx) * 0.5; else this.vx = Math.min(0, this.vx); }

    // Floors and platforms
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.vy >= 0) {
      for (const p of w.platforms) {
        if (this.x < p.x1 - half * 0.5 || this.x > p.x2 + half * 0.5) continue;
        if (p.thin && this.dropThrough > 0) continue;
        if (prevY <= p.y + 1 && this.y >= p.y) {
          this.y = p.y;
          this.land(p);
          break;
        }
      }
    }
    if (!this.onGround && wasGround && this.vy >= 0) this.coyote = PHYS.COYOTE;
    if (this.coyote > 0) this.coyote -= DT;
    if (this.y > 600) { this.y = 0; this.vy = 0; this.x = 0; }   // safety
    if (this.y < w.ceiling) { this.y = w.ceiling; this.vy = Math.max(0, this.vy); }
  }

  land(p) {
    const impact = this.vy;
    this.vy = 0;
    this.onGround = true;
    this.platform = p;
    this.jumpsLeft = this.mod('airJumps');
    if (this.state === 'tumble') {
      // Hard launches bounce once off the floor before the knockdown.
      if (impact > 1000 && !this.bounced) {
        this.bounced = true;
        this.vy = -impact * 0.32; this.vx *= 0.6; this.onGround = false;
        this.world.emit('bounce', { f: this, v: impact });
        return;
      }
      if (impact > 600 || this.bounced) { this.setState('down'); this.world.emit('bounce', { f: this, v: impact }); }
      else if (this.stun <= 0) this.setState('idle');
      else this.setState('hurt');
    } else if (this.state === 'attack' && this.move?.air) {
      // Landing cancels aerials with a short lag.
      this.move = null; this.setState('idle'); this.landLag = 0.06;
    } else if (impact > 300) this.world.emit('land', { f: this, v: impact });
  }

  startDash(dir) {
    if (Math.abs(dir) > 0.2) this.facing = Math.sign(dir);
    this.setState('dash');
    this.dashT = PHYS.DASH_TIME;
    this.dashCd = PHYS.DASH_CD;
    this.vy = Math.min(this.vy, 0) * 0.3;
    this.world.emit('dash', { f: this });
  }

  startMove(id) {
    const m = MOVES[id];
    if (!m) return;
    if (m.air && this.onGround) return;
    this.move = m; this.moveId = id; this.moveT = 0; this.hitIds = new Set(); this.chainReady = false; this.chainQueued = null;
    this.setState('attack');
    this.anim = m.anim; this.animT = 0;
    if (this.onGround && id !== 'dashstrike') this.vx *= 0.35;
    if (id === 'uppercut') this.vy = this.onGround ? -300 : this.vy;
    if (id === 'flip' && !this.onGround) this.vy = Math.min(this.vy, -260);
    this.world.emit('swing', { f: this, heavy: m.dmg > 60 });
  }

  updateMove(inp) {
    const m = this.move;
    this.moveT += DT;
    const t = this.moveT;
    if (inp.light && m.next) this.chainQueued = m.next;
    const activeStart = m.startup, activeEnd = m.startup + m.active;
    if (t >= activeStart && t < activeEnd) this.world.attackHitbox(this, m);
    // Cancel windows: chain lights after hitting or during late recovery; abilities cancel on hit.
    this.chainReady = t >= activeEnd;
    if (this.chainReady && this.chainQueued && (this.hitIds.size > 0 || t > activeEnd + 0.04)) {
      const nx = this.chainQueued; this.startMove(nx); return;
    }
    if (this.hitIds.size > 0 && t >= activeEnd) {
      for (let i = 0; i < 4; i++) if (inp.ab[i] && this.tryCast(i, inp)) return;
      if (inp.heavy && m.dmg < 60) { this.startMove(pickHeavy(this, inp)); return; }
      if (inp.jumpP && this.moveId === 'uppercut') { this.move = null; this.setState('air'); this.vy = -PHYS.AIR_JUMP; this.world.emit('jump', { f: this }); return; }
    }
    if (t >= activeEnd + m.recovery) { this.move = null; this.setState(this.onGround ? 'idle' : 'air'); }
  }

  abilityCost(def) {
    if (def.kind === 'ultimate') return 0;
    return def.cost ?? 0;
  }

  tryCast(slot, inp) {
    const def = this.slots[slot];
    if (!def) return false;
    if (this.cooldowns[slot] > 0) return false;
    if (def.kind === 'ultimate') { if (this.ult < 100) return false; }
    else if (this.energy < this.abilityCost(def)) { this.world.emit('noEnergy', { f: this }); return false; }
    if (def.ground && !this.onGround) return false;
    if (def.kind === 'ultimate') this.ult = 0; else this.energy -= this.abilityCost(def);
    const boost = this.stats.boost[def.id] || {};
    this.cooldowns[slot] = (def.cd ?? 1) * (1 - this.mod('cdr')) * (1 + (boost.cd || 0));
    this.cast = { def, slot, t: 0, fired: false, boost, aimY: inp.y };
    if (Math.abs(inp.x) > 0.2) this.facing = Math.sign(inp.x);
    this.setState('cast');
    this.anim = def.anim || 'cast'; this.animT = 0;
    if (this.onGround) this.vx *= 0.2;
    if (def.hover && !this.onGround) this.vy *= 0.2;
    this.world.emit('cast', { f: this, def });
    if (def.kind === 'ultimate') this.world.cinematic(this, def);
    return true;
  }

  updateCast(inp) {
    const c = this.cast;
    c.t += DT;
    const windup = c.def.windup ?? 0.12;
    if (!c.fired && c.t >= windup) {
      c.fired = true;
      castAbility(this.world, this, c.def, c.boost, c);
    }
    if (c.channel) {
      // Channeled abilities (beams, rushes) end themselves.
      if (c.channel.done) { this.cast = null; this.setState(this.onGround ? 'idle' : 'air'); }
      return;
    }
    if (c.fired && c.t >= windup + (c.def.recover ?? 0.22)) { this.cast = null; this.setState(this.onGround ? 'idle' : 'air'); }
  }

  // Receive a hit. Returns 'hit' | 'guard' | 'parry' | 'miss'.
  takeHit(h, attacker) {
    if (!this.alive || this.invuln > 0) return 'miss';
    if (this.intangible > 0 && !h.unblockable) return 'miss';
    const fromDir = Math.sign(this.x - (h.x ?? attacker.x)) || attacker.facing;
    // Counter stance
    if (this.cast?.def.prim === 'counter' && this.cast.t < this.cast.def.params.window) {
      this.world.counterTriggered(this, attacker);
      return 'miss';
    }
    if (this.shield && !h.unblockable) {
      this.shield.hp -= h.dmg;
      this.world.emit('shieldHit', { f: this, x: this.x, y: this.y - 100 });
      return 'guard';
    }
    const guarding = (this.state === 'guard') && Math.sign(attacker.x - this.x) === this.facing && !h.unblockable;
    if (guarding) {
      if (this.stateT < 0.1 && !h.projectile) {
        this.world.emit('parry', { f: this, a: attacker });
        if (attacker.state === 'attack') { attacker.move = null; attacker.setState('hurt'); attacker.stun = 0.45; attacker.vx = -attacker.facing * 200; }
        return 'parry';
      }
      this.guardHp -= h.dmg * 0.6;
      this.hp = Math.max(1, this.hp - h.dmg * 0.08);
      this.vx = (h.dir ?? fromDir) * Math.min(500, Math.abs(h.kb[0]) * 0.5 + 120);
      if (this.guardHp <= 0) {
        this.guardHp = 0; this.setState('guardbreak'); this.vy = -500; this.onGround = false;
        this.world.emit('guardBreak', { f: this });
      }
      this.world.emit('guard', { f: this, dmg: h.dmg });
      return 'guard';
    }
    // Damage with combo scaling, defense, crits.
    const scale = Math.max(0.35, 1 - 0.07 * attacker.owner.combo);
    let dmg = h.dmg * scale / this.mod('def');
    const crit = Math.random() < attacker.owner.mod('crit');
    if (crit) dmg *= 1.5;
    this.hp = Math.max(0, this.hp - dmg);
    const ownerA = attacker.owner;
    ownerA.combo++; ownerA.comboT = 1.1; ownerA.comboDmg += dmg;
    if (ownerA.mod('lifesteal') > 0) ownerA.hp = Math.min(ownerA.maxHp, ownerA.hp + dmg * ownerA.mod('lifesteal'));
    ownerA.ult = Math.min(100, ownerA.ult + dmg * 0.09 * ownerA.mod('ultGain'));
    this.ult = Math.min(100, this.ult + dmg * 0.05 * this.mod('ultGain'));
    ownerA.energy = Math.min(MATCH.ENERGY_MAX, ownerA.energy + (h.energy ?? 2));
    if (h.status) this.status.push({ ...h.status, t: h.status.time });

    // Super armor shrugs off light hits (stance, transformations, heavy startups).
    const armor = this.mod('armor') + (this.state === 'attack' && this.move?.armor && this.moveT < this.move.startup ? 0.6 : 0);
    if (armor > 0 && dmg < 70 * armor && this.hp > 0) {
      this.world.emit('hit', { f: this, a: attacker, dmg, x: h.x ?? this.x, y: h.y ?? this.y - 100, crit, armored: true });
      return 'hit';
    }
    const kbScale = 1 + (1 - this.hp / this.maxHp) * 0.35;
    const dir = h.dir ?? fromDir;
    this.vx = h.kb[0] * dir * kbScale;
    this.vy = h.kb[1] * kbScale;
    if (this.vy < -50) this.onGround = false;
    this.stun = h.stun * (1 - this.mod('armor') * 0.5);
    this.move = null;
    if (this.cast && !this.cast.def.uninterruptible) { this.cast.channel && (this.cast.channel.done = true); this.cast = null; }
    this.bounced = false;
    this.setState(Math.hypot(this.vx, this.vy) > 650 || this.vy < -600 ? 'tumble' : 'hurt');
    this.facing = -dir;
    if (this.hp <= 0) { this.setState('tumble'); this.vy = Math.min(this.vy, -700); this.stun = 99; }
    this.world.emit('hit', { f: this, a: attacker, dmg, x: h.x ?? this.x, y: h.y ?? this.y - 100, crit, heavy: dmg > 70, kb: h.kb });
    return 'hit';
  }

  hurtbox() {
    const h = this.state === 'down' ? 60 : PHYS.HEIGHT;
    return { x1: this.x - PHYS.WIDTH / 2, x2: this.x + PHYS.WIDTH / 2, y1: this.y - h, y2: this.y };
  }
}
