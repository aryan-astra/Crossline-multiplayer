import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/engine";
import { MAPS, collideBuildings, isWalkable } from "../src/game/maps";
import type { Entity, MapDef } from "../src/game/types";
import {
  hasLineOfSight,
  nextWaypoint,
  prewarmNavigation,
} from "../src/game/navigation";

test("prewarmed OSM graph returns the same clear first waypoint as lazy construction", () => {
  const cold = structuredClone(MAPS.paris),
    warm = structuredClone(MAPS.paris);
  const mover = createWorld("paris", "protester", "Test", "test", 0, 0).player!;
  Object.assign(mover, {
    x: 1370,
    y: 740,
    path: undefined,
    pathTarget: undefined,
  });
  const target = { x: 1770, y: 750 };
  const expected = nextWaypoint(cold, { ...mover }, target.x, target.y);

  prewarmNavigation(warm);
  prewarmNavigation(warm);
  const actual = nextWaypoint(warm, { ...mover }, target.x, target.y);

  assert.deepEqual(actual, expected);
  assert.equal(hasLineOfSight(warm, mover, actual), true);
});

test("overlapping Paris footprints cannot certify a trapped collision cycle as open ground", () => {
  const map = structuredClone(MAPS.paris);
  for (const [x, y] of [
    [726.2531722783929, 771.1118230818741],
    [696.098357031292, 909.937686967735],
  ]) {
    const p = collideBuildings(map, x, y, 9);
    assert.equal(isWalkable(map, p.x, p.y, 9), true);
    assert.deepEqual(collideBuildings(map, p.x, p.y, 9), p);
  }
});

test("local steering leaves a narrow passage that has no coarse grid cell", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const map = structuredClone(world.map);
  map.w = map.h = 400;
  map.buildings = [
    { kind: "block", x: 0, y: 0, w: 40, h: 200, hp: 100, maxHp: 100 },
    { kind: "block", x: 60, y: 0, w: 40, h: 200, hp: 100, maxHp: 100 },
  ];
  const mover = {
    ...world.player!,
    x: 50,
    y: 100,
    path: undefined,
    pathTarget: undefined,
  };
  const point = nextWaypoint(map, mover, 150, 250);
  assert.equal(hasLineOfSight(map, mover, point), true);
  assert.ok(point.y > mover.y);
  assert.ok(Math.abs(point.x - mover.x) < 1e-6);
});

test("fixed-step movers clear a U obstruction and OSM rally routes without jitter", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0, 73);
  const uMap = {
    ...world.map,
    w: 500,
    h: 400,
    buildings: [
      {
        kind: "block" as const,
        x: 150,
        y: 120,
        w: 40,
        h: 200,
        hp: 1,
        maxHp: 1,
      },
      {
        kind: "block" as const,
        x: 270,
        y: 120,
        w: 40,
        h: 200,
        hp: 1,
        maxHp: 1,
      },
      {
        kind: "block" as const,
        x: 150,
        y: 280,
        w: 160,
        h: 40,
        hp: 1,
        maxHp: 1,
      },
    ],
  };
  const move = (
    map: MapDef,
    e: Entity,
    goal: { x: number; y: number },
    limit: number,
  ) => {
    for (
      let i = 0;
      i < limit && Math.hypot(e.x - goal.x, e.y - goal.y) > 8;
      i++
    ) {
      const waypoint = nextWaypoint(map, e, goal.x, goal.y);
      const d = Math.hypot(waypoint.x - e.x, waypoint.y - e.y);
      if (d > 0) {
        const step = Math.min(d, e.speed * 0.05);
        Object.assign(
          e,
          collideBuildings(
            map,
            e.x + ((waypoint.x - e.x) / d) * step,
            e.y + ((waypoint.y - e.y) / d) * step,
            9,
          ),
        );
      }
      assert.equal(isWalkable(map, e.x, e.y, 9), true);
    }
    return Math.hypot(e.x - goal.x, e.y - goal.y);
  };
  const uMover = {
    ...world.player!,
    speed: 110,
    x: 230,
    y: 240,
    path: undefined,
    pathTarget: undefined,
  };
  assert.ok(move(uMap, uMover, { x: 230, y: 70 }, 1200) < 8);

  for (const map of Object.values(MAPS)) {
    const seeded = createWorld(map.id, "protester", "Test", "test", 0, 0, 73);
    const mover = {
      ...seeded.player!,
      speed: 110,
      x: map.rallyPoints[0].x,
      y: map.rallyPoints[0].y,
      path: undefined,
      pathTarget: undefined,
    };
    assert.ok(
      move(map, mover, map.rallyPoints.at(-1)!, 5000) < 8,
      `${map.id} rally route stalled`,
    );
  }
});
