// Gamepad (DualSense / any standard pad), keyboard and touch input.
// Produces one control state per frame plus menu navigation edges.

const NAV_DELAY = 0.32, NAV_REPEAT = 0.085;

function deadzone(x, y, dz, shape) {
  if (shape === 'circle') {
    const m = Math.hypot(x, y);
    if (m <= dz) return [0, 0];
    const s = Math.min(1, (m - dz) / (1 - dz)) / m;
    return [x * s, y * s];
  }
  const f = v => (Math.abs(v) <= dz ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - dz) / (1 - dz)));
  return [f(x), f(y)];
}

const clamp1 = v => (v > 1 ? 1 : v < -1 ? -1 : v);

export function describeBinding(b) {
  if (!b) return 'Unbound';
  const names = ['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3',
    'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'PS', 'Touchpad'];
  if (b.type === 'button') return names[b.index] ?? `Button ${b.index}`;
  if (b.type === 'axis') return `Axis ${b.index}${b.dir > 0 ? '+' : '−'}`;
  if (b.type === 'key') return b.code.replace(/^Key/, '').replace(/^Digit/, '');
  return '?';
}

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.state = {
      throttle: 0, steer: 0, airX: 0, airY: 0, dodgeX: 0, dodgeY: 0,
      jump: false, boost: false, powerslide: false, airRoll: false, airRollLeft: false, airRollRight: false,
      ballCam: false, camX: 0, camY: 0,
    };
    this.held = {};
    this.prevHeld = {};
    this.edges = new Set();
    this.keys = new Set();
    this.padIndex = -1;
    this.padName = '';
    this.padRest = null;
    this.ballCamToggled = false;
    this.nav = { dir: null, timer: 0, events: [] };
    this.capture = null;
    this.source = 'none';
    this.touch = null;

    addEventListener('keydown', e => {
      if (this.capture && this.capture.kind === 'key') {
        e.preventDefault();
        const cb = this.capture.cb; this.capture = null;
        cb(e.code === 'Escape' ? undefined : { type: 'key', code: e.code });
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.source = 'keyboard';
        const navMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', Escape: 'back', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyQ: 'tabL', KeyE: 'tabR' };
        if (navMap[e.code]) this.nav.events.push(navMap[e.code]);
        if (e.code === 'Escape') this.edges.add('menu');
        if (e.code === 'KeyR') this.edges.add('reset');
      }
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('gamepadconnected', e => { this.padIndex = e.gamepad.index; this.padName = e.gamepad.id; this.onPad?.(true, e.gamepad.id); });
    addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.index === this.padIndex) { this.padIndex = -1; this.padName = ''; this.onPad?.(false, e.gamepad.id); }
    });
  }

  attachTouch(touch) { this.touch = touch; }

  getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = this.padIndex >= 0 ? pads[this.padIndex] : null;
    if (!pad) {
      for (const p of pads) if (p && p.connected) { pad = p; this.padIndex = p.index; this.padName = p.id; this.onPad?.(true, p.id); break; }
    }
    return pad && pad.connected ? pad : null;
  }

  readBinding(pad, b) {
    if (!b) return 0;
    if (b.type === 'key') return this.keys.has(b.code) ? 1 : 0;
    if (!pad) return 0;
    if (b.type === 'button') {
      const btn = pad.buttons[b.index];
      return btn ? (btn.value || (btn.pressed ? 1 : 0)) : 0;
    }
    if (b.type === 'axis') {
      const v = (pad.axes[b.index] ?? 0) * b.dir;
      if (b.full) return Math.max(0, Math.min(1, (v + 1) / 2));
      return Math.max(0, Math.min(1, v));
    }
    return 0;
  }

  // Called once per rendered frame.
  poll(dt, menuOpen) {
    const c = this.settings.controls;
    const pad = this.getPad();
    const st = this.state;
    const b = c.bindings;
    const held = {};
    let lx = 0, ly = 0, rx = 0, ry = 0, throttle = 0;

    if (this.capture && this.capture.kind === 'pad' && pad) this.pollCapture(pad);

    if (pad) {
      const ax = c.stickAxes;
      lx = pad.axes[ax.steerX] ?? 0; ly = pad.axes[ax.steerY] ?? 0;
      rx = pad.axes[ax.camX] ?? 0; ry = pad.axes[ax.camY] ?? 0;
      for (const k of Object.keys(b)) held[k] = this.readBinding(pad, b[k]);
      if (Math.abs(lx) + Math.abs(ly) > 0.3 || pad.buttons.some(x => x.pressed)) this.source = 'pad';
    } else for (const k of Object.keys(b)) held[k] = 0;

    // Keyboard layer.
    const K = code => this.keys.has(code);
    if (this.keys.size) {
      const kx = (K('KeyD') ? 1 : 0) - (K('KeyA') ? 1 : 0);
      const ky = (K('KeyS') ? 1 : 0) - (K('KeyW') ? 1 : 0);
      const ay = (K('ArrowDown') ? 1 : 0) - (K('ArrowUp') ? 1 : 0);
      if (kx) lx = kx;
      if (ky || ay) ly = ay || ky;
      held.throttle = Math.max(held.throttle, K('KeyW') ? 1 : 0);
      held.reverse = Math.max(held.reverse, K('KeyS') ? 1 : 0);
      held.jump = Math.max(held.jump, K('Space') || K('KeyJ') ? 1 : 0);
      held.boost = Math.max(held.boost, K('ShiftLeft') || K('ShiftRight') || K('KeyK') ? 1 : 0);
      held.powerslide = Math.max(held.powerslide, K('ControlLeft') || K('KeyC') || K('KeyL') ? 1 : 0);
      held.airRoll = Math.max(held.airRoll, K('ControlLeft') || K('KeyC') || K('KeyL') ? 1 : 0);
      held.airRollLeft = Math.max(held.airRollLeft, K('KeyQ') ? 1 : 0);
      held.airRollRight = Math.max(held.airRollRight, K('KeyE') ? 1 : 0);
      held.ballCam = Math.max(held.ballCam, K('KeyY') || K('KeyF') ? 1 : 0);
    }

    // Touch layer.
    const t = this.touch?.state;
    if (t && t.active) {
      if (t.stickActive) { lx = t.x; ly = t.y; }
      held.jump = Math.max(held.jump, t.jump ? 1 : 0);
      held.boost = Math.max(held.boost, t.boost ? 1 : 0);
      held.powerslide = Math.max(held.powerslide, t.drift ? 1 : 0);
      held.airRoll = Math.max(held.airRoll, t.drift ? 1 : 0);
      held.ballCam = Math.max(held.ballCam, t.ballCam ? 1 : 0);
      held.reverse = Math.max(held.reverse, t.brake ? 1 : 0);
      const auto = c.touchAutoThrottle ? 1 : 0;
      held.throttle = Math.max(held.throttle, t.gas ? 1 : (t.brake ? 0 : auto));
      this.source = 'touch';
    }

    // Edges
    for (const k of Object.keys(held)) {
      const on = held[k] > 0.5;
      if (on && !this.prevHeld[k]) this.edges.add(k);
      this.prevHeld[k] = on;
    }

    // Menu navigation from the pad.
    if (pad) this.pollNav(pad, lx, ly, dt);

    if (menuOpen) {
      Object.assign(st, { throttle: 0, steer: 0, airX: 0, airY: 0, dodgeX: 0, dodgeY: 0, jump: false, boost: false, powerslide: false, airRoll: false, airRollLeft: false, airRollRight: false, camX: 0, camY: 0 });
      return st;
    }

    throttle = (held.throttle || 0) - (held.reverse || 0);
    const [dx, dy] = deadzone(lx, ly, c.deadzone, c.deadzoneShape);
    const [cx, cy] = deadzone(rx, ry, 0.12, 'circle');
    st.throttle = clamp1(throttle);
    st.steer = clamp1(dx * c.steeringSensitivity);
    st.airX = clamp1(dx * c.aerialSensitivity);
    st.airY = clamp1(-dy * c.aerialSensitivity);
    st.dodgeX = dx;
    st.dodgeY = -dy;
    st.jump = held.jump > 0.5;
    st.boost = held.boost > 0.5;
    st.powerslide = held.powerslide > 0.5;
    st.airRoll = held.airRoll > 0.5;
    st.airRollLeft = held.airRollLeft > 0.5;
    st.airRollRight = held.airRollRight > 0.5;
    st.camX = cx; st.camY = cy;
    if (this.settings.camera.ballCamMode === 'toggle') {
      if (this.edges.has('ballCam')) this.ballCamToggled = !this.ballCamToggled;
      st.ballCam = this.ballCamToggled;
    } else st.ballCam = held.ballCam > 0.5;
    this.held = held;
    return st;
  }

  pollNav(pad, lx, ly, dt) {
    const btn = i => pad.buttons[i]?.pressed;
    let dir = null;
    if (btn(12) || ly < -0.6) dir = 'up';
    else if (btn(13) || ly > 0.6) dir = 'down';
    else if (btn(14) || lx < -0.6) dir = 'left';
    else if (btn(15) || lx > 0.6) dir = 'right';
    const n = this.nav;
    if (dir !== n.dir) { n.dir = dir; n.timer = NAV_DELAY; if (dir) n.events.push(dir); }
    else if (dir) {
      n.timer -= dt;
      if (n.timer <= 0) { n.timer = NAV_REPEAT; n.events.push(dir); }
    }
    const edgeBtn = (i, name) => {
      const key = 'nav' + i;
      const on = btn(i);
      if (on && !this.prevHeld[key]) n.events.push(name);
      this.prevHeld[key] = on;
    };
    edgeBtn(0, 'confirm');
    edgeBtn(1, 'back');
    edgeBtn(4, 'tabL');
    edgeBtn(5, 'tabR');
  }

  takeNav() { const e = this.nav.events; this.nav.events = []; return e; }
  takeEdge(name) { const had = this.edges.has(name); this.edges.delete(name); return had; }
  clearEdges() { this.edges.clear(); }

  // Capture the next pad button or axis for rebinding.
  beginCapture(cb) {
    const pad = this.getPad();
    this.capture = { kind: pad ? 'pad' : 'key', cb, rest: pad ? [...pad.axes] : [], armed: false, t: performance.now() };
  }

  cancelCapture() { this.capture = null; }

  pollCapture(pad) {
    const cap = this.capture;
    // Wait for every button to be released first (the confirm press that opened capture).
    const anyDown = pad.buttons.some(b => b.pressed);
    if (!cap.armed) { if (!anyDown) cap.armed = true; return; }
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed) {
        this.capture = null;
        this.prevHeld = {};
        cap.cb({ type: 'button', index: i });
        return;
      }
    }
    for (let i = 0; i < pad.axes.length; i++) {
      const d = pad.axes[i] - (cap.rest[i] ?? 0);
      if (Math.abs(d) > 0.6) {
        const dir = Math.sign(d);
        const full = Math.abs((cap.rest[i] ?? 0) + dir) < 0.2; // trigger resting at -1
        this.capture = null;
        cap.cb({ type: 'axis', index: i, dir, full });
        return;
      }
    }
  }

  rumble(strong, weak, ms) {
    if (!this.settings.controls.vibration) return;
    const pad = this.getPad();
    const act = pad?.vibrationActuator;
    if (!act) return;
    try { act.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }); } catch { /* unsupported */ }
  }
}

// On-screen controls for playing without a controller.
export class TouchControls {
  constructor(root) {
    this.root = root;
    this.state = { active: false, stickActive: false, x: 0, y: 0, jump: false, boost: false, drift: false, ballCam: false, brake: false, gas: false };
    this.stickId = null;
    this.ox = 0; this.oy = 0;
    this.buttons = new Map();
    this.base = root.querySelector('.stick-base');
    this.knob = root.querySelector('.stick-knob');
    const zone = root.querySelector('.stick-zone');
    zone.addEventListener('pointerdown', e => this.stickDown(e));
    addEventListener('pointermove', e => this.stickMove(e), { passive: false });
    addEventListener('pointerup', e => this.stickUp(e));
    addEventListener('pointercancel', e => this.stickUp(e));
    for (const el of root.querySelectorAll('[data-touch]')) {
      const key = el.dataset.touch;
      const down = e => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        this.state[key] = true; this.state.active = true;
        el.classList.add('down');
      };
      const up = e => { e.preventDefault(); this.state[key] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    }
  }

  show(on) { this.root.hidden = !on; if (!on) this.state.active = false; }

  stickDown(e) {
    e.preventDefault();
    this.stickId = e.pointerId;
    this.ox = e.clientX; this.oy = e.clientY;
    this.state.active = true;
    this.state.stickActive = true;
    this.base.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    this.base.classList.add('on');
    this.stickMove(e);
  }

  stickMove(e) {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    const R = 64;
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx *= R / m; dy *= R / m; }
    this.state.x = dx / R; this.state.y = dy / R;
    this.knob.style.transform = `translate(${this.ox + dx}px, ${this.oy + dy}px)`;
  }

  stickUp(e) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.state.stickActive = false;
    this.state.x = this.state.y = 0;
    this.base.classList.remove('on');
    this.knob.style.transform = 'translate(-200px, -200px)';
  }
}
