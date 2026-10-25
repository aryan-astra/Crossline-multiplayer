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

test("small target jitter reuses a route and unreachable targets do not replan forever", () => {
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
  assert.deepEqual(nextWaypoint(map, mover, Number.NaN, 200), {
    x: mover.x,
    y: mover.y,
  });
  nextWaypoint(map, mover, 300, 200);
  const route = mover.path;
  for (let i = 0; i < 100; i++)
    nextWaypoint(map, mover, 300 + Math.sin(i) * 10, 200 + Math.cos(i) * 10);
  assert.equal(mover.path, route);

  const blockedMap = {
    ...map,
    buildings: [
      {
        kind: "block" as const,
        x: 190,
        y: 0,
        w: 20,
        h: 400,
        hp: 100,
        maxHp: 100,
      },
    ],
  };
  mover.x = 100;
  mover.y = 200;
  mover.path = undefined;
  mover.pathTarget = undefined;
  for (let i = 0; i < 100; i++) {
    const waypoint = nextWaypoint(blockedMap, mover, 300, 200);
    mover.x = waypoint.x;
    mover.y = waypoint.y;
  }
  const exhausted = mover.path;
  assert.deepEqual(exhausted, []);
  for (let i = 0; i < 100; i++) nextWaypoint(blockedMap, mover, 300, 200);
  assert.equal(mover.path, exhausted);
});

test("cached unreachable routes retry when a barricade breaks", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const map = structuredClone(world.map);
  map.w = map.h = 400;
  const barricade = {
    kind: "wall" as const,
    barricade: true,
    x: 190,
    y: 0,
    w: 20,
    h: 400,
    hp: 100,
    maxHp: 100,
    broken: false as boolean,
  };
  map.buildings = [barricade];
  const mover: Entity = {
    ...world.player!,
    x: 100,
    y: 200,
    path: undefined,
    pathTarget: undefined,
  };

  for (let i = 0; i < 100; i++) {
    const waypoint = nextWaypoint(map, mover, 300, 200);
    mover.x = waypoint.x;
    mover.y = waypoint.y;
  }
  assert.deepEqual(mover.path, []);

  barricade.broken = true;
  assert.deepEqual(nextWaypoint(map, mover, 300, 200), { x: 300, y: 200 });
});
