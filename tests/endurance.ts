import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Store } from "../src/server/store";
import { GameService } from "../src/server/service";
import { collideBuildings } from "../src/game/maps";

if (!global.gc)
  throw new Error("Run with node --expose-gc .test-build/tests/endurance.js");
const store = new Store(":memory:");
let service = new GameService(store);
const police = store.createGuest("Endurance Officer").profile;
const protester = store.createGuest("Endurance Citizen").profile;
service.join(police.id, "delhi", "police");
service.join(protester.id, "paris", "protester");
global.gc();
const before = process.memoryUsage(),
  started = performance.now();
const checkpoints: unknown[] = [],
  ticks: number[] = [];
let restarted = false;
try {
  for (let i = 1; i <= 36000; i++) {
    const start = performance.now();
    service.advance(0.05);
    ticks.push(performance.now() - start);
    if (i % 6000 === 0) {
      for (const w of Object.values(service.worlds)) {
        assert.equal(w.over, false);
        assert.ok(w.entities.length <= 70);
        assert.ok(w.events.length <= 256 && w.feed.length <= 40);
        assert.ok(
          w.projectiles.length < 200 &&
            w.effects.length < 200 &&
            w.gases.length < 100,
        );
        for (const e of w.entities) {
          assert.ok(
            Number.isFinite(e.x) &&
              Number.isFinite(e.y) &&
              Number.isFinite(e.hp),
          );
          if (
            !e.buildingId &&
            e.kind !== "truck" &&
            e.kind !== "crate" &&
            !e.remove &&
            e.state !== "down"
          ) {
            const point = collideBuildings(w.map, e.x, e.y, 9);
            assert.ok(
              Math.hypot(point.x - e.x, point.y - e.y) < 0.001,
              `${w.map.id}:${e.id} penetrated geometry`,
            );
          }
        }
      }
      for (const id of [police.id, protester.id]) {
        const p = store.profile(id);
        assert.ok(Number.isSafeInteger(p.credits) && p.credits >= 0);
        assert.equal(p.lifeId, 1);
        assert.equal(p.lifeCredits, 69);
      }
      if (i === 18000) {
        service.checkpoint();
        const sequence = service.worlds.delhi.eventSeq;
        const cycle = service.worlds.delhi.objective!.cycle;
        service = new GameService(store);
        service.join(police.id, "delhi", "police");
        service.join(protester.id, "paris", "protester");
        assert.equal(service.worlds.delhi.eventSeq, sequence);
        assert.equal(service.worlds.delhi.objective!.cycle, cycle);
        restarted = true;
      }
      global.gc();
      checkpoints.push({
        simulatedSeconds: i / 20,
        entities: Object.values(service.worlds).map((w) => w.entities.length),
        heapUsed: process.memoryUsage().heapUsed,
        snapshotBytes: Buffer.byteLength(
          JSON.stringify(service.snapshot(police.id, 0, 2)),
        ),
      });
      console.log(`Endurance progress: ${i / 20} simulated seconds / 1800`);
    }
  }
  global.gc();
  const after = process.memoryUsage();
  ticks.sort((a, b) => a - b);
  assert.ok(restarted);
  assert.equal(store.profile(police.id).credits, 69);
  assert.equal(store.profile(protester.id).credits, 69);
  console.log(
    JSON.stringify(
      {
        node: process.version,
        scope:
          "two authoritative worlds, two idle humans, real NPC simulation and in-memory SQLite; excludes rendering/network",
        simulatedSeconds: 1800,
        ticks: 36000,
        elapsedMs: Math.round(performance.now() - started),
        p50Ms: +ticks[18000].toFixed(3),
        p95Ms: +ticks[34200].toFixed(3),
        maxMs: +ticks[35999].toFixed(3),
        heapAfterGcBefore: before.heapUsed,
        heapAfterGcAfter: after.heapUsed,
        rssDeltaBytes: after.rss - before.rss,
        controllerRestart: restarted,
        checkpoints,
      },
      null,
      2,
    ),
  );
} finally {
  store.close();
}
