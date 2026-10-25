import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  spawnPlayer,
  updatePlayer,
  update,
  doAction,
  roeValid,
} from "../src/game/engine";
import { collideBuildings } from "../src/game/maps";
import {
  interactObjective,
  updateWorldRules,
  enterBuilding,
  exitBuilding,
  insidePosition,
  collectResource,
  markWanted,
  validDetention,
  emitEvent,
} from "../src/game/world-rules";
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
function persistent() {
  const w = createWorld("delhi", "watcher", "Coordinator", "server", 0, 0, 7, {
    persistent: true,
  });
  w.entities = [];
  w.populationAt = Infinity;
  return w;
}

test("persistent world continues beyond300s and shared humans step exactly once", () => {
  const w = persistent();
  const p = spawnPlayer(w, "protester", "A", "A")!;
  assert.equal(spawnPlayer(w, "protester", "A", "A"), p);
  w.map.buildings = [];
  p.x = 500;
  p.y = 500;
  updatePlayer(w, p, { ...idle, right: true }, 0.05);
  assert.equal(p.x, 505.5);
  w.player = p;
  update(w, 0.05, { ...idle, right: true });
  assert.equal(p.x, 505.5);
  for (let i = 0; i < 6200; i++) update(w, 0.05, idle);
  assert.ok(w.time > 300);
  assert.equal(w.over, false);
  assert.equal(w.tick, 6201);
});

test("objective needs sustained cooperation, can be contested, captures once and recovers", () => {
  const w = persistent(),
    objective = w.objective!;
  const a = spawnPlayer(w, "protester", "A", "A")!,
    b = spawnPlayer(w, "protester", "B", "B")!;
  Object.assign(a, { x: objective.x, y: objective.y });
  Object.assign(b, { x: objective.x + 20, y: objective.y });
  interactObjective(w, a);
  updateWorldRules(w, 1);
  assert.equal(objective.progress, 0);
  interactObjective(w, b);
  for (let i = 0; i < 5; i++) updateWorldRules(w, 1);
  assert.equal(objective.progress, 5);
  const npc = structuredClone(a);
  Object.assign(npc, {
    id: w.nextId++,
    profileId: undefined,
    isPlayer: false,
    remote: false,
    name: "NPC",
  });
  w.entities.push(npc);
  objective.contributors[a.id] = 20;
  objective.contributors[b.id] = 10;
  objective.contributors[npc.id] = 100;
  const cop = spawnPlayer(w, "police", "Cop", "Cop")!;
  Object.assign(cop, { x: objective.x, y: objective.y + 20 });
  updateWorldRules(w, 1);
  assert.equal(objective.status, "contested");
  assert.equal(objective.progress, 4);
  cop.x += 200;
  for (let i = 0; i < 10; i++) updateWorldRules(w, 1);
  assert.equal(
    w.events.filter((e) => e.type === "objective_capture").length,
    1,
  );
  assert.equal(
    w.events.filter((e) => e.type === "objective_contribution").length,
    3,
  );
  const capture = w.events.find((e) => e.type === "objective_capture");
  assert.equal(capture?.actorId, a.id);
  assert.deepEqual(
    w.events
      .filter((e) => e.type === "objective_team_reward")
      .map((e) => e.actorId)
      .sort(),
    [a.id, b.id].sort(),
  );
  assert.equal(objective.status, "recovering");
  assert.equal(w.factionScores?.protester, 1);
  assert.equal(w.over, false);
  updateWorldRules(w, 60);
  assert.equal(objective.status, "protected");
  assert.equal(objective.cycle, 2);
  assert.equal(w.factionScores?.protester, 1);
});

test("NPCs support a Constitution Book capture only after a human contributes", () => {
  const w = persistent(),
    objective = w.objective!,
    human = spawnPlayer(w, "protester", "A", "A")!;
  Object.assign(human, { x: objective.x, y: objective.y });
  const npc = structuredClone(human);
  Object.assign(npc, {
    id: w.nextId++,
    profileId: undefined,
    isPlayer: false,
    remote: false,
    name: "NPC",
  });
  w.entities.push(npc);
  for (let i = 0; i < objective.captureSeconds + 1; i++) updateWorldRules(w, 1);
  assert.equal(objective.progress, 0);
  assert.equal(w.factionScores?.protester, 0);
  interactObjective(w, human);
  for (let i = 0; i < objective.captureSeconds; i++) updateWorldRules(w, 1);
  assert.equal(w.factionScores?.protester, 1);
});

test("defensive victory is local to an objective cycle", () => {
  const w = persistent(),
    cop = spawnPlayer(w, "police", "Cop", "Cop")!;
  Object.assign(cop, { x: w.objective!.x, y: w.objective!.y });
  w.objective!.defenseSeconds = 2;
  updateWorldRules(w, 1);
  updateWorldRules(w, 1);
  updateWorldRules(w, 1);
  assert.equal(
    w.events.filter((e) => e.type === "objective_defense").length,
    1,
  );
  assert.equal(w.over, false);
});

test("custody releases alive in place and death waits30s for explicit respawn", () => {
  const w = persistent();
  w.map.buildings = [];
  const cop = spawnPlayer(w, "police", "Cop", "Cop")!,
    p = spawnPlayer(w, "protester", "P", "P")!;
  Object.assign(cop, { x: 500, y: 500 });
  Object.assign(p, { x: 520, y: 500, violentT: 100 });
  w.player = cop;
  doAction(w, "primary");
  w.player = null;
  for (let i = 0; i < 30; i++) {
    updatePlayer(w, cop, idle, 0.05);
    update(w, 0.05, idle);
  }
  assert.equal(p.state, "detained");
  assert.equal(w.events.filter((e) => e.type === "detention").length, 1);
  for (let i = 0; i < 420; i++) update(w, 0.05, idle);
  assert.equal(p.state, "idle");
  assert.equal(p.x, 520);
  assert.equal(p.y, 500);
  assert.equal(p.remove, false);
  p.hp = 0;
  update(w, 0.05, idle);
  assert.equal(p.state, "down");
  assert.equal(p.deathUntil, w.time + 30);
  for (let i = 0; i < 650; i++) update(w, 0.05, idle);
  assert.equal(p.state, "down");
  assert.equal(p.hp, 0);
  assert.equal(w.events.filter((e) => e.type === "death").length, 1);
});

test("peaceful traits and wanted designation alone authorize neither custody nor fire", () => {
  const w = persistent(),
    p = spawnPlayer(w, "protester", "P", "P")!,
    cop = spawnPlayer(w, "police", "C", "C")!;
  w.map.buildings = [];
  Object.assign(p, {
    x: 520,
    y: 500,
    wanted: 5,
    brain: { ...p.brain, aggression: 1 },
  });
  Object.assign(cop, { x: 500, y: 500 });
  assert.equal(validDetention(w, p), false);
  w.player = cop;
  doAction(w, "primary");
  w.player = null;
  for (let i = 0; i < 30; i++) {
    updatePlayer(w, cop, idle, 0.05);
    update(w, 0.05, idle);
  }
  assert.equal(p.state, "idle");
  assert.equal(
    w.events.filter((e) => e.type === "unjustified_detention").length,
    0,
  );
  const soldier = spawnPlayer(w, "military", "M", "M")!;
  Object.assign(soldier, { x: 500, y: 500 });
  Object.assign(p, { violentT: 8, recentThrowT: 3, warnedT: 4 });
  w.tension = 80;
  assert.equal(roeValid(w, soldier, p), false);
  p.imminentThreatUntil = w.time + 1;
  assert.equal(roeValid(w, soldier, p), true);
});

test("doors enforce physical entry, occupancy, indoor collisions and return through same door", () => {
  const w = persistent(),
    building = w.map.buildings.find((b) => b.interior)!;
  building.interior!.capacity = 1;
  const p = spawnPlayer(w, "protester", "A", "A")!,
    q = spawnPlayer(w, "police", "B", "B")!;
  assert.equal(enterBuilding(w, p, building.id!), false);
  Object.assign(p, building.entrance);
  Object.assign(q, building.entrance);
  assert.equal(enterBuilding(w, p, building.id!), true);
  assert.equal(enterBuilding(w, q, building.id!), false);
  const point = insidePosition(w, p, -50, 1000);
  assert.equal(point.x, 10);
  assert.equal(point.y, 170);
  const outside = collideBuildings(w.map, -50, w.map.h + 500, 9);
  assert.equal(outside.x, 10);
  assert.equal(outside.y, w.map.h - 10);
  p.x = 50;
  p.y = 50;
  assert.equal(exitBuilding(w, p), false);
  p.x = 120;
  p.y = 156;
  assert.equal(exitBuilding(w, p), true);
  assert.deepEqual({ x: p.x, y: p.y }, building.entrance);
  assert.equal(enterBuilding(w, q, building.id!), true);
});

test("wanted expires, essentials replenish predictably and witnessed events stay bounded", () => {
  const w = persistent(),
    p = spawnPlayer(w, "protester", "A", "A")!;
  markWanted(w, p);
  assert.equal(p.wanted, 1);
  w.time = 91;
  updateWorldRules(w, 0.05);
  assert.equal(p.wanted, 0);
  Object.assign(p, w.resources![0]);
  p.hunger = 30;
  p.thirst = 30;
  assert.equal(collectResource(w, p), true);
  assert.equal(p.hunger, 70);
  w.resources![0].food = 0;
  w.resources![0].water = 0;
  w.time = 160;
  updateWorldRules(w, 0.05);
  assert.equal(w.resources![0].food, 3);
  const reporter = {
    ...p,
    id: w.nextId++,
    isPlayer: false,
    journalist: true,
    x: p.x + 20,
  };
  w.entities.push(reporter);
  w.map.buildings = [];
  emitEvent(w, "wanted", { targetId: p.id });
  assert.ok(w.events.some((e) => e.type === "news"));
  for (let i = 0; i < 300; i++) emitEvent(w, "chant", { actorId: p.id });
  assert.equal(w.events.length, 256);
  assert.equal(new Set(w.events.map((e) => e.id)).size, 256);
});

test("adaptive bot population replenishes without exceeding budget", () => {
  const w = persistent();
  w.populationAt = 0;
  for (let i = 0; i < 90; i++) {
    w.populationAt = 0;
    update(w, 0.05, idle);
  }
  assert.ok(w.entities.length >= 40 && w.entities.length <= 54);
  assert.ok(w.entities.some((e) => e.journalist));
  for (let i = 0; i < 20; i++) spawnPlayer(w, "protester", `H${i}`, `H${i}`);
  for (let i = 0; i < 90; i++) {
    w.populationAt = 0;
    update(w, 0.05, idle);
  }
  assert.ok(w.entities.filter((e) => !e.isPlayer).length <= 54);
  assert.equal(w.entities.filter((e) => e.isPlayer).length, 20);
});
