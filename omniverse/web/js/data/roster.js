// The fighter roster. Each character file holds looks, 3 skins, a 35-node skill tree and a default loadout.
import naruto from './chars/naruto.js';
import sasuke from './chars/sasuke.js';
import kakashi from './chars/kakashi.js';
import obito from './chars/obito.js';
import boruto from './chars/boruto.js';
import momoshiki from './chars/momoshiki.js';
import spiderman from './chars/spiderman.js';
import goku from './chars/goku.js';
import minato from './chars/minato.js';
import madara from './chars/madara.js';
import ironman from './chars/ironman.js';
import cap from './chars/cap.js';
import thor from './chars/thor.js';

export const ROSTER = [naruto, minato, kakashi, sasuke, madara, obito, momoshiki, boruto, goku, spiderman, ironman, cap, thor];

export function getChar(id) { return ROSTER.find(c => c.id === id); }
export function getAbility(char, id) { return char.abilities.find(a => a.id === id); }
