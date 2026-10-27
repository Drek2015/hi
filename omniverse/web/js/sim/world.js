// A match: two fighters (plus clones), ability entities, rounds, hit-stop and slow motion.
import { DT, MATCH } from './constants.js';
import { Fighter, emptyInput } from './fighter.js';
import { Burst, Visual } from './abilities.js';

export class World {
  constructor({ arena, players, roundsToWin = MATCH.ROUNDS_TO_WIN }) {
    this.arena = arena;
    this.left = arena.left; this.right = arena.right; this.ceiling = arena.ceiling;
    this.platforms = arena.platforms;
    this.events = [];
    this.entities = [];
    this.clones = [];
    this.time = 0;
    this.hitstop = 0;
    this.slowmo = 0; this.slowScale = 1;
    this.flash = null;
    this.roundsToWin = roundsToWin;
    this.wins = [0, 0];
    this.round = 0;
    this.fighters = players.map((p, i) => {
      const f = new Fighter(this, { char: p.char, skin: p.skin, slots: p.slots, passives: p.passives, side: i, id: i, x: i ? 380 : -380 });
      f.dmgFactor = p.dmgFactor ?? 1;
      return f;
    });
    this.startRound();
  }

  startRound() {
    this.round++;
    this.entities = []; this.clones = [];
    this.fighters.forEach((f, i) => f.reset(i ? 380 : -380));
    this.phase = 'intro'; this.phaseT = 0;
    this.timer = MATCH.ROUND_TIME;
    this.emit('roundStart', { round: this.round });
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (type === 'hit') {
      const stop = Math.min(0.13, Math.max(0.045, data.dmg * 0.0011)) * (data.crit ? 1.4 : 1);
      if (!data.armored) this.hitstop = Math.max(this.hitstop, stop);
    }
  }

  add(e) { this.entities.push(e); }

  enemyOf(f) {
    const side = f.owner.side;
    return this.fighters.find(o => o.side !== side);
  }

  targetsOf(owner) {
    const side = owner.owner.side;
    const out = [];
    for (const f of this.fighters) if (f.side !== side && f.alive) out.push(f);
    for (const c of this.clones) if (c.owner.side !== side && c.alive) out.push(c);
    return out;
  }

  onThinPlatform(f) { return !!f.platform?.thin && f.y < -1; }

  attackHitbox(f, m) {
    const [bx, by, bw, bh] = m.box;
    const x1 = f.facing > 0 ? f.x + bx : f.x - bx - bw;
    const box = { x1, x2: x1 + bw, y1: f.y + by, y2: f.y + by + bh };
    for (const t of this.targetsOf(f)) {
      if (f.hitIds.has(t)) continue;
      const hb = t.hurtbox();
      if (box.x1 < hb.x2 && box.x2 > hb.x1 && box.y1 < hb.y2 && box.y2 > hb.y1) {
        f.hitIds.add(t);
        const dmg = m.dmg * f.owner.mod('dmg') * (f.owner.dmgFactor ?? 1) * (f.isClone ? 0.5 : 1);
        t.takeHit({ dmg, kb: m.kb, dir: f.facing, stun: m.stun, x: (Math.max(box.x1, hb.x1) + Math.min(box.x2, hb.x2)) / 2, y: (Math.max(box.y1, hb.y1) + Math.min(box.y2, hb.y2)) / 2, energy: m.energy }, f);
      }
    }
  }

  spawnClone(owner, o) {
    const c = new Fighter(this, { char: owner.char, skin: owner.skin, slots: [], passives: [], side: owner.side, isClone: true, owner, hp: o.hp, x: owner.x + o.offset });
    c.facing = owner.facing;
    c.life = o.life;
    c.explode = o.explode;
    c.form = owner.form;
    c.cloneFx = o.fx;
    this.clones.push(c);
    this.add(new Visual(owner, { x: c.x, y: c.y - 90, fx: 'smoke', life: 0.5 }));
  }

  counterTriggered(def, attacker) {
    const p = def.cast.def.params;
    const a = attacker.owner;
    def.x = a.x - a.facing * 100; def.facing = a.facing;
    def.invuln = 0.4;
    this.add(new Visual(def, { x: def.x, y: def.y - 90, fx: def.cast.def.fx + 'In', life: 0.4 }));
    this.add(new Burst(def, { x: def.x + def.facing * 70, y: def.y - 100, r: 100, dmg: (p.dmg ?? 120) * def.mod('dmg') * (def.dmgFactor ?? 1), kb: 900, stun: 0.7, fx: def.cast.def.fx + 'Hit', life: 0.3, delay: 0.05, unblockable: true }));
    def.cast = null; def.setState('idle');
    this.emit('counter', { f: def });
  }

  cinematic(f, def) {
    this.slowmo = 0.55; this.slowScale = 0.22;
    this.flash = { t: 0, color: def.color || '#fff', name: def.name, f };
    this.emit('ultimate', { f, def });
  }

  // Advance one tick. inputs: [input0, input1].
  step(inputs) {
    this.time += DT;
    if (this.flash) { this.flash.t += DT; if (this.flash.t > 1.2) this.flash = null; }
    if (this.phase === 'intro') {
      this.phaseT += DT;
      if (this.phaseT > 1.6) { this.phase = 'fight'; this.emit('fight'); }
      this.fighters.forEach(f => f.update(emptyInput()));
      return;
    }
    if (this.phase === 'ko' || this.phase === 'timeup') {
      this.phaseT += DT;
      this.slowScale = this.phaseT < 1.2 ? 0.35 : 1;
      if (this.phaseT > 2.6) this.endRound();
    }
    if (this.phase === 'matchEnd') { this.phaseT += DT; }

    if (this.hitstop > 0) { this.hitstop -= DT; return; }
    if (this.slowmo > 0) { this.slowmo -= DT; if (this.slowmo <= 0) this.slowScale = 1; }

    const active = this.phase === 'fight';
    this.fighters.forEach((f, i) => {
      const inp = active ? inputs[i] : emptyInput();
      f.update(inp);
    });
    // Fighters face each other while not committed to an action.
    const [a, b] = this.fighters;
    for (const [f, o] of [[a, b], [b, a]]) {
      if ((f.state === 'idle' || f.state === 'guard' || f.state === 'charge') && f.onGround) f.facing = Math.sign(o.x - f.x) || f.facing;
    }
    // Push fighters apart.
    if (a.alive && b.alive && Math.abs(a.x - b.x) < 56 && Math.abs(a.y - b.y) < 140 && a.intangible <= 0 && b.intangible <= 0) {
      const push = (56 - Math.abs(a.x - b.x)) / 2 * (Math.sign(a.x - b.x) || 1);
      a.x += push; b.x -= push;
    }

    for (const c of this.clones) this.updateClone(c);
    this.clones = this.clones.filter(c => {
      if (c.alive && c.life > 0) return true;
      this.add(new Visual(c.owner, { x: c.x, y: c.y - 90, fx: 'smoke', life: 0.5 }));
      if (c.explode) this.add(new Burst(c.owner, { x: c.x, y: c.y - 90, r: 150, dmg: c.explode, kb: 700, fx: 'cloneBoom', life: 0.4 }));
      this.emit('poof', { x: c.x, y: c.y - 90 });
      return false;
    });

    for (const e of this.entities) e.update(this);
    this.clashProjectiles();
    this.entities = this.entities.filter(e => !e.dead);

    if (active) {
      this.timer -= DT;
      const dead = this.fighters.filter(f => !f.alive);
      if (dead.length) {
        this.phase = 'ko'; this.phaseT = 0;
        const winner = this.fighters.find(f => f.alive);
        this.roundWinner = winner ? winner.side : -1;
        this.emit('ko', { winner: this.roundWinner });
      } else if (this.timer <= 0) {
        this.phase = 'timeup'; this.phaseT = 0;
        const [p, q] = this.fighters.map(f => f.hp / f.maxHp);
        this.roundWinner = p === q ? -1 : p > q ? 0 : 1;
        this.emit('timeup', { winner: this.roundWinner });
      }
    }
  }

  clashProjectiles() {
    const ps = this.entities.filter(e => e.vx !== undefined && e.r && !e.dead && !(e.delay > 0) && e.clash);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i], q = ps[j];
      if (p.owner.owner.side === q.owner.owner.side) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) > p.r + q.r) continue;
      const pw = p.dmg, qw = q.dmg;
      this.emit('clash', { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      if (pw >= qw * 1.5) { q.dead = true; p.dmg -= qw; }
      else if (qw >= pw * 1.5) { p.dead = true; q.dmg -= pw; }
      else { p.die(this); q.die(this); }
    }
  }

  updateClone(c) {
    c.life -= DT;
    const enemy = this.enemyOf(c);
    const inp = emptyInput();
    if (enemy) {
      const dx = enemy.x - c.x;
      if (Math.abs(dx) > 90) inp.x = Math.sign(dx);
      else if (c.state !== 'attack' && Math.random() < 0.08) inp.light = true;
      if (enemy.y < c.y - 160 && c.onGround && Math.random() < 0.03) inp.jumpP = inp.jump = true;
    }
    c.update(inp);
  }

  endRound() {
    if (this.roundWinner >= 0) this.wins[this.roundWinner]++;
    const champ = this.wins.findIndex(w => w >= this.roundsToWin);
    if (champ >= 0) { this.phase = 'matchEnd'; this.phaseT = 0; this.matchWinner = champ; this.emit('matchEnd', { winner: champ }); }
    else this.startRound();
  }
}
