import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/engine";
import {
  MAPS,
  collideBuildings,
  ensureObjectiveDefenses,
  ensureStreetShops,
  isWalkable,
} from "../src/game/maps";
import { hasLineOfSight, nextWaypoint } from "../src/game/navigation";
import type { MapDef } from "../src/game/types";
import {
  enterBuilding,
  exitBuilding,
  initializeWorldRules,
} from "../src/game/world-rules";

test("bundled OSM footprints and navigation anchors stay on open ground", () => {
  for (const map of Object.values(MAPS)) {
    const objective = map.objectivePoint!;
    assert.ok(map.buildings.length >= 80);
    assert.ok((map.roadWays?.length ?? 0) > 0);
    assert.ok(map.buildings.some((building) => building.kind === "shop"));
    const shops = map.buildings.filter((building) => building.kind === "shop");
    assert.ok(shops.length >= 8);
    const fallbackNames =
      map.id === "delhi"
        ? ["Kirana shop", "Chai corner", "Street provisions", "Market kiosk"]
        : ["Boulangerie", "Café de quartier", "Épicerie", "Pâtisserie"];
    const addedShops = shops.filter((shop) =>
      fallbackNames.includes(shop.name ?? ""),
    );
    for (let i = 0; i < addedShops.length; i++) {
      const shop = addedShops[i];
      assert.ok(
        Math.hypot(
          shop.x + shop.w / 2 - objective.x,
          shop.y + shop.h / 2 - objective.y,
        ) >= 180,
      );
      for (const other of addedShops.slice(i + 1))
        assert.ok(
          Math.hypot(
            shop.x + shop.w / 2 - other.x - other.w / 2,
            shop.y + shop.h / 2 - other.y - other.h / 2,
          ) >= 180,
        );
    }
    const shopLocations = shops.map(({ id, x, y }) => ({ id, x, y }));
    ensureStreetShops(map);
    assert.deepEqual(
      map.buildings
        .filter((building) => building.kind === "shop")
        .map(({ id, x, y }) => ({ id, x, y })),
      shopLocations,
    );
    assert.ok(map.policeLine.length >= 14);
    assert.ok(map.checkpoints.length >= 7);
    assert.ok(
      map.policeLine.filter(
        (point) =>
          Math.hypot(point.x - objective.x, point.y - objective.y) <= 60,
      ).length >= 3,
    );
    assert.ok(
      new Set(
        [...map.policeLine, ...map.checkpoints].map(
          (point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`,
        ),
      ).size >= 20,
    );
    assert.ok(map.cropRect);
    assert.ok(isWalkable(map, objective.x, objective.y, 90));
    assert.ok(
      map.labels.some((label) =>
        label.text.includes(
          map.id === "delhi" ? "JANTAR MANTAR" : "PLACE DE LA RÉPUBLIQUE",
        ),
      ),
    );
    assert.equal(map.buildings.filter((b) => b.barricade).length, 4);
    const barricades = map.buildings.filter((b) => b.barricade);
    const osmOnly = {
      ...map,
      buildings: map.buildings.filter((b) => !b.barricade),
    };
    for (const barrier of barricades) {
      assert.equal(barrier.hp, 100);
      assert.equal(barrier.maxHp, 100);
      assert.ok(isWalkable(map, barrier.x - 10, barrier.y + 9, 9));
      for (let x = 4; x < barrier.w; x += 8)
        for (const y of [2, 9, 16])
          assert.ok(isWalkable(osmOnly, barrier.x + x, barrier.y + y, 2));
      if (barrier !== barricades.at(-1))
        assert.ok(
          isWalkable(map, barrier.x + barrier.w + 15, barrier.y + 9, 9),
        );
    }
    const legacyMap = structuredClone(map);
    legacyMap.buildings = legacyMap.buildings.filter((b) => !b.barricade);
    legacyMap.policeLine = [];
    ensureObjectiveDefenses(legacyMap);
    ensureObjectiveDefenses(legacyMap);
    assert.equal(legacyMap.buildings.filter((b) => b.barricade).length, 4);
    assert.equal(legacyMap.policeLine.length, 14);
    assert.ok(map.rallyPoints.length >= 12 && map.rallyPoints.length <= 20);
    assert.ok(
      Math.max(...map.rallyPoints.map((p) => p.x)) -
        Math.min(...map.rallyPoints.map((p) => p.x)) >
        map.w / 2,
    );
    assert.ok(
      Math.max(...map.rallyPoints.map((p) => p.y)) -
        Math.min(...map.rallyPoints.map((p) => p.y)) >
        map.h / 2,
    );
    for (const p of [
      ...map.buildings.flatMap((b) => b.footprint ?? []),
      ...(map.roadWays ?? []).flatMap((r) => r.line),
    ]) {
      assert.ok(
        p.x >= map.cropRect.x - 0.02 &&
          p.x <= map.cropRect.x + map.cropRect.w + 0.02,
      );
      assert.ok(
        p.y >= map.cropRect.y - 0.02 &&
          p.y <= map.cropRect.y + map.cropRect.h + 0.02,
      );
    }
    for (const building of map.buildings) {
      if (building.barricade) continue;
      assert.ok(building.footprint && building.footprint.length >= 4);
      assert.deepEqual(building.footprint[0], building.footprint.at(-1));
      const edge = building.footprint[0];
      const pushed = collideBuildings(map, edge.x, edge.y, 9);
      assert.ok(Math.hypot(pushed.x - edge.x, pushed.y - edge.y) > 0.1);
    }
    const usableBuildings = map.buildings.filter(
      (b) => b.kind !== "wall" && b.kind !== "monument",
    );
    assert.ok(usableBuildings.length > 0);
    for (const building of usableBuildings) {
      assert.ok(
        building.entrance && building.interior,
        `${map.id} ${building.id} lacks access`,
      );
      assert.ok(isWalkable(map, building.entrance!.x, building.entrance!.y, 9));
      const interior = building.interior!;
      const room = {
        ...map,
        w: interior.w,
        h: interior.h,
        buildings: interior.obstacles.map((rect) => ({
          ...rect,
          kind: "block" as const,
          hp: 1,
          maxHp: 1,
        })),
      };
      assert.deepEqual(
        collideBuildings(room, interior.w / 2, interior.h - 24, 9),
        { x: interior.w / 2, y: interior.h - 24 },
      );
    }
    const anchors = [
      ...map.rallyPoints,
      ...map.policeLine,
      ...map.checkpoints,
      map.spawns.protester,
      map.spawns.police,
      map.spawns.military,
      map.spawns.civilian,
      map.objectivePoint!,
      map.depots.protester,
      map.depots.police,
      ...map.truckRoutes.protester,
      ...map.truckRoutes.police,
    ];
    assert.ok(
      map.policeLine.some(
        (p) => Math.hypot(p.x - objective.x, p.y - objective.y) < 180,
      ),
    );
    for (const p of anchors)
      assert.deepEqual(collideBuildings(map, p.x, p.y, 9), p);
    const world = createWorld(map.id, "protester", "Test", "test", 0, 0, 17);
    const worldBuildings = world.map.buildings.filter(
      (b) => b.kind !== "wall" && b.kind !== "monument",
    );
    for (const building of worldBuildings) {
      delete building.entrance;
      delete building.interior;
    }
    initializeWorldRules(world);
    for (const building of worldBuildings) {
      assert.ok(isWalkable(map, building.entrance!.x, building.entrance!.y, 9));
      Object.assign(world.player!, building.entrance);
      assert.equal(enterBuilding(world, world.player!, building.id!), true);
      assert.equal(exitBuilding(world, world.player!), true);
    }
    for (const entity of world.entities) {
      const p = collideBuildings(map, entity.x, entity.y, 9);
      assert.ok(Math.hypot(entity.x - p.x, entity.y - p.y) < 0.02);
    }
    const target = map.rallyPoints[0];
    const waypoint = nextWaypoint(map, world.player!, target.x, target.y);
    assert.deepEqual(
      collideBuildings(map, waypoint.x, waypoint.y, 9),
      waypoint,
    );
    for (const route of Object.values(map.truckRoutes)) {
      const mover = {
        ...world.player!,
        x: route[0].x,
        y: route[0].y,
        path: undefined,
        pathTarget: undefined,
      };
      for (
        let step = 0;
        step < 100 &&
        Math.hypot(mover.x - route.at(-1)!.x, mover.y - route.at(-1)!.y) > 3;
        step++
      ) {
        const next = nextWaypoint(map, mover, route.at(-1)!.x, route.at(-1)!.y);
        assert.ok(
          hasLineOfSight(map, mover, next),
          `${map.id} blocked truck route step ${step}`,
        );
        mover.x = next.x;
        mover.y = next.y;
      }
      assert.ok(
        Math.hypot(mover.x - route.at(-1)!.x, mover.y - route.at(-1)!.y) <= 3,
        `${map.id} depot unreachable`,
      );
    }
  }
});

test("only broken barricades stop colliding", () => {
  const map: MapDef = {
    ...MAPS.paris,
    buildings: [
      {
        id: "barricade",
        kind: "wall" as const,
        barricade: true,
        x: 100,
        y: 100,
        w: 20,
        h: 20,
        hp: 0,
        maxHp: 100,
        broken: false,
      },
    ],
  };
  assert.equal(isWalkable(map, 110, 110, 9), false);
  map.buildings[0].broken = true;
  assert.equal(isWalkable(map, 110, 110, 9), true);
  assert.deepEqual(collideBuildings(map, 110, 110, 9), { x: 110, y: 110 });

  map.buildings[0].barricade = false;
  map.buildings[0].kind = "block";
  assert.equal(isWalkable(map, 110, 110, 9), false);
});

test("polygon navigation catches thin walls without blocking collinear extensions", () => {
  const map = {
    ...MAPS.paris,
    buildings: [
      {
        id: "thin-wall",
        kind: "block" as const,
        x: 100,
        y: 100,
        w: 2,
        h: 100,
        hp: 1,
        maxHp: 1,
        footprint: [
          { x: 100, y: 100 },
          { x: 102, y: 100 },
          { x: 102, y: 200 },
          { x: 100, y: 200 },
        ],
      },
    ],
  };
  assert.equal(hasLineOfSight(map, { x: 20, y: 100 }, { x: 80, y: 100 }), true);
  assert.equal(
    hasLineOfSight(map, { x: 50, y: 150 }, { x: 150, y: 150 }),
    false,
  );
});
