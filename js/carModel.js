// Octane-style car. The body and cabin are smooth lofts through superellipse
// cross-sections, so the silhouette has the Octane's tall cab, short sloped hood,
// flared fenders and big exposed wheels. Local frame: +x forward, +y left, +z up,
// origin at the physics pivot (17 uu above the ground).
import * as THREE from '../vendor/three.module.min.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// stations: [x, zBottom, zTop, halfWidth, exponent]; colorFn(x, y, z, top) -> THREE.Color
function loft(stations, segs, colorFn) {
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  for (const [x, zb, zt, w, n] of stations) {
    const zc = (zb + zt) / 2, h = (zt - zb) / 2;
    for (let i = 0; i < segs; i++) {
      const t = i / segs * Math.PI * 2;
      const ct = Math.cos(t), st = Math.sin(t);
      const y = w * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
      const z = zc + h * Math.sign(st) * Math.pow(Math.abs(st), 2 / n);
      pos.push(x, y, z);
      colorFn(x, y, z, st, c);
      col.push(c.r, c.g, c.b);
    }
  }
  const ns = stations.length;
  for (let s = 0; s < ns - 1; s++) {
    for (let i = 0; i < segs; i++) {
      const a = s * segs + i, b = s * segs + (i + 1) % segs, cc = a + segs, d = b + segs;
      idx.push(a, b, cc, b, d, cc);
    }
  }
  // End caps.
  for (const [s, flip] of [[0, true], [ns - 1, false]]) {
    const [x, zb, zt] = stations[s];
    const center = pos.length / 3;
    pos.push(x, 0, (zb + zt) / 2);
    colorFn(x, 0, (zb + zt) / 2, 0, c);
    col.push(c.r, c.g, c.b);
    for (let i = 0; i < segs; i++) {
      const a = s * segs + i, b = s * segs + (i + 1) % segs;
      if (flip) idx.push(center, b, a); else idx.push(center, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildCar(envMap, team = 'blue', glowTexture = null) {
  const paintHex = team === 'blue' ? 0x1f5fe8 : 0xf06a12;
  const paint = new THREE.Color(paintHex);
  const accent = new THREE.Color(team === 'blue' ? 0xdfe8f5 : 0x2a2d33);
  const black = new THREE.Color(0x121418);
  const glass = new THREE.Color(0x0d1626);
  const group = new THREE.Group();

  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.3, envMap, envMapIntensity: 0.75 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.3, roughness: 0.6, envMap, envMapIntensity: 0.4 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: paintHex, metalness: 0.35, roughness: 0.3, envMap, envMapIntensity: 0.75, side: THREE.DoubleSide });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, metalness: 0, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ad, metalness: 0.9, roughness: 0.3, envMap, envMapIntensity: 0.7 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf6f9ff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });

  // Main body tub.
  const body = loft([
    [-61, 2, 21, 27, 3.2],
    [-58, -3, 26, 31, 3.6],
    [-48, -5, 28, 33, 4],
    [-30, -6, 29, 34, 4],
    [-5, -6, 28.5, 34, 4],
    [18, -6, 27, 33, 4],
    [36, -5, 22.5, 31, 3.6],
    [52, -3, 17, 28, 3.2],
    [62, -1, 12, 25, 3],
    [67.5, 2, 8, 19, 2.6],
  ], 28, (x, y, z, st, c) => {
    if (z < 1.5) c.copy(black);
    else if (Math.abs(y) < 7 && z > 20 && x > 10) c.copy(accent);   // hood stripe
    else if (z > 6 && z < 9.5 && Math.abs(y) > 25) c.copy(accent);  // side stripe
    else c.copy(paint);
  });
  group.add(new THREE.Mesh(body, paintMat));

  // Cabin: tall glasshouse with painted roof and pillars.
  const cabin = loft([
    [-50, 24, 28, 23, 3],
    [-44, 24, 38, 25, 3.4],
    [-34, 24, 46, 26, 3.8],
    [-14, 24, 49.5, 26, 4],
    [2, 24, 48, 25.5, 4],
    [12, 24, 42, 25, 3.6],
    [20, 24, 33, 24, 3.2],
    [26, 24, 26.5, 22, 3],
  ], 28, (x, y, z, st, c) => {
    if (st > 0.82) c.copy(paint);                // roof
    else if (x < -42 || z < 27) c.copy(paint);    // rear pillar and sill
    else c.copy(glass);
  });
  group.add(new THREE.Mesh(cabin, paintMat));

  // Roof spoiler with side fins.
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(16, 56, 3), bodyMat);
  spoiler.position.set(-45, 0, 46);
  spoiler.rotation.y = -0.28;
  group.add(spoiler);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 9), darkMat);
    fin.position.set(-42, s * 27, 42);
    group.add(fin);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 4), lightMat);
    head.position.set(66.3, s * 13, 7.5);
    head.rotation.z = s * 0.25;
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 10, 7), tailMat);
    tail.position.set(-61.2, s * 21, 15);
    group.add(tail);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 6), darkMat);
    vent.position.set(10, s * 33.6, 16);
    group.add(vent);
  }

  // Front grille, bumper and rear diffuser.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(6, 40, 7), darkMat);
  grille.position.set(66, 0, 2.5);
  group.add(grille);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(8, 48, 10), darkMat);
  diffuser.position.set(-59, 0, 3);
  group.add(diffuser);

  // Exhaust and boost flame.
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 10, 16, 1, true), darkMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-62, 0, 11);
  group.add(exhaust);

  const flame = new THREE.Group();
  flame.position.set(-66, 0, 11);
  const coneGeo = (r, h) => {
    const g = new THREE.ConeGeometry(r, h, 16, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  const outerFlame = new THREE.Mesh(coneGeo(12, 80), new THREE.MeshBasicMaterial({
    color: 0xff5a10, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const innerFlame = new THREE.Mesh(coneGeo(6.5, 46), new THREE.MeshBasicMaterial({
    color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  flame.add(outerFlame, innerFlame);
  if (glowTexture) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow.scale.set(80, 80, 1);
    glow.position.x = -4;
    flame.add(glow);
  }
  flame.visible = false;
  group.add(flame);

  // Wheels with flared fender arches.
  const wheels = [];
  // Each wheel is three merged meshes (tyre, rim, spokes) to keep draw calls low.
  const makeWheel = (r, w) => {
    const g = new THREE.Group();
    const put = (geo, f) => { f(geo); return geo.toNonIndexed(); };
    const tyre = [new THREE.CylinderGeometry(r, r, w, 28)];
    for (const side of [-1, 1]) {
      tyre.push(put(new THREE.TorusGeometry(r - 1.5, 2.2, 8, 28), t => { t.rotateX(Math.PI / 2); t.translate(0, side * w / 2, 0); }));
    }
    const spokes = [new THREE.CylinderGeometry(r * 0.16, r * 0.16, w + 1.4, 12)];
    for (let i = 0; i < 6; i++) {
      spokes.push(put(new THREE.BoxGeometry(r * 0.46, w + 0.9, 2.4), b => { b.translate(r * 0.36, 0, 0); b.rotateY(i * Math.PI / 3); }));
    }
    g.add(new THREE.Mesh(mergeGeometries(tyre.map(t => t.index ? t.toNonIndexed() : t)), tireMat));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.6, 24), darkMat));
    g.add(new THREE.Mesh(mergeGeometries(spokes.map(t => t.index ? t.toNonIndexed() : t)), rimMat));
    return g;
  };
  const wheelDefs = [
    { x: 51, y: 38, z: -2.5, r: 14.5, w: 14, front: true },
    { x: 51, y: -38, z: -2.5, r: 14.5, w: 14, front: true },
    { x: -34, y: 39.5, z: -0.5, r: 16.5, w: 17, front: false },
    { x: -34, y: -39.5, z: -0.5, r: 16.5, w: 17, front: false },
  ];
  for (const d of wheelDefs) {
    const steer = new THREE.Group();
    steer.position.set(d.x, d.y, d.z);
    steer.add(makeWheel(d.r, d.w));
    const spin = steer.children[0];
    group.add(steer);
    wheels.push({ steer, spin, front: d.front, baseZ: d.z });
    // Fender: open arch shell plus a thick lip.
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(d.r + 5, d.r + 5, d.w + 6, 20, 1, true, -Math.PI / 2 - 0.35, Math.PI + 0.7), bodyMat);
    arch.position.set(d.x, d.y > 0 ? d.y - 1 : d.y + 1, d.z);
    group.add(arch);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(d.r + 5, 2.4, 6, 20, Math.PI + 0.7), darkMat);
    lip.rotation.set(Math.PI / 2, 0, -0.35);
    lip.position.set(d.x, d.y > 0 ? d.y + d.w / 2 + 2 : d.y - d.w / 2 - 2, d.z);
    group.add(lip);
  }

  group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { group, wheels, flame, outerFlame, innerFlame, bodyMat };
}
