// Menu screens (DOM overlay). Works with touch, mouse, keyboard and a gamepad (via MenuNav).
import { ROSTER } from '../data/roster.js';
import { ARENAS } from '../data/arenas.js';
import { DIFFICULTY } from '../sim/constants.js';
import { describe } from '../data/build.js';
import { drawSpritePortrait, hasSprites } from '../render/spriteset.js';
import { nodeCost } from '../save.js';
import { ACTIONS, PAD_NAMES, DEFAULT_PAD } from '../input.js';

export const PLAYABLE = () => ROSTER.filter(hasSprites);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

function portrait(c, skin, size = 96) {
  const cv = h('canvas', { class: 'portrait', width: size, height: size });
  drawSpritePortrait(cv, c, skin);
  return cv;
}

const btn = (label, onclick, cls = '', extra = {}) => h('button', { class: `btn ${cls}`, onclick, ...extra }, label);

export class Menus {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.stack = [];
  }

  get save() { return this.app.save; }

  show(name, ...args) {
    this.current = name;
    this.args = args;
    this.root.innerHTML = '';
    this.root.style.display = '';
    const el = this[name](...args);
    this.root.append(el);
    const first = el.querySelector('[autofocus]') || el.querySelector('button');
    first?.focus({ preventScroll: true });
  }

  hide() { this.root.innerHTML = ''; this.root.style.display = 'none'; this.current = null; }

  refresh() { if (this.current) { const f = document.activeElement?.dataset?.key; this.show(this.current, ...this.args); if (f) this.root.querySelector(`[data-key="${CSS.escape(f)}"]`)?.focus({ preventScroll: true }); } }

  back() {
    const a = this.app;
    a.audio.play('back');
    switch (this.current) {
      case 'setup': case 'skills': case 'controls': case 'settings': this.show('title'); break;
      case 'picker': this.show('setup'); break;
      case 'pause': a.resume(); break;
      case 'nodeDetail': this.show('skills', this.args[0]); break;
    }
  }

  // ---------- title ----------
  title() {
    const a = this.app;
    return h('div', { class: 'screen title' },
      h('div', { class: 'logo' }, h('span', { class: 'l1' }, 'OMNIVERSE'), h('span', { class: 'l2' }, 'CLASH')),
      h('div', { class: 'menu-col' },
        btn('FIGHT', () => { a.audio.play('ok'); this.show('setup'); }, 'big', { autofocus: true }),
        btn('SKILL TREES', () => { a.audio.play('ok'); this.show('skills', a.setup.p1); }),
        btn('CONTROLS', () => { a.audio.play('ok'); this.show('controls'); }),
        btn('SETTINGS', () => { a.audio.play('ok'); this.show('settings'); }),
      ),
      h('div', { class: 'hint' }, a.input.padConnected ? 'Controller connected — ✕ select  ○ back' : 'Connect a PS5 controller any time'),
    );
  }

  // ---------- match setup ----------
  setup() {
    const a = this.app, s = a.setup;
    const fighterCard = (side) => {
      const c = ROSTER.find(x => x.id === s[side]);
      const skinIdx = Math.max(0, c.skins.findIndex(k => k.id === s[side + 'Skin']));
      const skin = c.skins[skinIdx];
      const cycle = d => { const k = c.skins[(skinIdx + d + c.skins.length) % c.skins.length]; s[side + 'Skin'] = k.id; a.audio.play('ui'); this.refresh(); };
      return h('div', { class: `card ${side}` },
        h('div', { class: 'card-title' }, side === 'p1' ? 'YOU' : 'CPU'),
        h('button', { class: 'pbtn', 'data-key': side + 'pick', onclick: () => { a.audio.play('ok'); this.show('picker', side); } }, portrait(c, skin, 160)),
        h('div', { class: 'cname' }, c.name),
        h('div', { class: 'csub' }, `${c.universe} · ${c.title}`),
        h('div', { class: 'row' },
          btn('◀', () => cycle(-1), 'small', { 'data-key': side + 'skl' }),
          h('div', { class: 'skin' }, skin.name),
          btn('▶', () => cycle(1), 'small', { 'data-key': side + 'skr' })),
        h('div', { class: 'csub dim' }, skin.desc || ''),
      );
    };
    const arena = ARENAS.find(x => x.id === s.arena);
    const ai = ARENAS.indexOf(arena);
    const cycleArena = d => { s.arena = ARENAS[(ai + d + ARENAS.length) % ARENAS.length].id; a.audio.play('ui'); this.refresh(); };
    return h('div', { class: 'screen setup' },
      h('div', { class: 'cards' }, fighterCard('p1'), h('div', { class: 'vs' }, 'VS'), fighterCard('p2')),
      h('div', { class: 'row center' },
        btn('◀', () => cycleArena(-1), 'small', { 'data-key': 'arl' }),
        h('div', { class: `arena-name theme-${arena.theme}` }, arena.name),
        btn('▶', () => cycleArena(1), 'small', { 'data-key': 'arr' })),
      h('div', { class: 'row center' }, ...Object.entries(DIFFICULTY).map(([k, d]) =>
        btn(d.label.toUpperCase(), () => { s.difficulty = k; a.audio.play('ui'); this.refresh(); }, `small ${s.difficulty === k ? 'sel' : ''}`, { 'data-key': 'd' + k }))),
      h('div', { class: 'row center' },
        btn('BACK', () => this.back(), 'small'),
        btn('FIGHT!', () => { a.audio.play('ok'); a.startMatch(); }, 'big go', { 'data-key': 'go', 'data-pad': 'start', autofocus: true })),
    );
  }

  picker(side) {
    const a = this.app, s = a.setup;
    const list = PLAYABLE();
    const cells = list.map(c => h('button', {
      class: `pick ${s[side] === c.id ? 'sel' : ''}`, 'data-key': 'c' + c.id,
      onclick: () => { s[side] = c.id; s[side + 'Skin'] = side === 'p1' ? a.save.char(c).skin : c.skins[0].id; a.audio.play('ok'); this.show('setup'); },
    }, portrait(c, c.skins[0], 88), h('span', {}, c.short || c.name.split(' ')[0])));
    if (side === 'p2') cells.push(h('button', { class: 'pick', onclick: () => { const c = list[Math.floor(Math.random() * list.length)]; s.p2 = c.id; s.p2Skin = c.skins[Math.floor(Math.random() * c.skins.length)].id; a.audio.play('ok'); this.show('setup'); } }, h('div', { class: 'qmark' }, '?'), h('span', {}, 'Random')));
    const el = h('div', { class: 'screen picker' }, h('h2', {}, side === 'p1' ? 'CHOOSE YOUR FIGHTER' : 'CHOOSE YOUR OPPONENT'), h('div', { class: 'grid' }, cells), btn('BACK', () => this.back(), 'small'));
    setTimeout(() => el.querySelector('.pick.sel')?.focus({ preventScroll: true }));
    return el;
  }

  // ---------- skill trees ----------
  skills(charId, sel) {
    const a = this.app, sv = this.save;
    const list = PLAYABLE();
    const c = list.find(x => x.id === charId) || list[0];
    const cs = sv.char(c);
    const skin = c.skins.find(k => k.id === cs.skin) || c.skins[0];
    const loadout = cs.loadout;
    const node = n => {
      const owned = sv.isUnlocked(c, n), can = sv.canUnlock(c, n), reach = sv.prereqMet(c, n);
      const slot = loadout.indexOf(n.id);
      const cls = ['node', n.kind, owned ? 'owned' : can ? 'can' : reach ? 'reach' : 'locked', slot >= 0 ? 'eq' : '', sel === n.id ? 'sel' : ''].join(' ');
      return h('button', { class: cls, 'data-key': 'n' + n.id, onclick: () => { a.audio.play('ui'); this.show('skills', c.id, n.id); } },
        h('span', { class: 'nt' }, n.name),
        h('span', { class: 'nm' }, slot >= 0 ? `SLOT ${slot + 1}` : owned ? (n.kind === 'passive' ? 'PASSIVE' : 'OWNED') : `${nodeCost(n)} PT`),
        n.skin ? h('span', { class: 'nskin' }, c.skins.find(k => k.id === n.skin)?.name) : null);
    };
    const branches = c.branches.map((b, bi) => h('div', { class: 'branch' }, h('div', { class: 'bname' }, b),
      ...c.abilities.filter(n => n.branch === bi).sort((x, y) => x.tier - y.tier).map(node)));
    const cur = c.abilities.find(n => n.id === sel);
    let detail = h('div', { class: 'detail' }, h('div', { class: 'dim' }, 'Select an ability to see what it does, unlock it, or equip it.'));
    if (cur) {
      const owned = sv.isUnlocked(c, cur);
      const actions = [];
      if (!owned) actions.push(btn(`UNLOCK (${nodeCost(cur)} PT)`, () => { if (sv.unlock(c, cur)) a.audio.play('ok'); else a.audio.play('deny'); this.refresh(); }, sv.canUnlock(c, cur) ? 'go' : 'off', { 'data-key': 'unlock' }));
      else if (cur.kind === 'active') [0, 1, 2].forEach(i => actions.push(btn(`EQUIP ${i + 1}`, () => { sv.equip(c, i, cur); a.audio.play('ok'); this.refresh(); }, loadout[i] === cur.id ? 'sel' : '', { 'data-key': 'eq' + i })));
      else if (cur.kind === 'ultimate') actions.push(btn('EQUIP ULTIMATE', () => { sv.equip(c, 3, cur); a.audio.play('ok'); this.refresh(); }, loadout[3] === cur.id ? 'sel' : '', { 'data-key': 'eq3' }));
      detail = h('div', { class: 'detail' },
        h('div', { class: 'dname' }, cur.name),
        h('div', { class: 'dkind' }, `${cur.kind.toUpperCase()} · TIER ${cur.tier}${cur.cost ? ` · ${cur.cost} ${c.energyName.toUpperCase()}` : ''}${cur.cd ? ` · ${cur.cd}s` : ''}`),
        h('div', {}, describe(cur)),
        cur.skin ? h('div', { class: 'warn' }, `Only with the ${c.skins.find(k => k.id === cur.skin)?.name} skin.`) : null,
        !owned && !sv.prereqMet(c, cur) ? h('div', { class: 'warn' }, 'Unlock the ability above it in this branch first.') : null,
        h('div', { class: 'row' }, ...actions));
    }
    const ci = list.indexOf(c);
    const go = d => { this.show('skills', list[(ci + d + list.length) % list.length].id); a.audio.play('ui'); };
    return h('div', { class: 'screen skills' },
      h('div', { class: 'row top' },
        btn('◀ L1', () => go(-1), 'small', { 'data-pad': 'L1' }),
        portrait(c, skin, 64),
        h('div', { class: 'col' }, h('div', { class: 'cname' }, c.name), h('div', { class: 'csub' }, sv.settings.unlockAll ? 'Everything unlocked (Settings)' : `${cs.points} SKILL POINTS · ${cs.wins}W ${cs.losses}L`)),
        btn('R1 ▶', () => go(1), 'small', { 'data-pad': 'R1' }),
        h('div', { class: 'loadout' }, ...loadout.map((id, i) => h('div', { class: 'lslot' }, h('b', {}, i === 3 ? 'ULT' : String(i + 1)), c.abilities.find(n => n.id === id)?.name ?? '-'))),
        btn('BACK', () => this.back(), 'small')),
      h('div', { class: 'tree' }, ...branches, detail),
    );
  }

  // ---------- controls ----------
  controls() {
    const a = this.app, st = this.save.settings;
    const map = { ...DEFAULT_PAD, ...(st.padMap || {}) };
    const rows = ACTIONS.map(([act, label]) => h('div', { class: 'crow' },
      h('span', {}, label),
      btn(PAD_NAMES[map[act]] ?? '?', () => {
        if (!a.input.padConnected) { a.audio.play('deny'); return; }
        a.audio.play('ok');
        const b = this.root.querySelector(`[data-key="m${act}"]`);
        b.textContent = 'PRESS…';
        a.nav.capture = { armed: false, cb: idx => { st.padMap = { ...map, [act]: idx }; this.save.write(); a.audio.play('ok'); this.refresh(); } };
      }, 'small', { 'data-key': 'm' + act })));
    return h('div', { class: 'screen controls' },
      h('h2', {}, 'CONTROLS'),
      h('div', { class: 'cols' },
        h('div', { class: 'col' }, h('h3', {}, 'PS5 CONTROLLER'), ...rows,
          h('div', { class: 'crow' }, h('span', {}, `Stick deadzone ${Math.round(st.deadzone * 100)}%`),
            btn('-', () => { st.deadzone = Math.max(0.05, +(st.deadzone - 0.05).toFixed(2)); this.save.write(); this.refresh(); }, 'small', { 'data-key': 'dz-' }),
            btn('+', () => { st.deadzone = Math.min(0.5, +(st.deadzone + 0.05).toFixed(2)); this.save.write(); this.refresh(); }, 'small', { 'data-key': 'dz+' })),
          btn('RESET TO DEFAULT', () => { st.padMap = null; this.save.write(); this.refresh(); }, 'small')),
        h('div', { class: 'col help' }, h('h3', {}, 'HOW TO FIGHT'),
          h('p', {}, 'Left stick moves. Up/✕ jumps (twice in the air). Down while falling drops faster; down + jump drops through platforms.'),
          h('p', {}, '□ light attacks chain into combos; stick direction changes the move (up = launcher, down = sweep). △ is a heavy attack.'),
          h('p', {}, 'Hold L2 to guard (tap it right as a hit lands to parry). L2 + flick the stick, or L3, dashes with brief invincibility. L2 + down charges energy.'),
          h('p', {}, '○ R1 L1 fire your three equipped abilities. R2 fires your ultimate when the meter is full. Options pauses.'),
          h('p', {}, 'Keyboard: WASD move, Space jump, J/K attacks, U/I/O abilities, L ultimate, Shift guard, N dash, Esc pause.'))),
      btn('BACK', () => this.back(), 'small'),
    );
  }

  settings() {
    const a = this.app, st = this.save.settings;
    const toggle = (label, key, values) => {
      const i = values.findIndex(v => v[0] === st[key]);
      return h('div', { class: 'crow' }, h('span', {}, label),
        btn(values[i < 0 ? 0 : i][1], () => { st[key] = values[(i + 1) % values.length][0]; this.save.write(); a.applySettings(); a.audio.play('ui'); this.refresh(); }, 'small', { 'data-key': 's' + key }));
    };
    return h('div', { class: 'screen settings' },
      h('h2', {}, 'SETTINGS'),
      h('div', { class: 'col narrow' },
        toggle('Sound effects', 'sfx', [[0.8, 'ON'], [0.4, 'LOW'], [0, 'OFF']]),
        toggle('Controller rumble', 'rumble', [[true, 'ON'], [false, 'OFF']]),
        toggle('Touch controls', 'touch', [['auto', 'AUTO'], ['on', 'ALWAYS'], ['off', 'OFF']]),
        toggle('Unlock every ability (free play)', 'unlockAll', [[false, 'OFF'], [true, 'ON']]),
        toggle('Show FPS', 'showFps', [[false, 'OFF'], [true, 'ON']]),
        h('div', { class: 'crow' }, h('span', {}, 'Reset all skill progress'), btn('RESET', () => { if (confirm('Reset all skill points and unlocks?')) { this.save.reset(); a.audio.play('back'); } }, 'small'))),
      btn('BACK', () => this.back(), 'small', { autofocus: true }),
    );
  }

  // ---------- in-match ----------
  pause() {
    const a = this.app, f = a.world.fighters[0];
    return h('div', { class: 'screen pause' },
      h('h2', {}, 'PAUSED'),
      h('div', { class: 'menu-col' },
        btn('RESUME', () => a.resume(), 'big', { autofocus: true }),
        btn('RESTART', () => a.startMatch()),
        btn('QUIT TO MENU', () => a.quit())),
      h('div', { class: 'moves' }, ...f.slots.map((d, i) => d && h('div', {}, h('b', {}, ['○', 'R1', 'L1', 'R2'][i] + ' '), d.name, h('span', { class: 'dim' }, ' — ' + describe(d))))),
    );
  }

  results(won, pts) {
    const a = this.app, s = a.setup;
    const c = ROSTER.find(x => x.id === (won ? s.p1 : s.p2));
    const skin = c.skins.find(k => k.id === (won ? s.p1Skin : s.p2Skin)) || c.skins[0];
    return h('div', { class: 'screen results' },
      h('h2', { class: won ? 'win' : 'lose' }, won ? 'VICTORY' : 'DEFEAT'),
      portrait(c, skin, 180),
      h('div', { class: 'cname' }, `${c.name} wins`),
      h('div', { class: 'csub' }, `+${pts} skill point${pts === 1 ? '' : 's'} for ${ROSTER.find(x => x.id === s.p1).name}`),
      h('div', { class: 'row center' },
        btn('REMATCH', () => a.startMatch(), 'big go', { autofocus: true }),
        btn('CHANGE FIGHTERS', () => { a.toMenu(); this.show('setup'); }),
        btn('SKILL TREE', () => { a.toMenu(); this.show('skills', s.p1); }),
        btn('MAIN MENU', () => { a.toMenu(); this.show('title'); })),
    );
  }
}
