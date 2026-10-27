// Helpers for writing roster data compactly.
// A node is an ability in a character's skill tree: active, passive, transform or ultimate.

const P = (prim, params, extra = {}) => ({ prim, params, ...extra });

export const prim = {
  projectile: (dmg, o = {}) => P('projectile', { dmg, speed: 1300, r: 30, kb: [520, -260], stun: 0.45, ...o }),
  rain: (dmg, o = {}) => P('rain', { dmg, count: 8, area: 560, speed: 1700, ...o }),
  beam: (dmg, o = {}) => P('beam', { dmg, len: 1000, width: 80, time: 0.9, kb: [950, -320], ...o }, { windup: o.windup ?? 0.35 }),
  rush: (dmg, o = {}) => P('rush', { dmg, speed: 1600, time: 0.32, kb: [980, -430], stun: 0.65, ...o }),
  combo: (dmg, o = {}) => P('combo', { dmg, speed: 700, time: 0.5, ...o }),
  burst: (dmg, o = {}) => P('burst', { dmg, r: 190, kb: 820, ...o }),
  summon: (dmg, o = {}) => P('summon', { dmg, w: 320, h: 320, kb: [760, -720], delay: 0.35, ...o }, { windup: o.windup ?? 0.2 }),
  teleport: (dmg, o = {}) => P('teleport', { dmg, to: 'behind', strike: dmg > 0, ...o }, { windup: 0.06, recover: 0.12 }),
  phase: (o = {}) => P('phase', { time: 1.2, ...o }, { windup: 0.04, recover: 0.08 }),
  clones: (o = {}) => P('clones', { count: 2, time: 7, hp: 140, ...o }),
  buff: (mods, o = {}) => P('buff', { mods, time: 10, ...o }),
  transform: (form, mods, o = {}) => P('transform', { form, mods, time: 12, ...o }, { windup: 0.35, recover: 0.3 }),
  shield: (hp, o = {}) => P('shield', { hp, time: 4, ...o }),
  trap: (dmg, o = {}) => P('trap', { dmg, ...o }),
  grab: (dmg, o = {}) => P('grab', { dmg, range: 160, ...o }),
  heal: (hp, o = {}) => P('heal', { hp, ...o }),
  counter: (dmg, o = {}) => P('counter', { dmg, window: 0.6, ...o }, { windup: 0.02, recover: 0.5 }),
};

// Active ability node.
export function A(id, name, branch, tier, p, o = {}) {
  return { id, name, branch, tier, kind: 'active', cost: o.cost ?? 25, cd: o.cd ?? 4, anim: o.anim ?? 'cast', fx: o.fx ?? id, ...p, ...o, params: { ...p.params, ...(o.params || {}) } };
}

// Passive node.
export function S(id, name, branch, tier, mods, desc) {
  return { id, name, branch, tier, kind: 'passive', mods, desc };
}

// Ultimate node (fires from the ultimate meter).
export function U(id, name, branch, tier, p, o = {}) {
  return { id, name, branch, tier, kind: 'ultimate', cd: 0, anim: o.anim ?? 'ultimate', fx: o.fx ?? id, uninterruptible: true, windup: o.windup ?? 0.5, ...p, ...o, params: { ...p.params, ...(o.params || {}) } };
}

// Describe a node in plain words for the skill tree.
export function describe(n) {
  if (n.desc) return n.desc;
  const p = n.params || {};
  const d = Math.round(p.dmg ?? 0);
  switch (n.prim) {
    case 'projectile': return `Fires ${p.count > 1 ? p.count + ' ' : 'a '}projectile${p.count > 1 ? 's' : ''} for ${d} damage${p.explode ? ' that explodes' : ''}${p.homing ? ', homing' : ''}.`;
    case 'rain': return `Rains ${p.count} strikes on the enemy's area for ${d} total damage.`;
    case 'beam': return `Channels a beam for ${d} total damage.`;
    case 'rush': return `Charges forward and strikes for ${d} damage.`;
    case 'combo': return `A rushing multi-hit barrage for ${d} damage.`;
    case 'burst': return `Erupts around you for ${d} damage.`;
    case 'summon': return `Summons a massive strike for ${d} damage.`;
    case 'teleport': return d ? `Teleports behind the enemy and strikes for ${d} damage.` : 'Teleports instantly.';
    case 'phase': return `Become intangible for ${p.time}s${d ? ' while damaging nearby enemies' : ''}.`;
    case 'clones': return `Creates ${p.count} clones that fight for ${p.time}s.`;
    case 'buff': return `Powers up for ${p.time}s.`;
    case 'transform': return `Transforms for ${p.time}s, boosting damage, defense and speed.`;
    case 'shield': return `Raises a shield that absorbs ${p.hp} damage.`;
    case 'trap': return `Sets a trap that deals ${d} damage and holds the enemy.`;
    case 'grab': return `Grabs a nearby enemy for ${d} damage.`;
    case 'heal': return `Restores ${p.hp} health${p.energy ? ' and energy' : ''}.`;
    case 'counter': return `Counter stance: if hit, warp behind the attacker and strike for ${d}.`;
    default: return '';
  }
}
