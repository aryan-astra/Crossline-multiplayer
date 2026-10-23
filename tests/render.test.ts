import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
import { drawFrame } from "../src/game/render";
import { initializeWorldRules } from "../src/game/world-rules";

function recordingContext(labels: string[]): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "createRadialGradient" || key === "createLinearGradient")
          return () => ({ addColorStop() {} });
        if (key === "measureText") return () => ({ width: 12 });
        if (key === "fillText")
          return (label: string) => {
            labels.push(label);
          };
        return () => {};
      },
    },
  ) as CanvasRenderingContext2D;
}

test("rendering cannot advance or mutate detention or match state", () => {
  const w = createWorld("delhi", "police", "Test", "test", 1000, 0);
  w.entities[0].detainProgress = 0.6;
  const before = JSON.stringify(w);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "createRadialGradient" || key === "createLinearGradient")
          return () => gradient;
        if (key === "measureText") return () => ({ width: 12 });
        return () => {};
      },
    },
  ) as CanvasRenderingContext2D;
  for (let frame = 0; frame < 120; frame++)
    drawFrame(ctx, w, 800, 600, {} as HTMLCanvasElement);
  assert.equal(JSON.stringify(w), before);
});

test("roofs occlude characters behind the facade and culling skips distant actors", () => {
  const w = createWorld("delhi", "police", "Test", "test", 1000, 0);
  const actor = w.entities[0];
  w.map.buildings = [
    {
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      kind: "block",
      name: "TEST BLOCK",
      hp: 100,
      maxHp: 100,
    },
  ];
  w.map.trees = [];
  w.map.lamps = [];
  w.objective = undefined;
  w.resources = [];
  w.camX = 150;
  w.camY = 150;
  w.zoom = 1;
  w.entities = [
    { ...actor, x: 150, y: 80, id: 1, name: "Behind", isPlayer: true },
    { ...actor, x: 150, y: 230, id: 2, name: "Front", isPlayer: true },
    { ...actor, x: 2000, y: 1400, id: 3, name: "Distant", isPlayer: true },
  ];
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 400, 400, {} as HTMLCanvasElement);
  assert.ok(labels.indexOf("▼ Behind") < labels.indexOf("TEST BLOCK"));
  assert.ok(labels.indexOf("TEST BLOCK") < labels.indexOf("▼ Front"));
  assert.ok(!labels.includes("▼ Distant"));
});

test("interior cutaway shows only that building's occupants without mutating snapshots", () => {
  const w = createWorld("delhi", "protester", "Indoor", "test", 1000, 0);
  initializeWorldRules(w);
  const building = w.map.buildings.find((b) => b.interior)!;
  assert.ok(building);
  w.player!.buildingId = building.id;
  w.player!.x = 100;
  w.player!.y = 90;
  const before = JSON.stringify(w);
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 800, 600, {} as HTMLCanvasElement);
  assert.ok(labels.includes("▼ Indoor"));
  assert.ok(labels.some((label) => label.includes("INTERIOR")));
  assert.ok(!labels.includes("CONSTITUTION BOOK"));
  assert.equal(JSON.stringify(w), before);
});

test("Constitution Book and authoritative progress are visible in the civic area", () => {
  const w = createWorld("paris", "watcher", "Test", "test", 1000, 0);
  initializeWorldRules(w);
  assert.ok(w.objective);
  w.camX = w.objective!.x;
  w.camY = w.objective!.y;
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 800, 600, {} as HTMLCanvasElement);
  assert.ok(labels.includes("CONSTITUTION BOOK"));
  assert.ok(labels.includes(w.objective!.status.toUpperCase()));
});

test("downed NPCs do not advertise a player respawn lifecycle", () => {
  const w = createWorld("delhi", "watcher", "Test", "test", 1000, 0);
  const actor = w.entities[0];
  Object.assign(actor, {
    x: w.camX,
    y: w.camY,
    state: "down",
    deathUntil: w.time + 30,
  });
  w.entities = [actor];
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 800, 600, {} as HTMLCanvasElement);
  assert.ok(labels.includes("DOWN"));
  assert.ok(!labels.includes("RESPAWNING"));
  actor.profileId = "human-profile";
  labels.length = 0;
  drawFrame(recordingContext(labels), w, 800, 600, {} as HTMLCanvasElement);
  assert.ok(labels.includes("RESPAWNING"));
});
