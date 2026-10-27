// Player input from a gamepad (PS5 DualSense via the standard mapping), keyboard, and touch.
// poll() is called once per sim tick and produces the fighter input with press edges.
import { emptyInput } from './sim/fighter.js';

export const ACTIONS = [
  ['jump', 'Jump'], ['light', 'Light attack'], ['heavy', 'Heavy attack'],
  ['ab0', 'Ability 1'], ['ab1', 'Ability 2'], ['ab2', 'Ability 3'], ['ab3', 'Ultimate'],
  ['guard', 'Guard (+ stick = dash, + down = charge)'], ['dash', 'Dash'],
];

// Standard-mapping button indices as printed on a DualSense.
export const PAD_NAMES = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'PS', 'Touchpad'];

export const DEFAULT_PAD = { jump: 0, light: 2, heavy: 3, ab0: 1, ab1: 5, ab2: 4, ab3: 7, guard: 6, dash: 10 };
const KEYS = {
  jump: ['Space', 'KeyW', 'ArrowUp'], light: ['KeyJ'], heavy: ['KeyK'], ab0: ['KeyU'], ab1: ['KeyI'], ab2: ['KeyO'], ab3: ['KeyL'],
  guard: ['ShiftLeft', 'KeyH'], dash: ['KeyN'],
};

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.keys = new Set();
    this.touch = { x: 0, y: 0, buttons: new Set() };
    this.prev = {};
    this.padIndex = null;
    this.lastDevice = 'touch';
    this.flick = { x: 0, t: 0 };
    this.pausePressed = false;
    addEventListener('keydown', e => { this.keys.add(e.code); this.lastDevice = 'keyboard'; if (e.code === 'Escape') this.pausePressed = true; });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('gamepadconnected', e => { this.padIndex = e.gamepad.index; this.lastDevice = 'pad'; });
    addEventListener('gamepaddisconnected', e => { if (this.padIndex === e.gamepad.index) this.padIndex = null; });
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) if (p && p.connected) { this.padIndex = p.index; return p; }
    return null;
  }

  get padConnected() { return !!this.pad(); }

  // Raw held state of each action plus the stick.
  raw() {
    const map = { ...DEFAULT_PAD, ...(this.settings.padMap || {}) };
    const dz = this.settings.deadzone ?? 0.2;
    const held = {};
    let x = 0, y = 0;
    const p = this.pad();
    if (p) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const m = Math.hypot(ax, ay);
      if (m > dz) { const k = Math.min(1, (m - dz) / (1 - dz)) / m; x = ax * k; y = ay * k; }
      const b = i => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4);
      if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
      for (const a in map) held[a] = b(map[a]);
      if (p.buttons.some(btn => btn.pressed)) this.lastDevice = 'pad';
      const opt = b(9);
      if (opt && !this.prev.__opt) this.pausePressed = true;
      this.prev.__opt = opt;
    }
    const k = c => this.keys.has(c);
    if (k('KeyA') || k('ArrowLeft')) x = -1;
    if (k('KeyD') || k('ArrowRight')) x = 1;
    if (k('KeyS') || k('ArrowDown')) y = 1;
    if (k('ArrowUp')) y = -1;
    for (const a in KEYS) if (KEYS[a].some(k)) held[a] = true;
    if (this.touch.x || this.touch.y) { x = this.touch.x; y = this.touch.y; }
    for (const a of this.touch.buttons) held[a] = true;
    return { x, y, held };
  }

  // Called once per sim tick.
  poll() {
    const { x, y, held } = this.raw();
    const inp = emptyInput();
    inp.x = x; inp.y = y;
    const edge = a => held[a] && !this.prev[a];
    inp.jump = !!held.jump; inp.jumpP = edge('jump');
    inp.light = edge('light'); inp.heavy = edge('heavy');
    inp.guard = !!held.guard;
    for (let i = 0; i < 4; i++) inp.ab[i] = edge('ab' + i);
    // Dash: dedicated button, or a stick flick while guarding.
    inp.dash = edge('dash');
    if (inp.dash && Math.abs(x) < 0.3) inp.x = this.lastFacing || 1;
    const flicked = Math.abs(x) > 0.75 && Math.abs(this.flick.x) < 0.3;
    if (held.guard && flicked) inp.dash = true;
    this.flick.x = x;
    if (Math.abs(x) > 0.3) this.lastFacing = Math.sign(x);
    for (const a of ACTIONS) this.prev[a[0]] = !!held[a[0]];
    return inp;
  }

  consumePause() { const p = this.pausePressed; this.pausePressed = false; return p; }

  rumble(strong, weak, ms) {
    if (!this.settings.rumble) return;
    const p = this.pad();
    const act = p?.vibrationActuator;
    if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    else if (!p && navigator.vibrate && this.lastDevice === 'touch') navigator.vibrate(Math.min(ms, 40));
  }
}

// Menu navigation from the gamepad: d-pad/stick moves focus, ✕ confirms, ○ goes back.
export class MenuNav {
  constructor(input, onBack) {
    this.input = input;
    this.onBack = onBack;
    this.prev = {};
    this.repeatT = 0;
    this.capture = null;   // when set, the next fresh button press goes here (for remapping)
  }

  update(dt, root) {
    const p = this.input.pad();
    if (!p) return;
    const b = i => !!p.buttons[i]?.pressed;
    if (this.capture) {
      // Wait until every button is released, then take the next press.
      const pressed = p.buttons.findIndex(x => x.pressed);
      if (this.capture.armed && pressed >= 0) { const cb = this.capture.cb; this.capture = null; this.swallow = true; cb(pressed); }
      else if (pressed < 0) this.capture.armed = true;
      return;
    }
    if (this.swallow) { if (p.buttons.some(x => x.pressed)) return; this.swallow = false; }
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    let dir = null;
    if (b(12) || ay < -0.6) dir = 'up'; else if (b(13) || ay > 0.6) dir = 'down';
    else if (b(14) || ax < -0.6) dir = 'left'; else if (b(15) || ax > 0.6) dir = 'right';
    if (dir) {
      this.repeatT -= dt;
      if (this.prev.dir !== dir || this.repeatT <= 0) { this.move(dir, root); this.repeatT = this.prev.dir === dir ? 0.12 : 0.35; }
    }
    this.prev.dir = dir;
    const fresh = i => b(i) && !this.prev[i];
    if (fresh(0)) document.activeElement?.click?.();
    if (fresh(1)) this.onBack();
    if (fresh(4)) root.querySelector('[data-pad="L1"]')?.click();
    if (fresh(5)) root.querySelector('[data-pad="R1"]')?.click();
    if (fresh(9)) root.querySelector('[data-pad="start"]')?.click();
    for (const i of [0, 1, 4, 5, 9]) this.prev[i] = b(i);
  }

  move(dir, root) {
    const items = [...root.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter(e => e.offsetParent);
    if (!items.length) return;
    const cur = document.activeElement;
    if (!items.includes(cur)) { items[0].focus(); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect();
      const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (main <= 4) continue;
      const score = main + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
}
