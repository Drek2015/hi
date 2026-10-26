// Builds the 3D view of one hole: turf, rails, cup, flag, obstacles, lights and the themed world.
// Course coordinates (x, y, height) map to three.js as (x, height, -y).
import * as THREE from '../vendor/three.module.min.js';
import { PHYS } from './sim.js';
import { THEMES, turfMap, railTexture, bumperMesh, spinnerMesh, moverMesh, blockMesh, boostTexture, webTexture, flagTexture } from './themes.js';

const RAIL_H = 0.24, RAIL_T = 0.16, BASE = -0.45;

// A box whose two ends can have different bottom/top heights (for rails along ramps).
function prism(ax, az, bx, bz, nx, nz, thick, b0, t0, b1, t1, uvLen) {
  const ox = nx * thick / 2, oz = nz * thick / 2;
  const P = [
    [ax - ox, b0, az - oz], [ax + ox, b0, az + oz], [ax + ox, t0, az + oz], [ax - ox, t0, az - oz],
    [bx - ox, b1, bz - oz], [bx + ox, b1, bz + oz], [bx + ox, t1, bz + oz], [bx - ox, t1, bz - oz],
  ];
  const faces = [[0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4], [0, 3, 2, 1], [4, 5, 6, 7]];
  const pos = [], uv = [];
  for (const [a, b, c, d] of faces) {
    for (const [i, u, v] of [[a, 0, 0], [b, 1, 0], [c, 1, 1], [a, 0, 0], [c, 1, 1], [d, 0, 1]]) {
      pos.push(...P[i]);
      uv.push(u * uvLen, v);
    }
  }
  return { pos, uv };
}

export class HoleView {
  constructor(renderer, course, themeKey) {
    this.course = course;
    this.theme = THEMES[themeKey];
    this.themeKey = themeKey;
    this.scene = new THREE.Scene();
    const T = this.theme;
    renderer.toneMappingExposure = T.exposure;
    if (T.fog) this.scene.fog = new THREE.FogExp2(T.fog[0], T.fog[1]);
    this.scene.background = new THREE.Color(T.fog ? T.fog[0] : 0x000000);

    const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]);
    const cx = course.cols / 2, cz = -course.rows / 2;
    sun.position.set(cx + T.sun[2][0], T.sun[2][1], cz + T.sun[2][2]);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    const ext = Math.max(course.cols, course.rows) * 0.75 + 2;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 40 });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);

    this.bounds = { cx, cz, w: course.cols, d: course.rows };
    this.updateWorld = T.build(this.scene, this.bounds) || (() => {});

    this.buildTurf();
    this.buildRails();
    this.buildCup();
    this.buildObstacles();
  }

  buildTurf() {
    const c = this.course, T = this.theme;
    const pos = [], col = [], uv = [];
    const ca = new THREE.Color(T.turf[0]), cb = new THREE.Color(T.turf[1]);
    for (const cell of c.cells) {
      if (!cell) continue;
      const x0 = cell.c, y0 = c.rows - cell.row - 1;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const xa = x0 + i / 2, xb = xa + 0.5, ya = y0 + j / 2, yb = ya + 0.5;
        const h = (x, y) => c.cellHeight(cell, x, y);
        const color = ((cell.c * 2 + i) + (cell.row * 2 + (1 - j))) % 2 ? ca : cb;
        const tint = cell.ramp ? 0.92 : 1;
        const quad = [[xa, ya], [xb, ya], [xb, yb], [xa, ya], [xb, yb], [xa, yb]];
        for (const [x, y] of quad) {
          pos.push(x, h(x, y), -y);
          col.push(color.r * tint, color.g * tint, color.b * tint);
          uv.push(x * 0.5, y * 0.5);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const map = turfMap();
    const turf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.85 }));
    turf.receiveShadow = true;
    this.scene.add(turf);

    // Skirts under open edges.
    const sp = [];
    for (const w of c.walls) {
      if (!w.open) continue;
      sp.push(w.ax, w.h0, -w.ay, w.bx, w.h1, -w.by, w.bx, BASE, -w.by, w.ax, w.h0, -w.ay, w.bx, BASE, -w.by, w.ax, BASE, -w.ay);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.computeVertexNormals();
    const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: T.skirt, roughness: 0.9, side: THREE.DoubleSide }));
    skirt.receiveShadow = true;
    this.scene.add(skirt);
    // Underside so the course reads as a solid slab.
    const under = new THREE.Mesh(new THREE.PlaneGeometry(c.cols, c.rows), new THREE.MeshStandardMaterial({ color: T.skirt }));
    under.rotation.x = -Math.PI / 2;
    under.position.set(c.cols / 2, BASE, -c.rows / 2);
    under.visible = false;
    this.scene.add(under);
  }

  buildRails() {
    const c = this.course;
    const pos = [], uv = [], cap = [];
    for (const w of c.walls) {
      const len = Math.hypot(w.bx - w.ax, w.by - w.ay);
      // three.js axes: x stays, z = -y. Normal (perpendicular in plane).
      const dx = (w.bx - w.ax) / len, dz = -(w.by - w.ay) / len;
      const nx = -dz, nz = dx;
      // Open walls sit just outside the playing edge; internal ones straddle the step.
      let ax = w.ax, az = -w.ay, bx = w.bx, bz = -w.by;
      if (w.open) { ax -= w.nx * RAIL_T / 2; bx -= w.nx * RAIL_T / 2; az += w.ny * RAIL_T / 2; bz += w.ny * RAIL_T / 2; }
      // Extend slightly so corners overlap cleanly.
      ax -= dx * RAIL_T / 2; az -= dz * RAIL_T / 2; bx += dx * RAIL_T / 2; bz += dz * RAIL_T / 2;
      const b0 = (w.open ? w.h0 : w.l0) - 0.02, b1 = (w.open ? w.h1 : w.l1) - 0.02;
      const p = prism(ax, az, bx, bz, nx, nz, RAIL_T, b0, w.h0 + RAIL_H, b1, w.h1 + RAIL_H, len * 2);
      pos.push(...p.pos); uv.push(...p.uv);
      const k = prism(ax - dx * 0.01, az - dz * 0.01, bx + dx * 0.01, bz + dz * 0.01, nx, nz, RAIL_T + 0.04, w.h0 + RAIL_H - 0.02, w.h0 + RAIL_H + 0.025, w.h1 + RAIL_H - 0.02, w.h1 + RAIL_H + 0.025, 1);
      cap.push(...k.pos);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3));
    cg.computeVertexNormals();
    const caps = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: this.theme.railCap, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    caps.castShadow = true;
    this.scene.add(caps);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const rails = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: railTexture(this.themeKey), side: THREE.DoubleSide, roughness: 0.6, metalness: this.themeKey === 'lab' || this.themeKey === 'tower' ? 0.5 : 0.05 }));
    rails.castShadow = true;
    rails.receiveShadow = true;
    this.scene.add(rails);
  }

  buildCup() {
    const c = this.course, cup = c.cup;
    const h = c.height(cup.x, cup.y);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(PHYS.CUP_R, 32), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(cup.x, h + 0.004, -cup.y);
    const rim = new THREE.Mesh(new THREE.RingGeometry(PHYS.CUP_R, PHYS.CUP_R + 0.03, 32), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(cup.x, h + 0.005, -cup.y);
    this.scene.add(hole, rim);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }));
    pole.position.set(cup.x, h + 0.62, -cup.y);
    pole.castShadow = true;
    const fg = new THREE.PlaneGeometry(0.5, 0.31, 10, 4);
    fg.translate(0.25, 0, 0);
    this.flagBase = fg.attributes.position.array.slice();
    this.flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTexture(this.themeKey), side: THREE.DoubleSide, roughness: 0.8 }));
    this.flag.position.set(cup.x + 0.018, h + 1.08, -cup.y);
    this.flag.castShadow = true;
    this.scene.add(pole, this.flag);
    this.pole = pole;
  }

  buildObstacles() {
    const c = this.course, T = this.theme;
    this.animated = [];
    for (const o of c.obstacles) {
      if (o.type === 'bumper') {
        const m = bumperMesh(T.bumper, o.radius);
        m.position.set(o.x, c.height(o.x, o.y), -o.y);
        this.scene.add(m);
        this.animated.push({ o, m, kind: 'bumper', base: m.position.y, pulse: 0 });
      } else if (o.type === 'spinner') {
        const s = spinnerMesh(T.spinner, o.len);
        s.group.position.set(o.x, c.height(o.x, o.y), -o.y);
        this.scene.add(s.group);
        this.animated.push({ o, m: s.bar, kind: 'spinner' });
      } else if (o.type === 'mover') {
        const m = moverMesh(T.mover, o.w, o.h);
        this.scene.add(m);
        this.animated.push({ o, m, kind: 'mover' });
      } else if (o.type === 'block') {
        const m = blockMesh(this.themeKey, o.w, o.h);
        m.position.set(o.x, c.height(o.x, o.y), -o.y);
        this.scene.add(m);
      } else if (o.type === 'boost') {
        const tex = boostTexture();
        tex.repeat.set(1, 1.5);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.9), new THREE.MeshBasicMaterial({ map: tex, color: 0xffc23a, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = (o.angle - 90) * Math.PI / 180;
        m.position.set(o.x, c.height(o.x, o.y) + 0.006, -o.y);
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.6, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(o.x, c.height(o.x, o.y) + 0.004, -o.y);
        this.scene.add(pad, m);
        this.animated.push({ o, m, kind: 'boost', tex });
      } else if (o.type === 'portal') {
        for (const [x, y, color] of [[o.x, o.y, 0x5fe6ff], [o.bx, o.by, 0xffb84a]]) {
          const g = new THREE.Group();
          const ring = new THREE.Mesh(new THREE.TorusGeometry(o.radius + 0.04, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color }));
          ring.rotation.x = Math.PI / 2;
          const disc = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005;
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(o.radius, o.radius, 1.6, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          beam.position.y = 0.8;
          g.add(ring, disc, beam);
          g.position.set(x, c.height(x, y) + 0.02, -y);
          this.scene.add(g);
          this.animated.push({ kind: 'portal', m: g, beam });
        }
      } else if (o.type === 'zone') {
        const w = o.x1 - o.x0, d = o.y1 - o.y0;
        let mat;
        if (o.kind === 'ice') mat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, transparent: true, opacity: 0.55, metalness: 0.9, roughness: 0.05, depthWrite: false });
        else { const t = webTexture(); t.repeat.set(w / 1.5, d / 1.5); mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }); }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(o.x0 + w / 2, c.height(o.x0 + w / 2, o.y0 + d / 2) + 0.008, -(o.y0 + d / 2));
        this.scene.add(m);
      }
    }
  }

  bump(o) {
    const a = this.animated.find(x => x.o === o);
    if (a) a.pulse = 1;
  }

  update(t, dt) {
    const c = this.course;
    for (const a of this.animated) {
      if (a.kind === 'spinner') a.m.rotation.y = -c.spinnerAngle(a.o, t);
      else if (a.kind === 'mover') {
        const s = c.moverState(a.o, t);
        a.m.position.set(s.x, c.height(s.x, s.y), -s.y);
      } else if (a.kind === 'boost') a.tex.offset.y = -t * 1.6;
      else if (a.kind === 'portal') { a.m.rotation.y = t * 2; a.beam.material.opacity = 0.14 + Math.sin(t * 4) * 0.06; }
      else if (a.kind === 'bumper') {
        a.pulse = Math.max(0, a.pulse - dt * 4);
        const s = 1 + a.pulse * 0.15;
        a.m.scale.set(s, 1 - a.pulse * 0.1, s);
      }
    }
    // Flag waving.
    const p = this.flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = this.flagBase[i * 3];
      p.setZ(i, Math.sin(x * 9 - t * 6) * 0.05 * x * 2);
    }
    p.needsUpdate = true;
    this.updateWorld(t);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); });
    });
  }
}
