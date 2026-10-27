// Progress and settings, kept in localStorage.
import { ROSTER } from './data/roster.js';

const KEY = 'omniverse-save-v1';

const DEFAULT_SETTINGS = {
  padMap: null, deadzone: 0.2, rumble: true, sfx: 0.8, touch: 'auto', unlockAll: false, showFps: false, damageNumbers: false,
};

export const START_POINTS = 6;

export function nodeCost(n) {
  if (n.kind === 'ultimate') return 4;
  if (n.tier === 0) return 0;
  return n.tier <= 3 ? 1 : n.tier <= 7 ? 2 : 3;
}

function freshChar(c) {
  const unlocked = new Set(c.defaultLoadout);
  for (const a of c.abilities) if (a.tier === 0 && a.kind !== 'ultimate') unlocked.add(a.id);
  return { points: START_POINTS, unlocked: [...unlocked], loadout: [...c.defaultLoadout], skin: c.skins[0].id, wins: 0, losses: 0 };
}

export class Save {
  constructor() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    this.data = data && data.chars ? data : { chars: {}, settings: {} };
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
    for (const c of ROSTER) if (!this.data.chars[c.id]) this.data.chars[c.id] = freshChar(c);
    this.last = this.data.last || null;
  }

  get settings() { return this.data.settings; }

  char(c) { return this.data.chars[c.id]; }

  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } }

  isUnlocked(c, n) { return this.settings.unlockAll || this.char(c).unlocked.includes(n.id); }

  // A node can be bought when the node one tier below it in the same branch is owned.
  canUnlock(c, n) {
    if (this.isUnlocked(c, n)) return false;
    const cs = this.char(c);
    if (cs.points < nodeCost(n)) return false;
    return this.prereqMet(c, n);
  }

  prereqMet(c, n) {
    if (n.tier === 0) return true;
    return c.abilities.some(o => o.branch === n.branch && o.tier === n.tier - 1 && this.isUnlocked(c, o));
  }

  unlock(c, n) {
    if (!this.canUnlock(c, n)) return false;
    const cs = this.char(c);
    cs.points -= nodeCost(n);
    cs.unlocked.push(n.id);
    this.write();
    return true;
  }

  // Abilities this character can actually use with a skin.
  usable(c, n, skinId) { return this.isUnlocked(c, n) && (!n.skin || n.skin === skinId); }

  equip(c, slot, n) {
    const cs = this.char(c);
    const idx = cs.loadout.indexOf(n.id);
    if (idx >= 0 && idx !== slot) cs.loadout[idx] = cs.loadout[slot];
    cs.loadout[slot] = n.id;
    this.write();
  }

  // The fighter definition for a match: loadout (falling back to defaults when a slot is unusable
  // with this skin) and every unlocked passive.
  playerSetup(c, skin) {
    const cs = this.char(c);
    const slots = cs.loadout.map((id, i) => {
      const n = c.abilities.find(a => a.id === id);
      if (n && this.usable(c, n, skin.id) && (i === 3) === (n.kind === 'ultimate')) return n;
      const fallback = c.abilities.find(a => a.id === c.defaultLoadout[i]);
      return fallback && (!fallback.skin || fallback.skin === skin.id) ? fallback
        : c.abilities.find(a => (i === 3 ? a.kind === 'ultimate' : a.kind === 'active') && !a.skin);
    });
    const passives = c.abilities.filter(a => a.kind === 'passive' && this.usable(c, a, skin.id));
    return { char: c, skin, slots, passives };
  }

  reward(c, won, difficulty) {
    const bonus = { superEasy: 0, easy: 1, medium: 2, hard: 3 }[difficulty] ?? 0;
    const pts = won ? 3 + bonus : 1;
    const cs = this.char(c);
    cs.points += pts;
    if (won) cs.wins++; else cs.losses++;
    this.write();
    return pts;
  }

  remember(setup) { this.data.last = setup; this.write(); }

  reset() { this.data.chars = {}; for (const c of ROSTER) this.data.chars[c.id] = freshChar(c); this.write(); }
}

// A CPU opponent's kit: random unlocked-looking loadout for its skin; more passives on harder levels.
export function cpuSetup(c, skin, difficulty) {
  const ok = a => !a.skin || a.skin === skin.id;
  const actives = c.abilities.filter(a => a.kind === 'active' && ok(a));
  const ults = c.abilities.filter(a => a.kind === 'ultimate' && ok(a));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const set = new Set(c.defaultLoadout.slice(0, 3).map(id => actives.find(a => a.id === id)).filter(Boolean));
  if (difficulty !== 'superEasy') { set.clear(); while (set.size < Math.min(3, actives.length)) set.add(pick(actives)); }
  const share = { superEasy: 0, easy: 0.25, medium: 0.5, hard: 1 }[difficulty] ?? 0.5;
  const passives = c.abilities.filter(a => a.kind === 'passive' && ok(a) && Math.random() < share);
  return { char: c, skin, slots: [...set, pick(ults)], passives };
}
