import test from "node:test";
import assert from "node:assert/strict";
import {
  cameraZoom,
  clampZoom,
  trackCamera,
  constrainCamera,
} from "../src/game/camera";

test("only watcher can change role zoom, including malformed wheel values", () => {
  for (const role of ["protester", "police", "military"] as const) {
    for (const zoom of [0, 0.1, 1, 100, NaN, Infinity])
      assert.equal(clampZoom(role, zoom), cameraZoom(role));
  }
  assert.ok(cameraZoom("protester") > cameraZoom("police"));
  assert.ok(cameraZoom("police") > cameraZoom("military"));
  assert.equal(clampZoom("watcher", 0), 0.45);
  assert.equal(clampZoom("watcher", 10), 2);
  assert.equal(clampZoom("watcher", NaN), 0.85);
});

test("tracking is independent of display frame count and cannot overshoot", () => {
  const origin = { x: 0, y: 0 },
    target = { x: 100, y: 80 };
  let steps = origin;
  for (let i = 0; i < 60; i++) steps = trackCamera(steps, target, 1 / 60);
  const once = trackCamera(origin, target, 1);
  assert.ok(Math.abs(steps.x - once.x) < 1e-10);
  assert.ok(once.x > 0 && once.x < target.x);
  assert.deepEqual(trackCamera(origin, target, -1), origin);
});

test("world edges clamp camera and oversized viewports center it", () => {
  assert.deepEqual(
    constrainCamera(
      { x: -100, y: 9999 },
      { w: 800, h: 600 },
      { w: 2200, h: 1500 },
      1,
    ),
    { x: 400, y: 1200 },
  );
  assert.deepEqual(
    constrainCamera(
      { x: 0, y: 0 },
      { w: 1600, h: 1000 },
      { w: 800, h: 600 },
      1,
    ),
    { x: 400, y: 300 },
  );
});
