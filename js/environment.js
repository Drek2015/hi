// Daytime outdoor stadium surroundings: sky, mountains, skyline, trees, light towers.
// Sky, mountains and skyline live in the scene root (y-up); the rest in `world` (physics z-up).
import * as THREE from '../vendor/three.module.min.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { ARENA } from './constants.js';
import * as T from './textures.js';

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function trussGeometry(height) {
  const parts = [];
  const leg = new THREE.CylinderGeometry(16, 16, height, 6);
  leg.rotateX(Math.PI / 2);
  leg.translate(0, 0, height / 2);
  const off = 120;
  for (const [x, y] of [[-off, -off], [off, -off], [off, off], [-off, off]]) parts.push(leg.clone().translate(x, y, 0));
  for (let z = 300; z < height; z += 480) {
    for (const [w, d, x, y] of [[2 * off, 14, 0, -off], [2 * off, 14, 0, off], [14, 2 * off, -off, 0], [14, 2 * off, off, 0]]) {
      parts.push(new THREE.BoxGeometry(w, d, 14).translate(x, y, z));
    }
    // Diagonal braces on two faces.
    const len = Math.hypot(2 * off, 480);
    for (const y of [-off, off]) {
      const b = new THREE.BoxGeometry(len, 10, 10);
      b.rotateY(-Math.atan2(480, 2 * off));
      parts.push(b.translate(0, y, z + 240));
    }
  }
  parts.push(new THREE.BoxGeometry(900, 160, 40).translate(0, 0, height));
  return mergeGeometries(parts.map(p => p.toNonIndexed()));
}

export function buildEnvironment(scene, world, renderer) {
  // Sky as an equirect background and as the reflection environment.
  const sky = T.skyTexture();
  scene.background = sky;
  const pm = new THREE.PMREMGenerator(renderer);
  const envMap = pm.fromEquirectangular(sky).texture;
  pm.dispose();

  // Mountain range ring.
  const mtnTex = T.mountainTexture();
  mtnTex.repeat.set(3, 1);
  const mtn = new THREE.Mesh(
    new THREE.CylinderGeometry(42000, 42000, 11000, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: mtnTex, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false }),
  );
  mtn.position.y = 11000 / 2 - 900;
  mtn.renderOrder = -5;
  scene.add(mtn);

  // City skyline on one side.
  const cityTex = T.cityTexture();
  cityTex.repeat.set(1.5, 1);
  const city = new THREE.Mesh(
    new THREE.CylinderGeometry(30000, 30000, 9000, 48, 1, true, Math.PI - 1.35, 1.6),
    new THREE.MeshBasicMaterial({ map: cityTex, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false }),
  );
  city.position.y = 9000 / 2 - 600;
  city.renderOrder = -4;
  scene.add(city);

  // Grass ground.
  const grass = T.grassTexture();
  grass.repeat.set(140, 140);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), new THREE.MeshLambertMaterial({ map: grass }));
  ground.position.z = -40;
  world.add(ground);

  // Concrete apron around the arena.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * ARENA.W + 3200, 2 * ARENA.L + 4200),
    new THREE.MeshLambertMaterial({ color: 0x9a9c98 }),
  );
  apron.position.z = -30;
  world.add(apron);

  // Poplar trees (crossed quads, one instanced draw call).
  const treeGeo = mergeGeometries([0, Math.PI / 2].map(a => {
    const p = new THREE.PlaneGeometry(560, 1400);
    p.rotateX(Math.PI / 2);
    p.translate(0, 0, 700);
    p.rotateZ(a);
    return p;
  }));
  const treeMat = new THREE.MeshLambertMaterial({ map: T.treeTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  const COUNT = 340;
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, COUNT);
  const r = rng(12345);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const col = new THREE.Color();
  let n = 0;
  while (n < COUNT) {
    const a = r() * Math.PI * 2;
    const dist = 1 + r() * 0.9;
    const x = Math.cos(a) * (ARENA.W + 2600) * dist * 1.25;
    const y = Math.sin(a) * (ARENA.L + 2600) * dist * 1.12;
    if (Math.abs(x) < ARENA.W + 1900 && Math.abs(y) < ARENA.L + 2400) continue;
    v.set(x, y, -40);
    q.setFromAxisAngle(zAxis, r() * Math.PI);
    const k = 0.8 + r() * 0.6;
    s.set(k, k, k * (0.9 + r() * 0.4));
    m.compose(v, q, s);
    trees.setMatrixAt(n, m);
    trees.setColorAt(n, col.setHSL(0.12 + r() * 0.08, 0.25, 0.8 + r() * 0.2));
    n++;
  }
  world.add(trees);

  // Light towers with banners.
  const towerH = 5400;
  const towerGeo = trussGeometry(towerH);
  const spots = [
    [-ARENA.W - 1500, -ARENA.L + 600], [ARENA.W + 1500, -ARENA.L + 600],
    [-ARENA.W - 1500, ARENA.L - 600], [ARENA.W + 1500, ARENA.L - 600],
    [-ARENA.W - 1700, 0], [ARENA.W + 1700, 0],
    [-1900, -ARENA.L - 2300], [1900, ARENA.L + 2300],
  ];
  const towers = new THREE.InstancedMesh(towerGeo, new THREE.MeshLambertMaterial({ color: 0xb9bec6 }), spots.length);
  const bankGeo = new THREE.BoxGeometry(700, 60, 380);
  const faceGeo = new THREE.PlaneGeometry(680, 360);
  faceGeo.rotateX(Math.PI / 2);
  faceGeo.translate(0, -31, 0);
  const banks = new THREE.InstancedMesh(bankGeo, new THREE.MeshLambertMaterial({ color: 0x4a4f58 }), spots.length);
  const faces = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ map: T.lightPanelTexture(), side: THREE.DoubleSide }), spots.length);
  const bannerGeo = new THREE.PlaneGeometry(320, 1300);
  bannerGeo.rotateX(Math.PI / 2);
  const blueSpots = spots.filter(([, y]) => y < 0), orangeSpots = spots.filter(([, y]) => y >= 0);
  const banners = {
    blue: new THREE.InstancedMesh(bannerGeo, new THREE.MeshLambertMaterial({ map: T.bannerTexture('blue'), side: THREE.DoubleSide }), blueSpots.length),
    orange: new THREE.InstancedMesh(bannerGeo, new THREE.MeshLambertMaterial({ map: T.bannerTexture('orange'), side: THREE.DoubleSide }), orangeSpots.length),
  };
  const count = { blue: 0, orange: 0 };
  const e3 = new THREE.Euler();
  spots.forEach(([x, y], i) => {
    const face = Math.atan2(-y, -x);
    q.setFromAxisAngle(zAxis, face + Math.PI / 2);
    m.compose(v.set(x, y, -40), q, s.set(1, 1, 1));
    towers.setMatrixAt(i, m);
    q.setFromEuler(e3.set(0, 0, face + Math.PI / 2)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.35));
    m.compose(v.set(x + Math.cos(face) * 120, y + Math.sin(face) * 120, towerH + 180), q, s.set(1, 1, 1));
    banks.setMatrixAt(i, m);
    faces.setMatrixAt(i, m);
    const team = y < 0 ? 'blue' : 'orange';
    q.setFromAxisAngle(zAxis, face + Math.PI / 2);
    m.compose(v.set(x + Math.cos(face) * 150, y + Math.sin(face) * 150, 1700), q, s.set(1, 1, 1));
    banners[team].setMatrixAt(count[team]++, m);
  });
  world.add(banks, faces, banners.blue, banners.orange);
  world.add(towers);

  return { envMap };
}
