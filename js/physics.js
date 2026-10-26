// Fixed-tick simulation of one car, the ball and the boost pads.
import { Vector3, Quaternion } from '../vendor/three.module.min.js';
import {
  TICK, GRAVITY, ARENA, GOAL, BALL, CAR, THROTTLE_CURVE, STEER_CURVE, HIT_CURVE, curve,
  BIG_PADS, SMALL_PADS, PAD, SPAWNS,
} from './constants.js';
import { dist, normal } from './arena.js';

const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const tA = new Vector3(), tB = new Vector3(), tC = new Vector3(), tD = new Vector3(), tN = new Vector3();
const tQ = new Quaternion(), tQ2 = new Quaternion();

const HB_HALF = new Vector3(...CAR.HB_HALF);
const HB_OFF = new Vector3(...CAR.HB_OFFSET);
const CAR_INV_INERTIA = 1 / (CAR.MASS * 1150);
const BALL_INERTIA = 0.4 * BALL.MASS * BALL.R * BALL.R;

// Hitbox probe points used against the arena: 8 corners plus face centres.
const PROBES = [];
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) PROBES.push(new Vector3(sx, sy, sz));
PROBES.push(new Vector3(0, 0, 1), new Vector3(0, 0, -1), new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0));

function integrateRotation(q, w, dt) {
  const a = w.length() * dt;
  if (a < 1e-9) return;
  tQ.setFromAxisAngle(tA.copy(w).normalize(), a);
  q.premultiply(tQ).normalize();
}

function approach(v, target, rate) {
  return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
}

export class Car {
  constructor() {
    this.pos = new Vector3();
    this.vel = new Vector3();
    this.ang = new Vector3();
    this.quat = new Quaternion();
    this.normal = new Vector3(0, 0, 1);
    this.fwd = new Vector3();
    this.left = new Vector3();
    this.up = new Vector3();
    this.reset(SPAWNS[0]);
  }

  reset(spawn, boost = CAR.BOOST_START) {
    this.pos.set(...spawn.pos);
    this.vel.set(0, 0, 0);
    this.ang.set(0, 0, 0);
    this.quat.setFromAxisAngle(Z, spawn.yaw);
    this.normal.set(0, 0, 1);
    this.boost = boost;
    this.onGround = true;
    this.jumped = false;
    this.jumping = false;
    this.jumpTime = 0;
    this.airTimeSinceJump = 0;
    this.relandLock = 0;
    this.hasDoubleJumped = false;
    this.hasFlipped = false;
    this.flipping = false;
    this.flipTime = 0;
    this.flipX = 0;
    this.flipY = 0;
    this.boosting = false;
    this.boostTime = 0;
    this.handbrake = 0;
    this.steer = 0;
    this.supersonic = false;
    this.supersonicTime = 0;
    this.prevJump = false;
    this.contactTime = 1;
    this.contactNormal = new Vector3(0, 0, 1);
    this.wheelSpin = 0;
    this.airTime = 0;
    this.updateAxes();
  }

  updateAxes() {
    this.fwd.copy(X).applyQuaternion(this.quat);
    this.left.copy(Y).applyQuaternion(this.quat);
    this.up.copy(Z).applyQuaternion(this.quat);
  }

  step(inp, opt, events) {
    const dt = TICK;
    const jumpPressed = inp.jump && !this.prevJump;
    this.prevJump = inp.jump;

    // Boost with RL's minimum burst length.
    let boosting = inp.boost && (this.boost > 0 || opt.unlimitedBoost);
    if (!boosting && this.boostTime > 0 && this.boostTime < CAR.BOOST_MIN_TIME && this.boost > 0) boosting = true;
    if (boosting) {
      this.boostTime += dt;
      if (!opt.unlimitedBoost) this.boost = Math.max(0, this.boost - CAR.BOOST_USE * dt);
    } else this.boostTime = 0;
    this.boosting = boosting;

    this.handbrake = inp.powerslide
      ? Math.min(1, this.handbrake + CAR.HANDBRAKE_RISE * dt)
      : Math.max(0, this.handbrake - CAR.HANDBRAKE_FALL * dt);
    this.steer = approach(this.steer, inp.steer, dt / 0.05);

    this.updateAxes();
    if (this.relandLock > 0) this.relandLock -= dt;
    this.contactTime += dt;

    if (this.onGround) this.groundStep(inp, jumpPressed, events);
    else this.airStep(inp, jumpPressed, opt, events);

    const speed = this.vel.length();
    if (speed > CAR.MAX_SPEED) this.vel.multiplyScalar(CAR.MAX_SPEED / speed);

    this.pos.addScaledVector(this.vel, dt);
    integrateRotation(this.quat, this.ang, dt);
    this.updateAxes();

    if (this.onGround) this.groundConstraint(events);
    else this.airCollide(jumpPressed, events);

    const s = this.vel.length();
    if (s >= CAR.SUPERSONIC_START) { this.supersonic = true; this.supersonicTime = 0; }
    else if (this.supersonic && s >= CAR.SUPERSONIC_KEEP) {
      this.supersonicTime += dt;
      if (this.supersonicTime > CAR.SUPERSONIC_KEEP_TIME) this.supersonic = false;
    } else this.supersonic = false;

    this.wheelSpin += this.vel.dot(this.fwd) * dt / 14;
    this.airTime = this.onGround ? 0 : this.airTime + dt;
  }

  groundStep(inp, jumpPressed, events) {
    const dt = TICK;
    const n = this.normal;
    const fwd = this.fwd, left = this.left;

    const vf = this.vel.dot(fwd);
    const throttle = this.boosting ? 1 : inp.throttle;
    let dv;
    if (Math.abs(throttle) > 0.01) {
      if (throttle * vf >= 0 || Math.abs(vf) < 1) {
        dv = throttle * curve(THROTTLE_CURVE, Math.abs(vf)) * dt;
      } else {
        dv = -Math.sign(vf) * CAR.BRAKE_ACCEL * dt;
        if (Math.abs(dv) > Math.abs(vf)) dv = -vf;
      }
    } else {
      dv = -Math.sign(vf) * Math.min(CAR.COAST_ACCEL * dt, Math.abs(vf));
    }
    if (this.boosting) dv += CAR.BOOST_ACCEL_GROUND * dt;
    this.vel.addScaledVector(fwd, dv);

    // Steering: yaw rate from the speed-dependent turning curvature.
    const sf = this.vel.dot(fwd);
    const yawRate = -this.steer * curve(STEER_CURVE, Math.abs(sf)) * sf * (1 + CAR.HANDBRAKE_YAW_BONUS * this.handbrake);
    this.ang.copy(n).multiplyScalar(yawRate);

    // Lateral tyre grip, loosened by powerslide.
    const vl = this.vel.dot(left);
    const grip = CAR.GRIP + (CAR.HANDBRAKE_GRIP - CAR.GRIP) * this.handbrake;
    this.vel.addScaledVector(left, -vl * (1 - Math.exp(-grip * dt)));

    // Gravity plus the sticky force that keeps wheels on walls.
    const sticky = CAR.STICKY + (Math.abs(inp.throttle) > 0.01 ? 1 - Math.abs(n.z) : 0);
    tA.set(0, 0, GRAVITY).addScaledVector(n, GRAVITY * sticky);
    if (tA.dot(n) > 0) {
      this.onGround = false;
      this.relandLock = 0.25;
      events.push({ type: 'detach' });
    }
    this.vel.addScaledVector(tA, dt);

    if (jumpPressed) this.startJump(events);
  }

  startJump(events) {
    this.vel.addScaledVector(this.up, CAR.JUMP_IMPULSE);
    this.onGround = false;
    this.jumped = true;
    this.jumping = true;
    this.jumpTime = 0;
    this.airTimeSinceJump = 0;
    this.relandLock = CAR.JUMP_RELAND_LOCK;
    this.hasDoubleJumped = false;
    this.hasFlipped = false;
    events.push({ type: 'jump' });
  }

  airStep(inp, jumpPressed, opt, events) {
    const dt = TICK;
    const fwd = this.fwd, up = this.up;

    if (this.jumping) {
      this.jumpTime += dt;
      if (this.jumpTime < CAR.JUMP_MIN_TIME || (inp.jump && this.jumpTime < CAR.JUMP_HOLD_TIME)) {
        this.vel.addScaledVector(up, CAR.JUMP_HOLD_ACCEL * dt);
      } else this.jumping = false;
    } else if (this.jumped) this.airTimeSinceJump += dt;

    this.vel.z += GRAVITY * dt;
    if (Math.abs(inp.throttle) > 0.01) this.vel.addScaledVector(fwd, inp.throttle * CAR.AIR_THROTTLE_ACCEL * dt);
    if (this.boosting) this.vel.addScaledVector(fwd, CAR.BOOST_ACCEL_AIR * dt);

    // Air control inputs.
    const pitch = inp.airY;
    let yaw = inp.airX, roll = 0;
    if (inp.airRoll) { roll = inp.airX; yaw = 0; }
    const dirRoll = (inp.airRollRight ? 1 : 0) - (inp.airRollLeft ? 1 : 0);
    if (dirRoll) roll = dirRoll;

    // Recovery when lying on the roof or side.
    if (jumpPressed && this.contactTime < 0.12 && !this.jumping) {
      const n = this.contactNormal;
      this.vel.addScaledVector(n, 320);
      tB.crossVectors(up, n);
      if (tB.lengthSq() < 1e-4) tB.copy(fwd);
      this.ang.copy(tB.normalize()).multiplyScalar(5.5);
      this.jumped = true;
      this.hasFlipped = true;
      this.relandLock = 0.05;
      events.push({ type: 'jump' });
      jumpPressed = false;
    }

    if (jumpPressed && !this.jumping && !this.hasDoubleJumped && !this.hasFlipped &&
        (!this.jumped || this.airTimeSinceJump < CAR.DOUBLE_JUMP_WINDOW)) {
      const mag = Math.abs(inp.dodgeX) + Math.abs(inp.dodgeY);
      if (mag >= opt.dodgeDeadzone) this.startFlip(inp.dodgeY, inp.dodgeX, events);
      else {
        this.vel.addScaledVector(up, CAR.JUMP_IMPULSE);
        this.hasDoubleJumped = true;
        events.push({ type: 'doublejump' });
      }
    }

    // Local angular velocity.
    tQ2.copy(this.quat).invert();
    const wl = tB.copy(this.ang).applyQuaternion(tQ2);
    wl.x += (CAR.T_ROLL * roll - CAR.D_ROLL * wl.x) * dt;
    wl.y += (CAR.T_PITCH * pitch - CAR.D_PITCH * (1 - Math.abs(pitch)) * wl.y) * dt;
    wl.z += (-CAR.T_YAW * yaw - CAR.D_YAW * (1 - Math.abs(yaw)) * wl.z) * dt;

    if (this.flipping) {
      this.flipTime += dt;
      if (this.flipTime < CAR.FLIP_TORQUE_TIME) {
        if (this.flipX !== 0) {
          const cancel = Math.max(0, Math.min(1, -pitch * Math.sign(this.flipX)));
          const target = this.flipX * CAR.FLIP_PITCH_RATE * (1 - cancel);
          wl.y = approach(wl.y, target, 45 * dt);
        }
        if (this.flipY !== 0) wl.x = this.flipY * CAR.FLIP_ROLL_RATE;
        if (this.flipTime < CAR.FLIP_Z_DAMP_END && (this.vel.z < 0 || this.flipTime < 0.15)) {
          this.vel.z *= Math.pow(1 - CAR.FLIP_Z_DAMP, dt * 120);
        }
      } else this.flipping = false;
    }

    const wlen = wl.length();
    if (wlen > CAR.MAX_ANG) wl.multiplyScalar(CAR.MAX_ANG / wlen);
    this.ang.copy(wl).applyQuaternion(this.quat);
  }

  startFlip(dx, dy, events) {
    // dx: forward (+) / back (-), dy: right (+) / left (-)
    let len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    if (Math.abs(dx) < 0.1) dx = 0;
    if (Math.abs(dy) < 0.1) dy = 0;
    len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    const f2 = tC.set(this.fwd.x, this.fwd.y, 0);
    if (f2.lengthSq() < 1e-4) f2.set(-this.up.x, -this.up.y, 0);
    f2.normalize();
    const r2 = tD.set(f2.y, -f2.x, 0);
    const fs = this.vel.dot(f2);
    const ratio = Math.abs(fs) / CAR.MAX_SPEED;
    const backwards = Math.abs(fs) < 100 ? dx < 0 : (dx >= 0) !== (fs > 0);
    let ix = dx * CAR.DODGE_IMPULSE, iy = dy * CAR.DODGE_IMPULSE;
    const maxX = backwards ? CAR.FLIP_BACK_MAX_SCALE : CAR.FLIP_FWD_MAX_SCALE;
    ix *= (maxX - 1) * ratio + 1;
    iy *= (CAR.FLIP_SIDE_MAX_SCALE - 1) * ratio + 1;
    if (backwards) ix *= CAR.FLIP_BACK_SCALE_X;
    this.vel.addScaledVector(f2, ix).addScaledVector(r2, iy);

    this.flipping = true;
    this.flipTime = 0;
    this.flipX = dx;
    this.flipY = dy;
    this.hasFlipped = true;
    events.push({ type: 'flip' });
  }

  groundConstraint(events) {
    const p = this.pos;
    const d = dist(p.x, p.y, p.z);
    if (d > CAR.REST_HEIGHT + 30) {
      this.onGround = false;
      this.relandLock = 0.1;
      return;
    }
    normal(p.x, p.y, p.z, tN);
    // Follow surface curvature: rotate the car and its velocity with the surface.
    tQ.setFromUnitVectors(this.normal, tN);
    this.quat.premultiply(tQ).normalize();
    this.vel.applyQuaternion(tQ);
    this.normal.copy(tN);

    // Settle the car's up vector onto the surface normal (fast suspension).
    this.updateAxes();
    const dot = this.up.dot(tN);
    if (dot < 0.9999) {
      tQ.setFromUnitVectors(this.up, tN);
      if (dot < 0.995) tQ.slerp(tQ2.identity(), 0.65);
      this.quat.premultiply(tQ).normalize();
    }
    p.addScaledVector(tN, CAR.REST_HEIGHT - d);
    const vn = this.vel.dot(tN);
    this.vel.addScaledVector(tN, -vn);
    this.updateAxes();
  }

  airCollide(jumpPressed, events) {
    const p = this.pos;
    // Wheels touching down.
    const d = dist(p.x, p.y, p.z);
    if (this.relandLock <= 0 && d < CAR.REST_HEIGHT + 3) {
      normal(p.x, p.y, p.z, tN);
      if (this.up.dot(tN) > 0.55 && this.vel.dot(tN) < 150) {
        this.land(tN, events);
        return;
      }
    }

    // Hitbox against the arena.
    for (let iter = 0; iter < 2; iter++) {
      let worst = 0, wp = null;
      for (const s of PROBES) {
        tA.set(s.x * HB_HALF.x + HB_OFF.x, s.y * HB_HALF.y + HB_OFF.y, s.z * HB_HALF.z + HB_OFF.z)
          .applyQuaternion(this.quat).add(p);
        const pd = dist(tA.x, tA.y, tA.z);
        if (pd < worst) { worst = pd; wp = s; }
      }
      if (!wp) break;
      tA.set(wp.x * HB_HALF.x + HB_OFF.x, wp.y * HB_HALF.y + HB_OFF.y, wp.z * HB_HALF.z + HB_OFF.z)
        .applyQuaternion(this.quat);
      tB.copy(tA).add(p);
      normal(tB.x, tB.y, tB.z, tN);
      p.addScaledVector(tN, -worst);
      this.contactTime = 0;
      this.contactNormal.copy(tN);

      // Impulse at the contact point.
      const r = tA;
      const vp = tC.crossVectors(this.ang, r).add(this.vel);
      const vn = vp.dot(tN);
      if (vn < 0) {
        const rn = tD.crossVectors(r, tN);
        const j = -(1 + 0.25) * vn / (1 / CAR.MASS + rn.lengthSq() * CAR_INV_INERTIA);
        this.vel.addScaledVector(tN, j / CAR.MASS);
        this.ang.addScaledVector(rn, j * CAR_INV_INERTIA);
        // Friction
        vp.addScaledVector(tN, -vn);
        const vt = vp.length();
        if (vt > 1e-3) {
          const jt = Math.min(0.5 * j, vt * CAR.MASS * 0.5);
          vp.multiplyScalar(1 / vt);
          this.vel.addScaledVector(vp, -jt / CAR.MASS);
          const rt = tD.crossVectors(r, vp);
          this.ang.addScaledVector(rt, -jt * CAR_INV_INERTIA);
        }
        if (-vn > 300) events.push({ type: 'bump', strength: Math.min(1, -vn / 1500) });
      }
    }
    this.updateAxes();
  }

  land(n, events) {
    this.onGround = true;
    this.normal.copy(n);
    this.jumped = false;
    this.jumping = false;
    this.hasDoubleJumped = false;
    this.hasFlipped = false;
    this.flipping = false;
    const vn = this.vel.dot(n);
    if (vn < 0) this.vel.addScaledVector(n, -vn);
    // Keep only yaw rotation about the surface.
    const yaw = this.ang.dot(n);
    this.ang.copy(n).multiplyScalar(yaw);
    events.push({ type: 'land', strength: Math.min(1, Math.max(0, -vn) / 1200) });
  }
}

export class Ball {
  constructor() {
    this.pos = new Vector3();
    this.vel = new Vector3();
    this.ang = new Vector3();
    this.quat = new Quaternion();
    this.reset();
  }

  reset() {
    this.pos.set(0, 0, BALL.REST_Z);
    this.vel.set(0, 0, 0);
    this.ang.set(0, 0, 0);
    this.exploded = false;
    this.explodeTimer = 0;
    this.lastExtraTick = -10;
    this.touchTick = -10;
  }

  step(events) {
    const dt = TICK;
    if (this.exploded) return;
    this.vel.z += GRAVITY * dt;
    this.vel.multiplyScalar(1 - BALL.DRAG * dt);
    const s = this.vel.length();
    if (s > BALL.MAX_SPEED) this.vel.multiplyScalar(BALL.MAX_SPEED / s);
    this.pos.addScaledVector(this.vel, dt);
    integrateRotation(this.quat, this.ang, dt);

    const p = this.pos;
    for (let iter = 0; iter < 2; iter++) {
      const d = dist(p.x, p.y, p.z);
      if (d >= BALL.R) break;
      const n = normal(p.x, p.y, p.z, tN);
      p.addScaledVector(n, BALL.R - d);
      const vn = this.vel.dot(n);
      if (vn >= 0) continue;
      // Chip's bounce model with spin transfer.
      const vPerp = tA.copy(n).multiplyScalar(vn);
      const vPara = tB.copy(this.vel).sub(vPerp);
      const sl = tC.crossVectors(n, this.ang).multiplyScalar(BALL.R).add(vPara);
      const slen = sl.length();
      const ratio = slen > 1e-4 ? Math.abs(vn) / slen : 0;
      const e = vn < -25 ? BALL.RESTITUTION : 0;
      const dPara = sl.multiplyScalar(-Math.min(1, BALL.Y * ratio) * BALL.MU);
      this.ang.addScaledVector(tD.crossVectors(dPara, n), BALL.A * BALL.R);
      this.vel.addScaledVector(vPerp, -(1 + e)).add(dPara);
      if (vn < -250) events.push({ type: 'bounce', strength: Math.min(1, -vn / 2500), pos: p.clone() });
    }
    const w = this.ang.length();
    if (w > BALL.MAX_ANG) this.ang.multiplyScalar(BALL.MAX_ANG / w);
  }
}

class Pad {
  constructor(x, y, big) {
    this.x = x; this.y = y; this.big = big;
    this.timer = 0;
  }
}

export class World {
  constructor() {
    this.car = new Car();
    this.ball = new Ball();
    this.pads = [
      ...BIG_PADS.map(([x, y]) => new Pad(x, y, true)),
      ...SMALL_PADS.map(([x, y]) => new Pad(x, y, false)),
    ];
    this.tick = 0;
    this.score = { blue: 0, orange: 0 };
    this.events = [];
    this.opt = { unlimitedBoost: false, dodgeDeadzone: 0.5 };
    this.spawnIndex = 0;
  }

  resetAll() {
    this.ball.reset();
    this.car.reset(SPAWNS[this.spawnIndex]);
    for (const p of this.pads) p.timer = 0;
  }

  resetBall() { this.ball.reset(); }

  step(inp) {
    const events = this.events;
    this.tick++;
    this.car.step(inp, this.opt, events);
    this.ball.step(events);
    if (!this.ball.exploded) this.collideCarBall(events);
    this.updatePads(events);
    this.checkGoal(events);
  }

  collideCarBall(events) {
    const car = this.car, ball = this.ball;
    tQ2.copy(car.quat).invert();
    const local = tA.copy(ball.pos).sub(car.pos).applyQuaternion(tQ2).sub(HB_OFF);
    const cx = Math.max(-HB_HALF.x, Math.min(HB_HALF.x, local.x));
    const cy = Math.max(-HB_HALF.y, Math.min(HB_HALF.y, local.y));
    const cz = Math.max(-HB_HALF.z, Math.min(HB_HALF.z, local.z));
    const dx = local.x - cx, dy = local.y - cy, dz = local.z - cz;
    let d = Math.hypot(dx, dy, dz);
    if (d >= BALL.R) return;

    const nLocal = tB;
    if (d > 1e-6) nLocal.set(dx / d, dy / d, dz / d);
    else {
      // Ball centre inside the box: push out along the shallowest axis.
      const px = HB_HALF.x - Math.abs(local.x), py = HB_HALF.y - Math.abs(local.y), pz = HB_HALF.z - Math.abs(local.z);
      if (px < py && px < pz) nLocal.set(Math.sign(local.x) || 1, 0, 0);
      else if (py < pz) nLocal.set(0, Math.sign(local.y) || 1, 0);
      else nLocal.set(0, 0, Math.sign(local.z) || 1);
      d = -Math.min(px, py, pz);
    }
    const n = nLocal.applyQuaternion(car.quat);
    const contact = tC.set(cx, cy, cz).add(HB_OFF).applyQuaternion(car.quat).add(car.pos);

    ball.pos.addScaledVector(n, BALL.R - d);

    const rc = tD.copy(contact).sub(car.pos);
    const rb = new Vector3().copy(contact).sub(ball.pos);
    const vCar = new Vector3().crossVectors(car.ang, rc).add(car.vel);
    const vBall = new Vector3().crossVectors(ball.ang, rb).add(ball.vel);
    const rel = vBall.sub(vCar);
    const vn = rel.dot(n);
    const firstTouch = this.tick > ball.touchTick + 1;
    ball.touchTick = this.tick;
    // Relative speed before the contact is solved drives the extra impulse.
    const preRelSpeed = Math.min(4600, tA.copy(ball.vel).sub(car.vel).length());

    if (vn < 0) {
      const invM = 1 / BALL.MASS + 1 / CAR.MASS;
      const j = -vn / invM;
      ball.vel.addScaledVector(n, j / BALL.MASS);
      car.vel.addScaledVector(n, -j / CAR.MASS);
      if (!car.onGround) {
        const rn = new Vector3().crossVectors(rc, n);
        car.ang.addScaledVector(rn, -j * CAR_INV_INERTIA * 0.5);
      }
      // Friction puts spin on the ball.
      const vt = rel.addScaledVector(n, -vn);
      const vtl = vt.length();
      if (vtl > 1e-3) {
        vt.multiplyScalar(1 / vtl);
        const jt = Math.min(0.35 * j, vtl / (invM + BALL.R * BALL.R / BALL_INERTIA));
        ball.vel.addScaledVector(vt, -jt / BALL.MASS);
        car.vel.addScaledVector(vt, jt / CAR.MASS);
        const tq = new Vector3().crossVectors(rb, vt).multiplyScalar(-jt / BALL_INERTIA);
        ball.ang.add(tq);
      }
    }

    // Psyonix extra impulse, once per touch.
    if (this.tick > ball.lastExtraTick + 1) {
      const relSpeed = preRelSpeed;
      if (relSpeed > 0) {
        const dir = tA.copy(ball.pos).sub(car.pos);
        dir.z *= 0.35;
        dir.normalize();
        dir.addScaledVector(car.fwd, -dir.dot(car.fwd) * (1 - 0.65)).normalize();
        ball.vel.addScaledVector(dir, relSpeed * curve(HIT_CURVE, relSpeed));
      }
    }
    ball.lastExtraTick = this.tick;
    if (firstTouch) {
      const strength = Math.min(1, Math.max(0.08, -vn / 2500));
      events.push({ type: 'hit', strength, pos: contact.clone() });
    }
  }

  updatePads(events) {
    const car = this.car;
    for (const pad of this.pads) {
      if (pad.timer > 0) { pad.timer = Math.max(0, pad.timer - TICK); continue; }
      const r = pad.big ? PAD.BIG_RADIUS : PAD.SMALL_RADIUS;
      const h = pad.big ? PAD.BIG_HEIGHT : PAD.SMALL_HEIGHT;
      const dx = car.pos.x - pad.x, dy = car.pos.y - pad.y;
      if (dx * dx + dy * dy < r * r && car.pos.z < h && (car.boost < 100 || this.opt.unlimitedBoost)) {
        car.boost = Math.min(100, car.boost + (pad.big ? PAD.BIG_AMOUNT : PAD.SMALL_AMOUNT));
        pad.timer = pad.big ? PAD.BIG_RESPAWN : PAD.SMALL_RESPAWN;
        events.push({ type: 'pad', big: pad.big });
      }
    }
  }

  checkGoal(events) {
    const ball = this.ball;
    if (ball.exploded) {
      ball.explodeTimer -= TICK;
      if (ball.explodeTimer <= 0) { ball.reset(); events.push({ type: 'ballspawn' }); }
      return;
    }
    if (Math.abs(ball.pos.y) > ARENA.L + BALL.R && Math.abs(ball.pos.x) < GOAL.W && ball.pos.z < GOAL.H) {
      const team = ball.pos.y > 0 ? 'blue' : 'orange';
      this.score[team]++;
      ball.exploded = true;
      ball.explodeTimer = 3;
      events.push({ type: 'goal', team, pos: ball.pos.clone(), speed: ball.vel.length() });
      ball.vel.set(0, 0, 0);
    }
  }
}
