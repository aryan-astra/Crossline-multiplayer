import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formationSlot, rallyTarget } from "../src/game/ai";
import { createWorld, update } from "../src/game/engine";
import type { InputState } from "../src/game/types";

const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  mouseX: 0,
  mouseY: 0,
};

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

test("a protester does not chain stone throws during one violent episode", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 7, {
    persistent: true,
  });
  const protester = w.entities.find((e) => e.kind === "protester")!;
  const officer = w.entities.find((e) => e.kind === "police")!;
  w.entities = [protester, officer];
  Object.assign(protester, {
    x: 500,
    y: 500,
    violentT: 2,
    cooldown: 0,
    think: 0,
  });
  Object.assign(protester.brain, { aggression: 0, discipline: 0 });
  Object.assign(officer, { x: 520, y: 500 });

  update(w, 0.05, idle);

  assert.equal(w.projectiles.filter((p) => p.kind === "stone").length, 0);
});
