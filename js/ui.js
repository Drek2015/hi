// HUD, pause menu and settings screens. Fully navigable with a controller:
// D-pad / left stick to move, ✕ to select, ○ to go back, L1/R1 to switch tabs.
import { saveSettings, resetSection, BINDING_LABELS, DEFAULT_BINDINGS, TRAINING_ACTIONS } from './settings.js';
import { describeBinding } from './input.js';
import { SPAWNS } from './constants.js';

const $ = (sel, root = document) => root.querySelector(sel);

const fmt = (v, step) => {
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return Number(v).toFixed(dec);
};

// Settings schema: [section, key, label, type, options]
const TABS = [
  {
    id: 'camera', label: 'Camera', items: [
      ['camera', 'fov', 'Field of View', 'range', { min: 60, max: 110, step: 1 }],
      ['camera', 'distance', 'Distance', 'range', { min: 100, max: 400, step: 10 }],
      ['camera', 'height', 'Height', 'range', { min: 40, max: 200, step: 10 }],
      ['camera', 'angle', 'Angle', 'range', { min: -15, max: 0, step: 1 }],
      ['camera', 'stiffness', 'Stiffness', 'range', { min: 0, max: 1, step: 0.05 }],
      ['camera', 'swivelSpeed', 'Swivel Speed', 'range', { min: 1, max: 10, step: 0.1 }],
      ['camera', 'transitionSpeed', 'Transition Speed', 'range', { min: 1, max: 2, step: 0.1 }],
      ['camera', 'ballCamMode', 'Ball Camera', 'choice', { values: ['toggle', 'hold'], labels: ['Toggle', 'Hold'] }],
      ['camera', 'invertSwivel', 'Invert Swivel', 'toggle'],
      ['camera', 'shake', 'Camera Shake', 'toggle'],
      [null, 'reset:camera', 'Reset Camera Defaults', 'action'],
    ],
  },
  {
    id: 'controls', label: 'Controller', items: [
      ['controls', 'deadzoneShape', 'Deadzone Shape', 'choice', { values: ['cross', 'circle'], labels: ['Cross', 'Circle'] }],
      ['controls', 'deadzone', 'Controller Deadzone', 'range', { min: 0, max: 0.5, step: 0.01 }],
      ['controls', 'dodgeDeadzone', 'Dodge Deadzone', 'range', { min: 0.1, max: 1, step: 0.01 }],
      ['controls', 'steeringSensitivity', 'Steering Sensitivity', 'range', { min: 0.1, max: 10, step: 0.05 }],
      ['controls', 'aerialSensitivity', 'Aerial Sensitivity', 'range', { min: 0.1, max: 10, step: 0.05 }],
      ['controls', 'vibration', 'Controller Vibration', 'toggle'],
      ['controls', 'touchAutoThrottle', 'Touch Auto-Throttle', 'toggle'],
      [null, 'deadzoneViz', 'Stick Preview', 'viz'],
      [null, 'padTest', 'Controller Test', 'padtest'],
      [null, 'reset:controls', 'Reset Controller Defaults', 'action'],
    ],
  },
  { id: 'bindings', label: 'Bindings', items: 'bindings' },
  {
    id: 'models', label: 'Models', items: [
      [null, 'file:car', 'Car Model (.glb)', 'file'],
      ['models', 'carYaw', 'Car Model Facing', 'choice', { values: [0, 90, 180, 270], labels: ['0°', '90°', '180°', '270°'] }],
      [null, 'clear:car', 'Use Built-in Car', 'action'],
      [null, 'file:ball', 'Ball Model (.glb)', 'file'],
      [null, 'clear:ball', 'Use Built-in Ball', 'action'],
    ],
  },
  {
    id: 'video', label: 'Video', items: [
      ['video', 'renderScale', 'Render Quality', 'choice', {
        values: ['auto', 0.75, 1, 1.5, 2, 'native'], labels: ['Auto (holds FPS)', 'Performance', 'Balanced', 'High', 'Very High', 'Native'],
      }],
      ['video', 'fpsLimit', 'Frame Rate Limit', 'choice', { values: [0, 60, 90, 120, 144], labels: ['Display Rate', '60', '90', '120', '144'] }],
      ['video', 'particles', 'Particle Detail', 'choice', { values: ['high', 'low'], labels: ['High', 'Low'] }],
      ['video', 'showFps', 'Show FPS', 'toggle'],
    ],
  },
  {
    id: 'audio', label: 'Audio', items: [
      ['audio', 'master', 'Master Volume', 'range', { min: 0, max: 1, step: 0.05 }],
      ['audio', 'engine', 'Engine Volume', 'range', { min: 0, max: 1, step: 0.05 }],
      ['audio', 'effects', 'Effects Volume', 'range', { min: 0, max: 1, step: 0.05 }],
    ],
  },
  {
    id: 'training', label: 'Free Play', items: [
      ['training', 'unlimitedBoost', 'Unlimited Boost', 'toggle'],
      ['training', 'gameSpeed', 'Game Speed', 'range', { min: 0.25, max: 1, step: 0.05 }],
      ['training', 'showSpeed', 'Show Car Speed', 'toggle'],
      ['training', 'showTools', 'Show Training Tools', 'toggle'],
      ['training', 'showHitbox', 'Show Car Hitbox', 'toggle'],
      ['training', 'spawn', 'Spawn Location', 'choice', {
        values: SPAWNS.map((_, i) => i), labels: ['Goal (back)', 'Kickoff left', 'Kickoff right', 'Back left', 'Back right'],
      }],
    ],
  },
];

export class UI {
  constructor(settings, input, hooks) {
    this.s = settings;
    this.input = input;
    this.hooks = hooks;
    this.screen = 'start';
    this.tab = 0;
    this.focus = 0;
    this.capturing = null;

    this.el = {
      start: $('#start'), pause: $('#pause'), settings: $('#settings'),
      tabs: $('#tabs'), panel: $('#panel'), hud: $('#hud'),
      boostNum: $('#boost-num'), boostArc: $('#boost-arc'), fps: $('#fps'), speed: $('#speed'),
      scoreBlue: $('#score-blue'), scoreOrange: $('#score-orange'), clock: $('#clock'),
      goal: $('#goal-banner'), toast: $('#toast'), pad: $('#pad-status'), rotate: $('#rotate'),
    };

    $('#play-btn').addEventListener('click', () => hooks.play());
    $('#start-settings').addEventListener('click', () => this.openSettings('start'));
    $('#pause-btn').addEventListener('click', () => hooks.togglePause());
    for (const b of document.querySelectorAll('#pause [data-act]')) b.addEventListener('click', () => this.pauseAction(b.dataset.act));
    $('#settings-back').addEventListener('click', () => this.back());

    this.buildTabs();
    this.renderPanel();
    this.boostLen = this.el.boostArc.getTotalLength?.() ?? 400;
    this.el.boostArc.style.strokeDasharray = `${this.boostLen}`;
    this.lastBoost = -1;
  }

  // ---------- screens ----------
  show(screen) {
    this.screen = screen;
    this.el.start.hidden = screen !== 'start';
    this.el.pause.hidden = screen !== 'pause';
    this.el.settings.hidden = screen !== 'settings';
    this.focus = 0;
    this.applyFocus();
  }

  get menuOpen() { return this.screen !== 'game'; }

  openSettings(from) {
    this.settingsFrom = from;
    this.show('settings');
    this.renderPanel();
  }

  back() {
    if (this.capturing) { this.input.cancelCapture(); this.capturing = null; this.renderPanel(); return; }
    if (this.screen === 'settings') {
      saveSettings(this.s);
      this.hooks.settingsChanged();
      this.show(this.settingsFrom || 'pause');
    } else if (this.screen === 'pause') this.hooks.togglePause();
  }

  pauseAction(act) {
    if (act === 'resume') this.hooks.togglePause();
    else if (act === 'reset') { this.hooks.resetShot(); this.hooks.togglePause(); }
    else if (act === 'respawn') { this.hooks.resetAll(); this.hooks.togglePause(); }
    else if (act === 'settings') this.openSettings('pause');
    else if (act === 'fullscreen') this.hooks.fullscreen();
  }

  // ---------- settings ----------
  buildTabs() {
    this.el.tabs.innerHTML = '';
    TABS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = t.label;
      b.id = `tab-${t.id}`;
      b.addEventListener('click', () => { this.tab = i; this.focus = 0; this.renderPanel(); });
      this.el.tabs.appendChild(b);
    });
  }

  items() {
    const t = TABS[this.tab];
    if (t.items !== 'bindings') return t.items;
    return [
      ...Object.keys(BINDING_LABELS).map(k => [null, 'bind:' + k, BINDING_LABELS[k], 'bind']),
      ['controls.stickAxes', 'camX', 'Camera Stick X Axis', 'choice', { values: [0, 1, 2, 3, 4, 5], labels: ['0', '1', '2', '3', '4', '5'] }],
      ['controls.stickAxes', 'camY', 'Camera Stick Y Axis', 'choice', { values: [0, 1, 2, 3, 4, 5], labels: ['0', '1', '2', '3', '4', '5'] }],
      [null, 'reset:bindings', 'Reset Bindings', 'action'],
    ];
  }

  section(path) {
    return path.split('.').reduce((o, k) => o[k], this.s);
  }

  renderPanel() {
    [...this.el.tabs.children].forEach((b, i) => b.classList.toggle('active', i === this.tab));
    const panel = this.el.panel;
    panel.innerHTML = '';
    this.rows = [];
    for (const item of this.items()) {
      const [sec, key, label, type, opt] = item;
      const row = document.createElement('div');
      row.className = 'row';
      row.tabIndex = -1;
      const name = document.createElement('span');
      name.className = 'row-label';
      name.textContent = label;
      row.appendChild(name);
      const ctl = document.createElement('div');
      ctl.className = 'row-ctl';

      if (type === 'range') {
        const val = this.section(sec)[key];
        const input = document.createElement('input');
        input.type = 'range';
        input.min = opt.min; input.max = opt.max; input.step = opt.step; input.value = val;
        input.id = `set-${sec}-${key}`;
        input.setAttribute('aria-label', label);
        const out = document.createElement('output');
        out.textContent = fmt(val, opt.step);
        input.addEventListener('input', () => { this.setValue(sec, key, parseFloat(input.value)); out.textContent = fmt(input.value, opt.step); });
        ctl.append(input, out);
        row.adjust = d => {
          const v = Math.min(opt.max, Math.max(opt.min, Math.round((parseFloat(input.value) + d * opt.step) / opt.step) * opt.step));
          input.value = v; out.textContent = fmt(v, opt.step); this.setValue(sec, key, v);
        };
      } else if (type === 'choice') {
        const val = this.section(sec)[key];
        const wrap = document.createElement('div');
        wrap.className = 'choice';
        const prev = document.createElement('button'); prev.textContent = '‹'; prev.setAttribute('aria-label', 'Previous');
        const next = document.createElement('button'); next.textContent = '›'; next.setAttribute('aria-label', 'Next');
        const lab = document.createElement('span');
        const idx = () => Math.max(0, opt.values.findIndex(v => v === this.section(sec)[key]));
        lab.textContent = opt.labels[opt.values.indexOf(val)] ?? String(val);
        row.adjust = d => {
          const i = (idx() + d + opt.values.length) % opt.values.length;
          this.setValue(sec, key, opt.values[i]);
          lab.textContent = opt.labels[i];
        };
        prev.addEventListener('click', () => row.adjust(-1));
        next.addEventListener('click', () => row.adjust(1));
        wrap.append(prev, lab, next);
        ctl.appendChild(wrap);
        row.activate = () => row.adjust(1);
      } else if (type === 'toggle') {
        const btn = document.createElement('button');
        btn.className = 'toggle';
        btn.setAttribute('role', 'switch');
        const sync = () => {
          const on = this.section(sec)[key];
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-checked', on);
          btn.textContent = on ? 'On' : 'Off';
        };
        sync();
        row.activate = () => { this.setValue(sec, key, !this.section(sec)[key]); sync(); };
        row.adjust = () => row.activate();
        btn.addEventListener('click', () => row.activate());
        ctl.appendChild(btn);
      } else if (type === 'bind') {
        const action = key.slice(5);
        const btn = document.createElement('button');
        btn.className = 'bind';
        btn.textContent = this.capturing === action ? 'Press a button…' : describeBinding(this.s.controls.bindings[action]);
        if (this.capturing === action) btn.classList.add('listening');
        const clear = document.createElement('button');
        clear.className = 'bind-clear';
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => { this.s.controls.bindings[action] = null; saveSettings(this.s); this.renderPanel(); });
        row.activate = () => this.startCapture(action);
        btn.addEventListener('click', () => row.activate());
        ctl.append(btn, clear);
      } else if (type === 'file') {
        const kind = key.slice(5);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,.gltf,model/gltf-binary';
        input.hidden = true;
        input.id = `file-${kind}`;
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.textContent = 'Choose file';
        input.addEventListener('change', () => { if (input.files[0]) this.hooks.loadModel(kind, input.files[0]); input.value = ''; });
        row.activate = () => input.click();
        btn.addEventListener('click', () => input.click());
        ctl.append(input, btn);
      } else if (type === 'action' && key.startsWith('clear:')) {
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.textContent = 'Use built-in';
        row.activate = () => this.hooks.clearModel(key.slice(6));
        btn.addEventListener('click', () => row.activate());
        ctl.appendChild(btn);
      } else if (type === 'action') {
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.textContent = 'Reset';
        row.activate = () => {
          const what = key.slice(6);
          if (what === 'bindings') this.s.controls.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
          else resetSection(this.s, what);
          saveSettings(this.s);
          this.hooks.settingsChanged();
          this.renderPanel();
          this.toast('Defaults restored');
        };
        btn.addEventListener('click', () => row.activate());
        ctl.appendChild(btn);
      } else if (type === 'padtest') {
        const box = document.createElement('div');
        box.className = 'padtest';
        box.textContent = 'Press any button on your controller';
        this.padTestEl = box;
        ctl.appendChild(box);
        row.classList.add('viz-row');
      } else if (type === 'viz') {
        const c = document.createElement('canvas');
        c.width = 220; c.height = 110;
        c.className = 'stickviz';
        this.vizCanvas = c;
        ctl.appendChild(c);
        row.classList.add('viz-row');
      }
      row.appendChild(ctl);
      row.addEventListener('pointerenter', () => { this.focus = this.rows.indexOf(row); this.applyFocus(); });
      panel.appendChild(row);
      this.rows.push(row);
    }
    if (this.focus >= this.rows.length) this.focus = 0;
    this.applyFocus();
  }

  startCapture(action) {
    this.capturing = action;
    this.renderPanel();
    this.input.beginCapture(b => {
      this.capturing = null;
      if (b) {
        this.s.controls.bindings[action] = b;
        saveSettings(this.s);
        this.renderTools();
        this.toast(`${BINDING_LABELS[action]}: ${describeBinding(b)}`);
      }
      this.renderPanel();
    });
    clearTimeout(this.captureTimer);
    this.captureTimer = setTimeout(() => {
      if (this.capturing === action) { this.input.cancelCapture(); this.capturing = null; this.renderPanel(); }
    }, 6000);
  }

  setValue(sec, key, v) {
    this.section(sec)[key] = v;
    this.hooks.settingsChanged();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSettings(this.s), 400);
  }

  focusables() {
    if (this.screen === 'settings') return this.rows;
    if (this.screen === 'pause') return [...document.querySelectorAll('#pause [data-act]')];
    if (this.screen === 'start') return [$('#play-btn'), $('#start-settings')];
    return [];
  }

  applyFocus() {
    const list = this.focusables();
    list.forEach((el, i) => el.classList.toggle('focus', i === this.focus));
    const el = list[this.focus];
    if (el && this.screen === 'settings') el.scrollIntoView({ block: 'nearest' });
  }

  handleNav(events) {
    if (this.capturing) return;
    for (const e of events) {
      const list = this.focusables();
      if (e === 'up') this.focus = (this.focus - 1 + list.length) % list.length;
      else if (e === 'down') this.focus = (this.focus + 1) % list.length;
      else if (e === 'left' || e === 'right') {
        const row = list[this.focus];
        if (this.screen === 'settings' && row?.adjust) row.adjust(e === 'left' ? -1 : 1);
        else if (this.screen === 'settings') this.switchTab(e === 'left' ? -1 : 1);
      } else if (e === 'tabL' || e === 'tabR') {
        if (this.screen === 'settings') this.switchTab(e === 'tabL' ? -1 : 1);
      } else if (e === 'confirm') {
        const el = list[this.focus];
        if (!el) continue;
        if (this.screen === 'settings') el.activate?.();
        else el.click();
      } else if (e === 'back') this.back();
      this.applyFocus();
    }
  }

  switchTab(d) {
    this.tab = (this.tab + d + TABS.length) % TABS.length;
    this.focus = 0;
    this.renderPanel();
  }

  // Live readout of what the controller reports, to verify the PS5 layout on this device.
  drawPadTest(pad) {
    const el = this.padTestEl;
    if (!el || !el.isConnected) return;
    if (!pad) { el.textContent = 'No controller detected'; return; }
    const names = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'Touchpad'];
    const down = pad.buttons.map((b, i) => (b.pressed || b.value > 0.1) ? `${names[i] ?? 'B' + i}${b.value > 0 && b.value < 1 ? ' ' + b.value.toFixed(2) : ''}` : null).filter(Boolean);
    const axes = pad.axes.map((a, i) => `A${i} ${a >= 0 ? ' ' : ''}${a.toFixed(2)}`).join('  ');
    const warn = pad.mapping === 'standard' ? 'Standard layout ✓' : 'Non-standard layout: rebind under Bindings';
    el.innerHTML = `<b>${pad.id.split('(')[0].trim()}</b> · ${warn}<br>Pressed: ${down.join(', ') || '—'}<br><span class="axes">${axes}</span>`;
  }

  drawStickViz(raw, processed) {
    const c = this.vizCanvas;
    if (!c || !c.isConnected) return;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const draw = (cx, title, x, y, dz) => {
      const r = 44;
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, 55, r, 0, Math.PI * 2); g.stroke();
      if (dz) {
        g.fillStyle = 'rgba(255,90,90,0.25)';
        if (this.s.controls.deadzoneShape === 'circle') { g.beginPath(); g.arc(cx, 55, r * dz, 0, Math.PI * 2); g.fill(); }
        else { g.fillRect(cx - r, 55 - r * dz, 2 * r, 2 * r * dz); g.fillRect(cx - r * dz, 55 - r, 2 * r * dz, 2 * r); }
      }
      g.fillStyle = '#ffd04a';
      g.beginPath(); g.arc(cx + x * r, 55 + y * r, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = '10px system-ui';
      g.textAlign = 'center';
      g.fillText(title, cx, 108);
    };
    draw(55, 'RAW', raw[0], raw[1], this.s.controls.deadzone);
    draw(165, 'IN GAME', processed[0], processed[1], 0);
  }

  renderTools() {
    const el = document.getElementById('tools');
    if (!el) return;
    el.hidden = !this.s.training.showTools;
    el.innerHTML = '';
    for (const a of TRAINING_ACTIONS) {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = BINDING_LABELS[a];
      const key = document.createElement('b');
      key.textContent = describeBinding(this.s.controls.bindings[a]);
      row.append(name, key);
      el.appendChild(row);
    }
  }

  // ---------- HUD ----------
  updateHud(world, fps, dt) {
    const car = world.car;
    const b = Math.round(car.boost);
    if (b !== this.lastBoost) {
      this.lastBoost = b;
      this.el.boostNum.textContent = b;
      this.el.boostArc.style.strokeDashoffset = `${this.boostLen * (1 - b / 100)}`;
      this.el.hud.classList.toggle('boost-full', b >= 100);
    }
    this.el.scoreBlue.textContent = world.score.blue;
    this.el.scoreOrange.textContent = world.score.orange;
    this.el.fps.hidden = !this.s.video.showFps;
    if (this.s.video.showFps) this.el.fps.textContent = `${Math.round(fps)} FPS`;
    this.el.speed.hidden = !this.s.training.showSpeed;
    if (this.s.training.showSpeed) this.el.speed.textContent = `${Math.round(car.vel.length())} uu/s${car.supersonic ? ' · SUPERSONIC' : ''}`;
  }

  setClock(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    this.el.clock.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  goalBanner(team, speed) {
    const g = this.el.goal;
    g.className = `goal-banner ${team}`;
    g.querySelector('.goal-speed').textContent = `${Math.round(speed * 0.036)} KPH`;
    g.hidden = false;
    void g.offsetWidth;
    g.classList.add('show');
    clearTimeout(this.goalTimer);
    this.goalTimer = setTimeout(() => { g.hidden = true; g.classList.remove('show'); }, 2800);
  }

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  setPadStatus(connected, name) {
    const short = /dualsense|054c.*0ce6|wireless controller/i.test(name) ? 'DualSense' : (name || '').split('(')[0].trim().slice(0, 32);
    this.el.pad.textContent = connected ? `Controller connected · ${short}` : 'No controller detected · press any button on your controller';
    this.el.pad.classList.toggle('ok', connected);
    if (connected) this.toast(`${short} connected`);
  }
}
