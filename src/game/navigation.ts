import type { Entity, MapDef } from "./types";
import { collideBuildings } from "./maps";

const CELL = 40;
const grids = new WeakMap<
  MapDef,
  { cols: number; rows: number; open: Uint8Array; edges: number[][] }
>();

function clear(
  map: MapDef,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const d2 = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const pointSegment = (
    p: { x: number; y: number },
    u: { x: number; y: number },
    v: { x: number; y: number },
  ) => {
    const dx = v.x - u.x,
      dy = v.y - u.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    return { x: u.x + dx * t, y: u.y + dy * t };
  };
  const orientation = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) =>
    r.x >= Math.min(p.x, q.x) - 1e-8 &&
    r.x <= Math.max(p.x, q.x) + 1e-8 &&
    r.y >= Math.min(p.y, q.y) - 1e-8 &&
    r.y <= Math.max(p.y, q.y) + 1e-8;
  const segmentDistance2 = (
    u: { x: number; y: number },
    v: { x: number; y: number },
    p: { x: number; y: number },
    q: { x: number; y: number },
  ) => {
    const a1 = orientation(u, v, p),
      a2 = orientation(u, v, q),
      b1 = orientation(p, q, u),
      b2 = orientation(p, q, v);
    if (
      (((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) &&
        ((b1 > 0 && b2 < 0) || (b1 < 0 && b2 > 0))) ||
      (Math.abs(a1) < 1e-8 && onSegment(u, v, p)) ||
      (Math.abs(a2) < 1e-8 && onSegment(u, v, q)) ||
      (Math.abs(b1) < 1e-8 && onSegment(p, q, u)) ||
      (Math.abs(b2) < 1e-8 && onSegment(p, q, v))
    )
      return 0;
    return Math.min(
      d2(u, pointSegment(u, p, q)),
      d2(v, pointSegment(v, p, q)),
      d2(p, pointSegment(p, u, v)),
      d2(q, pointSegment(q, u, v)),
    );
  };
  if (
    d2(a, collideBuildings(map, a.x, a.y, 9)) > 1e-4 ||
    d2(b, collideBuildings(map, b.x, b.y, 9)) > 1e-4
  )
    return false;
  for (const block of map.buildings) {
    if (
      Math.max(a.x, b.x) < block.x - 9 ||
      Math.min(a.x, b.x) > block.x + block.w + 9 ||
      Math.max(a.y, b.y) < block.y - 9 ||
      Math.min(a.y, b.y) > block.y + block.h + 9
    )
      continue;
    const ring = block.footprint ?? [
      { x: block.x, y: block.y },
      { x: block.x + block.w, y: block.y },
      { x: block.x + block.w, y: block.y + block.h },
      { x: block.x, y: block.y + block.h },
    ];
    for (let i = 0; i < ring.length; i++)
      if (
        segmentDistance2(a, b, ring[i], ring[(i + 1) % ring.length]) <
        81 - 1e-6
      )
        return false;
  }
  return true;
}

export function nextWaypoint(
  map: MapDef,
  e: Entity,
  x: number,
  y: number,
): { x: number; y: number } {
  const target = collideBuildings(map, x, y, 9);
  if (clear(map, e, target)) {
    e.path = undefined;
    return target;
  }
  if (
    !e.path ||
    !e.pathTarget ||
    Math.hypot(e.pathTarget.x - x, e.pathTarget.y - y) > CELL / 2
  ) {
    let grid = grids.get(map);
    if (!grid) {
      const cols = Math.ceil(map.w / CELL),
        rows = Math.ceil(map.h / CELL);
      const open = new Uint8Array(cols * rows);
      for (let i = 0; i < open.length; i++) {
        const cx = ((i % cols) + 0.5) * CELL,
          cy = (Math.floor(i / cols) + 0.5) * CELL;
        const point = collideBuildings(map, cx, cy, 9);
        open[i] = Number(
          cx < map.w - 10 &&
            cy < map.h - 10 &&
            Math.hypot(point.x - cx, point.y - cy) < 0.001,
        );
      }
      const edges: number[][] = Array.from({ length: open.length }, () => []);
      const center = (i: number) => ({
        x: ((i % cols) + 0.5) * CELL,
        y: (Math.floor(i / cols) + 0.5) * CELL,
      });
      // Geometry stays solid after damage, so sweep each static grid edge once.
      for (let i = 0; i < open.length; i++) {
        if (!open[i]) continue;
        const neighbors = [i + cols];
        if (i % cols < cols - 1) neighbors.push(i + 1);
        for (const j of neighbors) {
          if (j >= open.length || !open[j] || !clear(map, center(i), center(j)))
            continue;
          edges[i].push(j);
          edges[j].push(i);
        }
      }
      grid = { cols, rows, open, edges };
      grids.set(map, grid);
    }
    const { cols, open, edges } = grid;
    const center = (i: number) => ({
      x: ((i % cols) + 0.5) * CELL,
      y: (Math.floor(i / cols) + 0.5) * CELL,
    });
    const candidates: number[] = [];
    for (let i = 0; i < open.length; i++) if (open[i]) candidates.push(i);
    const distance2 = (i: number) => {
      const dx = ((i % cols) + 0.5) * CELL - e.x;
      const dy = (Math.floor(i / cols) + 0.5) * CELL - e.y;
      return dx * dx + dy * dy;
    };
    candidates.sort((a, b) => distance2(a) - distance2(b));
    const start = candidates.find((i) => clear(map, e, center(i))) ?? -1;
    if (start < 0) return { x: e.x, y: e.y };
    const parents = new Int32Array(open.length).fill(-1);
    const queue = [start];
    parents[start] = start;
    let end = start,
      closest = Infinity;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head],
        p = center(i),
        d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < closest) {
        closest = d;
        end = i;
      }
      if (d <= CELL && clear(map, p, target)) {
        end = i;
        break;
      }
      for (const j of edges[i])
        if (parents[j] === -1) {
          parents[j] = i;
          queue.push(j);
        }
    }
    const path = [center(end)];
    for (let i = end; i !== start; ) {
      i = parents[i];
      path.push(center(i));
    }
    e.path = path.reverse();
    if (clear(map, center(end), target)) e.path.push(target);
    e.pathTarget = { x, y };
  }
  while (
    e.path.length > 1 &&
    Math.hypot(e.path[0].x - e.x, e.path[0].y - e.y) < 6
  )
    e.path.shift();
  return e.path[0] ?? target;
}

export const hasLineOfSight = clear;
