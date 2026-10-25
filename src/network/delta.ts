import type { Entity, WorldEvent } from "../game/types";
import type { Snapshot, SnapshotDelta, WireSnapshot } from "./protocol";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function compactSnapshot(snapshot: Snapshot): WireSnapshot {
  const { map, ...world } = snapshot.world;
  const entities = world.entities.map((entity) => {
    const { path: _path, pathTarget: _pathTarget, ...visible } = entity;
    return visible;
  });
  return clone({
    ...snapshot,
    world: { ...world, entities },
    mapId: map.id,
    buildingStates: map.buildings.map(
      (building) => [building.hp, !!building.broken] as [number, boolean],
    ),
  });
}

export function makeSnapshotDelta(
  previous: WireSnapshot,
  next: WireSnapshot,
): SnapshotDelta {
  const patch: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(next)) {
    if (["v", "type", "tick", "ack", "world"].includes(key)) continue;
    if (!equal(value, previous[key as keyof WireSnapshot])) patch[key] = value;
  }
  for (const key of Object.keys(previous))
    if (!(key in next) && !["v", "type", "tick", "ack", "world"].includes(key))
      unset.push(key);
  const world: Record<string, unknown> = {};
  const worldUnset: string[] = [];
  for (const [key, value] of Object.entries(next.world)) {
    if (["entities", "events"].includes(key)) continue;
    if (!equal(value, previous.world[key as keyof typeof previous.world]))
      world[key] = value;
  }
  for (const key of Object.keys(previous.world))
    if (!(key in next.world) && !["entities", "events"].includes(key))
      worldUnset.push(key);
  const oldEntities = new Map(
    previous.world.entities.map((entity) => [entity.id, entity]),
  );
  const newEntities = new Map(
    next.world.entities.map((entity) => [entity.id, entity]),
  );
  const remove = [...oldEntities.keys()].filter((id) => !newEntities.has(id));
  const upsert: SnapshotDelta["entities"]["upsert"] = [];
  for (const [id, nextEntity] of newEntities) {
    const oldEntity = oldEntities.get(id);
    if (!oldEntity) {
      upsert.push({
        id,
        fields: nextEntity as unknown as Record<string, unknown>,
      });
      continue;
    }
    const fields: Record<string, unknown> = {};
    const unset: string[] = [];
    for (const [key, value] of Object.entries(nextEntity)) {
      if (!equal(value, (oldEntity as unknown as Record<string, unknown>)[key]))
        fields[key] = value;
    }
    for (const key of Object.keys(oldEntity))
      if (!(key in nextEntity)) unset.push(key);
    if (Object.keys(fields).length || unset.length)
      upsert.push({ id, fields, ...(unset.length ? { unset } : {}) });
  }
  const events = next.world.events.filter(
    (event) => event.id > previous.world.eventSeq,
  );
  return {
    v: 1,
    type: "delta",
    tick: next.tick,
    ack: next.ack,
    baseTick: previous.tick,
    mapId: next.mapId,
    patch,
    ...(unset.length ? { unset } : {}),
    world,
    ...(worldUnset.length ? { worldUnset } : {}),
    entities: {
      remove,
      upsert,
      order: next.world.entities.map(({ id }) => id),
    },
    events: clone(
      next.world.eventSeq < previous.world.eventSeq
        ? next.world.events
        : events,
    ),
    ...(next.world.eventSeq < previous.world.eventSeq
      ? { eventsReset: true }
      : {}),
  };
}

export function applySnapshotDelta(
  base: WireSnapshot,
  delta: SnapshotDelta,
): WireSnapshot | null {
  if (base.tick !== delta.baseTick || base.mapId !== delta.mapId) return null;
  const out = clone(base) as WireSnapshot;
  for (const key of delta.unset ?? [])
    delete (out as unknown as Record<string, unknown>)[key];
  Object.assign(out, delta.patch, {
    tick: delta.tick,
    ack: delta.ack,
    type: "snapshot",
  });
  for (const key of delta.worldUnset ?? [])
    delete (out.world as unknown as Record<string, unknown>)[key];
  Object.assign(out.world, delta.world);
  const entities = new Map(
    (out.world.entities ?? []).map((entity) => [entity.id, entity]),
  );
  for (const id of delta.entities.remove) entities.delete(id);
  for (const update of delta.entities.upsert) {
    const current = object(entities.get(update.id));
    for (const key of update.unset ?? []) delete current[key];
    Object.assign(current, update.fields, { id: update.id });
    entities.set(update.id, current as unknown as Entity);
  }
  out.world.entities = delta.entities.order
    .map((id) => entities.get(id))
    .filter((entity): entity is Entity => !!entity);
  const events = new Map<number, WorldEvent>(
    delta.eventsReset
      ? []
      : (out.world.events ?? []).map((event) => [event.id, event]),
  );
  for (const event of delta.events) events.set(event.id, event);
  out.world.events = [...events.values()]
    .sort((a, b) => a.id - b.id)
    .slice(-256);
  return out;
}
