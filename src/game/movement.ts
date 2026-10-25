import type { Entity, InputState, MapDef } from "./types";
import { collideBuildings } from "./maps";

export function moveCharacter(
  map: MapDef,
  entity: Entity,
  input: InputState,
  dt: number,
  persistent = false,
) {
  let dx = Number(input.right) - Number(input.left);
  let dy = Number(input.down) - Number(input.up);
  if (!dx && !dy)
    return {
      x: entity.x,
      y: entity.y,
      dir: entity.dir,
      moving: false,
      running: false,
    };
  const length = Math.hypot(dx, dy);
  dx /= length;
  dy /= length;
  const speed =
    entity.speed *
    (input.sprint ? 1.5 : 1) *
    (persistent && Math.min(entity.hunger, entity.thirst) < 30 ? 0.8 : 1);
  const x = entity.x + dx * speed * Math.min(dt, 0.05);
  const y = entity.y + dy * speed * Math.min(dt, 0.05);
  const interior = entity.buildingId
    ? map.buildings.find((b) => b.id === entity.buildingId)?.interior
    : undefined;
  if (entity.buildingId && !interior)
    return {
      x: entity.x,
      y: entity.y,
      dir: Math.atan2(dy, dx),
      moving: false,
      running: false,
    };
  const collisionMap = interior
    ? {
        ...map,
        w: interior.w,
        h: interior.h,
        buildings: interior.obstacles.map((r) => ({
          ...r,
          kind: "block" as const,
          hp: 1,
          maxHp: 1,
        })),
      }
    : map;
  const position = collideBuildings(collisionMap, x, y, 9);
  const dir = Math.atan2(dy, dx);
  return {
    ...position,
    dir,
    moving: Math.hypot(position.x - entity.x, position.y - entity.y) > 0.01,
    running:
      input.sprint &&
      Math.hypot(position.x - entity.x, position.y - entity.y) > 0.01,
  };
}
