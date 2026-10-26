import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
import { drawFrame, drawMinimap } from "../src/game/render";
import { initializeWorldRules } from "../src/game/world-rules";
import { placeName } from "../src/game/place-names";

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

test("overlapping crowd speech stays readable without changing agent state", () => {
  const w = createWorld("paris", "watcher", "Observer", "test", 69, 0);
  w.camX = 1000;
  w.camY = 700;
  w.zoom = 1;
  w.entities = w.entities.slice(0, 8).map((entity, i) => ({
    ...entity,
    x: 1000 + i,
    y: 700 + i,
    bubble: `Crowd voice ${i}`,
  }));
  const before = JSON.stringify(w);
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 800, 600, {} as HTMLCanvasElement);
  assert.equal(
    labels.filter((text) => text.startsWith("Crowd voice")).length,
    1,
  );
  assert.equal(JSON.stringify(w), before);
});

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
  w.selectedId = 2;
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 400, 400, {} as HTMLCanvasElement);
  assert.ok(
    labels.indexOf("▼ Behind") < labels.indexOf(placeName("TEST BLOCK")),
  );
  assert.ok(
    labels.indexOf(placeName("TEST BLOCK")) < labels.indexOf("◉ Front"),
  );
  assert.ok(!labels.includes("▼ Distant"));
});

test("visible local, remote and bot names appear without selecting anyone", () => {
  const w = createWorld("paris", "protester", "Local", "test", 500, 0);
  const local = w.player!;
  local.x = w.camX;
  local.y = w.camY;
  const remote = {
    ...local,
    id: w.nextId++,
    profileId: "remote-profile",
    remote: true,
    name: "Remote",
    x: local.x + 30,
  };
  const bot = {
    ...local,
    id: w.nextId++,
    profileId: undefined,
    isPlayer: false,
    remote: false,
    name: "Aarav",
    x: local.x - 40,
  };
  w.entities = [local, remote, bot];
  w.map.buildings = [];
  w.map.trees = [];
  w.objective = undefined;
  w.resources = [];
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(labels.includes("▼ Local"));
  assert.ok(labels.includes("◉ Remote"));
  assert.ok(labels.includes("Aarav · BOT"));
  w.selectedId = remote.id;
  labels.length = 0;
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(labels.includes("◉ Remote"));
});

test("roadside gear is labeled and highlights its walk-over pickup when close", () => {
  const w = createWorld("delhi", "protester", "Collector", "test", 500, 0);
  const player = w.player!;
  const stone = {
    ...player,
    id: w.nextId++,
    kind: "crate" as const,
    isPlayer: false,
    crateItem: "stones" as const,
    crateFaction: "protester" as const,
    roadsidePickup: true,
    x: player.x + 100,
  };
  w.entities = [player, stone];
  w.map.buildings = [];
  w.map.trees = [];
  w.objective = undefined;
  w.resources = [];
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(labels.includes("STONES"));
  stone.x = player.x + 30;
  labels.length = 0;
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(labels.includes("Walk over · STONES"));
});

test("entrances keep a quiet door glyph and show ENTER only nearby", () => {
  const w = createWorld("delhi", "protester", "Walker", "test", 500, 0);
  const building = structuredClone(w.map.buildings.find((b) => b.entrance)!);
  w.map.buildings = [building];
  w.map.trees = [];
  w.objective = undefined;
  w.resources = [];
  w.camX = building.entrance!.x;
  w.camY = building.entrance!.y;
  const labels: string[] = [];
  w.player!.x = building.entrance!.x + 110;
  w.player!.y = building.entrance!.y;
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(!labels.includes("ENTER"));
  w.player!.x = building.entrance!.x;
  labels.length = 0;
  drawFrame(recordingContext(labels), w, 400, 300, {} as HTMLCanvasElement);
  assert.ok(labels.includes("ENTER"));
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

test("wanted protesters are visibly marked in the world", () => {
  const w = createWorld("delhi", "watcher", "Test", "test", 1000, 0);
  const target = w.entities.find((entity) => entity.kind === "protester")!;
  Object.assign(target, { x: 500, y: 500, wanted: 2 });
  w.entities = [target];
  w.map.buildings = [];
  w.map.trees = [];
  w.map.lamps = [];
  w.objective = undefined;
  w.resources = [];
  w.camX = 500;
  w.camY = 500;
  w.selectedId = target.id;
  const labels: string[] = [];
  drawFrame(recordingContext(labels), w, 400, 400, {} as HTMLCanvasElement);
  assert.ok(labels.includes("WANTED 2"));
});

test("minimap viewport uses the actual game canvas dimensions", () => {
  const w = createWorld("delhi", "watcher", "Test", "test", 1000, 0);
  w.camX = 1000;
  w.camY = 800;
  w.zoom = 1;
  let viewport: number[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === "strokeRect"
          ? (...args: number[]) => {
              viewport = args;
            }
          : () => {},
    },
  ) as CanvasRenderingContext2D;
  drawMinimap(ctx, w, 240, 164, 800, 600);
  const sx = 240 / w.map.w,
    sy = 164 / w.map.h;
  const expected = [600 * sx, 500 * sy, 800 * sx, 600 * sy];
  assert.equal(viewport.length, expected.length);
  for (const [index, value] of expected.entries())
    assert.ok(Math.abs(viewport[index] - value) < 1e-10);
});

test("minimap reuses static geometry across authoritative snapshots", (t) => {
  const w = createWorld("paris", "watcher", "Test", "test", 0, 0);
  let backgrounds = 0;
  const ctx = recordingContext([]);
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement() {
        backgrounds++;
        return { width: 0, height: 0, getContext: () => ctx };
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  });
  drawMinimap(ctx, w, 200, 136, 1280, 720);
  drawMinimap(
    ctx,
    {
      ...w,
      map: { ...w.map, buildings: w.map.buildings.map((b) => ({ ...b })) },
    },
    200,
    136,
    1280,
    720,
  );
  assert.equal(backgrounds, 1);
});
