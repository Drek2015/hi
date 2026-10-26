// Physics constants in Unreal units (1 uu = 1 cm), z-up, 120 Hz fixed tick.
// Values follow the community-measured numbers (RLBot wiki, RocketSim, Chip's ball model).

export const TICK_RATE = 120;
export const TICK = 1 / TICK_RATE;
export const GRAVITY = -650;

export const ARENA = {
  W: 4096,   // half width (x)
  L: 5120,   // half length (y), back wall plane
  H: 2044,   // ceiling
  C: 8064,   // corner chamfer: |x| + |y| <= C
  R: 256,    // radius of every floor/wall/ceiling transition
};

export const GOAL = { W: 892.755, H: 642.775, D: 880 };

export const BALL = {
  R: 91.25,
  MASS: 30,
  MAX_SPEED: 6000,
  MAX_ANG: 6,
  DRAG: 0.0305,
  RESTITUTION: 0.6,
  MU: 0.285,      // surface friction
  A: 0.0003,      // spin transfer
  Y: 2.0,         // friction ramp
  REST_Z: 92.75,
};

export const CAR = {
  MASS: 180,
  MAX_SPEED: 2300,
  SUPERSONIC_START: 2200,
  SUPERSONIC_KEEP: 2100,
  SUPERSONIC_KEEP_TIME: 1.0,
  REST_HEIGHT: 17.0,
  // Octane hitbox
  HB_HALF: [59.0, 42.1, 18.08],
  HB_OFFSET: [13.88, 0, 20.75],

  BOOST_ACCEL_GROUND: 2975 / 3,
  BOOST_ACCEL_AIR: 3175 / 3,
  BOOST_USE: 100 / 3,
  BOOST_START: 33.33,
  BOOST_MIN_TIME: 0.1,

  BRAKE_ACCEL: 3500,
  COAST_ACCEL: 525,
  AIR_THROTTLE_ACCEL: 200 / 3,

  JUMP_IMPULSE: 291.667,
  JUMP_HOLD_ACCEL: 1458.333,
  JUMP_HOLD_TIME: 0.2,
  JUMP_MIN_TIME: 0.025,
  JUMP_RELAND_LOCK: 0.06,
  DOUBLE_JUMP_WINDOW: 1.25,

  DODGE_IMPULSE: 500,
  FLIP_TORQUE_TIME: 0.65,
  FLIP_Z_DAMP: 0.35,
  FLIP_Z_DAMP_END: 0.21,
  FLIP_BACK_SCALE_X: 16 / 15,
  FLIP_FWD_MAX_SCALE: 1.0,
  FLIP_SIDE_MAX_SCALE: 1.9,
  FLIP_BACK_MAX_SCALE: 2.5,
  FLIP_PITCH_RATE: 5.5,
  FLIP_ROLL_RATE: 5.5,

  MAX_ANG: 5.5,
  STICKY: 0.5,

  // Air control: angular acceleration = T * input + D * angular velocity (local axes)
  T_ROLL: 36.07956616966136,
  T_PITCH: 12.14599781908070,
  T_YAW: 8.91962804287785,
  D_ROLL: 4.47166302201591,
  D_PITCH: 2.798194258050845,
  D_YAW: 1.886491900437232,

  // Ground tyre model
  GRIP: 26,
  HANDBRAKE_GRIP: 1.6,
  HANDBRAKE_RISE: 5,
  HANDBRAKE_FALL: 2,
  HANDBRAKE_YAW_BONUS: 0.55,
};

// Throttle acceleration as a function of forward speed.
export const THROTTLE_CURVE = [[0, 1600], [1400, 160], [1410, 0], [2300, 0]];
// Turning curvature (1/radius) as a function of forward speed.
export const STEER_CURVE = [[0, 0.0069], [500, 0.00398], [1000, 0.00235], [1500, 0.001375], [1750, 0.0011], [2500, 0.00088]];
// Psyonix "extra" ball impulse scale by relative speed.
export const HIT_CURVE = [[0, 0.65], [500, 0.65], [2300, 0.55], [4600, 0.30]];

export function curve(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

// Standard Soccar boost pad layout.
export const BIG_PADS = [
  [-3072, -4096], [3072, -4096], [-3584, 0], [3584, 0], [-3072, 4096], [3072, 4096],
];
export const SMALL_PADS = [
  [0, -4240], [-1792, -4184], [1792, -4184], [-940, -3308], [940, -3308], [0, -2816],
  [-3584, -2484], [3584, -2484], [-1788, -2300], [1788, -2300], [-2048, -1036], [0, -1024],
  [2048, -1036], [-1024, 0], [1024, 0], [-2048, 1036], [0, 1024], [2048, 1036],
  [-1788, 2300], [1788, 2300], [-3584, 2484], [3584, 2484], [0, 2816], [-940, 3310],
  [940, 3308], [-1792, 4184], [1792, 4184], [0, 4240],
];
export const PAD = {
  BIG_RADIUS: 208, BIG_HEIGHT: 168, BIG_AMOUNT: 100, BIG_RESPAWN: 10,
  SMALL_RADIUS: 144, SMALL_HEIGHT: 165, SMALL_AMOUNT: 12, SMALL_RESPAWN: 4,
};

export const SPAWNS = [
  { pos: [0, -4608, 17], yaw: Math.PI / 2 },
  { pos: [-2048, -2560, 17], yaw: Math.PI / 4 },
  { pos: [2048, -2560, 17], yaw: 3 * Math.PI / 4 },
  { pos: [-256, -3840, 17], yaw: Math.PI / 2 },
  { pos: [256, -3840, 17], yaw: Math.PI / 2 },
];
