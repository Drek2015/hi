// Shared basic moveset. Times in seconds. Hitboxes are relative to the fighter's feet,
// x measured in the facing direction, y upward negative.

export const MOVES = {
  jab: { anim: 'jab', startup: 0.05, active: 0.05, recovery: 0.13, box: [24, -132, 78, 42], dmg: 30, kb: [130, -40], stun: 0.26, next: 'cross', energy: 3 },
  cross: { anim: 'cross', startup: 0.05, active: 0.05, recovery: 0.15, box: [24, -128, 86, 44], dmg: 34, kb: [160, -50], stun: 0.28, next: 'roundhouse', energy: 3 },
  roundhouse: { anim: 'roundhouse', startup: 0.08, active: 0.07, recovery: 0.24, box: [18, -118, 104, 60], dmg: 52, kb: [560, -340], stun: 0.42, energy: 5 },
  smash: { anim: 'smash', startup: 0.15, active: 0.08, recovery: 0.3, box: [26, -140, 112, 76], dmg: 92, kb: [860, -430], stun: 0.52, energy: 6, armor: true },
  uppercut: { anim: 'uppercut', startup: 0.09, active: 0.09, recovery: 0.27, box: [10, -200, 86, 120], dmg: 68, kb: [140, -1180], stun: 0.58, energy: 5 },
  sweep: { anim: 'sweep', startup: 0.1, active: 0.08, recovery: 0.25, box: [14, -54, 118, 54], dmg: 60, kb: [300, -520], stun: 0.5, energy: 5 },
  airkick: { anim: 'airkick', startup: 0.05, active: 0.1, recovery: 0.12, box: [8, -112, 96, 70], dmg: 40, kb: [300, -170], stun: 0.32, energy: 3, air: true },
  axe: { anim: 'axe', startup: 0.12, active: 0.08, recovery: 0.22, box: [6, -96, 96, 110], dmg: 76, kb: [200, 950], stun: 0.46, energy: 5, air: true },
  flip: { anim: 'flip', startup: 0.06, active: 0.09, recovery: 0.14, box: [-30, -230, 120, 110], dmg: 44, kb: [60, -760], stun: 0.4, energy: 3, air: true },
  dashstrike: { anim: 'dashstrike', startup: 0.04, active: 0.11, recovery: 0.2, box: [10, -130, 110, 70], dmg: 58, kb: [680, -280], stun: 0.42, energy: 4 },
};

// Context-sensitive selection (like most platform fighters).
export function pickLight(f, inp) {
  if (!f.onGround) return inp.y < -0.5 ? 'flip' : 'airkick';
  if (f.state === 'dash') return 'dashstrike';
  if (f.state === 'attack' && f.move && f.chainReady && MOVES[f.moveId].next) return MOVES[f.moveId].next;
  return 'jab';
}

export function pickHeavy(f, inp) {
  if (!f.onGround) return inp.y > 0.5 ? 'axe' : inp.y < -0.5 ? 'flip' : 'axe';
  if (inp.y < -0.5) return 'uppercut';
  if (inp.y > 0.5) return 'sweep';
  return 'smash';
}
