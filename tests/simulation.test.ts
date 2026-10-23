import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  createWorld,
  spawnPlayer,
  update,
  doAction,
  buy,
  fund,
  placeBet,
  roeValid,
  issueOrder,
} from "../src/game/engine";
import { MAPS, collideBuildings } from "../src/game/maps";
import { nextWaypoint } from "../src/game/navigation";
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
const world = (seed = 42) =>
  createWorld("delhi", "protester", "Tester", "local", 500, 0, seed);

test("fixed movement normalizes diagonals, follows camera and respects buildings", () => {
  const run = (input: InputState) => {
    const w = world();
    w.entities = [w.player!];
    w.map.buildings = [];
    w.player!.x = 500;
    w.player!.y = 500;
    w.camX = 500;
    w.camY = 500;
    for (let i = 0; i < 30; i++) update(w, 1 / 30, input);
    return w;
  };
  const straight = run({ ...idle, right: true });
  const diagonal = run({ ...idle, right: true, down: true });
  assert.ok(Math.abs(straight.player!.x - 610) < 0.001);
  assert.ok(
    Math.abs(
      Math.hypot(diagonal.player!.x - 500, diagonal.player!.y - 500) - 110,
    ) < 0.001,
  );
  assert.ok(straight.camX > 500 && straight.camX < straight.player!.x);
  const w = run(idle);
  w.map.buildings = [
    { x: 530, y: 450, w: 50, h: 100, kind: "block", hp: 100, maxHp: 100 },
  ];
  for (let i = 0; i < 60; i++)
    update(w, 1 / 30, { ...idle, right: true, sprint: true });
  assert.equal(w.player!.x, 521);
});

test("fixed inputs and seed reproduce a full headless round independently", () => {
  const a = world(),
    b = world();
  const start = performance.now();
  for (let i = 0; i < 6001; i++) {
    update(a, 0.05, idle);
    update(b, 0.05, idle);
  }
  assert.deepEqual(a, b);
  assert.ok(a.over);
  assert.ok(
    a.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)),
  );
  assert.ok(a.entities.length <= 100);
  assert.notDeepEqual(world(43).entities, world().entities);
  console.log(
    `Two 300s headless rounds, 62 bots each: ${(performance.now() - start).toFixed(1)}ms`,
  );
});

test("police dispatch pursues peaceful wanted targets without detaining them", () => {
  const w = createWorld("delhi", "watcher", "Server", "server", 0, 0, 42, {
    persistent: true,
  });
  w.entities = [];
  w.map.buildings = [];
  const target = spawnPlayer(w, "protester", "Target", "target")!;
  const officer = spawnPlayer(w, "police", "Officer", "officer")!;
  Object.assign(target, { x: 600, y: 600, wanted: 1, violentT: 0 });
  Object.assign(officer, {
    x: 300,
    y: 600,
    isPlayer: false,
    remote: false,
    profileId: undefined,
    think: 0,
    policeTaskTargetId: target.id,
  });
  w.order = { id: 1, x: 300, y: 300, mode: "move", t: 10, issuer: "Test" };
  officer.brain.discipline = 1;
  const x = officer.x;
  update(w, 0.05, idle);
  assert.ok(officer.x > x);
  assert.equal(officer.order, null);
  assert.equal(target.hp, 100);
  assert.notEqual(target.state, "detained");

  target.wanted = 0;
  officer.think = 0;
  update(w, 0.05, idle);
  assert.equal(officer.policeTaskTargetId, undefined);
  assert.equal(target.hp, 100);
});

test("map destruction cannot leak between worlds or into map templates", () => {
  const a = world(),
    b = world();
  const shop = a.map.buildings.find((v) => v.kind === "shop")!;
  shop.broken = true;
  shop.hp = 0;
  assert.ok(!b.map.buildings.find((v) => v.kind === "shop")!.broken);
  assert.ok(!MAPS.delhi.buildings.find((v) => v.kind === "shop")!.broken);
});

test("chant cooldown and inactive players cannot farm actions", () => {
  const w = world();
  doAction(w, "primary");
  for (let i = 0; i < 10; i++) doAction(w, "primary");
  assert.equal(w.earned, 2);
  for (const state of ["detained", "down"] as const) {
    w.player!.state = state;
    w.player!.cooldown = 0;
    doAction(w, "primary");
    assert.equal(w.earned, 2);
  }
  w.player!.state = "idle";
  w.player!.remove = true;
  doAction(w, "primary");
  assert.equal(w.earned, 2);
});

test("player projectile travel time uses the aimed world distance", () => {
  const w = world();
  const p = w.player!;
  p.stones = 1;
  p.target = { x: p.x + 160, y: p.y };
  doAction(w, "secondary");
  assert.equal(w.projectiles[0].dur, 0.5);
  assert.equal(w.projectiles[0].tx, p.target.x);
});

test("economy rejects invalid numeric inputs and caps local state", () => {
  const w = world();
  const e = w.entities.find((v) => v.kind === "protester" && !v.isPlayer)!;
  for (const amount of [NaN, Infinity, -1, 0, 0.5]) {
    buy(w, "calm", amount);
    fund(w, "police", amount);
    placeBet(w, e.id, "free60", amount);
  }
  assert.equal(w.wallet, 500);
  assert.equal(w.bets.length, 0);
  w.wallet = 100000;
  for (let i = 0; i < 110; i++) placeBet(w, e.id, "free60", 1);
  assert.equal(w.bets.length, 100);
  for (let i = 0; i < 100; i++) fund(w, "police", 1);
  assert.equal(w.entities.filter((v) => v.kind === "truck").length, 20);
});

test("military shared eligibility requires warning, recent violence, range and tension", () => {
  const w = createWorld("paris", "military", "Tester", "local", 500, 10, 2);
  const p = w.player!,
    target = w.entities.find((e) => e.kind === "protester")!;
  target.x = p.x - 30;
  target.y = p.y;
  target.violentT = 8;
  target.recentThrowT = 3;
  w.tension = 70;
  assert.equal(roeValid(w, p, target), false);
  doAction(w, "primary");
  assert.equal(w.projectiles.length, 0);
  target.warnedT = 4;
  assert.equal(roeValid(w, p, target), true);
  doAction(w, "primary");
  assert.equal(w.projectiles.length, 1);
  target.recentThrowT = 0;
  assert.equal(roeValid(w, p, target), false);
  target.recentThrowT = 3;
  w.tension = 55;
  assert.equal(roeValid(w, p, target), false);
  w.tension = 70;
  target.x = p.x - 241;
  assert.equal(roeValid(w, p, target), false);
});

test("detention has one owner, cancels progress and counts outcome once", () => {
  const w = createWorld("paris", "police", "Tester", "local", 500, 0, 3);
  const p = w.player!,
    target = w.entities.find((e) => e.kind === "protester")!;
  w.entities = [p, target];
  p.x = 1000;
  p.y = 900;
  target.x = 1020;
  target.y = 900;
  target.stun = 100;
  target.violentT = 100;
  doAction(w, "primary");
  for (let i = 0; i < 10; i++) update(w, 0.05, idle);
  assert.ok(target.detainProgress > 0);
  update(w, 0.05, { ...idle, left: true });
  assert.equal(target.detainProgress, 0);
  assert.equal(target.detainOfficer, null);
  doAction(w, "primary");
  for (let i = 0; i < 35; i++) update(w, 0.05, idle);
  assert.equal(w.detentions, 1);
  assert.equal(w.stats.playerDetentions, 1);
  doAction(w, "primary");
  assert.equal(w.detentions, 1);
});

test("police actions honor the selected target and never switch to another suspect", () => {
  const w = createWorld("delhi", "police", "Officer", "officer", 500, 0);
  const player = w.player!;
  const [violent, peaceful] = w.entities.filter(
    (entity) => entity.kind === "protester",
  );
  assert.ok(violent && peaceful);
  w.entities = [player, violent, peaceful];
  Object.assign(player, { x: 500, y: 500 });
  Object.assign(violent, { x: 510, y: 500, violentT: 4 });
  Object.assign(peaceful, { x: 515, y: 500, violentT: 0 });

  doAction(w, "primary", peaceful.id);
  assert.notEqual(player.actingOn, violent.id);

  doAction(w, "primary", violent.id);
  assert.equal(player.actingOn, violent.id);
});

test("spawn and crowd separation preserve solid geometry", () => {
  for (const map of ["delhi", "paris"] as const) {
    const w = createWorld(map, "watcher", "Tester", "local", 500, 0, 9);
    for (let i = 0; i < 120; i++) {
      update(w, 0.05, idle);
      for (const e of w.entities) {
        const corrected = collideBuildings(w.map, e.x, e.y, 9);
        assert.ok(
          Math.hypot(corrected.x - e.x, corrected.y - e.y) < 0.01,
          `${map} ${e.name} inside solid`,
        );
      }
    }
  }
});

test("bounded navigation routes around an obstructing block", () => {
  const w = world(),
    e = w.player!;
  w.map = {
    ...w.map,
    w: 800,
    h: 600,
    buildings: [
      { x: 300, y: 150, w: 150, h: 300, kind: "block", hp: 100, maxHp: 100 },
    ],
  };
  e.x = 200;
  e.y = 300;
  for (let i = 0; i < 500 && Math.hypot(e.x - 550, e.y - 300) > 6; i++) {
    const waypoint = nextWaypoint(w.map, e, 550, 300);
    const d = Math.hypot(waypoint.x - e.x, waypoint.y - e.y);
    if (d > 0) {
      e.x += ((waypoint.x - e.x) / d) * Math.min(d, 5);
      e.y += ((waypoint.y - e.y) / d) * Math.min(d, 5);
    }
    const corrected = collideBuildings(w.map, e.x, e.y, 9);
    assert.ok(Math.hypot(corrected.x - e.x, corrected.y - e.y) < 0.01);
  }
  assert.ok(Math.hypot(e.x - 550, e.y - 300) < 6);
});

test("expired commands clear every cached officer order", () => {
  const w = createWorld("delhi", "police", "Tester", "local", 500, 0, 5);
  issueOrder(w, 800, 1100, "move");
  w.order!.t = -3;
  for (const e of w.entities) e.order = { x: 10, y: 10 };
  update(w, 0.05, idle);
  assert.ok(w.entities.every((e) => e.order == null));
});

test("round end refunds unresolved wagers and liquidates portfolio once", () => {
  const w = world();
  const e = w.entities.find((v) => v.kind === "protester")!;
  buy(w, "calm", 1);
  placeBet(w, e.id, "free60", 50);
  w.time = 299.99;
  update(w, 0.05, idle);
  assert.equal(w.bets[0].status, "refunded");
  assert.deepEqual(w.holdings, {});
  const wallet = w.wallet;
  update(w, 0.05, idle);
  assert.equal(w.wallet, wallet);
});

test("both supply routes reach their depot on both maps without crossing solids", () => {
  for (const map of ["delhi", "paris"] as const) {
    for (const faction of ["protester", "police"] as const) {
      const w = createWorld(map, "watcher", "Tester", "local", 500, 0, 7);
      w.entities = [];
      // Keep the isolated delivery scenario active without crowd-dependent end conditions.
      const marker = world().entities[0];
      marker.remote = true;
      marker.x = 600;
      marker.y = 1100;
      Object.assign(marker, collideBuildings(w.map, marker.x, marker.y, 9));
      w.entities.push(marker);
      fund(w, faction, 100);
      for (
        let i = 0;
        i < 2400 && w.entities.some((e) => e.kind === "truck");
        i++
      ) {
        update(w, 0.05, idle);
        const truck = w.entities.find((e) => e.kind === "truck");
        if (truck) {
          const corrected = collideBuildings(w.map, truck.x, truck.y, 9);
          assert.ok(
            Math.hypot(corrected.x - truck.x, corrected.y - truck.y) < 0.01,
          );
        }
      }
      assert.equal(
        w.entities.filter((e) => e.kind === "truck").length,
        0,
        `${map}/${faction} stuck`,
      );
      assert.equal(
        w.entities.filter((e) => e.kind === "crate").length,
        4,
        `${map}/${faction} delivery`,
      );
    }
  }
});
