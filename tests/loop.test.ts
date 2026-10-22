import test from "node:test";
import assert from "node:assert/strict";
import { advance, STEP } from "../src/game/loop";

test("fixed ticks match across render rates and cap hidden-tab catch-up", () => {
  for (const fps of [30, 60, 120]) {
    let ticks = 0,
      accumulator = 0;
    for (let frame = 0; frame < fps * 5; frame++)
      accumulator = advance(accumulator, 1 / fps, () => ticks++);
    assert.equal(ticks, 150);
    assert.ok(accumulator < STEP);
  }
  let ticks = 0;
  advance(0, 300, () => ticks++);
  assert.ok(ticks <= 8);
  assert.equal(
    advance(0, NaN, () => assert.fail()),
    0,
  );
});
