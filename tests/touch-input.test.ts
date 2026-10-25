import test from "node:test";
import assert from "node:assert/strict";
import { joystickInput } from "../src/game/touch-input";

test("joystick dead zone releases all directions and travel is clamped", () => {
  for (const [x, y] of [
    [0, 0],
    [3, 4],
  ]) {
    const input = joystickInput(x, y);
    assert.equal(input.up || input.down || input.left || input.right, false);
  }
  const diagonal = joystickInput(100, -100);
  assert.equal(diagonal.right && diagonal.up, true);
  assert.equal(diagonal.left || diagonal.down, false);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 40) < 1e-8);
  const horizontal = joystickInput(-30, 0);
  assert.equal(horizontal.left, true);
  assert.equal(horizontal.up || horizontal.down || horizontal.right, false);
});
