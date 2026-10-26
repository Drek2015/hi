// Fuzz test: fire the ball at a spinning, boosting, flipping car from every direction
// and check the ball never ends a tick inside the Octane hitbox.
import { World } from '../js/physics.js';
import { BALL, CAR } from '../js/constants.js';
import { Euler, Vector3 } from '../vendor/three.module.min.js';

const blank = () => ({ throttle: 0, steer: 0, airX: 0, airY: 0, dodgeX: 0, dodgeY: 0, jump: false, boost: false, powerslide: false, airRoll: false, airRollLeft: false, airRollRight: false });
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const w = new World();
w.opt.unlimitedBoost = true;
let worst = Infinity, overlapTicks = 0, hits = 0, trials = 4000, tunnels = 0;
for (let t = 0; t < trials; t++) {
  const air = rnd() < 0.6;
  w.car.reset({ pos: [(rnd() - 0.5) * 4000, (rnd() - 0.5) * 6000, air ? 300 + rnd() * 1200 : 17], yaw: rnd() * 6.28 });
  if (air) {
    w.car.onGround = false; w.car.relandLock = 1;
    w.car.quat.setFromEuler(new Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
    w.car.ang.set((rnd() - 0.5) * 11, (rnd() - 0.5) * 11, (rnd() - 0.5) * 11).clampLength(0, CAR.MAX_ANG);
  }
  w.car.vel.set((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 0.5).normalize().multiplyScalar(rnd() * 2300);
  w.ball.reset();
  const dir = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
  const center = w.car.pos.clone().add(new Vector3(...CAR.HB_OFFSET).applyQuaternion(w.car.quat));
  w.ball.pos.copy(center).addScaledVector(dir, 450);
  const speed = 500 + rnd() * 5500;
  w.ball.vel.copy(dir).multiplyScalar(-speed).add(w.car.vel);
  const inp = { ...blank(), boost: rnd() < 0.5, airRoll: rnd() < 0.3, airX: rnd() * 2 - 1, airY: rnd() * 2 - 1, throttle: 1 };
  let touched = false;
  for (let k = 0; k < 40; k++) {
    const cp0 = w.car.pos.clone(), cq0 = w.car.quat.clone(), bp0 = w.ball.pos.clone();
    const bv0 = w.ball.vel.clone();
    w.step(inp);
    const hitNow = w.events.some(e => e.type === 'hit') || w.ball.touchTick === w.tick;
    if (hitNow) touched = true;
    // Tunnelling: the straight path inside this tick crossed the hitbox but no contact was solved.
    if (!hitNow && w.ball.vel.distanceTo(bv0) < 1e-6 + 700 * (1 / 120) + 50) {
      for (let f = 0.05; f < 1; f += 0.05) {
        const d = w.hitboxDistance(cp0.clone().lerp(w.car.pos, f), cq0.clone().slerp(w.car.quat, f), bp0.clone().lerp(w.ball.pos, f));
        if (d < BALL.R - 10) { tunnels++; break; }
      }
    }
    w.events.length = 0;
    const d = w.hitboxDistance(w.car.pos, w.car.quat, w.ball.pos);
    worst = Math.min(worst, d);
    if (d < BALL.R - 2) overlapTicks++;
  }
  if (touched) hits++;
}
const ok = overlapTicks === 0 && tunnels === 0;
console.log(`${ok ? 'PASS' : 'FAIL'}  ${trials} shots, ${hits} touches, ticks with ball inside hitbox: ${overlapTicks}, pass-throughs: ${tunnels}, closest centre distance ${worst.toFixed(1)} (ball radius ${BALL.R})`);
process.exit(ok ? 0 : 1);
