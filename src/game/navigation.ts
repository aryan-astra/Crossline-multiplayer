import type { Entity, MapDef } from "./types";
import { collideBuildings, isWalkable } from "./maps";

const CELL = 40;
type Point = { x: number; y: number };
const grids = new WeakMap<
  MapDef,
  { cols: number; rows: number; open: Uint8Array; edges: number[][] }
>();

const distance2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function pointSegment(p: Point, u: Point, v: Point): Point {
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
}

const orientation = (p: Point, q: Point, r: Point) =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const onSegment = (p: Point, q: Point, r: Point) =>
  r.x >= Math.min(p.x, q.x) - 1e-8 &&
  r.x <= Math.max(p.x, q.x) + 1e-8 &&
  r.y >= Math.min(p.y, q.y) - 1e-8 &&
  r.y <= Math.max(p.y, q.y) + 1e-8;

function segmentDistance2(u: Point, v: Point, p: Point, q: Point) {
  const a1 = orientation(u, v, p),
    a2 = orientation(u, v, q);
  const b1 = orientation(p, q, u),
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
    distance2(u, pointSegment(u, p, q)),
    distance2(v, pointSegment(v, p, q)),
    distance2(p, pointSegment(p, u, v)),
    distance2(q, pointSegment(q, u, v)),
  );
}

function clear(
  map: MapDef,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  if (!isWalkable(map, a.x, a.y, 9) || !isWalkable(map, b.x, b.y, 9))
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

/** Build the static walk graph before the first simulation tick. */
export function prewarmNavigation(map: MapDef): void {
  if (grids.has(map)) return;
  const cols = Math.ceil(map.w / CELL),
    rows = Math.ceil(map.h / CELL);
  const open = new Uint8Array(cols * rows);
  const center = (i: number) => ({
    x: ((i % cols) + 0.5) * CELL,
    y: (Math.floor(i / cols) + 0.5) * CELL,
  });
  for (let i = 0; i < open.length; i++) {
    const { x, y } = center(i);
    open[i] = Number(
      x < map.w - 10 && y < map.h - 10 && isWalkable(map, x, y, 9),
    );
  }
  const edges: number[][] = Array.from({ length: open.length }, () => []);
  for (let i = 0; i < open.length; i++) {
    if (!open[i]) continue;
    const neighbors = [i + cols];
    if (i % cols < cols - 1) neighbors.push(i + 1);
    for (const j of neighbors)
      if (j < open.length && open[j] && clear(map, center(i), center(j))) {
        edges[i].push(j);
        edges[j].push(i);
      }
  }
  grids.set(map, { cols, rows, open, edges });
}

export function nextWaypoint(
  map: MapDef,
  e: Entity,
  x: number,
  y: number,
): { x: number; y: number } {
  if (!isWalkable(map, e.x, e.y, 9)) {
    Object.assign(e, collideBuildings(map, e.x, e.y, 9));
    e.path = undefined;
  }
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
    prewarmNavigation(map);
    const grid = grids.get(map)!;
    const { cols, open, edges } = grid;
    const center = (i: number) => ({
      x: ((i % cols) + 0.5) * CELL,
      y: (Math.floor(i / cols) + 0.5) * CELL,
    });
    // Test nearby cells first; scanning from the map corner repeats long polygon sweeps.
    const candidates: { index: number; point: Point; distance: number }[] = [];
    for (let i = 0; i < open.length; i++)
      if (open[i]) {
        const point = center(i);
        candidates.push({ index: i, point, distance: distance2(point, e) });
      }
    candidates.sort((a, b) => a.distance - b.distance);
    const start =
      candidates
        .slice(0, 32)
        .find((candidate) => clear(map, e, candidate.point))?.index ?? -1;
    if (start < 0) {
      // A coarse graph can miss narrow passages; take a clear local step and retry after movement.
      let best: Point = { x: e.x, y: e.y };
      let nearest = Infinity;
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8;
        const point = {
          x: e.x + Math.cos(angle) * CELL,
          y: e.y + Math.sin(angle) * CELL,
        };
        const distance = distance2(point, target);
        if (distance < nearest && clear(map, e, point)) {
          best = point;
          nearest = distance;
        }
      }
      return best;
    }
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
