// Shared, data-only arena geometry. X/Z are ground-plane coordinates; Y is up.
export const ARENA = { size: 60, half: 30, baseRadius: 5, poisonRadius: 4 };
const halfObstacles = [
  { x: -10, z: 4, w: 3.6, d: 3.6, h: 3.3, kind: 'crate' },
  { x: -13, z: 3, w: 2.4, d: 2.4, h: 2.1, kind: 'crate' },
  { x: -7, z: 16, w: 9, d: 1.5, h: 3.2, kind: 'wall' },
  { x: -18, z: -8, w: 1.5, d: 8, h: 3.2, kind: 'wall' },
  { x: -6, z: -13, w: 4, d: 2, h: 1.1, kind: 'cover' },
  { x: -23, z: 5, w: 3.2, d: 3.2, h: 2.6, kind: 'crate' },
  { x: -3, z: 25, w: 3.5, d: 2, h: 1.2, kind: 'cover' },
];
export const OBSTACLES = halfObstacles.flatMap((o, i) => [
  { ...o, id: i * 2 }, { ...o, x: -o.x, z: -o.z, id: i * 2 + 1 },
]);
export const BASES = [
  { id: 0, x: -22, z: 22, color: '#edb82f', name: 'HOME' },
  { id: 1, x: 22, z: -22, color: '#ef785c', name: 'RIVAL' },
];
export const PICKUP_SPAWNS = [{ x: -20, z: -20 }, { x: 0, z: 0 }, { x: 20, z: 20 }];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function isFree(x, z, radius = 0.5) {
  if (Math.abs(x) > ARENA.half - radius || Math.abs(z) > ARENA.half - radius) return false;
  return !OBSTACLES.some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}

// A vertical capsule against upright boxes reduces to circle/AABB on the ground.
// Substeps avoid tunneling; iterative projection gives smooth sliding at corners.
export function moveBody(body, dx, dz, radius) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.7)));
  for (let step = 0; step < steps; step++) {
    body.x = clamp(body.x + dx / steps, -30 + radius, 30 - radius);
    body.z = clamp(body.z + dz / steps, -30 + radius, 30 - radius);
    for (let pass = 0; pass < 3; pass++) for (const o of OBSTACLES) {
      const left = o.x - o.w / 2, right = o.x + o.w / 2;
      const back = o.z - o.d / 2, front = o.z + o.d / 2;
      const px = clamp(body.x, left, right), pz = clamp(body.z, back, front);
      const vx = body.x - px, vz = body.z - pz, d = Math.hypot(vx, vz);
      if (d >= radius) continue;
      if (d > 0.00001) {
        body.x = px + vx / d * radius; body.z = pz + vz / d * radius;
      } else {
        const sides = [
          { d: body.x - left, x: left - radius, z: body.z },
          { d: right - body.x, x: right + radius, z: body.z },
          { d: body.z - back, x: body.x, z: back - radius },
          { d: front - body.z, x: body.x, z: front + radius },
        ].sort((a, b) => a.d - b.d);
        body.x = sides[0].x; body.z = sides[0].z;
      }
    }
  }
}

export function clearPath(a, b, radius = 0.6) {
  const steps = Math.ceil(distance(a, b) / 0.4);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radius)) return false;
  }
  return true;
}

// Small shared navigation grid. No scene, browser, or mutable game data here.
const CELL = 2, N = 30;
const point = id => ({ x: (id % N) * CELL - 29, z: Math.floor(id / N) * CELL - 29 });
const walkable = Array.from({ length: N * N }, (_, i) => { const p = point(i); return isFree(p.x, p.z, 0.65); });
function closestCell(p) {
  let best = -1, min = Infinity;
  for (let i = 0; i < walkable.length; i++) if (walkable[i]) {
    const d = distance(p, point(i));
    if (d < min) { min = d; best = i; }
  }
  return best;
}
export function findPath(from, to, radius = 0.6) {
  if (clearPath(from, to, radius)) return [{ x: to.x, z: to.z }];
  const start = closestCell(from), end = closestCell(to);
  if (start < 0 || end < 0) return [];
  const open = new Set([start]), closed = new Set();
  const cost = new Map([[start, 0]]), parent = new Map();
  while (open.size) {
    let current = -1, best = Infinity;
    for (const id of open) {
      const score = cost.get(id) + distance(point(id), point(end));
      if (score < best) { best = score; current = id; }
    }
    if (current === end) {
      const path = [point(end)];
      while (current !== start) { current = parent.get(current); path.unshift(point(current)); }
      if (isFree(to.x, to.z, radius)) path.push({ x: to.x, z: to.z });
      const smooth = [];
      let anchor = from, index = 0;
      while (index < path.length) {
        let far = index;
        for (let j = index + 1; j < path.length; j++) {
          if (clearPath(anchor, path[j], radius)) far = j; else break;
        }
        smooth.push(path[far]); anchor = path[far]; index = far + 1;
      }
      return smooth;
    }
    open.delete(current); closed.add(current);
    const x = current % N, z = Math.floor(current / N);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const nx = x + dx, nz = z + dz, next = nz * N + nx;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N || !walkable[next] || closed.has(next)) continue;
      if (dx && dz && (!walkable[z * N + nx] || !walkable[nz * N + x])) continue;
      const g = cost.get(current) + Math.hypot(dx, dz) * CELL;
      if (g < (cost.get(next) ?? Infinity)) { parent.set(next, current); cost.set(next, g); open.add(next); }
    }
  }
  return [];
}
