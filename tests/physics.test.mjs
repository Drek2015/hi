// Headless checks that the simulation hits Rocket League's known reference numbers.
import { World } from '../js/physics.js';
import { dist } from '../js/arena.js';
import { TICK } from '../js/constants.js';

const blank = () => ({ throttle: 0, steer: 0, airX: 0, airY: 0, dodgeX: 0, dodgeY: 0, jump: false, boost: false, powerslide: false, airRoll: false, airRollLeft: false, airRollRight: false });
let failures = 0;
function check(name, value, lo, hi) {
  const ok = value >= lo && value <= hi;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${value.toFixed(3)}  (expected ${lo}..${hi})`);
}
function run(world, ticks, inp) { for (let i = 0; i < ticks; i++) { world.step(typeof inp === 'function' ? inp(i) : inp); world.events.length = 0; } }

// Arena SDF sanity
check('floor distance at z=100', dist(0, 0, 100), 99.9, 100.1);
check('side wall distance', dist(4000, 0, 1000), 95.9, 96.1);
check('inside goal', dist(0, 5500, 300), 50, 400);
check('behind back wall', dist(2000, 5300, 300), -1e9, 0);

// Throttle only: approaches 1410 uu/s
{ const w = new World(); w.ball.pos.set(0, 3000, 93); w.car.boost = 0;
  run(w, 120 * 6, { ...blank(), throttle: 1 });
  check('max throttle speed', w.car.vel.length(), 1395, 1415);
  check('car stays at rest height', w.car.pos.z, 16.5, 17.5); }

// Boost from standstill reaches 2300
{ const w = new World(); w.opt.unlimitedBoost = true; w.car.reset({ pos: [0, -4608, 17], yaw: Math.PI / 2 }); w.ball.pos.set(3000, 0, 93);
  let t = 0; while (w.car.vel.length() < 2299 && t < 600) { w.step({ ...blank(), throttle: 1, boost: true }); w.events.length = 0; t++; }
  check('time to max speed with boost (s)', t * TICK, 1.4, 2.1); }

// Single jump height (full hold) ~ 230
{ const w = new World(); w.ball.pos.set(3000, 0, 93); let maxZ = 0;
  run(w, 10, blank());
  for (let i = 0; i < 240; i++) { w.step({ ...blank(), jump: i < 30 }); w.events.length = 0; maxZ = Math.max(maxZ, w.car.pos.z); }
  check('single jump apex gain', maxZ - 17, 215, 245); }

// Double jump height ~ 500
{ const w = new World(); w.ball.pos.set(3000, 0, 93); let maxZ = 0;
  run(w, 10, blank());
  for (let i = 0; i < 300; i++) { w.step({ ...blank(), jump: i < 24 || (i > 26 && i < 30) }); w.events.length = 0; maxZ = Math.max(maxZ, w.car.pos.z); }
  check('double jump apex gain', maxZ - 17, 430, 560); }

// Front flip from standstill gives ~500 forward speed
{ const w = new World(); w.ball.pos.set(3000, 0, 93);
  run(w, 10, blank());
  run(w, 12, i => ({ ...blank(), jump: i < 6 }));
  w.step({ ...blank(), jump: true, dodgeY: 1, airY: 1 }); w.events.length = 0;
  const fwdSpeed = w.car.vel.dot(w.car.fwd);
  check('front flip impulse', Math.hypot(w.car.vel.x, w.car.vel.y), 480, 520);
  run(w, 50, { ...blank(), dodgeY: 1, airY: 1 });
  check('flip pitch rate rad/s', Math.abs(w.car.ang.length()), 4.5, 5.6); }

// Driving into the side wall carries the car up the wall
{ const w = new World(); w.opt.unlimitedBoost = true; w.ball.pos.set(0, 3000, 93);
  w.car.reset({ pos: [2500, 0, 17], yaw: 0 });
  run(w, 120 * 2, { ...blank(), throttle: 1, boost: true });
  check('car climbed wall (z)', w.car.pos.z, 300, 2044);
  check('car still on surface', w.car.onGround ? 1 : 0, 1, 1);
  check('car x near wall', w.car.pos.x, 4000, 4096); }

// Car hits stationary ball at ~1400 → ball speed in RL's ballpark
{ const w = new World(); w.ball.pos.set(0, -3000, 93); w.car.reset({ pos: [0, -4608, 17], yaw: Math.PI / 2 }); w.car.boost = 0;
  let ballSpeed = 0;
  for (let i = 0; i < 600; i++) { w.step({ ...blank(), throttle: 1 }); w.events.length = 0; ballSpeed = Math.max(ballSpeed, w.ball.vel.length()); }
  check('ball speed after 1410 hit', ballSpeed, 1700, 2900); }

// Ball dropped from 1000 bounces to ~0.6 * velocity
{ const w = new World(); w.ball.pos.set(0, 0, 1000); w.car.reset({ pos: [0, -4608, 17], yaw: Math.PI / 2 });
  let minVz = 0, maxVzAfter = 0, bounced = false;
  for (let i = 0; i < 400; i++) { w.step(blank()); w.events.length = 0; const vz = w.ball.vel.z; if (!bounced) { minVz = Math.min(minVz, vz); if (vz > 0) bounced = true; } if (bounced) maxVzAfter = Math.max(maxVzAfter, vz); }
  check('ball restitution', maxVzAfter / -minVz, 0.55, 0.62); }

// Goal scoring
{ const w = new World(); w.ball.pos.set(0, 4800, 200); w.ball.vel.set(0, 2000, 0); w.car.reset({ pos: [0, -4608, 17], yaw: Math.PI / 2 });
  let goal = false; for (let i = 0; i < 120; i++) { w.step(blank()); if (w.events.some(e => e.type === 'goal')) goal = true; w.events.length = 0; }
  check('goal registered', goal ? 1 : 0, 1, 1); }

// Ball shot into the ceiling corner never escapes the arena
{ const w = new World(); w.car.reset({ pos: [0, -4608, 17], yaw: Math.PI / 2 }); let escaped = false;
  for (const v of [[3000, 3000, 3000], [-6000, 500, 200], [2000, -5000, 4000], [100, 6000, 3000]]) {
    w.ball.reset(); w.ball.pos.set(0, 0, 1000); w.ball.vel.set(...v);
    for (let i = 0; i < 600; i++) { w.step(blank()); w.events.length = 0; if (dist(w.ball.pos.x, w.ball.pos.y, w.ball.pos.z) < 0) escaped = true; }
  }
  check('ball never escapes', escaped ? 0 : 1, 1, 1); }

// Directional air roll: holding air roll right rolls the car clockwise (positive about forward).
{ const w = new World(); w.ball.pos.set(3000, 0, 93);
  w.car.reset({ pos: [0, 0, 800], yaw: Math.PI / 2 }); w.car.onGround = false; w.car.relandLock = 1;
  run(w, 30, { ...blank(), airRollRight: true });
  const rollRate = w.car.ang.dot(w.car.fwd);
  check('air roll right rate (rad/s)', rollRate, 4, 5.6);
  w.car.ang.set(0, 0, 0);
  run(w, 30, { ...blank(), airRollLeft: true });
  check('air roll left rate (rad/s)', -w.car.ang.dot(w.car.fwd), 4, 5.6); }

// Training tools keep the ball inside the arena.
{ const w = new World(); let ok = true;
  for (const a of ['takePossession', 'startDribble', 'passBall', 'launchBall', 'defendShot']) {
    for (const spawn of [[0, -4608], [3000, 4000], [-3800, -100]]) {
      w.car.reset({ pos: [...spawn, 17], yaw: 1 }); w.training(a);
      if (dist(w.ball.pos.x, w.ball.pos.y, w.ball.pos.z) < 80) { ok = false; console.log('  outside:', a, spawn); }
    }
  }
  check('training spawns stay inside', ok ? 1 : 0, 1, 1); }

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
