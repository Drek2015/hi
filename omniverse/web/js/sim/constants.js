// Core tuning. World units are pixels at 1080p; y grows downward, the main floor is y = 0.

export const TICK_RATE = 120;
export const DT = 1 / TICK_RATE;

export const PHYS = {
  GRAVITY: 4300,
  FAST_FALL: 2600,       // extra gravity while holding down in the air
  MAX_FALL: 1900,
  RUN: 640,
  AIR_SPEED: 560,
  GROUND_ACCEL: 9000,
  AIR_ACCEL: 4200,
  FRICTION: 7000,
  JUMP: 1520,
  AIR_JUMP: 1380,
  JUMP_CUT: 0.45,        // releasing jump early cuts upward speed
  COYOTE: 0.08,
  BUFFER: 0.12,          // input buffer window
  DASH_SPEED: 1650,
  DASH_TIME: 0.16,
  DASH_CD: 0.42,
  WIDTH: 64,             // hurtbox
  HEIGHT: 178,
};

export const MATCH = {
  ROUNDS_TO_WIN: 2,
  ROUND_TIME: 99,
  HP: 1000,
  ENERGY_MAX: 100,
  ENERGY_REGEN: 6,       // per second
  ULT_MAX: 100,
  GUARD_MAX: 100,
  GUARD_REGEN: 22,
};

export const DIFFICULTY = {
  superEasy: { label: 'Super Easy', reaction: 0.62, aggression: 0.22, block: 0.04, ability: 0.12, combo: 0.15, speed: 0.72, dodge: 0.02, damage: 0.65 },
  easy: { label: 'Easy', reaction: 0.4, aggression: 0.42, block: 0.14, ability: 0.28, combo: 0.4, speed: 0.86, dodge: 0.08, damage: 0.85 },
  medium: { label: 'Medium', reaction: 0.22, aggression: 0.68, block: 0.34, ability: 0.5, combo: 0.72, speed: 1, dodge: 0.2, damage: 1 },
  hard: { label: 'Hard', reaction: 0.1, aggression: 0.88, block: 0.58, ability: 0.82, combo: 0.95, speed: 1.05, dodge: 0.42, damage: 1.12 },
};
