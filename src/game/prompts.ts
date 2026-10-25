import type { Role, World } from "./types";
import { placeName } from "./place-names";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function interactionPrompt(world: World | undefined, role: Role) {
  const player = world?.player;
  if (!world || !player || role === "watcher")
    return "Select a person to inspect or follow.";

  if (player.buildingId) {
    const building = world.map.buildings.find(
      (item) => item.id === player.buildingId,
    );
    return `B · Leave ${building?.name ? placeName(building.name) : "the building"}${building?.kind === "shop" ? " · F loot food" : ""}`;
  }

  const doorway = world.map.buildings
    .filter((item) => item.entrance && item.interior)
    .sort(
      (a, b) => distance(player, a.entrance!) - distance(player, b.entrance!),
    )[0];
  if (doorway?.entrance && distance(player, doorway.entrance) <= 36)
    return `B · Enter ${doorway.name ? placeName(doorway.name) : "building"}${doorway.kind === "shop" ? " · F loot food" : ""}`;

  const resource = world.resources?.find(
    (item) =>
      distance(player, item) <= 40 &&
      ((item.food > 0 && player.hunger < 85) ||
        (item.water > 0 && player.thirst < 85)),
  );
  if (resource)
    return `F · Refill ${
      resource.food > 0 && player.hunger < 85
        ? resource.water > 0 && player.thirst < 85
          ? "food and water"
          : "food"
        : "water"
    }`;

  if (role === "protester") {
    if (
      world.objective &&
      world.objective.status !== "recovering" &&
      distance(player, world.objective) <= 65
    )
      return "F · Join the Constitution Book objective";
    const crate = world.entities.find(
      (item) =>
        !item.remove &&
        item.kind === "crate" &&
        item.crateFaction === "protester" &&
        distance(player, item) <= 60,
    );
    if (crate) return "Walk over the crowd supply crate to collect gear";
    return "E · Chant to raise morale and earn credits";
  }

  if (role === "police") {
    const suspect = world.entities
      .filter(
        (item) =>
          !item.remove &&
          item.kind === "protester" &&
          item.state !== "down" &&
          item.state !== "detained" &&
          item.buildingId === player.buildingId &&
          (world.persistent
            ? item.violentT > 0
            : item.violentT > 0 ||
              (world.tension > 60 && item.brain.aggression > 0.65)) &&
          distance(player, item) <= 44,
      )
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
    if (suspect) return `E · Detain ${suspect.name}`;
    const crate = world.entities.find(
      (item) =>
        !item.remove &&
        item.kind === "crate" &&
        item.crateFaction === "police" &&
        distance(player, item) <= 60,
    );
    if (crate) return "Walk over the police supply crate to collect gear";
    return "C · Place a formation order · E detains nearby suspects";
  }

  return "Q · Warn first · E requires an immediate serious threat";
}
