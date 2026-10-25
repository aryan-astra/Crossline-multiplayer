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

test("disciplined protesters keep marching without starting violence", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 19);
  const protester = w.entities.find((e) => e.kind === "protester")!;
  w.entities = [protester];
  Object.assign(protester, {
    x: 500,
    y: 500,
    think: 0,
    stones: 12,
    state: "march",
  });
  Object.assign(protester.brain, { aggression: 1, discipline: 1 });

  update(w, 0.05, idle);

  assert.equal(w.projectiles.filter((p) => p.kind === "stone").length, 0);
  assert.equal(protester.state, "march");
  assert.ok(protester.target);
});

test("disciplined protesters march toward the existing persistent objective", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 23, {
    persistent: true,
  });
  const protester = w.entities.find((e) => e.kind === "protester")!;
  w.entities = [protester];
  w.objective = {
    x: 700,
    y: 500,
    status: "protected",
    progress: 0,
    phaseT: 0,
    recoveryT: 0,
    cycle: 0,
    contributors: {},
    captureSeconds: 12,
    defenseSeconds: 180,
    recoverySeconds: 60,
  };
  Object.assign(protester, {
    x: 500,
    y: 500,
    think: 0,
    violentT: 0,
    rallyIdx: w.map.rallyPoints.length,
  });
  protester.brain.discipline = 1;

  update(w, 0.05, idle);

  assert.deepEqual(protester.target, { x: 700, y: 500 });
  assert.equal(w.projectiles.filter((p) => p.kind === "stone").length, 0);
});

test("peaceful crowd completes rally points, then holds the objective", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 29, {
    persistent: true,
  });
  const protesters = w.entities
    .filter((e) => e.kind === "protester")
    .slice(0, 2);
  w.entities = protesters;
  w.objective = {
    x: 1600,
    y: w.map.rallyPoints[0].y,
    status: "protected",
    progress: 0,
    phaseT: 0,
    recoveryT: 0,
    cycle: 0,
    contributors: {},
    captureSeconds: 12,
    defenseSeconds: 180,
    recoverySeconds: 60,
  };
  for (const protester of protesters) {
    protester.brain.discipline = 1;
    protester.brain.aggression = 1;
    protester.rallyIdx = w.map.rallyPoints.length;
    protester.x = w.objective.x;
    protester.y = w.objective.y;
    protester.target = null;
  }

  update(w, 0.1, idle);

  assert.equal(w.objective.progress, 0.05);
  assert.deepEqual(
    Object.keys(w.objective.contributors).sort(),
    protesters.map((e) => String(e.id)).sort(),
  );
  assert.ok(protesters.every((e) => e.rallyIdx === w.map.rallyPoints.length));
  assert.ok(protesters.every((e) => e.target?.x === w.objective!.x));

  for (let i = 0; i < 5; i++) update(w, 0.1, idle);

  assert.ok(w.objective.progress > 0.05);
  assert.ok(protesters.every((e) => e.rallyIdx === w.map.rallyPoints.length));
});

test("peaceful march advances through rally anchors before the objective", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 31, {
    persistent: true,
  });
  const protester = w.entities.find((e) => e.kind === "protester")!;
  w.entities = [protester];
  protester.brain.discipline = 1;
  protester.rallyIdx = 0;
  const initialAnchor = rallyTarget(protester, w.map.rallyPoints[0], 65, 0);
  protester.x = initialAnchor.x;
  protester.y = initialAnchor.y;
  protester.target = null;

  for (
    let i = 0;
    i < 1200 && protester.rallyIdx < w.map.rallyPoints.length;
    i++
  )
    update(w, 0.05, idle);

  assert.equal(protester.rallyIdx, w.map.rallyPoints.length);
  assert.deepEqual(protester.target, {
    x: w.objective!.x,
    y: w.objective!.y,
  });
});
