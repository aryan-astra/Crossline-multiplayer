import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/server/store";
import { upgradeWorldMap } from "../src/server/map-upgrade";
import { createWorld, spawnPlayer } from "../src/game/engine";
import { MAPS } from "../src/game/maps";

test("same-size saved districts receive defenses and shops without resetting players or progress", () => {
  const store = new Store(":memory:");
  try {
    const w = createWorld("delhi", "protester", "Saved", "saved", 0, 0, 42, {
      persistent: true,
    });
    w.map.buildings = w.map.buildings.filter((b) => !b.barricade);
    w.objective!.progress = 3;
    const before = structuredClone(w.player);
    upgradeWorldMap(w, store);
    assert.equal(w.map.buildings.filter((b) => b.barricade).length, 4);
    assert.ok(w.map.buildings.filter((b) => b.kind === "shop").length >= 8);
    assert.equal(w.objective!.progress, 3);
    assert.deepEqual(w.player, before);
    const barricade = w.map.buildings.find((b) => b.barricade)!;
    barricade.hp = 0;
    barricade.broken = true;
    w.map.policeLine = [];
    upgradeWorldMap(w, store);
    assert.equal(w.map.buildings.filter((b) => b.barricade).length, 4);
    assert.equal(w.map.policeLine.length, 14);
    assert.equal(barricade.hp, 0);
    assert.equal(barricade.broken, true);
  } finally {
    store.close();
  }
});

test("district expansion translates active and offline saved characters exactly once", () => {
  const store = new Store(":memory:");
  try {
    const first = store.createGuest("Active").profile,
      second = store.createGuest("Offline").profile;
    const w = createWorld("delhi", "watcher", "Server", "server", 0, 0, 42, {
      persistent: true,
    });
    const p = spawnPlayer(w, "protester", "Active", first.id)!;
    const point = MAPS.delhi.spawns.protester;
    p.x = point.x - 1100;
    p.y = point.y - 750;
    w.map.w = 2200;
    w.map.h = 1500;
    store.saveCharacter(first.id, p);
    const offline = {
      ...structuredClone(p),
      id: p.id + 1000,
      profileId: second.id,
    };
    store.saveCharacter(second.id, offline);
    const profiles = [store.profile(first.id), store.profile(second.id)];
    upgradeWorldMap(w, store);
    assert.equal(w.map.w, 4400);
    assert.equal(w.map.h, 3000);
    assert.equal(p.x, point.x);
    assert.equal(p.y, point.y);
    assert.equal(store.character(second.id)!.x, point.x);
    assert.equal(store.character(second.id)!.y, point.y);
    upgradeWorldMap(w, store);
    assert.equal(p.x, point.x);
    assert.equal(store.character(second.id)!.x, point.x);
    assert.deepEqual(
      [store.profile(first.id), store.profile(second.id)],
      profiles,
    );
    assert.equal(store.checkpoint("delhi")!.map.w, 4400);
  } finally {
    store.close();
  }
});

test("district expansion preserves an existing building's interior coordinate space", () => {
  const store = new Store(":memory:");
  try {
    const profile = store.createGuest("Indoor").profile;
    const w = createWorld("delhi", "watcher", "Server", "server", 0, 0, 42, {
      persistent: true,
    });
    const building = w.map.buildings.find((b) => b.interior)!;
    const p = spawnPlayer(w, "protester", "Indoor", profile.id)!;
    p.buildingId = building.id;
    p.x = 120;
    p.y = 150;
    w.map.w = 2200;
    w.map.h = 1500;
    store.saveCharacter(profile.id, p);
    upgradeWorldMap(w, store);
    assert.equal(p.buildingId, building.id);
    assert.deepEqual([p.x, p.y], [120, 150]);
    assert.deepEqual(
      [store.character(profile.id)!.x, store.character(profile.id)!.y],
      [120, 150],
    );
  } finally {
    store.close();
  }
});
