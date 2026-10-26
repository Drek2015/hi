// Rocket League style chase camera with car cam / ball cam, swivel and the
// standard camera settings (FOV, distance, height, angle, stiffness, swivel, transition).
import { Vector3, Quaternion, MathUtils } from '../vendor/three.module.min.js';
import { dist, normal } from './arena.js';

const WORLD_UP = new Vector3(0, 0, 1);
const tA = new Vector3(), tB = new Vector3(), tN = new Vector3();
const tQ = new Quaternion();

function projectOnPlane(v, n, out) {
  return out.copy(v).addScaledVector(n, -v.dot(n));
}

// Rotate unit vector v toward target about axis by a fraction of the angle between them.
function rotateToward(v, target, axis, frac) {
  const cross = tA.crossVectors(v, target);
  const angle = Math.atan2(cross.dot(axis), v.dot(target));
  tQ.setFromAxisAngle(axis, angle * frac);
  v.applyQuaternion(tQ);
  return v;
}

export class CameraRig {
  constructor() {
    this.pos = new Vector3(0, -5000, 200);
    this.look = new Vector3(0, 0, 0);
    this.up = new Vector3(0, 0, 1);
    this.fwd = new Vector3(0, 1, 0);
    this.pivot = new Vector3();
    this.ballBlend = 0;
    this.swivel = 0;
    this.swivelPitch = 0;
    this.snapNext = true;
  }

  snap() { this.snapNext = true; }

  update(dt, car, ball, input, s, aspect) {
    const snap = this.snapNext;
    this.snapNext = false;

    // Camera up follows the driving surface, world up in the air.
    const targetUp = car.onGround ? car.normal : WORLD_UP;
    if (snap) this.up.copy(targetUp);
    else this.up.lerp(targetUp, 1 - Math.exp(-6 * dt)).normalize();
    const up = this.up;

    // Ball cam blend.
    const ballTarget = input.ballCam && !ball.exploded ? 1 : 0;
    const rate = 3.2 * s.transitionSpeed;
    this.ballBlend = snap ? ballTarget : MathUtils.clamp(this.ballBlend + Math.sign(ballTarget - this.ballBlend) * rate * dt, 0, 1);
    const blend = MathUtils.smoothstep(this.ballBlend, 0, 1);

    // Desired forward direction in the camera plane.
    const carDir = projectOnPlane(car.fwd, up, tB);
    if (carDir.lengthSq() < 0.04) projectOnPlane(car.vel, up, carDir);
    if (carDir.lengthSq() < 0.04) carDir.copy(this.fwd);
    carDir.normalize();
    const target = carDir;
    if (blend > 0) {
      const toBall = projectOnPlane(tN.copy(ball.pos).sub(car.pos), up, tN);
      if (toBall.lengthSq() > 400) {
        toBall.normalize();
        if (blend >= 1) target.copy(toBall);
        else rotateToward(target, toBall, up, blend);
      }
    }
    projectOnPlane(this.fwd, up, this.fwd);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.copy(target);
    this.fwd.normalize();
    if (snap) this.fwd.copy(target);
    else rotateToward(this.fwd, target, up, 1 - Math.exp(-(blend > 0.5 ? 14 : 9) * dt));
    this.fwd.normalize();

    // Swivel with the right stick (absolute direction like RL).
    const sx = input.camX * (s.invertSwivel ? -1 : 1), sy = input.camY;
    const mag = Math.hypot(sx, sy);
    let targetSwivel = 0, targetPitch = 0;
    if (mag > 0.25) {
      const k = MathUtils.clamp((mag - 0.25) / 0.6, 0, 1);
      targetSwivel = -Math.atan2(sx, -sy) * k;
    }
    let dS = targetSwivel - this.swivel;
    if (dS > Math.PI) dS -= 2 * Math.PI;
    if (dS < -Math.PI) dS += 2 * Math.PI;
    this.swivel += dS * (1 - Math.exp(-s.swivelSpeed * 2.4 * dt));
    if (this.swivel > Math.PI) this.swivel -= 2 * Math.PI;
    if (this.swivel < -Math.PI) this.swivel += 2 * Math.PI;
    this.swivelPitch += (targetPitch - this.swivelPitch) * (1 - Math.exp(-8 * dt));

    const viewFwd = tA.copy(this.fwd).applyAxisAngle(up, this.swivel);

    // Stiffness: how tightly the camera pivot tracks the car.
    const k = 6 + s.stiffness * 40;
    if (snap) this.pivot.copy(car.pos);
    else this.pivot.lerp(car.pos, 1 - Math.exp(-k * dt));
    // Lateral/vertical lag is clamped so the car never leaves frame.
    tN.copy(this.pivot).sub(car.pos);
    if (tN.length() > 160) this.pivot.copy(car.pos).addScaledVector(tN.normalize(), 160);

    const camPos = this.pos.copy(this.pivot).addScaledVector(viewFwd, -s.distance).addScaledVector(up, s.height);

    // Keep the camera inside the arena.
    for (let i = 0; i < 2; i++) {
      const d = dist(camPos.x, camPos.y, camPos.z);
      if (d >= 40) break;
      normal(camPos.x, camPos.y, camPos.z, tN);
      camPos.addScaledVector(tN, 40 - d);
    }

    // Look direction: pitched by the camera angle; ball cam tilts toward the ball.
    const right = tN.crossVectors(viewFwd, up).normalize();
    const lookDir = tB.copy(viewFwd).applyAxisAngle(right, MathUtils.degToRad(s.angle));
    if (blend > 0 && Math.abs(this.swivel) < 0.3) {
      const toBall = tA.copy(ball.pos).sub(camPos).normalize();
      // Only pitch toward the ball; yaw already follows it.
      const pitchBall = Math.asin(MathUtils.clamp(toBall.dot(up), -1, 1));
      const pitchNow = Math.asin(MathUtils.clamp(lookDir.dot(up), -1, 1));
      const want = MathUtils.clamp(pitchBall + MathUtils.degToRad(s.angle) * 0.5, -0.5, 1.1);
      if (want > pitchNow) lookDir.applyAxisAngle(right, (want - pitchNow) * blend);
    }
    this.look.copy(camPos).addScaledVector(lookDir, 1000);

    // RL's FOV is horizontal at 16:9; wider screens see more at the sides (Hor+).
    const hf = MathUtils.degToRad(s.fov);
    const vfov = MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / Math.min(aspect, 16 / 9)));
    return { pos: camPos, look: this.look, up, vfov };
  }
}
