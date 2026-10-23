import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
import { interactionPrompt } from "../src/game/prompts";
import { initializeWorldRules } from "../src/game/world-rules";

test("prompts surface nearby buildings, essentials and the live objective", () => {
  const world = createWorld("delhi", "protester", "Guest", "guest", 100, 0);
  initializeWorldRules(world);
  const player = world.player!;
  const building = world.map.buildings.find((item) => item.interior)!;
  Object.assign(player, building.entrance);
  assert.match(interactionPrompt(world, "protester"), /^B · Enter/);

  player.x = world.resources![0].x;
  player.y = world.resources![0].y;
  player.hunger = 50;
  player.thirst = 50;
  assert.match(interactionPrompt(world, "protester"), /^F · Refill/);

  player.hunger = 100;
  player.thirst = 100;
  player.x = world.objective!.x;
  player.y = world.objective!.y;
  assert.equal(
    interactionPrompt(world, "protester"),
    "F · Join the Constitution Book objective",
  );
});

test("prompts describe role actions and interiors without claiming watcher actions", () => {
  const policeWorld = createWorld(
    "paris",
    "police",
    "Officer",
    "officer",
    100,
    0,
  );
  initializeWorldRules(policeWorld);
  const player = policeWorld.player!;
  const suspect = policeWorld.entities.find(
    (item) => item.kind === "protester",
  )!;
  Object.assign(player, { x: 1000, y: 1000 });
  Object.assign(suspect, {
    x: 1010,
    y: 1000,
    violentT: 4,
    state: "throw" as const,
  });
  assert.equal(
    interactionPrompt(policeWorld, "police"),
    `E · Detain ${suspect.name}`,
  );

  player.buildingId = "paris-shop-0";
  assert.match(interactionPrompt(policeWorld, "police"), /^B · Leave/);
  assert.equal(
    interactionPrompt(policeWorld, "watcher"),
    "Select a person to inspect or follow.",
  );
});
