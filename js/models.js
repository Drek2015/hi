// Optional custom car / ball models (.glb) supplied by the player, kept in IndexedDB.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const DB = 'boost-arena-models';
const STORE = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveModel(kind, buffer) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      if (buffer) tx.objectStore(STORE).put(buffer, kind); else tx.objectStore(STORE).delete(kind);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch { /* storage unavailable: model lasts this session only */ }
}

export async function loadSavedModel(kind) {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).get(kind);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

export function parseGlb(buffer) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', g => resolve(g.scene), reject);
  });
}

// Wrap a glTF scene (y-up) so it sits in our z-up car frame, scaled to the Octane hitbox.
export function fitCar(object, yawDeg) {
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.x = Math.PI / 2;
  inner.add(object);
  holder.add(inner);
  holder.rotation.z = THREE.MathUtils.degToRad(yawDeg);
  const outer = new THREE.Group();
  outer.add(holder);
  outer.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const s = 128 / Math.max(size.x, 1e-3);
  holder.scale.setScalar(s);
  outer.updateMatrixWorld(true);
  box.setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(4 - c.x, -c.y, -17 - box.min.z);
  return outer;
}

export function fitBall(object, radius) {
  const holder = new THREE.Group();
  holder.add(object);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  holder.scale.setScalar((radius * 2) / Math.max(size.x, size.y, size.z, 1e-3));
  holder.updateMatrixWorld(true);
  box.setFromObject(holder);
  holder.position.sub(box.getCenter(new THREE.Vector3()));
  const outer = new THREE.Group();
  outer.add(holder);
  return outer;
}
