import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
import {
  compactSnapshot,
  makeSnapshotDelta,
  applySnapshotDelta,
} from "../src/network/delta";
import type { Snapshot } from "../src/network/protocol";

function sample(): Snapshot {
  const world = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 71);
  return {
    v: 1,
    type: "snapshot",
    tick: world.tick,
    ack: 0,
    world,
    self: {
      id: "watcher",
      name: "Watcher",
      credits: 100,
      lifeCredits: 0,
      lifeId: 0,
      score: 0,
      policeScore: 0,
      protesterScore: 0,
      watcherProfit: 0,
      detentions: 0,
      penalties: 0,
      appointmentUntil: 0,
      mapId: "delhi",
      role: "watcher",
      deathUntil: 0,
    },
    holdings: {},
    predictions: [],
    rankings: [],
    online: 1,
    appointmentIn: 0,
  };
}

test("delta reconstructs a changed authoritative snapshot including entity additions, removals and optional-key deletion", () => {
  const initial = sample();
  initial.world.entities[0].profileId = "one";
  const before = compactSnapshot(initial);
  const next = structuredClone(initial);
  next.tick = 1;
  next.world.tick = 1;
  next.world.time += 1 / 30;
  next.world.eventSeq = 2;
  next.world.events = [
    { id: 1, tick: 1, time: 1, type: "news", details: "first" },
    { id: 2, tick: 1, time: 1, type: "news", details: "second" },
  ];
  const first = next.world.entities[0];
  first.x += 3;
  delete first.profileId;
  next.world.entities.pop();
  next.world.entities.push({
    ...structuredClone(first),
    id: 99999,
    name: "New entity",
  });
  const wireNext = compactSnapshot(next);
  const delta = makeSnapshotDelta(before, wireNext);
  assert.deepEqual(applySnapshotDelta(before, delta), wireNext);
  assert.deepEqual(delta.entities.remove, [before.world.entities.at(-1)!.id]);
  assert.ok(
    delta.entities.upsert
      .find((entry) => entry.id === first.id)
      ?.unset?.includes("profileId"),
  );
});

test("delta refuses the wrong base tick or map", () => {
  const before = compactSnapshot(sample());
  const next = compactSnapshot(sample());
  next.tick++;
  const delta = makeSnapshotDelta(before, next);
  assert.equal(applySnapshotDelta({ ...before, tick: 9 }, delta), null);
  assert.equal(applySnapshotDelta({ ...before, mapId: "paris" }, delta), null);
});

test("delta unsets optional snapshot and world fields, preserves entity order, and resets regressed events", () => {
  const initial = sample();
  initial.policeTask = {
    targetId: 1,
    name: "Target",
    wantedLevel: 1,
    x: 1,
    y: 1,
    inBuilding: false,
  };
  initial.world.events = [
    { id: 9, tick: 4, time: 4, type: "news", details: "old" },
  ];
  initial.world.eventSeq = 9;
  const before = compactSnapshot(initial);
  const next = structuredClone(initial);
  next.tick++;
  next.world.tick++;
  delete next.policeTask;
  next.world.entities.reverse();
  next.world.eventSeq = 1;
  next.world.events = [
    { id: 1, tick: next.tick, time: 5, type: "news", details: "new timeline" },
  ];
  const wireNext = compactSnapshot(next);
  (before.world as unknown as Record<string, unknown>).policeTask =
    "world field";
  const delta = makeSnapshotDelta(before, wireNext);
  assert.deepEqual(applySnapshotDelta(before, delta), wireNext);
  assert.ok(delta.unset?.includes("policeTask"));
  assert.ok(delta.worldUnset?.includes("policeTask"));
  assert.equal(delta.eventsReset, true);
});

test("real world tick delta reduces JSON payload by at least 60 percent", () => {
  const before = sample();
  const next = structuredClone(before);
  next.tick++;
  next.world.tick++;
  next.world.time += 1 / 30;
  for (const entity of next.world.entities) entity.x += 0.1;
  const a = compactSnapshot(before),
    b = compactSnapshot(next);
  const fullBytes = Buffer.byteLength(JSON.stringify(b));
  const deltaBytes = Buffer.byteLength(JSON.stringify(makeSnapshotDelta(a, b)));
  assert.ok(
    deltaBytes < fullBytes * 0.4,
    `full=${fullBytes} delta=${deltaBytes}`,
  );
});
