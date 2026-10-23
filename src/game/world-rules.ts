import type { Entity, World, WorldEvent } from "./types";
import { collideBuildings } from "./maps";
import { hasLineOfSight } from "./navigation";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const active = (e: Entity) =>
  !e.remove && e.state !== "down" && e.state !== "detained";

export function emitEvent(
  w: World,
  type: WorldEvent["type"],
  data: Omit<Partial<WorldEvent>, "id" | "tick" | "time" | "type"> = {},
) {
  const event: WorldEvent = {
    ...data,
    id: ++w.eventSeq,
    tick: w.tick,
    time: w.time,
    type,
  };
  w.events.push(event);
  if (w.events.length > 256) w.events.shift();
  if (type !== "news") {
    const subject = w.entities.find(
      (e) => e.id === (data.targetId ?? data.actorId),
    );
    const reporter =
      subject &&
      w.entities.find(
        (e) =>
          e.journalist &&
          active(e) &&
          e.buildingId === subject.buildingId &&
          distance(e, subject) < 300 &&
          (e.buildingId || hasLineOfSight(w.map, e, subject)),
      );
    if (reporter)
      emitEvent(w, "news", {
        actorId: reporter.id,
        targetId: subject.id,
        details: type,
      });
  }
  return event;
}

export function initializeWorldRules(w: World) {
  w.factionScores ??= { protester: 0, police: 0 };
  w.events ??= [];
  w.eventSeq ??= 0;
  w.tick ??= 0;
  w.objective ??= {
    x: w.map.id === "delhi" ? 1180 : 1350,
    y: w.map.id === "delhi" ? 850 : 780,
    status: "protected",
    progress: 0,
    phaseT: 0,
    recoveryT: 0,
    cycle: 1,
    contributors: {},
    captureSeconds: 12,
    defenseSeconds: 180,
    recoverySeconds: 60,
  };
  for (const [index, shop] of w.map.buildings
    .filter((b) => b.kind === "shop")
    .slice(0, 3)
    .entries()) {
    shop.id ??= `${w.map.id}-shop-${index}`;
    shop.entrance ??=
      w.map.id === "delhi"
        ? { x: shop.x - 15, y: shop.y + shop.h / 2 }
        : { x: shop.x + shop.w / 2, y: shop.y - 15 };
    shop.interior ??= {
      w: 240,
      h: 180,
      capacity: 6,
      obstacles: [
        { x: 30, y: 30, w: 70, h: 28 },
        { x: 150, y: 30, w: 60, h: 28 },
      ],
    };
  }
  w.resources ??= ["protester", "police"].map((key) => {
    const point = w.map.depots[key as "protester" | "police"];
    return {
      id: `${key}-essentials`,
      ...point,
      food: 6,
      water: 6,
      nextRefill: w.time + 60,
    };
  });
  let journalists = 0;
  for (const e of w.entities) {
    e.hunger ??= 100;
    e.thirst ??= 100;
    e.wanted ??= 0;
    e.wantedUntil ??= 0;
    if (e.kind === "civilian" && journalists++ < 2) e.journalist = true;
  }
}

export function validDetention(w: World, target: Entity) {
  return (
    w.entities.includes(target) &&
    active(target) &&
    target.kind === "protester" &&
    target.violentT > 0
  );
}

export function markWanted(w: World, target: Entity) {
  target.wanted = Math.min(5, target.wanted + 1);
  target.wantedUntil = w.time + 90;
  if ((target.evasionRewards ?? 0) < 3) target.evasionAt ??= w.time + 60;
  emitEvent(w, "wanted", { targetId: target.id, amount: target.wanted });
}

const buildingFor = (w: World, id?: string) =>
  w.map.buildings.find((b) => b.id === id && b.interior && b.entrance);

export function insidePosition(w: World, entity: Entity, x: number, y: number) {
  const building = buildingFor(w, entity.buildingId);
  if (!building?.interior) return { x: entity.x, y: entity.y };
  const { interior } = building;
  const innerMap = {
    ...w.map,
    w: interior.w,
    h: interior.h,
    buildings: interior.obstacles.map((rect) => ({
      ...rect,
      kind: "block" as const,
      hp: 1,
      maxHp: 1,
    })),
  };
  return collideBuildings(innerMap, x, y, 9);
}

export function enterBuilding(w: World, entity: Entity, id: string): boolean {
  const building = buildingFor(w, id);
  if (
    !w.entities.includes(entity) ||
    !active(entity) ||
    entity.buildingId ||
    !building?.entrance ||
    !building.interior ||
    distance(entity, building.entrance) > 36
  )
    return false;
  const occupants = w.entities.filter((e) => !e.remove && e.buildingId === id);
  if (occupants.length >= building.interior.capacity) return false;
  entity.buildingId = id;
  entity.x = building.interior.w / 2;
  entity.y = building.interior.h - 24;
  entity.target = null;
  entity.path = undefined;
  entity.actingOn = null;
  entity.state = "idle";
  return true;
}

export function exitBuilding(w: World, entity: Entity): boolean {
  const building = buildingFor(w, entity.buildingId);
  if (
    !w.entities.includes(entity) ||
    !active(entity) ||
    !building?.entrance ||
    !building.interior ||
    distance(entity, {
      x: building.interior.w / 2,
      y: building.interior.h - 24,
    }) > 36
  )
    return false;
  Object.assign(entity, building.entrance);
  entity.buildingId = undefined;
  entity.target = null;
  entity.path = undefined;
  return true;
}

export function collectResource(w: World, entity: Entity): boolean {
  if (!w.entities.includes(entity) || !active(entity) || entity.buildingId)
    return false;
  const resource = w.resources?.find((r) => distance(r, entity) <= 40);
  if (!resource) return false;
  let used = false;
  if (resource.food > 0 && entity.hunger < 85) {
    resource.food--;
    entity.hunger = Math.min(100, entity.hunger + 40);
    used = true;
  }
  if (resource.water > 0 && entity.thirst < 85) {
    resource.water--;
    entity.thirst = Math.min(100, entity.thirst + 40);
    used = true;
  }
  if (used)
    emitEvent(w, "resource_collection", {
      actorId: entity.id,
      details: resource.id,
    });
  return used;
}

export function interactObjective(w: World, entity: Entity): boolean {
  if (
    !w.objective ||
    !w.entities.includes(entity) ||
    !active(entity) ||
    entity.kind !== "protester" ||
    entity.buildingId ||
    distance(entity, w.objective) > 65 ||
    w.objective.status === "recovering"
  )
    return false;
  entity.objectiveUntil = w.time + w.objective.captureSeconds + 3;
  return true;
}

function finishObjective(w: World, faction: "protester" | "police") {
  w.factionScores ??= { protester: 0, police: 0 };
  w.factionScores[faction]++;
  const objective = w.objective!;
  const participants = Object.entries(objective.contributors)
    .filter(([id]) =>
      w.entities.some(
        (e) => e.id === Number(id) && active(e) && e.faction === faction,
      ),
    )
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
  const humanParticipants = participants.filter(([id]) =>
    w.entities.some((e) => e.id === Number(id) && e.profileId),
  );
  const winner = humanParticipants[0];
  emitEvent(
    w,
    faction === "protester" ? "objective_capture" : "objective_defense",
    {
      actorId: winner ? Number(winner[0]) : undefined,
      faction,
      details: `cycle:${objective.cycle}`,
    },
  );
  for (const [id, amount] of participants) {
    emitEvent(w, "objective_contribution", {
      actorId: Number(id),
      amount: Math.round(amount),
      faction,
      details: `cycle:${objective.cycle}`,
    });
    if (humanParticipants.some(([humanId]) => humanId === id))
      emitEvent(w, "objective_team_reward", {
        actorId: Number(id),
        amount: 5,
        faction,
        details: `cycle:${objective.cycle}`,
      });
  }
  objective.status = "recovering";
  objective.recoveryT = objective.recoverySeconds;
  objective.progress = 0;
  objective.phaseT = 0;
  objective.contributors = {};
}

export function updateWorldRules(w: World, dt: number) {
  if (!w.objective) initializeWorldRules(w);
  for (const resource of w.resources ?? [])
    if (w.time >= resource.nextRefill) {
      resource.food = Math.min(6, resource.food + 3);
      resource.water = Math.min(6, resource.water + 3);
      resource.nextRefill = w.time + 60;
    }
  for (const e of w.entities) {
    if (!active(e) || e.kind === "truck" || e.kind === "crate") continue;
    e.hunger = Math.max(20, e.hunger - dt * 0.03);
    e.thirst = Math.max(20, e.thirst - dt * 0.05);
    if (!e.isPlayer && (e.hunger < 60 || e.thirst < 60)) collectResource(w, e);
    if (e.wanted > 0 && w.time >= e.wantedUntil) {
      e.wanted--;
      e.wantedUntil = w.time + 30;
    }
    if (e.wanted > 0 && e.evasionAt != null && w.time >= e.evasionAt) {
      const nearbyPolice = w.entities.some(
        (o) =>
          active(o) &&
          o.kind === "police" &&
          o.buildingId === e.buildingId &&
          distance(e, o) < 220,
      );
      if (nearbyPolice)
        emitEvent(w, "evasion", {
          actorId: e.id,
          amount: Math.min(5, e.wanted),
        });
      e.evasionRewards = (e.evasionRewards ?? 0) + 1;
      e.evasionAt = undefined;
    }
    if (e.buildingId && !e.isPlayer) {
      // Indoor bots rest, then leave through the same doorway.
      const building = buildingFor(w, e.buildingId)!;
      e.x = building.interior!.w / 2;
      e.y = building.interior!.h - 24;
      if (e.think <= 0) exitBuilding(w, e);
      else e.think -= dt;
    }
  }
  const objective = w.objective!;
  for (const id of Object.keys(objective.contributors))
    if (!w.entities.some((e) => e.id === Number(id) && !e.remove))
      delete objective.contributors[id];
  if (objective.status === "recovering") {
    objective.recoveryT = Math.max(0, objective.recoveryT - dt);
    if (objective.recoveryT === 0) {
      objective.status = "protected";
      objective.cycle++;
    }
    return;
  }
  const nearby = w.entities.filter(
    (e) => active(e) && !e.buildingId && distance(e, objective) <= 65,
  );
  const attackers = nearby.filter(
    (e) =>
      e.kind === "protester" &&
      (!e.isPlayer || (e.objectiveUntil ?? 0) > w.time),
  );
  const defenders = nearby.filter(
    (e) => e.kind === "police" || e.kind === "military",
  );
  objective.status =
    attackers.length && defenders.length ? "contested" : "protected";
  if (attackers.length >= 2 && defenders.length === 0) {
    objective.progress += dt;
    for (const e of attackers)
      objective.contributors[e.id] = (objective.contributors[e.id] ?? 0) + dt;
    objective.phaseT = 0;
    if (objective.progress >= objective.captureSeconds)
      finishObjective(w, "protester");
  } else {
    objective.progress = Math.max(0, objective.progress - dt);
    if (!attackers.length && defenders.length) {
      objective.phaseT += dt;
      for (const e of defenders)
        objective.contributors[e.id] = (objective.contributors[e.id] ?? 0) + dt;
      if (objective.phaseT >= objective.defenseSeconds)
        finishObjective(w, "police");
    }
  }
}

export function interactionClear(w: World, a: Entity, b: Entity): boolean {
  if (a.buildingId !== b.buildingId) return false;
  if (!a.buildingId) return !w.persistent || hasLineOfSight(w.map, a, b);
  const building = buildingFor(w, a.buildingId);
  if (!building?.interior) return false;
  const { interior } = building;
  return hasLineOfSight(
    {
      ...w.map,
      w: interior.w,
      h: interior.h,
      buildings: interior.obstacles.map((rect) => ({
        ...rect,
        kind: "block" as const,
        hp: 1,
        maxHp: 1,
      })),
    },
    a,
    b,
  );
}
