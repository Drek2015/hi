// Course geometry, ball physics, distance-to-cup field and bot shot planning.
// Units are metres; one grid cell is 1 m. x grows to the right, y grows toward the far end.

export const PHYS = {
  STEP: 0.32,          // height of one level
  R: 0.13,             // ball radius
  CUP_R: 0.21,
  SINK_SPEED: 2.7,
  G_ROLL: 9.81 * 5 / 7,
  DECEL: 0.85,         // rolling resistance (m/s^2)
  DRAG: 0.32,          // speed-proportional drag (1/s)
  STOP: 0.05,
  MAX_SHOT: 9.5,
  WALL_E: 0.72,
  DT: 1 / 120,
};

const RAMP_DIR = { '^': [0, 1], 'v': [0, -1], '>': [1, 0], '<': [-1, 0] };
const ZONES = {
  ice: { decel: 0.12, drag: 0.04 },
  web: { decel: 3.2, drag: 1.6 },
  sand: { decel: 3.2, drag: 1.6 },
};

export class Course {
  constructor(def) {
    this.def = def;
    const grid = def.grid;
    this.rows = grid.length;
    this.cols = Math.max(...grid.map(r => r.length));
    this.cells = [];
    for (let row = 0; row < this.rows; row++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = grid[row][c] ?? '.';
        if (ch === '.' || ch === ' ') { this.cells.push(null); continue; }
        const lvCh = def.levels?.[row]?.[c];
        const level = lvCh && /\d/.test(lvCh) ? +lvCh : 0;
        const cell = { c, row, level, ramp: RAMP_DIR[ch] || null, ch };
        this.cells.push(cell);
        const cx = c + 0.5, cy = this.rows - row - 0.5;
        if (ch === 'S') this.start = { x: cx, y: cy };
        if (ch === 'H') this.cup = { x: cx, y: cy };
      }
    }
    this.buildWalls();
    this.obstacles = (def.obstacles || []).map(o => this.convertObstacle(o));
    this.zones = this.obstacles.filter(o => o.type === 'zone');
    this.dynamic = this.obstacles.filter(o => o.type !== 'zone');
  }

  Y(r) { return this.rows - r; }

  cell(c, row) {
    if (c < 0 || row < 0 || c >= this.cols || row >= this.rows) return null;
    return this.cells[row * this.cols + c];
  }

  cellAt(x, y) { return this.cell(Math.floor(x), Math.floor(this.rows - y)); }

  cellHeight(cell, x, y) {
    const S = PHYS.STEP;
    if (!cell.ramp) return cell.level * S;
    const x0 = cell.c, y0 = this.rows - cell.row - 1;
    const lx = Math.min(1, Math.max(0, x - x0)), ly = Math.min(1, Math.max(0, y - y0));
    const [dx, dy] = cell.ramp;
    const t = dx > 0 ? lx : dx < 0 ? 1 - lx : dy > 0 ? ly : 1 - ly;
    return (cell.level + t) * S;
  }

  height(x, y) {
    const cell = this.cellAt(x, y);
    return cell ? this.cellHeight(cell, x, y) : -1;
  }

  // Height gradient (rise per metre) at a point.
  slope(x, y) {
    const cell = this.cellAt(x, y);
    if (!cell || !cell.ramp) return [0, 0];
    return [cell.ramp[0] * PHYS.STEP, cell.ramp[1] * PHYS.STEP];
  }

  buildWalls() {
    const walls = [];
    const sides = [
      // [neighbour dc, drow, edge endpoints relative to the cell's lower-left corner]
      [0, -1, [0, 1], [1, 1]],   // far edge (y+1)
      [0, 1, [0, 0], [1, 0]],    // near edge
      [1, 0, [1, 0], [1, 1]],    // right edge
      [-1, 0, [0, 0], [0, 1]],   // left edge
    ];
    for (const cell of this.cells) {
      if (!cell) continue;
      const x0 = cell.c, y0 = this.rows - cell.row - 1;
      for (const [dc, dr, a, b] of sides) {
        const nb = this.cell(cell.c + dc, cell.row + dr);
        const ax = x0 + a[0], ay = y0 + a[1], bx = x0 + b[0], by = y0 + b[1];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const hA0 = this.cellHeight(cell, ax, ay), hA1 = this.cellHeight(cell, bx, by);
        let wall = false, hB0 = hA0, hB1 = hA1;
        if (!nb) wall = true;
        else {
          hB0 = this.cellHeight(nb, ax, ay); hB1 = this.cellHeight(nb, bx, by);
          const hmA = this.cellHeight(cell, mx, my), hmB = this.cellHeight(nb, mx, my);
          if (Math.abs(hmA - hmB) > 0.01 || Math.abs(hA0 - hB0) > 0.01) wall = true;
        }
        if (!wall) continue;
        // Inward normal points into this cell.
        const nx = -dc, ny = dr;
        // Each wall is shared by two cells when both exist; keep one copy.
        if (nb && (dc > 0 || dr > 0)) continue;
        walls.push({ ax, ay, bx, by, nx, ny, open: !nb, h0: Math.max(hA0, hB0), h1: Math.max(hA1, hB1), l0: Math.min(hA0, hB0), l1: Math.min(hA1, hB1) });
      }
    }
    this.walls = walls;
    // Spatial buckets: each cell lists the walls on or next to it.
    this.bucket = new Map();
    for (const w of walls) {
      const minC = Math.floor(Math.min(w.ax, w.bx)) - 1, maxC = Math.ceil(Math.max(w.ax, w.bx));
      const minY = Math.floor(Math.min(w.ay, w.by)) - 1, maxY = Math.ceil(Math.max(w.ay, w.by));
      for (let c = minC; c <= maxC; c++) for (let y = minY; y <= maxY; y++) {
        const k = c * 1000 + y;
        if (!this.bucket.has(k)) this.bucket.set(k, []);
        this.bucket.get(k).push(w);
      }
    }
  }

  wallsNear(x, y) { return this.bucket.get(Math.floor(x) * 1000 + Math.floor(y)) || []; }

  convertObstacle(o) {
    const Y = r => this.rows - r;
    switch (o.type) {
      case 'bumper': return { ...o, y: Y(o.r) };
      case 'spinner': return { ...o, y: Y(o.r), thick: 0.09 };
      case 'mover': return { ...o, y0: Y(o.r0), y1: Y(o.r1) };
      case 'block': return { ...o, y: Y(o.r) };
      case 'boost': return { ...o, y: Y(o.r), dx: Math.cos(o.angle * Math.PI / 180), dy: Math.sin(o.angle * Math.PI / 180), radius: 0.38 };
      case 'portal': return { ...o, y: Y(o.r), by: Y(o.br), ex: Math.cos(o.exit * Math.PI / 180), ey: Math.sin(o.exit * Math.PI / 180), radius: 0.3 };
      case 'zone': return { ...o, y0: Y(o.r1), y1: Y(o.r0), ...ZONES[o.kind] };
      default: return o;
    }
  }

  // Position and velocity of moving obstacles at time t.
  moverState(o, t) {
    const w = 2 * Math.PI / o.period;
    const s = 0.5 - 0.5 * Math.cos(w * t);
    const ds = 0.5 * w * Math.sin(w * t);
    return {
      x: o.x0 + (o.x1 - o.x0) * s, y: o.y0 + (o.y1 - o.y0) * s,
      vx: (o.x1 - o.x0) * ds, vy: (o.y1 - o.y0) * ds,
    };
  }

  spinnerAngle(o, t) { return o.speed * t; }
}

export function makeBall(course) {
  return { x: course.start.x, y: course.start.y, vx: 0, vy: 0, moving: false, sunk: false, portalCd: 0, sinkT: 0, lastX: course.start.x, lastY: course.start.y };
}

// Collide the ball with a segment moving at (svx, svy). Returns impact speed.
function hitSegment(b, ax, ay, bx, by, rad, svx, svy, e, minTwoSided) {
  const ex = bx - ax, ey = by - ay;
  const len2 = ex * ex + ey * ey;
  let t = ((b.x - ax) * ex + (b.y - ay) * ey) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, py = ay + ey * t;
  let dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const minD = PHYS.R + rad;
  if (d >= minD || d < 1e-9) return 0;
  dx /= d; dy /= d;
  b.x = px + dx * minD; b.y = py + dy * minD;
  const rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = rvx * dx + rvy * dy;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * dx;
  b.vy -= (1 + e) * vn * dy;
  // A little tangential friction against walls.
  const tx = -dy, ty = dx;
  const vt = (b.vx - svx) * tx + (b.vy - svy) * ty;
  b.vx -= vt * 0.06 * tx; b.vy -= vt * 0.06 * ty;
  return -vn;
}

// Advance one ball by one tick at time t. Returns an event string or null.
export function stepBall(course, b, t) {
  const P = PHYS, dt = P.DT;
  if (b.sunk) { b.sinkT += dt; return null; }
  if (!b.moving) return null;
  let event = null;

  let decel = P.DECEL, drag = P.DRAG;
  for (const z of course.zones) {
    if (b.x > z.x0 && b.x < z.x1 && b.y > z.y0 && b.y < z.y1) { decel = z.decel; drag = z.drag; }
  }
  const [gx, gy] = course.slope(b.x, b.y);
  b.vx -= P.G_ROLL * gx * dt;
  b.vy -= P.G_ROLL * gy * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const ns = Math.max(0, sp - (decel + drag * sp) * dt);
    b.vx *= ns / sp; b.vy *= ns / sp;
  }
  const px = b.x, py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt;

  // Walls
  let impact = 0;
  for (const w of course.wallsNear(b.x, b.y)) impact = Math.max(impact, hitSegment(b, w.ax, w.ay, w.bx, w.by, 0, 0, 0, P.WALL_E));

  // Obstacles
  for (const o of course.dynamic) {
    if (o.type === 'bumper') {
      const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), minD = P.R + o.radius;
      if (d < minD && d > 1e-9) {
        const nx = dx / d, ny = dy / d;
        b.x = o.x + nx * minD; b.y = o.y + ny * minD;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; b.vx += nx * 1.4; b.vy += ny * 1.4; event = 'bumper'; }
      }
    } else if (o.type === 'spinner') {
      const a = course.spinnerAngle(o, t), h = o.len / 2;
      const cx = Math.cos(a) * h, cy = Math.sin(a) * h;
      // Velocity of the bar at the ball's projection.
      const rx = b.x - o.x, ry = b.y - o.y;
      const along = Math.max(-h, Math.min(h, rx * Math.cos(a) + ry * Math.sin(a)));
      const svx = -o.speed * Math.sin(a) * along, svy = o.speed * Math.cos(a) * along;
      const hit = hitSegment(b, o.x - cx, o.y - cy, o.x + cx, o.y + cy, o.thick, svx, svy, 0.8);
      if (hit > 0.3) event = 'spinner';
      impact = Math.max(impact, hit);
    } else if (o.type === 'mover' || o.type === 'block') {
      const s = o.type === 'mover' ? course.moverState(o, t) : { x: o.x, y: o.y, vx: 0, vy: 0 };
      const x0 = s.x - o.w, x1 = s.x + o.w, y0 = s.y - o.h, y1 = s.y + o.h;
      for (const [ax, ay, bx, by] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) {
        impact = Math.max(impact, hitSegment(b, ax, ay, bx, by, 0, s.vx, s.vy, 0.75));
      }
    } else if (o.type === 'boost') {
      if (Math.hypot(b.x - o.x, b.y - o.y) < o.radius) {
        const along = b.vx * o.dx + b.vy * o.dy;
        if (along < o.power) {
          const k = Math.min(1, 12 * dt);
          b.vx += o.dx * (o.power - along) * k; b.vy += o.dy * (o.power - along) * k;
          if (event === null) event = 'boost';
        }
      }
    } else if (o.type === 'portal') {
      if (b.portalCd > 0) b.portalCd -= dt;
      else if (Math.hypot(b.x - o.x, b.y - o.y) < o.radius) {
        const s2 = Math.max(2.2, Math.hypot(b.vx, b.vy) * 0.9);
        b.x = o.bx + o.ex * 0.35; b.y = o.by + o.ey * 0.35;
        b.vx = o.ex * s2; b.vy = o.ey * s2;
        b.portalCd = 0.5;
        event = 'portal';
      }
    }
  }
  if (impact > 0.4 && !event) event = 'wall';

  // Safety: never leave the course.
  if (!course.cellAt(b.x, b.y)) { b.x = px; b.y = py; b.vx *= -0.5; b.vy *= -0.5; }

  // Cup
  const cup = course.cup;
  const dx = cup.x - b.x, dy = cup.y - b.y, dc = Math.hypot(dx, dy);
  const speed = Math.hypot(b.vx, b.vy);
  if (dc < P.CUP_R) {
    if (speed < P.SINK_SPEED) {
      b.sunk = true; b.moving = false; b.vx = b.vy = 0;
      return 'sunk';
    }
    // Lip: the cup tugs the ball toward its centre.
    b.vx += dx / (dc + 1e-6) * 14 * dt; b.vy += dy / (dc + 1e-6) * 14 * dt;
  }

  const [sx, sy] = course.slope(b.x, b.y);
  if (Math.hypot(b.vx, b.vy) < P.STOP && sx === 0 && sy === 0) {
    b.vx = b.vy = 0;
    b.moving = false;
    event = event || 'stop';
  }
  return event;
}

export function shoot(b, angle, power) {
  const s = Math.max(0, Math.min(1, power)) * PHYS.MAX_SHOT;
  b.vx = Math.cos(angle) * s;
  b.vy = Math.sin(angle) * s;
  b.moving = true;
  b.lastX = b.x; b.lastY = b.y;
}

// Shortest walking distance from every point to the cup (0.25 m grid), aware of walls and portals.
export class DistanceField {
  constructor(course) {
    const res = 0.25;
    this.res = res;
    this.course = course;
    this.nx = Math.ceil(course.cols / res);
    this.ny = Math.ceil(course.rows / res);
    const N = this.nx * this.ny;
    this.d = new Float64Array(N).fill(Infinity);
    const valid = new Uint8Array(N);
    const pos = i => [(i % this.nx + 0.5) * res, (Math.floor(i / this.nx) + 0.5) * res];
    for (let i = 0; i < N; i++) {
      const [x, y] = pos(i);
      if (!course.cellAt(x, y)) continue;
      let ok = true;
      for (const o of course.dynamic) {
        if (o.type === 'bumper' && Math.hypot(x - o.x, y - o.y) < o.radius + 0.05) ok = false;
        if (o.type === 'block' && Math.abs(x - o.x) < o.w && Math.abs(y - o.y) < o.h) ok = false;
      }
      valid[i] = ok ? 1 : 0;
    }
    const crosses = (x0, y0, x1, y1) => {
      for (const w of course.wallsNear((x0 + x1) / 2, (y0 + y1) / 2)) {
        if (segX(x0, y0, x1, y1, w.ax, w.ay, w.bx, w.by)) return true;
      }
      return false;
    };
    // Dijkstra with a binary heap.
    const heap = new Heap();
    const cupI = this.index(course.cup.x, course.cup.y);
    this.d[cupI] = 0;
    heap.push(cupI, 0);
    const portals = course.dynamic.filter(o => o.type === 'portal');
    const portalDone = new Set();
    const nbs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.size) {
      const [i, di] = heap.pop();
      if (di > this.d[i]) continue;
      const [x, y] = pos(i);
      for (const p of portals) {
        if (!portalDone.has(p) && Math.hypot(x - p.bx, y - p.by) < 0.5) {
          portalDone.add(p);
          for (let j = 0; j < N; j++) {
            if (!valid[j]) continue;
            const [xj, yj] = pos(j);
            if (Math.hypot(xj - p.x, yj - p.y) < p.radius && di + 0.5 < this.d[j]) { this.d[j] = di + 0.5; heap.push(j, di + 0.5); }
          }
        }
      }
      const ix = i % this.nx, iy = Math.floor(i / this.nx);
      for (const [ox, oy, cost] of nbs) {
        const jx = ix + ox, jy = iy + oy;
        if (jx < 0 || jy < 0 || jx >= this.nx || jy >= this.ny) continue;
        const j = jy * this.nx + jx;
        if (!valid[j]) continue;
        const [x2, y2] = pos(j);
        let c = cost * res;
        const cell = course.cellAt(x2, y2);
        if (cell?.ramp) c *= 1.4;
        const nd = di + c;
        if (nd >= this.d[j]) continue;
        if (crosses(x, y, x2, y2)) continue;
        this.d[j] = nd;
        heap.push(j, nd);
      }
    }
  }

  index(x, y) {
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor(x / this.res)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor(y / this.res)));
    return iy * this.nx + ix;
  }

  at(x, y) {
    const v = this.d[this.index(x, y)];
    if (Number.isFinite(v)) return v;
    // Fall back to the best neighbour (points hugging a wall).
    let best = Infinity;
    for (const [ox, oy] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25]]) {
      best = Math.min(best, this.d[this.index(x + ox, y + oy)] + 0.3);
    }
    return best;
  }

  // Direction of steepest descent toward the cup (for the initial aim).
  bestDirection(x, y) {
    let best = null, bv = this.at(x, y);
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2;
      const v = this.at(x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.5);
      if (v < bv) { bv = v; best = a; }
    }
    return best ?? Math.atan2(this.course.cup.y - y, this.course.cup.x - x);
  }
}

function segX(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= -1e-6 && v <= 1 + 1e-6;
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(k, v) {
    const K = this.k, V = this.v;
    K.push(k); V.push(v);
    let i = K.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (V[p] <= V[i]) break;
      [K[p], K[i]] = [K[i], K[p]]; [V[p], V[i]] = [V[i], V[p]];
      i = p;
    }
  }
  pop() {
    const K = this.k, V = this.v;
    const top = [K[0], V[0]];
    const lk = K.pop(), lv = V.pop();
    if (K.length) {
      K[0] = lk; V[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < K.length && V[l] < V[m]) m = l;
        if (r < K.length && V[r] < V[m]) m = r;
        if (m === i) break;
        [K[m], K[i]] = [K[i], K[m]]; [V[m], V[i]] = [V[i], V[m]];
        i = m;
      }
    }
    return top;
  }
}

// Simulate a shot to rest. Returns the final ball and whether it sank.
export function simulateShot(course, from, t0, angle, power, maxTime = 8, path = null) {
  const b = { ...from, moving: false, sunk: false, portalCd: 0 };
  shoot(b, angle, power);
  let t = t0;
  const steps = Math.ceil(maxTime / PHYS.DT);
  for (let i = 0; i < steps && b.moving; i++) {
    stepBall(course, b, t);
    t += PHYS.DT;
    if (path && i % 3 === 0) path.push(b.x, b.y);
  }
  return { ball: b, time: t - t0 };
}

// Bot shot search, run incrementally (a generator) so it can be spread across frames.
export function* planShot(course, field, from, t0, skill = 0.7) {
  const evalShot = (a, p) => {
    const { ball, time } = simulateShot(course, from, t0, a, p, 7);
    if (ball.sunk) return -10 + time * 0.05;
    return field.at(ball.x, ball.y) + (ball.moving ? 2 : 0);
  };
  let best = { a: field.bestDirection(from.x, from.y), p: 0.5, s: Infinity };
  const powers = [0.22, 0.34, 0.46, 0.6, 0.75, 0.9, 1.0];
  const ANG = 64;
  let n = 0;
  for (let k = 0; k < ANG; k++) {
    const a = k / ANG * Math.PI * 2;
    for (const p of powers) {
      const s = evalShot(a, p);
      if (s < best.s) best = { a, p, s };
      if (++n % 24 === 0) yield null;
    }
  }
  // Refine around the best shot.
  const base = best;
  for (let da = -6; da <= 6; da++) {
    for (const dp of [-0.08, -0.04, 0, 0.04, 0.08]) {
      const a = base.a + da * 0.018, p = Math.max(0.08, Math.min(1, base.p + dp));
      const s = evalShot(a, p);
      if (s < best.s) best = { a, p, s };
      if (++n % 24 === 0) yield null;
    }
  }
  // Human-like error.
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const noise = 1 - skill;
  return { angle: best.a + g() * (0.02 + 0.2 * noise), power: Math.max(0.05, Math.min(1, best.p * (1 + g() * (0.03 + 0.3 * noise)))) };
}
