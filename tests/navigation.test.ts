import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/engine";
import { MAPS, collideBuildings, isWalkable } from "../src/game/maps";
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
