import type { Role } from "./types";

type Position = { x: number; y: number };
type Size = { w: number; h: number };

export function cameraZoom(role: Role): number {
  return { protester: 1.15, police: 0.95, military: 0.72, watcher: 0.85 }[role];
}

export function clampZoom(role: Role, requested: number): number {
  if (role !== "watcher" || !Number.isFinite(requested))
    return cameraZoom(role);
  return Math.max(0.45, Math.min(2, requested));
}

export function trackCamera(
  current: Position,
  target: Position,
  dt: number,
): Position {
  const blend = Number.isFinite(dt) ? 1 - Math.exp(-8 * Math.max(0, dt)) : 0;
  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
  };
}

export function constrainCamera(
  camera: Position,
  viewport: Size,
  world: Size,
  zoom: number,
): Position {
  const halfW = viewport.w / (2 * zoom),
    halfH = viewport.h / (2 * zoom);
  return {
    x:
      halfW * 2 >= world.w
        ? world.w / 2
        : Math.max(halfW, Math.min(world.w - halfW, camera.x)),
    y:
      halfH * 2 >= world.h
        ? world.h / 2
        : Math.max(halfH, Math.min(world.h - halfH, camera.y)),
  };
}
