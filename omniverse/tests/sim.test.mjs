// Headless AI-vs-AI matches for every pair of fighters and difficulty: checks matches finish,
// abilities fire, nothing throws or goes NaN.
import { World } from '../web/js/sim/world.js';
import { AIController } from '../web/js/sim/ai.js';
import { ROSTER } from '../web/js/data/roster.js';
import { ARENAS } from '../web/js/data/arenas.js';

let failures = 0;
const fails = msg => { failures++; console.log('FAIL', msg); };

function loadoutFor(char, all = false, skin) {
  const ids = all ? null : char.defaultLoadout;
  const ok = a => !a.skin || a.skin === skin.id;
  const actives = char.abilities.filter(a => a.kind !== 'passive' && a.kind !== 'ultimate' && ok(a));
  const ults = char.abilities.filter(a => a.kind === 'ultimate' && ok(a));
  if (!all) return ids.map(id => char.abilities.find(a => a.id === id));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const s = new Set(); while (s.size < Math.min(3, actives.length)) s.add(pick(actives));
  return [...s, pick(ults)];
}

const fired = new Map();
const t0 = Date.now();
let matches = 0;
for (const a of ROSTER) for (const b of ROSTER) for (const diff of ['superEasy', 'medium', 'hard']) {
  for (let rep = 0; rep < 4; rep++) {
    const arena = ARENAS[(matches) % ARENAS.length];
    const mk = c => { const skin = c.skins[rep % c.skins.length]; return { char: c, skin, slots: loadoutFor(c, rep > 0, skin), passives: c.abilities.filter(x => x.kind === 'passive') }; };
    const w = new World({ arena, players: [mk(a), mk(b)] });
    const ai = [new AIController(w, w.fighters[0], diff), new AIController(w, w.fighters[1], 'medium')];
    let ticks = 0;
    try {
      while (w.phase !== 'matchEnd' && ticks < 120 * 600) {
        w.step([ai[0].input(), ai[1].input()]);
        for (const e of w.events) if (e.type === 'abilityFired') fired.set(e.def.id, (fired.get(e.def.id) || 0) + 1);
        w.events.length = 0;
        for (const f of w.fighters) if (!Number.isFinite(f.x + f.y + f.hp)) throw new Error(`NaN state for ${f.char.id}`);
        ticks++;
      }
    } catch (err) { fails(`${a.id} vs ${b.id} (${diff}): ${err.stack}`); continue; }
    if (w.phase !== 'matchEnd') fails(`${a.id} vs ${b.id} (${diff}) did not finish in 10 minutes`);
    matches++;
  }
}
const all = ROSTER.flatMap(c => c.abilities.filter(x => x.kind !== 'passive'));
const never = all.filter(x => !fired.has(x.id));
console.log(`${matches} matches in ${((Date.now() - t0) / 1000).toFixed(1)}s; ${fired.size} distinct abilities used; never used (non-skin): ${never.map(x => x.id).join(', ') || 'none'}`);
for (const c of ROSTER) {
  if (c.abilities.length !== 35) fails(`${c.id} has ${c.abilities.length} abilities, needs 35`);
  if (c.skins.length < 3) fails(`${c.id} has ${c.skins.length} skins`);
  const ids = new Set(); for (const x of c.abilities) { if (ids.has(x.id)) fails(`${c.id} duplicate ability ${x.id}`); ids.add(x.id); }
  for (const id of c.defaultLoadout) if (!ids.has(id)) fails(`${c.id} loadout references missing ${id}`);
}
console.log(failures ? `${failures} failure(s)` : 'all checks passed');
process.exit(failures ? 1 : 0);
