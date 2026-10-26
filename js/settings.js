// User settings with Rocket League's default values. Saved per device.
const KEY = 'boost-arena-settings-v3';

export const DEFAULT_BINDINGS = {
  throttle: { type: 'button', index: 7 },
  reverse: { type: 'button', index: 6 },
  jump: { type: 'button', index: 0 },
  boost: { type: 'button', index: 1 },
  powerslide: { type: 'button', index: 4 },
  airRoll: { type: 'button', index: 2 },
  airRollLeft: { type: 'button', index: 4 },
  airRollRight: { type: 'button', index: 5 },
  ballCam: { type: 'button', index: 3 },
  reset: { type: 'button', index: 8 },
  takePossession: { type: 'button', index: 13 },
  startDribble: { type: 'button', index: 12 },
  passBall: { type: 'button', index: 14 },
  launchBall: { type: 'button', index: 15 },
  defendShot: { type: 'button', index: 11 },
  menu: { type: 'button', index: 9 },
};

export const TRAINING_ACTIONS = ['reset', 'takePossession', 'startDribble', 'passBall', 'launchBall', 'defendShot'];

export const BINDING_LABELS = {
  throttle: 'Throttle',
  reverse: 'Reverse / Brake',
  jump: 'Jump',
  boost: 'Boost',
  powerslide: 'Powerslide',
  airRoll: 'Air Roll',
  airRollLeft: 'Air Roll Left',
  airRollRight: 'Air Roll Right',
  ballCam: 'Ball Cam',
  reset: 'Reset Shot',
  takePossession: 'Take Possession',
  startDribble: 'Start Dribble',
  passBall: 'Pass Ball',
  launchBall: 'Launch Ball',
  defendShot: 'Defend Shot',
  menu: 'Pause Menu',
};

export const DEFAULTS = {
  camera: {
    shake: false,
    fov: 110,
    distance: 270,
    height: 100,
    angle: -4,
    stiffness: 0.45,
    swivelSpeed: 5,
    transitionSpeed: 1.2,
    ballCamMode: 'toggle',
    invertSwivel: false,
  },
  controls: {
    deadzoneShape: 'cross',
    deadzone: 0.1,
    dodgeDeadzone: 0.5,
    steeringSensitivity: 1.0,
    aerialSensitivity: 1.0,
    vibration: true,
    stickAxes: { steerX: 0, steerY: 1, camX: 2, camY: 3 },
    bindings: DEFAULT_BINDINGS,
    touchAutoThrottle: true,
  },
  video: {
    renderScale: 'auto',
    fpsLimit: 0,
    showFps: false,
    particles: 'high',
  },
  audio: {
    master: 0.7,
    engine: 0.55,
    effects: 0.8,
  },
  models: {
    carYaw: 0,
  },
  training: {
    unlimitedBoost: false,
    gameSpeed: 1,
    showSpeed: false,
    showTools: true,
    showHitbox: false,
    spawn: 0,
  },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function merge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], o = over[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && k !== 'bindings') base[k] = merge(b, o);
    else if (k === 'bindings' && o && typeof o === 'object') base[k] = { ...b, ...o };
    else if (typeof o === typeof b || b === null) base[k] = o;
  }
  return base;
}

export function loadSettings() {
  const s = clone(DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) merge(s, JSON.parse(raw));
  } catch { /* storage unavailable: defaults */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetSection(s, section) {
  s[section] = clone(DEFAULTS[section]);
}
