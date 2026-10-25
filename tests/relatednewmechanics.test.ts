import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  doAction,
  initializeRoadsidePickups,
  spawnSupply,
  update,
} from "../src/game/engine";
import { SUPPLY_CATALOG } from "../src/game/equipment";
import { parseMessage } from "../src/network/protocol";
import { Store } from "../src/server/store";
import { GameService } from "../src/server/service";
import { hasLineOfSight } from "../src/game/navigation";
import { interactionClear } from "../src/game/world-rules";
import type { Building, InputState } from "../src/game/types";

const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  mouseX: 0,
  mouseY: 0,
};

test("roadside pickup equips items and melee weapons have distinct damage", () => {
  const w = createWorld("delhi", "protester", "Tester", "local", 500, 0, 2);
  const player = w.player!;
  const officer = w.entities.find((entity) => entity.kind === "police")!;
  w.entities = [player, officer];
  Object.assign(player, { x: 500, y: 500, cooldown: 0 });
  Object.assign(officer, { x: 510, y: 500, hp: 100, shield: false });
  const crate = {
    ...player,
    id: 900,
    kind: "crate" as const,
    faction: "protester" as const,
    name: "Roadside supplies",
    x: player.x,
    y: player.y,
    crateFaction: "protester" as const,
    crateItem: "stick" as const,
    remove: false,
  };
  w.entities.push(crate);
  update(w, 0.05, idle);
  assert.equal(player.equipment, "stick");
  player.cooldown = 0;
  doAction(w, "special");
  assert.equal(officer.hp, 86);
  player.equipment = "bat";
  player.cooldown = 0;
  doAction(w, "special");
  assert.equal(officer.hp, 62);
});

test("roadside pickups backfill a checkpoint once without replacing supply crates", () => {
  const w = createWorld("delhi", "watcher", "Tester", "local", 500, 0, 4);
  w.entities = w.entities.filter((entity) => !entity.roadsidePickup);
  const depotCrate = {
    ...w.entities[0],
    id: 999,
    kind: "crate" as const,
    name: "Depot supplies",
    crateFaction: "police" as const,
    remove: false,
  };
  w.entities.push(depotCrate);
  initializeRoadsidePickups(w);
  initializeRoadsidePickups(w);
  assert.equal(w.entities.filter((entity) => entity.roadsidePickup).length, 8);
  assert.ok(
    w.entities.some(
      (entity) => entity.roadsidePickup && entity.crateItem === "stones",
    ),
  );
  assert.ok(
    w.entities.some(
      (entity) => entity.roadsidePickup && entity.crateItem === "stick",
    ),
  );
  assert.ok(w.entities.includes(depotCrate));
  w.entities
    .filter((entity) => entity.roadsidePickup)
    .forEach((entity) => (entity.remove = true));
  w.roadsideRefillAt = w.time;
  update(w, 0.05, idle);
  assert.equal(
    w.entities.filter((entity) => entity.roadsidePickup && !entity.remove)
      .length,
    4,
  );
});

test("delivered packs match their advertised contents and rations restore needs", () => {
  for (const faction of ["protester", "police"] as const) {
    for (const kind of ["essentials", "gear", "arms"] as const) {
      if (faction === "police" && kind === "arms") continue;
      const w = createWorld("delhi", "watcher", "Tester", "local", 500, 0, 4, {
        persistent: true,
      });
      w.entities = [];
      w.populationAt = Infinity;
      spawnSupply(w, faction, kind);
      const truck = w.entities[0];
      truck.state = "unload";
      truck.stateT = 0;
      update(w, 0.05, idle);
      const items = w.entities.map((entity) => entity.crateItem);
      if (kind === "essentials") {
        assert.ok(items.includes("rations"));
        assert.ok(items.includes("firstaid"));
      } else if (kind === "gear") {
        assert.ok(items.includes("shield"));
        assert.ok(items.includes(faction === "police" ? "gas" : "bat"));
      } else assert.deepEqual(items, ["firearm"]);
    }
  }
  const w = createWorld("delhi", "protester", "Tester", "local", 500, 0, 4);
  const player = w.player!;
  Object.assign(player, { x: 500, y: 500, hunger: 30, thirst: 30 });
  w.entities = [
    player,
    {
      ...player,
      id: 9999,
      kind: "crate",
      crateFaction: "protester",
      crateItem: "rations",
      isPlayer: false,
    },
  ];
  update(w, 0.05, idle);
  assert.ok(player.hunger >= 69 && player.thirst >= 69);
  assert.equal(
    w.entities.some((entity) => entity.id === 9999),
    false,
  );
});

test("shields absorb damage until their durability breaks", () => {
  const w = createWorld("delhi", "watcher", "Tester", "local", 500, 0, 3);
  const target = w.entities.find((entity) => entity.kind === "police")!;
  Object.assign(target, {
    x: 500,
    y: 500,
    hp: 100,
    shield: true,
    shieldHp: 12,
  });
  w.entities = [target];
  w.projectiles.push({
    x: 500,
    y: 500,
    sx: 0,
    sy: 500,
    tx: 500,
    ty: 500,
    t: 0,
    dur: 0.05,
    kind: "stone",
    from: -1,
  });
  update(w, 0.05, idle);
  assert.equal(target.hp, 98);
  assert.equal(target.shieldHp, 0);
  assert.equal(target.shield, false);
});

test("protester attacks honor the selected target and line of sight and become wanted only on attack", () => {
  const w = createWorld("delhi", "protester", "Tester", "local", 500, 0, 6, {
    persistent: true,
  });
  const player = w.player!;
  const officers = w.entities.filter((entity) => entity.kind === "police");
  const [selected, other] = officers;
  w.entities = [player, selected, other];
  w.map = structuredClone(w.map);
  w.map.buildings = [];
  Object.assign(player, {
    x: 500,
    y: 500,
    cooldown: 0,
    equipment: "bat" as const,
  });
  Object.assign(selected, {
    x: 510,
    y: 500,
    hp: 100,
    shield: false,
    remote: true,
  });
  Object.assign(other, { x: 520, y: 500, hp: 100, remote: true });
  const wall: Building = {
    kind: "wall",
    barricade: true,
    x: 505,
    y: 480,
    w: 10,
    h: 40,
    hp: 100,
    maxHp: 100,
  };
  w.map.buildings.push(wall);
  doAction(w, "special", selected.id);
  assert.equal(selected.hp, 100);
  assert.equal(other.hp, 100);
  assert.equal(player.wanted, 0);
  wall.broken = true;
  player.cooldown = 0;
  assert.equal(interactionClear(w, player, selected), true);
  assert.equal(hasLineOfSight(w.map, player, selected), true);
  doAction(w, "special", selected.id);
  assert.equal(selected.hp, 76);
  assert.equal(other.hp, 100);
  assert.ok(player.wanted > 0);

  Object.assign(selected, { hp: 100, shield: true, shieldHp: 12 });
  player.equipment = "firearm";
  player.ammo = 0;
  player.cooldown = 0;
  doAction(w, "special", selected.id);
  assert.equal(selected.hp, 100);
  assert.equal(player.ammo, 0);
  player.ammo = 3;
  player.cooldown = 0;
  doAction(w, "special", selected.id);
  assert.equal(player.ammo, 2);
  assert.equal(w.projectiles.length, 1);
  for (let i = 0; i < 3; i++) update(w, 0.05, idle);
  assert.equal(selected.hp, 88);
  assert.equal(selected.shield, false);
});

test("stones and nearby human-backed protesters break objective barricades", () => {
  const meleeWorld = createWorld(
    "delhi",
    "protester",
    "Tester",
    "local",
    500,
    0,
    10,
    {
      persistent: true,
    },
  );
  const meleeWall = meleeWorld.map.buildings.find(
    (building) => building.barricade,
  )!;
  const meleePlayer = meleeWorld.player!;
  Object.assign(meleePlayer, {
    x: meleeWall.x + meleeWall.w / 2,
    y: meleeWall.y - 12,
    equipment: "bat" as const,
    cooldown: 0,
  });
  meleeWorld.entities = [meleePlayer];
  doAction(meleeWorld, "special");
  assert.equal(meleeWall.hp, 76);

  const w = createWorld("delhi", "protester", "Tester", "local", 500, 0, 8, {
    persistent: true,
  });
  const barricade = w.map.buildings.find((building) => building.barricade)!;
  const player = w.player!;
  player.remote = true;
  w.entities = [player];
  w.projectiles.push({
    x: barricade.x + barricade.w / 2,
    y: barricade.y + barricade.h / 2,
    sx: player.x,
    sy: player.y,
    tx: barricade.x + barricade.w / 2,
    ty: barricade.y + barricade.h / 2,
    t: 0,
    dur: 0.05,
    kind: "stone",
    from: player.id,
  });
  update(w, 0.05, idle);
  assert.equal(barricade.hp, 82);

  const guarded = createWorld(
    "delhi",
    "protester",
    "Human",
    "human",
    500,
    0,
    9,
    {
      persistent: true,
    },
  );
  const human = guarded.player!;
  const wall = guarded.map.buildings.find((building) => building.barricade)!;
  const approach = { x: wall.x + wall.w / 2, y: wall.y - 12 };
  const bot = structuredClone(human);
  Object.assign(human, { remote: true, x: approach.x - 20, y: approach.y });
  Object.assign(bot, {
    id: 9999,
    isPlayer: false,
    profileId: undefined,
    remote: false,
    x: approach.x,
    y: approach.y,
    cooldown: 0,
    brain: { ...bot.brain, discipline: 1, aggression: 0 },
  });
  guarded.player = null;
  guarded.entities = [bot];
  guarded.tension = 60;
  const before = wall.hp;
  update(guarded, 0.05, idle);
  assert.equal(wall.hp, before);
  guarded.entities = [human, bot];
  update(guarded, 0.05, idle);
  assert.ok(wall.hp < before);
  assert.equal(guarded.objective!.progress, 0);
});

test("market quotes move toward fair value with bounded random noise", () => {
  const w = createWorld("delhi", "watcher", "Tester", "local", 500, 0, 5);
  w.tension = 0;
  w.instruments[0].price = 400;
  w.marketT = 1.49;
  update(w, 0.05, idle);
  assert.ok(w.instruments[0].price > 334 && w.instruments[0].price < 336);
});

test("recent violence decays after fighting stops instead of accumulating forever", () => {
  const w = createWorld("delhi", "watcher", "Tester", "local", 0, 0, 5, {
    persistent: true,
  });
  w.entities = [];
  w.populationAt = Infinity;
  w.violenceRate = 50;
  for (let i = 0; i < 300; i++) update(w, 0.05, idle);
  assert.ok(w.violenceRate < 20);
  w.violenceRate = 50000;
  update(w, 0.05, idle);
  assert.ok(w.violenceRate <= 100);
});

test("persistent market prices and charts stay synchronized between cities every 1.5 seconds", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    const delhi = service.worlds.delhi;
    const paris = service.worlds.paris;
    delhi.instruments[0].price = 10;
    paris.instruments = structuredClone(delhi.instruments);
    delhi.tension = 20;
    paris.tension = 80;
    delhi.damage = 10;
    paris.damage = 50;
    delhi.violenceRate = 0;
    paris.violenceRate = 4;
    const initialPrice = delhi.instruments[0].price;
    for (let i = 0; i < 200; i++) {
      service.advance(0.05);
      for (let j = 0; j < delhi.instruments.length; j++) {
        assert.equal(paris.instruments[j].price, delhi.instruments[j].price);
        assert.equal(paris.instruments[j].prev, delhi.instruments[j].prev);
        assert.deepEqual(
          paris.instruments[j].history,
          delhi.instruments[j].history,
        );
      }
    }
    assert.notEqual(delhi.instruments[0].price, initialPrice);
    assert.equal(delhi.instruments[0].history.length, 46);
  } finally {
    store.close();
  }
});

test("fund choices validate faction and catalog prices stay server owned", () => {
  const message = {
    v: 1,
    seq: 1,
    requestId: "arms",
    type: "fund",
    faction: "protester",
    kind: "arms",
  };
  assert.ok(parseMessage(message));
  assert.equal(parseMessage({ ...message, kind: "invalid" }), null);
  assert.equal(SUPPLY_CATALOG.find((item) => item.kind === "arms")?.price, 500);
  assert.equal(
    SUPPLY_CATALOG.some(
      (item) => item.faction === "police" && String(item.kind) === "arms",
    ),
    false,
  );
});

test("spectator arms funding is priced once and unavailable police arms are rejected", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    for (const world of Object.values(service.worlds)) world.entities = [];
    const profile = store.createGuest("Tester").profile;
    profile.credits = 1000;
    store.saveProfile(profile);
    service.join(profile.id, "delhi", "watcher");
    const fund = {
      v: 1 as const,
      seq: 1,
      requestId: "arms-once",
      type: "fund" as const,
      faction: "protester" as const,
      kind: "arms" as const,
    };
    service.command(profile.id, fund);
    service.command(profile.id, { ...fund, seq: 2 });
    assert.equal(store.profile(profile.id).credits, 500);
    assert.equal(
      service.worlds.delhi.entities.filter(
        (entity) => entity.kind === "truck" && entity.supplyKind === "arms",
      ).length,
      1,
    );
    assert.throws(
      () =>
        service.command(profile.id, {
          ...fund,
          seq: 3,
          requestId: "police-arms",
          faction: "police",
        }),
      /unavailable/,
    );
    assert.equal(store.profile(profile.id).credits, 500);
  } finally {
    store.close();
  }
});

test("shop interaction spends stock, marks looting wanted, and respects the human cooldown", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    const profile = store.createGuest("Tester").profile;
    service.join(profile.id, "delhi", "protester");
    const world = service.worlds.delhi;
    const player = world.entities.find(
      (entity) => entity.profileId === profile.id,
    )!;
    const shop = world.map.buildings.find(
      (building) => building.kind === "shop" && building.entrance,
    )!;
    Object.assign(player, {
      x: shop.entrance!.x,
      y: shop.entrance!.y,
      hunger: 30,
      thirst: 100,
    });
    const stock = shop.shopStock!.food;
    service.command(profile.id, {
      v: 1,
      seq: 1,
      requestId: "shop-loot",
      type: "action",
      action: "interact",
    });
    assert.equal(player.hunger, 70);
    assert.ok(player.wanted > 0);
    assert.equal(shop.shopStock!.food, stock - 1);
    service.command(profile.id, {
      v: 1,
      seq: 2,
      requestId: "shop-loot-again",
      type: "action",
      action: "interact",
    });
    assert.equal(shop.shopStock!.food, stock - 1);
  } finally {
    store.close();
  }
});

test("disconnect cancels Constitution Book participation immediately", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    const profile = store.createGuest("Tester").profile;
    service.join(profile.id, "delhi", "protester");
    const player = service.worlds.delhi.entities.find(
      (entity) => entity.profileId === profile.id,
    )!;
    player.objectiveUntil = service.worlds.delhi.time + 10;
    service.disconnect(profile.id);
    assert.equal(player.objectiveUntil, undefined);
  } finally {
    store.close();
  }
});
