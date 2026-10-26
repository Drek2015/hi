// One pooled, additive point-sprite particle system (single draw call).
import * as THREE from '../vendor/three.module.min.js';

const VERT = `
attribute float size;
attribute vec4 tint;
uniform float scale;
varying vec4 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec4 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = clamp(1.0 - d, 0.0, 1.0);
  a = a * a;
#ifdef SMOKE
  a = smoothstep(0.0, 0.6, a);
  gl_FragColor = vec4(vTint.rgb, vTint.a * a);
#else
  gl_FragColor = vec4(vTint.rgb * a, vTint.a * a);
#endif
}`;

export class Particles {
  constructor(max = 2500, smoke = false) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.sizeAttr = new Float32Array(max);
    this.tintAttr = new Float32Array(max * 4);

    const geo = new THREE.BufferGeometry();
    this.posBuf = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeBuf = new THREE.BufferAttribute(this.sizeAttr, 1).setUsage(THREE.DynamicDrawUsage);
    this.tintBuf = new THREE.BufferAttribute(this.tintAttr, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posBuf);
    geo.setAttribute('size', this.sizeBuf);
    geo.setAttribute('tint', this.tintBuf);
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      defines: smoke ? { SMOKE: '' } : {},
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = smoke ? 9 : 10;
    this.quality = 1;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0) {
    if (this.quality < 1 && Math.random() > this.quality) return;
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 0; this.maxLife[i] = life;
    this.size0[i] = s0; this.size1[i] = s1;
    this.c0.set(c0, i * 4); this.c1.set(c1, i * 4);
    this.drag[i] = drag; this.grav[i] = grav;
  }

  burst(p, n, speed, life, s0, s1, c0, c1, opts = {}) {
    const { drag = 2, grav = 0, up = 0, spread = 1 } = opts;
    for (let k = 0; k < n; k++) {
      let x, y, z, l;
      do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
      l = Math.sqrt(l);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.emit(p.x, p.y, p.z, x / l * sp * spread, y / l * sp * spread, z / l * sp + up,
        life * (0.6 + Math.random() * 0.6), s0, s1, c0, c1, drag, grav);
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        const j = --this.count;
        if (i !== j) this.copy(j, i);
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] = this.vel[i * 3 + 2] * k + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.sizeAttr[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      for (let c = 0; c < 4; c++) this.tintAttr[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * t;
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.posBuf.needsUpdate = true;
    this.sizeBuf.needsUpdate = true;
    this.tintBuf.needsUpdate = true;
  }

  copy(from, to) {
    for (let c = 0; c < 3; c++) {
      this.pos[to * 3 + c] = this.pos[from * 3 + c];
      this.vel[to * 3 + c] = this.vel[from * 3 + c];
    }
    for (let c = 0; c < 4; c++) {
      this.c0[to * 4 + c] = this.c0[from * 4 + c];
      this.c1[to * 4 + c] = this.c1[from * 4 + c];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.size0[to] = this.size0[from]; this.size1[to] = this.size1[from];
    this.drag[to] = this.drag[from]; this.grav[to] = this.grav[from];
  }

  clear() { this.count = 0; }
}
