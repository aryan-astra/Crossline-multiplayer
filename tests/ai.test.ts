import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formationSlot, rallyTarget } from "../src/game/ai";
import { createWorld, doAction, spawnPlayer, update } from "../src/game/engine";
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

test("disciplined protesters keep their rally anchor instead of homing to the objective", () => {
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
    rallyIdx: 0,
  });
  protester.brain.discipline = 1;
  const rally = rallyTarget(protester, w.map.rallyPoints[0], 65, 0);

  update(w, 0.05, idle);

  assert.deepEqual(protester.target, rally);
  assert.equal(w.projectiles.filter((p) => p.kind === "stone").length, 0);
});

test("peaceful bots do not gather at the objective after their rally anchors", () => {
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
    protester.rallyIdx = w.map.rallyPoints.length - 1;
    protester.x = w.map.rallyPoints[protester.rallyIdx].x;
    protester.y = w.map.rallyPoints[protester.rallyIdx].y;
    protester.target = null;
  }

  update(w, 0.1, idle);

  assert.equal(w.objective.progress, 0);
  assert.ok(protesters.every((e) => e.rallyIdx < w.map.rallyPoints.length));
  assert.ok(
    protesters.every(
      (e) =>
        Math.hypot(e.target!.x - w.objective!.x, e.target!.y - w.objective!.y) >
        100,
    ),
  );

  for (let i = 0; i < 5; i++) update(w, 0.1, idle);

  assert.equal(w.objective.progress, 0);
});

test("nearby human protesters draw support only after tension escalates", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 37);
  const bot = w.entities.find((e) => e.kind === "protester")!;
  const human = {
    ...bot,
    id: 9999,
    isPlayer: true,
    remote: true,
    x: bot.x + 120,
  };
  w.entities = [bot, human];
  bot.brain.discipline = 1;
  bot.rallyIdx = 0;
  w.tension = 54;
  update(w, 0.05, idle);
  const anchorTarget = bot.target;

  w.tension = 55;
  update(w, 0.05, idle);

  assert.notDeepEqual(bot.target, anchorTarget);
  assert.ok(
    Math.hypot(bot.target!.x - human.x, bot.target!.y - human.y) <= 90 * 0.84,
  );
});

test("new protesters can throw with idle aim and get clear no-ammo feedback", () => {
  const w = createWorld("delhi", "protester", "Player", "player", 0, 0, 41);
  const player = w.player!;
  assert.equal(player.stones, 3);
  player.target = { x: player.x, y: player.y };

  doAction(w, "secondary");

  assert.equal(player.stones, 2);
  assert.equal(
    w.projectiles.filter((projectile) => projectile.kind === "stone").length,
    1,
  );
  assert.ok(
    Math.hypot(w.projectiles[0].tx - player.x, w.projectiles[0].ty - player.y) >
      100,
  );

  player.stones = 0;
  player.cooldown = 0;
  doAction(w, "secondary");
  assert.equal(w.projectiles.length, 1);
  assert.match(player.bubble ?? "", /No stones/);
});

test("remote human protesters stay inside the map after crowd updates", () => {
  const w = createWorld("delhi", "watcher", "Watcher", "watcher", 0, 0, 43);
  const human = spawnPlayer(w, "protester", "Remote", "remote")!;
  human.x = 0;
  human.y = 0;

  update(w, 0.05, idle);

  assert.ok(human.x >= 9 && human.x <= w.map.w - 9);
  assert.ok(human.y >= 9 && human.y <= w.map.h - 9);
});

test("peaceful march keeps circling rally anchors without heading to the objective", () => {
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

  for (let i = 0; i < 1200; i++) update(w, 0.05, idle);

  assert.ok(protester.rallyIdx < w.map.rallyPoints.length);
  assert.notDeepEqual(protester.target, {
    x: w.objective!.x,
    y: w.objective!.y,
  });
});
