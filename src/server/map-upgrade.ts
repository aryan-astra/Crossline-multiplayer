import {
  MAPS,
  collideBuildings,
  ensureObjectiveDefenses,
  ensureStreetShops,
} from "../game/maps";
import { initializeWorldRules } from "../game/world-rules";
import type { Entity, World } from "../game/types";
import type { Store } from "./store";

/** Translate saved characters with the geographic frame; balances and life state stay intact. */
export function upgradeWorldMap(w: World, store: Store): void {
  const current = MAPS[w.map.id];
  if (w.map.roadWays && w.map.w === current.w && w.map.h === current.h) {
    ensureStreetShops(w.map);
    if (!w.map.buildings.some((b) => b.barricade)) {
      w.map.objectivePoint = { ...current.objectivePoint! };
      if (w.objective) Object.assign(w.objective, w.map.objectivePoint);
    }
    ensureObjectiveDefenses(w.map);
    initializeWorldRules(w);
    store.saveWorld(w.map.id, w);
    return;
  }
  const old = w.map;
  const dx = old.roadWays ? (current.w - old.w) / 2 : 0;
  const dy = old.roadWays ? (current.h - old.h) / 2 : 0;
  w.map = structuredClone(current);
  const translate = (entity: Entity) => {
    if (
      entity.buildingId &&
      !w.map.buildings.some((b) => b.id === entity.buildingId && b.interior)
    ) {
      const door = old.buildings.find(
        (b) => b.id === entity.buildingId,
      )?.entrance;
      Object.assign(entity, door ?? old.spawns.protester);
      entity.buildingId = undefined;
    }
    if (!old.roadWays) entity.buildingId = undefined;
    if (!entity.buildingId) {
      entity.x += dx;
      entity.y += dy;
      Object.assign(entity, collideBuildings(w.map, entity.x, entity.y, 9));
    }
    entity.path = undefined;
    entity.pathTarget = undefined;
    entity.target = null;
    entity.order = null;
    if (entity.state === "detained") Object.assign(entity, w.map.detainZone);
    if (entity.kind === "truck" && entity.truckFaction) {
      entity.truckPath = w.map.truckRoutes[entity.truckFaction];
      let nearest = 0;
      for (let i = 1; i < entity.truckPath.length; i++)
        if (
          Math.hypot(
            entity.truckPath[i].x - entity.x,
            entity.truckPath[i].y - entity.y,
          ) <
          Math.hypot(
            entity.truckPath[nearest].x - entity.x,
            entity.truckPath[nearest].y - entity.y,
          )
        )
          nearest = i;
      entity.truckIdx = Math.min(entity.truckPath.length - 1, nearest + 1);
    }
  };
  for (const entity of w.entities) translate(entity);
  // Existing NPCs need homes in the expanded district, rather than a translated central pile.
  let index = 0;
  for (const entity of w.entities) {
    if (
      entity.profileId ||
      entity.buildingId ||
      entity.remove ||
      !["protester", "civilian"].includes(entity.kind) ||
      ["down", "detained"].includes(entity.state)
    )
      continue;
    const anchor = w.map.rallyPoints[index++ % w.map.rallyPoints.length];
    Object.assign(
      entity,
      collideBuildings(
        w.map,
        anchor.x + ((entity.id % 3) - 1) * 24,
        anchor.y + ((entity.id % 5) - 2) * 18,
        9,
      ),
    );
    entity.rallyIdx = (index - 1) % w.map.rallyPoints.length;
  }
  if (w.objective) Object.assign(w.objective, w.map.objectivePoint);
  for (const resource of w.resources ?? [])
    Object.assign(
      resource,
      w.map.depots[resource.id.startsWith("police") ? "police" : "protester"],
    );
  w.projectiles = [];
  w.effects = [];
  w.gases = [];
  w.order = null;
  initializeWorldRules(w);
  store.atomic(() => {
    for (const { id, entity } of store.savedCharacters(w.map.id)) {
      translate(entity);
      store.saveCharacter(id, entity);
    }
    store.saveWorld(w.map.id, w);
  });
}
