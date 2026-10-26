// Octane-style car built from primitives. Local frame: +x forward, +y left, +z up,
// origin at the physics pivot (17 uu above the ground).
import * as THREE from '../vendor/three.module.min.js';

function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: 6,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, (width - bevel * 2) / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

export function buildCar(envMap, team = 'blue', glowTexture = null) {
  const paint = team === 'blue' ? 0x2a6bff : 0xff7a1a;
  const accent = team === 'blue' ? 0x7fb2ff : 0xffc27a;
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: paint, metalness: 0.45, roughness: 0.22, envMap, envMapIntensity: 1.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.3, roughness: 0.6, envMap, envMapIntensity: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.9, roughness: 0.08, envMap, envMapIntensity: 1.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0.0, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.95, roughness: 0.25, envMap });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const decalMat = new THREE.MeshBasicMaterial({ color: accent });

  // Lower body.
  const body = new THREE.Mesh(extrudeProfile([
    [-58, -5], [-62, 6], [-61, 21], [-53, 27], [-22, 29], [18, 27], [42, 22], [58, 17], [66, 9], [66, 0], [60, -5],
  ], 72, 5), bodyMat);
  group.add(body);

  // Cabin and glass.
  const cabin = new THREE.Mesh(extrudeProfile([
    [-50, 25], [-37, 42], [-29, 46], [2, 46], [9, 44], [27, 26],
  ], 58, 3.5), glassMat);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(31, 52, 3), bodyMat);
  roof.position.set(-13, 0, 48.2);
  group.add(roof);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(14, 58, 2.5), bodyMat);
  spoiler.position.set(-40, 0, 45);
  spoiler.rotation.y = -0.35;
  group.add(spoiler);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 8), darkMat);
    fin.position.set(-40, s * 26, 42);
    group.add(fin);
    // Side skirts and side stripe.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(70, 4, 7), darkMat);
    skirt.position.set(8, s * 36.5, -2);
    group.add(skirt);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(74, 1, 3.2), decalMat);
    stripe.position.set(4, s * 36.6, 13);
    group.add(stripe);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3, 13, 5), lightMat);
    head.position.set(66.5, s * 25, 10);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 6), tailMat);
    tail.position.set(-62.2, s * 25, 17);
    group.add(tail);
  }
  // Front splitter and rear diffuser.
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(10, 68, 10), darkMat);
  splitter.position.set(63.5, 0, -1);
  group.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(10, 64, 12), darkMat);
  diffuser.position.set(-59, 0, 1);
  group.add(diffuser);
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(2, 52, 1.6), tailMat);
  tailBar.position.set(-62.6, 0, 21.5);
  group.add(tailBar);
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 9), darkMat);
  rearPlate.position.set(-62, 0, 11);
  group.add(rearPlate);

  // Exhaust and boost flame.
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 10, 14, 1, true), darkMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-63, 0, 9);
  group.add(exhaust);

  const flame = new THREE.Group();
  flame.position.set(-67, 0, 9);
  const coneGeo = (r, h) => {
    const g = new THREE.ConeGeometry(r, h, 14, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  const outerFlame = new THREE.Mesh(coneGeo(13, 72), new THREE.MeshBasicMaterial({
    color: 0xff6a12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const innerFlame = new THREE.Mesh(coneGeo(7, 40), new THREE.MeshBasicMaterial({
    color: 0xffd98a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xff9a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glow.scale.set(70, 70, 1);
  glow.position.x = -6;
  flame.add(outerFlame, innerFlame, glow);
  flame.visible = false;
  group.add(flame);

  // Wheels.
  const wheels = [];
  const archMat = bodyMat.clone();
  archMat.side = THREE.DoubleSide;
  const makeWheel = (r, w) => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), tireMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.8, 20), darkMat);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 2.4, 10), rimMat);
    g.add(tire, rim, hub);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.62, w + 1.6, 2.6), rimMat);
      spoke.position.x = r * 0.3;
      const holder = new THREE.Group();
      holder.add(spoke);
      holder.rotation.y = i * Math.PI * 2 / 5;
      g.add(holder);
    }
    return g;
  };
  const wheelDefs = [
    { x: 50, y: 37, z: -2.5, r: 14.5, w: 13, front: true },
    { x: 50, y: -37, z: -2.5, r: 14.5, w: 13, front: true },
    { x: -35, y: 38.5, z: -0.5, r: 16.5, w: 16, front: false },
    { x: -35, y: -38.5, z: -0.5, r: 16.5, w: 16, front: false },
  ];
  for (const d of wheelDefs) {
    const steer = new THREE.Group();
    steer.position.set(d.x, d.y, d.z);
    const spin = makeWheel(d.r, d.w);
    steer.add(spin);
    group.add(steer);
    wheels.push({ steer, spin, front: d.front, baseZ: d.z });
    // Fender arch.
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(d.r + 5, d.r + 5, d.w + 6, 16, 1, true, -Math.PI / 2 - 0.25, Math.PI + 0.5), archMat);
    arch.position.set(d.x, d.y > 0 ? d.y + 1 : d.y - 1, d.z);
    group.add(arch);
  }

  group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { group, wheels, flame, outerFlame, innerFlame, bodyMat, archMat };
}
