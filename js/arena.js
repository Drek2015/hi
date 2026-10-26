// Arena collision as a signed distance field. dist() > 0 inside the playable space.
// The arena is an octagonal prism whose every edge is rounded with radius R
// (Minkowski sum of an inset prism and a sphere), unioned with the two goal boxes.
import { ARENA, GOAL } from './constants.js';

const { W, L, H, C, R } = ARENA;
const A = W - R;
const B = L - R;
const K = C - R * Math.SQRT2;

// Inset octagon, counter-clockwise.
export const INSET = [
  [A, -(K - A)], [A, K - A], [K - B, B], [-(K - B), B],
  [-A, K - A], [-A, -(K - A)], [-(K - B), -B], [K - B, -B],
];

export const EDGES = INSET.map((p, i) => {
  const q = INSET[(i + 1) % INSET.length];
  const ex = q[0] - p[0], ey = q[1] - p[1];
  const len = Math.hypot(ex, ey);
  const nx = ey / len, ny = -ex / len;
  return { px: p[0], py: p[1], ex, ey, len, len2: ex * ex + ey * ey, nx, ny, off: nx * p[0] + ny * p[1] };
});

// Goal boxes reach a little into the arena so they cut the back-wall ramp.
export const GOAL_Y0 = L - R - 60;
export const GOAL_Y1 = L + GOAL.D;

function sdOct(x, y) {
  let maxD = -Infinity;
  for (let i = 0; i < 8; i++) {
    const e = EDGES[i];
    const d = e.nx * x + e.ny * y - e.off;
    if (d > maxD) maxD = d;
  }
  if (maxD <= 0) return maxD;
  let best = Infinity;
  for (let i = 0; i < 8; i++) {
    const e = EDGES[i];
    const wx = x - e.px, wy = y - e.py;
    let t = (wx * e.ex + wy * e.ey) / e.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = wx - e.ex * t, dy = wy - e.ey * t;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function arenaDist(x, y, z) {
  const a = sdOct(x, y);
  const b = Math.max(R - z, z - (H - R));
  const ox = a > 0 ? a : 0, oz = b > 0 ? b : 0;
  const sd = Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(a, b), 0);
  return R - sd;
}

// Goal interiors are boxes with rounded inside edges, so they can be driven on.
export const GOAL_ROUND = 60;
const GOAL_CY = (GOAL_Y0 + GOAL_Y1) / 2;
const GOAL_HY = (GOAL_Y1 - GOAL_Y0) / 2;
const GOAL_HZ = GOAL.H / 2;

function goalDist(x, y, z) {
  const r = GOAL_ROUND;
  const qx = Math.abs(x) - (GOAL.W - r);
  const qy = Math.abs(Math.abs(y) - GOAL_CY) - (GOAL_HY - r);
  const qz = Math.abs(z - GOAL_HZ) - (GOAL_HZ - r);
  const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0;
  return r - (Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0));
}

export function dist(x, y, z) {
  const d = arenaDist(x, y, z);
  if (Math.abs(y) > GOAL_Y0 - 400) {
    const g = goalDist(x, y, z);
    return g > d ? g : d;
  }
  return d;
}

const EPS = 1.5;
// Writes the unit surface normal (pointing into the playable space) to out.
export function normal(x, y, z, out) {
  const nx = dist(x + EPS, y, z) - dist(x - EPS, y, z);
  const ny = dist(x, y + EPS, z) - dist(x, y - EPS, z);
  const nz = dist(x, y, z + EPS) - dist(x, y, z - EPS);
  const len = Math.hypot(nx, ny, nz) || 1;
  out.x = nx / len; out.y = ny / len; out.z = nz / len;
  return out;
}

// Height of the floor directly below a point, if it is the flat floor.
export function onFlatFloor(x, y) {
  return sdOct(x, y) <= 0 || (Math.abs(x) < GOAL.W && Math.abs(y) < GOAL_Y1);
}
