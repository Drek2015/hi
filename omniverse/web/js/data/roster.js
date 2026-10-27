// The fighter roster. Each character file holds looks, 3 skins, a 35-node skill tree and a default loadout.
import naruto from './chars/naruto.js';
import sasuke from './chars/sasuke.js';
import kakashi from './chars/kakashi.js';
import obito from './chars/obito.js';
import boruto from './chars/boruto.js';
import momoshiki from './chars/momoshiki.js';
import spiderman from './chars/spiderman.js';
import goku from './chars/goku.js';

export const ROSTER = [naruto, sasuke, kakashi, obito, boruto, momoshiki, spiderman, goku];

export function getChar(id) { return ROSTER.find(c => c.id === id); }
export function getAbility(char, id) { return char.abilities.find(a => a.id === id); }
