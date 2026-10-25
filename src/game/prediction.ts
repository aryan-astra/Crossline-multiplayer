import { moveCharacter } from "./movement";
import type { Entity, InputState, MapDef } from "./types";

/** Visual-only, bounded prediction; snapshots still own position and every outcome. */
export function predictCharacter(
  map: MapDef,
  entity: Entity,
  input: InputState,
  seconds: number,
): Entity {
  if (
    entity.remove ||
    entity.stun > 0 ||
    ["down", "detained", "detain"].includes(entity.state) ||
    !Number.isFinite(seconds)
  )
    return entity;
  const predicted = { ...entity };
  for (
    let remaining = Math.max(0, Math.min(0.15, seconds));
    remaining > 1e-8;
    remaining -= 0.05
  )
    Object.assign(
      predicted,
      moveCharacter(map, predicted, input, Math.min(0.05, remaining), true),
    );
  return predicted;
}
