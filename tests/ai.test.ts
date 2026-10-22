import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formationSlot, rallyTarget } from "../src/game/ai";

test("formation slots center on the order and space perpendicular to advance", () => {
  const order = { x: 100, y: 0 };
  const members = [1, 2, 3].map((id) => ({ id, x: 0, y: 0 }));
  assert.deepEqual(
    members.map((member) => formationSlot(order, members, member)),
    [
      { x: 100, y: -26 },
      { x: 100, y: 0 },
      { x: 100, y: 26 },
    ],
  );
  assert.deepEqual(formationSlot(order, [], { id: 1 }), order);
  assert.deepEqual(formationSlot({ x: 0, y: 0 }, members, members[0]), {
    x: -26,
    y: 0,
  });
});

test("rally targets reproduce and stay inside the rally circle", () => {
  const rally = { x: 200, y: 300 };
  const targets = new Set<string>();
  for (let id = 1; id <= 100; id++) {
    const point = rallyTarget({ id }, rally, 80, 12);
    assert.deepEqual(point, rallyTarget({ id }, rally, 80, 12));
    assert.ok(
      Math.hypot(point.x - rally.x, point.y - rally.y) <= 80 * 0.84 + 1e-10,
    );
    targets.add(JSON.stringify(point));
  }
  assert.equal(targets.size, 100);
  assert.notDeepEqual(
    rallyTarget({ id: 1 }, rally, 80, 12),
    rallyTarget({ id: 1 }, rally, 80, 24),
  );
});
