import type { Entity, MapDef } from "./types";
import { collideBuildings } from "./maps";

const CELL = 40;
const grids = new WeakMap<
  MapDef,
  { cols: number; rows: number; open: Uint8Array }
>();

function clear(
  map: MapDef,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const minX = Math.min(a.x, b.x),
    maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y),
    maxY = Math.max(a.y, b.y);
  for (const block of map.buildings) {
    if (
      maxX < block.x - 9 ||
      minX > block.x + block.w + 9 ||
      maxY < block.y - 9 ||
      minY > block.y + block.h + 9
    )
      continue;
    // Swept circle: two side rectangles plus four rounded corners.
    for (const box of [
      { x: block.x - 9, y: block.y, w: block.w + 18, h: block.h },
      { x: block.x, y: block.y - 9, w: block.w, h: block.h + 18 },
    ]) {
      let low = 0,
        high = 1;
      for (const axis of ["x", "y"] as const) {
        const min = box[axis],
          max = min + (axis === "x" ? box.w : box.h);
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-8) {
          if (a[axis] <= min || a[axis] >= max) {
            low = 2;
            break;
          }
        } else {
          const t1 = (min - a[axis]) / delta,
            t2 = (max - a[axis]) / delta;
          low = Math.max(low, Math.min(t1, t2));
          high = Math.min(high, Math.max(t1, t2));
        }
      }
      if (low < high - 1e-8 && high > 0 && low < 1) return false;
    }
    for (const x of [block.x, block.x + block.w])
      for (const y of [block.y, block.y + block.h]) {
        const t =
          length2 === 0
            ? 0
            : Math.max(
                0,
                Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2),
              );
        if ((a.x + dx * t - x) ** 2 + (a.y + dy * t - y) ** 2 < 81 - 1e-6)
          return false;
      }
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
      grid = { cols, rows, open };
      grids.set(map, grid);
    }
    const { cols, open } = grid;
    const center = (i: number) => ({
      x: ((i % cols) + 0.5) * CELL,
      y: (Math.floor(i / cols) + 0.5) * CELL,
    });
    const candidates: number[] = [];
    for (let i = 0; i < open.length; i++) if (open[i]) candidates.push(i);
    const distance2 = (i: number) => {
      const p = center(i);
      return (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
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
      const neighbors = [i - cols, i + cols];
      if (i % cols > 0) neighbors.push(i - 1);
      if (i % cols < cols - 1) neighbors.push(i + 1);
      for (const j of neighbors)
        if (
          j >= 0 &&
          j < open.length &&
          open[j] &&
          parents[j] === -1 &&
          clear(map, p, center(j))
        ) {
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
