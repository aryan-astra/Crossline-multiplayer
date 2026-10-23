import { performance } from "node:perf_hooks";
import {
  createWorld,
  spawnPlayer,
  update,
  updatePlayer,
} from "../src/game/engine";
import { collideBuildings } from "../src/game/maps";
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

export function benchmark() {
  return [
    { humans: 1, bots: 20 },
    { humans: 2, bots: 50 },
    { humans: 5, bots: 100 },
    { humans: 10, bots: null },
  ].map((scenario) => {
    const w = createWorld("paris", "watcher", "Benchmark", "server", 0, 0, 42, {
      persistent: true,
    });
    const initial = [...w.entities];
    if (scenario.bots !== null) {
      w.populationAt = Number.MAX_SAFE_INTEGER;
      w.entities = [];
      for (let i = 0; i < scenario.bots; i++) {
        const e = structuredClone(initial[i % initial.length]);
        e.id = w.nextId++;
        e.x += (i % 5) * 12;
        e.y += (i % 7) * 12;
        Object.assign(e, collideBuildings(w.map, e.x, e.y, 9));
        w.entities.push(e);
      }
    }
    for (let i = 0; i < scenario.humans; i++)
      spawnPlayer(
        w,
        i % 2 ? "police" : "protester",
        `Human ${i}`,
        `human:${i}`,
      );
    const humans = w.entities.filter((e) => e.isPlayer);
    const times: number[] = [];
    const before = process.memoryUsage();
    const start = performance.now();
    for (let i = 0; i < 900; i++) {
      const tick = performance.now();
      for (const player of humans) updatePlayer(w, player, idle, 1 / 30);
      update(w, 1 / 30, idle);
      times.push(performance.now() - tick);
    }
    const elapsed = performance.now() - start;
    times.sort((a, b) => a - b);
    const after = process.memoryUsage();
    return {
      scenario: `${scenario.humans} humans / ${scenario.bots ?? "adaptive"} bots`,
      seed: 42,
      ticks: 900,
      simulatedSeconds: 30,
      elapsedMs: Math.round(elapsed),
      p50Ms: +times[450].toFixed(3),
      p95Ms: +times[855].toFixed(3),
      maxMs: +times[899].toFixed(3),
      remainingBots: w.entities.filter((e) => !e.isPlayer).length,
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      rssDeltaBytes: after.rss - before.rss,
    };
  });
}

if (require.main === module)
  console.log(
    JSON.stringify(
      {
        node: process.version,
        scope:
          "headless simulation; no network, SQLite or rendering; memory deltas include GC noise",
        results: benchmark(),
      },
      null,
      2,
    ),
  );
