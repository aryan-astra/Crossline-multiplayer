import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/engine";
import { hasLineOfSight, nextWaypoint } from "../src/game/navigation";
import type { Entity } from "../src/game/types";

test("nearby unchanged targets reuse a route after checking its next segment", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const map = structuredClone(world.map);
  map.w = map.h = 400;
  map.buildings = [
    { kind: "block", x: 160, y: 80, w: 80, h: 240, hp: 100, maxHp: 100 },
  ];
  const mover: Entity = {
    ...world.player!,
    x: 100,
    y: 200,
    path: undefined,
    pathTarget: undefined,
  };

  nextWaypoint(map, mover, 300, 200);
  const path = mover.path;
  assert.ok(path?.length);

  const waypoint = nextWaypoint(map, mover, 310, 200);

  assert.equal(mover.path, path);
  assert.equal(waypoint, path[0]);
});

test("reached cached waypoints do not skip validation of the next segment", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const map = structuredClone(world.map);
  map.w = map.h = 400;
  map.buildings = [
    { kind: "block", x: 65, y: 80, w: 30, h: 40, hp: 100, maxHp: 100 },
  ];
  const mover: Entity = {
    ...world.player!,
    x: 50,
    y: 100,
    path: [
      { x: 52, y: 100 },
      { x: 110, y: 100 },
    ],
    pathTarget: { x: 300, y: 100 },
  };

  const waypoint = nextWaypoint(map, mover, 310, 100);

  assert.equal(hasLineOfSight(map, mover, waypoint), true);
});

test("large maps choose a nearby open start cell when replanning", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const map = structuredClone(world.map);
  map.w = 4400;
  map.h = 3000;
  map.buildings = [
    { kind: "block", x: 400, y: 0, w: 80, h: 500, hp: 100, maxHp: 100 },
  ];
  const mover: Entity = {
    ...world.player!,
    x: 100,
    y: 100,
    path: undefined,
    pathTarget: undefined,
  };

  const waypoint = nextWaypoint(map, mover, 4000, 2800);

  assert.ok(mover.path?.length);
  assert.ok(Math.hypot(waypoint.x - mover.x, waypoint.y - mover.y) <= 40);
});
