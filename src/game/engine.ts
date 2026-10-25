import { MAPS, collideBuildings } from "./maps";
import {
  emitEvent,
  initializeWorldRules,
  updateWorldRules,
  markWanted,
  validDetention,
  insidePosition,
  interactionClear,
  enterBuilding,
} from "./world-rules";
import { nextWaypoint, hasLineOfSight } from "./navigation";
import { formationSlot, rallyTarget } from "./ai";
import type {
  Entity,
  World,
  MapId,
  Role,
  InputState,
  Brain,
  Faction,
  Instrument,
} from "./types";

function random(w: World): number {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState / 4294967296;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const NAMES: Record<MapId, string[]> = {
  delhi: [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Ishaan",
    "Kabir",
    "Reyansh",
    "Ananya",
    "Diya",
    "Saanvi",
    "Myra",
    "Rohan",
    "Arjun",
    "Neha",
    "Priya",
    "Kunal",
    "Farhan",
    "Zoya",
    "Imran",
    "Gurpreet",
    "Harleen",
    "Manish",
    "Ritu",
    "Dev",
    "Tara",
    "Nikhil",
    "Pooja",
    "Sameer",
    "Aisha",
    "Vikram",
    "Meera",
    "Sanjay",
    "Kavita",
    "Rajesh",
    "Sunita",
    "Amit",
    "Deepak",
    "Rashmi",
    "Yusuf",
    "Lakshmi",
    "Om",
  ],
  paris: [
    "Louis",
    "Gabriel",
    "Raphaël",
    "Jules",
    "Adam",
    "Lucas",
    "Emma",
    "Jade",
    "Louise",
    "Alice",
    "Hugo",
    "Arthur",
    "Léa",
    "Chloé",
    "Manon",
    "Camille",
    "Nathan",
    "Enzo",
    "Sarah",
    "Inès",
    "Mathis",
    "Théo",
    "Nina",
    "Zoé",
    "Antoine",
    "Margaux",
    "Karim",
    "Aya",
    "Moussa",
    "Fatou",
    "Élise",
    "Julien",
    "Claire",
    "Bastien",
    "Amélie",
    "Olivier",
    "Nadia",
    "Sofiane",
    "Lucie",
    "Paul",
  ],
};

const CHANTS: Record<MapId, string[]> = {
  delhi: [
    "Inquilab Zindabad!",
    "Azadi!",
    "हमारा हक़ चाहिए!",
    "Peaceful protest!",
    "सुनो सरकार!",
    "We want justice!",
  ],
  paris: [
    "Liberté!",
    "On est là!",
    "Nos retraites!",
    "République debout!",
    "Égalité!",
    "Écoutez-nous!",
  ],
};

export const RANKS = ["Constable", "Head Constable", "Inspector", "Commander"];
export const MILITARY_UNLOCK = 10;

export function rankFor(detentions: number): number {
  return detentions >= 10 ? 3 : detentions >= 6 ? 2 : detentions >= 3 ? 1 : 0;
}

function brain(w: World): Brain {
  return {
    aggression: random(w),
    courage: random(w),
    discipline: 0.3 + random(w) * 0.7,
    greed: random(w),
    chattiness: random(w),
    seed: random(w) * 1000,
  };
}

export function feed(
  w: World,
  text: string,
  tone: "info" | "good" | "bad" | "market" = "info",
) {
  w.feed.unshift({ t: ++w.feedSeq, text, tone });
  if (w.feed.length > 40) w.feed.pop();
}

function makeEntity(
  w: World,
  kind: Entity["kind"],
  faction: Faction,
  x: number,
  y: number,
  name: string,
): Entity {
  return {
    hunger: 100,
    thirst: 100,
    wanted: 0,
    wantedUntil: 0,
    id: w.nextId++,
    kind,
    faction,
    name,
    x,
    y,
    dir: random(w) * Math.PI * 2,
    speed:
      kind === "military" ? 78 : kind === "police" ? 82 : 70 + random(w) * 20,
    hp: 100,
    maxHp: 100,
    state: "idle",
    stateT: 0,
    think: random(w) * 0.5,
    brain: brain(w),
    violentT: 0,
    recentThrowT: 0,
    warnedT: 0,
    stun: 0,
    detainProgress: 0,
    detainedBy: null,
    stones: 0,
    gas: 0,
    shield: false,
    sign: kind === "protester" && random(w) < 0.6,
    cooldown: 0,
    chantT: 0,
    bubble: null,
    bubbleT: 0,
    rank: 0,
    order: null,
    orderSeen: -1,
    rallyIdx: Math.floor(random(w) * 4),
    target: null,
    isPlayer: false,
    remote: false,
    skin: Math.floor(random(w) * 5),
    cloth: Math.floor(random(w) * 6),
    remove: false,
    detentionsThisRound: 0,
    lawfulShots: 0,
    everViolent: false,
    actingOn: null,
  };
}

function instruments(): Instrument[] {
  const mk = (
    id: string,
    ticker: string,
    name: string,
    desc: string,
    price: number,
  ): Instrument => ({
    id,
    ticker,
    name,
    desc,
    price,
    prev: price,
    history: Array(40).fill(price),
  });
  return [
    mk(
      "calm",
      "ORDR",
      "Public Order Index",
      "Falls as the streets heat up. Short the chaos, long the calm.",
      82,
    ),
    mk(
      "chaos",
      "CHAO",
      "Chaos Futures",
      "Tracks raw tension on the ground. Rises with violence.",
      45,
    ),
    mk(
      "glass",
      "GLAZ",
      "Glazier & Repairs Co.",
      "Broken shopfronts mean business. Rises with property damage.",
      30,
    ),
    mk(
      "media",
      "NEWS",
      "Breaking News Media",
      "Feeds on drama and volatility. More action, more viewers.",
      55,
    ),
  ];
}

export function createWorld(
  mapId: MapId,
  role: Role,
  playerName: string,
  playerId: string,
  wallet: number,
  careerDetentions: number,
  seed = 1,
  options: { persistent?: boolean } = {},
): World {
  const map = structuredClone(MAPS[mapId]);
  const w: World = {
    persistent: options.persistent ?? false,
    tick: 0,
    eventSeq: 0,
    events: [],
    rngState: seed >>> 0,
    feedSeq: 0,
    map,
    entities: [],
    projectiles: [],
    effects: [],
    gases: [],
    tension: 32,
    violenceRate: 0,
    damage: 0,
    detentions: 0,
    morale: 55,
    time: 0,
    duration: 300,
    over: false,
    overReason: "",
    role,
    playerName,
    playerId,
    player: null,
    wallet,
    careerDetentions,
    instruments: instruments(),
    holdings: {},
    bets: [],
    order: null,
    orderSeq: 0,
    feed: [],
    marketT: 0,
    nextId: 1,
    stats: {
      throws: 0,
      shots: 0,
      roeViolations: 0,
      playerDetentions: 0,
      funded: 0,
      betProfit: 0,
      tradeProfit: 0,
    },
    camX: map.spawns[role === "watcher" ? "protester" : role].x,
    camY: map.spawns[role === "watcher" ? "protester" : role].y,
    zoom: 1,
    selectedId: null,
    commandMode: false,
    lastSync: 0,
    earned: 0,
  };
  const names = [...NAMES[mapId]];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(random(w) * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  let ni = 0;
  const nextName = () => names[ni++ % names.length];
  // crowd
  for (let i = 0; i < 34; i++) {
    const rallyIdx = i % map.rallyPoints.length;
    const p = map.rallyPoints[rallyIdx];
    const e = makeEntity(
      w,
      "protester",
      "protester",
      p.x + (random(w) - 0.5) * 160,
      p.y + (random(w) - 0.5) * 110,
      nextName(),
    );
    e.rallyIdx = rallyIdx;
    e.brain.aggression = clamp(e.brain.aggression * 0.9 + 0.05, 0, 1);
    w.entities.push(e);
  }
  for (let i = 0; i < 14; i++) {
    const p = map.policeLine[i % map.policeLine.length];
    const e = makeEntity(
      w,
      "police",
      "police",
      p.x + (random(w) - 0.5) * 50,
      p.y + (random(w) - 0.5) * 50,
      nextName(),
    );
    e.rank = i === 0 ? 3 : i < 3 ? 2 : i < 7 ? 1 : 0;
    e.shield = i % 3 === 0;
    w.entities.push(e);
  }
  for (let i = 0; i < 4; i++) {
    const p = map.checkpoints[i % map.checkpoints.length];
    const e = makeEntity(
      w,
      "military",
      "military",
      p.x + (random(w) - 0.5) * 60,
      p.y + (random(w) - 0.5) * 60,
      nextName(),
    );
    e.brain.discipline = 0.9;
    w.entities.push(e);
  }
  for (let i = 0; i < 10; i++) {
    const s = map.spawns.civilian;
    w.entities.push(
      makeEntity(
        w,
        "civilian",
        "civilian",
        s.x + (random(w) - 0.5) * 500,
        s.y + (random(w) - 0.5) * 300,
        nextName(),
      ),
    );
  }
  if (role !== "watcher") {
    const s = map.spawns[role];
    const p = makeEntity(w, role, role, s.x, s.y, playerName);
    p.isPlayer = true;
    p.speed = 110;
    p.rank = rankFor(careerDetentions);
    p.sign = role === "protester";
    if (role === "protester") p.stones = 3;
    w.entities.push(p);
    w.player = p;
  }
  feed(
    w,
    `Live from ${map.name} — ${map.country}. Crowd is gathering.`,
    "info",
  );
  feed(
    w,
    role === "military"
      ? "RULES OF ENGAGEMENT: fire only at ACTIVE violent threats (red ⚠). Warning shot first."
      : "Round started. 5 minutes on the clock.",
    "info",
  );
  for (const e of w.entities)
    Object.assign(e, collideBuildings(map, e.x, e.y, 9));
  if (w.persistent) initializeWorldRules(w);
  return w;
}

/* ---------------- movement ---------------- */
function moveTo(
  w: World,
  e: Entity,
  tx: number,
  ty: number,
  speed: number,
  dt: number,
): boolean {
  if (Math.hypot(tx - e.x, ty - e.y) < 6) return true;
  const waypoint = nextWaypoint(w.map, e, tx, ty);
  const dx = waypoint.x - e.x,
    dy = waypoint.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return false;
  e.dir = Math.atan2(dy, dx);
  const step = Math.min(d, speed * dt);
  const nx = e.x + (dx / d) * step,
    ny = e.y + (dy / d) * step;
  const p = collideBuildings(w.map, nx, ny, 9);
  e.moving = Math.hypot(p.x - e.x, p.y - e.y) > 0.01;
  e.running = e.moving && speed > e.speed;
  e.x = p.x;
  e.y = p.y;
  return Math.hypot(tx - e.x, ty - e.y) < 12;
}

function say(e: Entity, text: string, dur = 2.4) {
  e.bubble = text;
  e.bubbleT = dur;
}

function fx(
  w: World,
  kind: "smoke" | "flash" | "ring" | "text" | "siren",
  x: number,
  y: number,
  dur: number,
  text?: string,
  color?: string,
  r?: number,
) {
  w.effects.push({ kind, x, y, t: 0, dur, text, color, r });
}

function nearest(
  w: World,
  e: Entity,
  pred: (o: Entity) => boolean,
  maxD = Infinity,
  targetId?: number,
): Entity | null {
  if (targetId !== undefined) {
    const target = w.entities.find((o) => o.id === targetId);
    return target &&
      target.id !== e.id &&
      !target.remove &&
      target.buildingId === e.buildingId &&
      target.state !== "down" &&
      target.state !== "detained" &&
      target.kind !== "truck" &&
      target.kind !== "crate" &&
      pred(target) &&
      dist(e, target) <= maxD
      ? target
      : null;
  }
  let best: Entity | null = null,
    bd = maxD;
  for (const o of w.entities) {
    if (
      o.id === e.id ||
      o.remove ||
      o.buildingId !== e.buildingId ||
      o.state === "down" ||
      o.state === "detained" ||
      o.kind === "truck" ||
      o.kind === "crate"
    )
      continue;
    if (!pred(o)) continue;
    const d = dist(e, o);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/* ---------------- core events ---------------- */
function detain(w: World, cop: Entity, target: Entity) {
  if (
    target.remove ||
    cop.remove ||
    cop.state === "down" ||
    cop.state === "detained" ||
    !interactionClear(w, cop, target) ||
    dist(cop, target) > 52 ||
    target.state === "down" ||
    target.state === "detained" ||
    target.detainedBy != null
  )
    return;
  if (w.persistent && !validDetention(w, target)) {
    emitEvent(w, "unjustified_detention", {
      actorId: cop.id,
      targetId: target.id,
      amount: -10,
    });
    target.detainProgress = 0;
    target.detainOfficer = null;
    return;
  }
  if (w.persistent) {
    target.custodyUntil = w.time + 20;
    if (target.buildingId) {
      const doorway = w.map.buildings.find(
        (b) => b.id === target.buildingId,
      )?.entrance;
      if (doorway) Object.assign(target, doorway);
      target.buildingId = undefined;
    }
    emitEvent(w, "detention", {
      actorId: cop.id,
      targetId: target.id,
      amount: 10,
    });
  }
  target.detainProgress = 0;
  target.stateT = 0;
  target.state = "detained";
  target.detainedBy = cop.id;
  target.violentT = 0;
  target.stun = 0;
  w.detentions++;
  cop.detentionsThisRound++;
  w.morale = clamp(w.morale - 2.5, 0, 100);
  w.tension = clamp(w.tension + 1.5, 0, 100);
  fx(w, "ring", target.x, target.y, 0.6, undefined, "#4da3ff");
  fx(w, "text", target.x, target.y - 20, 1.4, "DETAINED", "#4da3ff");
  if (cop.isPlayer) {
    w.stats.playerDetentions++;
    w.careerDetentions++;
    w.earned += 40;
    if (!w.persistent) cop.rank = rankFor(w.careerDetentions);
    feed(
      w,
      `You detained ${target.name}. +40₿ · Career: ${w.careerDetentions}${w.careerDetentions === MILITARY_UNLOCK ? " — MILITARY UNLOCKED!" : ""}`,
      "good",
    );
    if (w.careerDetentions === MILITARY_UNLOCK)
      fx(w, "text", cop.x, cop.y - 34, 3, "★ MILITARY UNLOCKED ★", "#ffd75e");
  } else {
    feed(w, `${RANKS[cop.rank]} ${cop.name} detained ${target.name}.`, "info");
  }
}

function throwStone(w: World, e: Entity, tx: number, ty: number) {
  if (Math.hypot(tx - e.x, ty - e.y) < 1) {
    tx = e.x + Math.cos(e.dir) * 160;
    ty = e.y + Math.sin(e.dir) * 160;
  }
  if (w.persistent) markWanted(w, e);
  e.violentT = 8;
  e.recentThrowT = 3;
  e.everViolent = true;
  e.cooldown = 2.5 + random(w) * 2.5;
  e.state = "throw";
  e.stateT = 0.4;
  w.stats.throws++;
  w.projectiles.push({
    x: e.x,
    y: e.y,
    sx: e.x,
    sy: e.y,
    tx,
    ty,
    t: 0,
    dur: clamp(dist(e, { x: tx, y: ty }) / 320, 0.35, 0.9),
    kind: "stone",
    from: e.id,
  });
  w.tension = clamp(w.tension + 2, 0, 100);
  w.violenceRate += 1;
  if (e.isPlayer) w.earned += 5;
}

function fireBullet(
  w: World,
  shooter: Entity,
  target: Entity,
  lawful: boolean,
) {
  shooter.cooldown = 1.6;
  shooter.dir = Math.atan2(target.y - shooter.y, target.x - shooter.x);
  w.stats.shots++;
  w.projectiles.push({
    x: shooter.x,
    y: shooter.y,
    sx: shooter.x,
    sy: shooter.y,
    tx: target.x,
    ty: target.y,
    t: 0,
    dur: 0.12,
    kind: "bullet",
    from: shooter.id,
    targetId: target.id,
  });
  fx(
    w,
    "flash",
    shooter.x + Math.cos(shooter.dir) * 16,
    shooter.y + Math.sin(shooter.dir) * 16,
    0.15,
  );
  w.tension = clamp(w.tension + (lawful ? 6 : 14), 0, 100);
  w.violenceRate += 2;
  if (lawful) {
    shooter.lawfulShots++;
    if (shooter.isPlayer) {
      w.earned += 25;
      feed(
        w,
        `Lawful engagement on ${target.name} (active threat). +25₿`,
        "good",
      );
    }
  } else {
    w.stats.roeViolations++;
    if (shooter.isPlayer) {
      w.wallet = Math.max(0, w.wallet - 150);
      feed(
        w,
        `⚖ ROE VIOLATION — ${target.name} was not an active threat. Fined 150₿.`,
        "bad",
      );
      fx(
        w,
        "text",
        shooter.x,
        shooter.y - 30,
        2.5,
        "ROE VIOLATION −150₿",
        "#ff5d5d",
      );
    }
  }
}

export function roeValid(w: World, shooter: Entity, t: Entity): boolean {
  return (
    (!w.persistent || (t.imminentThreatUntil ?? 0) > w.time) &&
    shooter.buildingId === t.buildingId &&
    (!w.persistent || hasLineOfSight(w.map, shooter, t)) &&
    w.tension > 55 &&
    !t.remove &&
    t.warnedT > 0 &&
    dist(shooter, t) <= 240 &&
    t.kind === "protester" &&
    t.violentT > 0 &&
    t.recentThrowT > 0 &&
    t.state !== "detained" &&
    t.state !== "down"
  );
}

function deployGas(w: World, e: Entity, tx: number, ty: number) {
  e.gas--;
  e.cooldown = 4;
  w.projectiles.push({
    x: e.x,
    y: e.y,
    sx: e.x,
    sy: e.y,
    tx,
    ty,
    t: 0,
    dur: 0.7,
    kind: "gascan",
    from: e.id,
  });
  say(e, "Tear gas out!");
}

export function spawnSupply(w: World, faction: "protester" | "police") {
  if (
    w.entities.filter((e) => e.kind === "truck" || e.kind === "crate").length >=
    20
  )
    return;
  const route = w.map.truckRoutes[faction];
  const start = collideBuildings(w.map, route[0].x, route[0].y, 9);
  const t = makeEntity(
    w,
    "truck",
    faction,
    start.x,
    start.y,
    faction === "police" ? "Supply Van" : "Pickup Truck",
  );
  t.truckFaction = faction;
  t.truckPath = [...route];
  t.truckIdx = 1;
  t.state = "drive";
  t.speed = 170;
  w.entities.push(t);
  feed(
    w,
    `🚚 ${faction === "police" ? "Police" : "Protester"} supply truck en route to the ${faction} depot.`,
    "market",
  );
}

/* ---------------- brains ---------------- */
function updateProtester(w: World, e: Entity, dt: number) {
  if (e.isPlayer || e.remote) return;
  const b = e.brain;
  // fear response
  const gasHere = w.gases.find((g) => dist(g, e) < g.r);
  const threat = nearest(
    w,
    e,
    (o) =>
      (o.kind === "police" && o.state === "engage") ||
      (o.kind === "military" && e.warnedT > 0),
    110,
  );
  if (
    (gasHere || (threat && random(w) < (1 - b.courage) * 0.1)) &&
    e.state !== "flee"
  ) {
    e.state = "flee";
    e.stateT = 2.5 + random(w) * 2;
  }
  if (e.state === "flee") {
    if (w.persistent) {
      const shelter = w.map.buildings.find(
        (b) => b.entrance && b.id && dist(e, b.entrance) < 36,
      );
      if (shelter?.id && enterBuilding(w, e, shelter.id)) {
        e.think = 10;
        return;
      }
    }
    e.stateT -= dt;
    const s = w.map.spawns.protester;
    moveTo(w, e, s.x + (b.seed % 200) - 100, s.y, e.speed * 1.35, dt);
    if (e.stateT <= 0) e.state = "march";
    return;
  }
  if (w.tension >= 55) {
    const human = nearest(
      w,
      e,
      (o) => o.kind === "protester" && o.isPlayer && o.state !== "flee",
      260,
    );
    if (human) {
      e.target = rallyTarget(e, human, 90, w.time);
      e.state = "march";
      moveTo(w, e, e.target.x, e.target.y, e.speed, dt);
      return;
    }
  }
  if (e.brain.discipline >= 0.65 && e.violentT <= 0) {
    const points = w.map.rallyPoints;
    if (points.length === 0) return;
    if (e.rallyIdx >= points.length) {
      e.rallyIdx = 0;
      e.target = null;
    }
    const target = e.target;
    if (!target || dist(e, target) < 24) {
      if (e.target) e.rallyIdx = (e.rallyIdx + 1) % points.length;
      const rally = points[e.rallyIdx];
      const target = rallyTarget(e, rally, 65, 0);
      e.target = collideBuildings(w.map, target.x, target.y, 9);
    }
    e.state = "march";
    const destination = e.target;
    if (destination) moveTo(w, e, destination.x, destination.y, e.speed, dt);
    return;
  }
  e.think -= dt;
  if (e.think > 0) {
    if (e.state === "march" && e.target)
      moveTo(w, e, e.target.x, e.target.y, e.speed, dt);
    return;
  }
  e.think = 0.35 + random(w) * 0.3;
  // decide violence
  const violenceP =
    b.aggression *
    (1 - b.discipline) *
    (w.tension / 100) *
    (0.12 + (e.stones > 0 ? 0.25 : 0) + w.morale / 500);
  if (e.violentT <= 0 && e.cooldown <= 0 && random(w) < violenceP) {
    // aim at nearest intact shop or nearest police
    let tgt: { x: number; y: number } | null = null;
    const cop = nearest(
      w,
      e,
      (o) => o.kind === "police" || o.kind === "military",
      300,
    );
    let bd = Infinity;
    for (const s of w.map.buildings) {
      if (s.kind !== "shop" || s.broken) continue;
      const c = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      const d = dist(e, c);
      if (d < bd && d < 420) {
        bd = d;
        tgt = c;
      }
    }
    if (!tgt && cop) tgt = { x: cop.x, y: cop.y };
    if (tgt) {
      throwStone(
        w,
        e,
        tgt.x + (random(w) - 0.5) * 30,
        tgt.y + (random(w) - 0.5) * 30,
      );
      if (b.chattiness > 0.6)
        say(e, random(w) < 0.5 ? "Take that!" : "Back off!");
      return;
    }
  }
  // chant near rally
  const rally = w.map.rallyPoints[e.rallyIdx % w.map.rallyPoints.length];
  if (dist(e, rally) < 90 && random(w) < b.chattiness * 0.25 && e.chantT <= 0) {
    e.state = "chant";
    e.chantT = 6 + random(w) * 6;
    say(e, CHANTS[w.map.id][Math.floor(random(w) * CHANTS[w.map.id].length)]);
    w.morale = clamp(w.morale + 0.8, 0, 100);
    w.tension = clamp(w.tension + 0.3, 0, 100);
    return;
  }
  // march between rally points
  if (random(w) < 0.3) e.rallyIdx = (e.rallyIdx + 1) % w.map.rallyPoints.length;
  const rp = w.map.rallyPoints[e.rallyIdx % w.map.rallyPoints.length];
  e.target = rallyTarget(e, rp, 100, w.time);
  e.state = "march";
}

function updatePolice(w: World, e: Entity, dt: number) {
  if (e.isPlayer || e.remote) return;
  const b = e.brain;
  // detention channel in progress
  if (e.state === "detain" && e.actingOn != null) {
    const t = w.entities.find((o) => o.id === e.actingOn);
    if (
      !t ||
      t.remove ||
      t.state === "detained" ||
      t.state === "down" ||
      !interactionClear(w, e, t) ||
      dist(e, t) > 48
    ) {
      e.state = "idle";
      e.actingOn = null;
    } else {
      e.dir = Math.atan2(t.y - e.y, t.x - e.x);
      if (t.detainOfficer != null && t.detainOfficer !== e.id) return;
      t.detainOfficer = e.id;
      t.detainProgress += dt * (0.9 + e.rank * 0.15);
      if (t.detainProgress >= 1.2) {
        detain(w, e, t);
        e.state = "idle";
        e.actingOn = null;
      }
      return;
    }
  }
  e.think -= dt;
  if (e.think > 0) {
    if (e.order) moveTo(w, e, e.order.x, e.order.y, e.speed, dt);
    return;
  }
  e.think = 0.3 + random(w) * 0.25;
  // follow player orders per discipline & rank hierarchy
  if (w.order && w.order.t > 0 && e.orderSeen !== w.order.id) {
    e.orderSeen = w.order.id;
    e.order = null;
    const allowed = 4 + playerRank(w) * 3;
    const obeyers = w.entities
      .filter(
        (o) =>
          o.kind === "police" &&
          !o.isPlayer &&
          !o.remote &&
          !o.remove &&
          o.state !== "down" &&
          o.state !== "detained",
      )
      .sort((a, c) => c.rank - a.rank)
      .slice(0, allowed);
    if (
      obeyers.some((o) => o.id === e.id) &&
      random(w) < 0.4 + b.discipline * 0.6
    ) {
      e.order = formationSlot(w.order, obeyers, e);
      if (e.rank >= 2 && b.chattiness > 0.5) say(e, "Moving!");
    }
  }
  if (w.order && w.order.t <= 0) e.order = null;
  let assigned = w.entities.find(
    (o) => o.id === e.policeTaskTargetId && !o.remove,
  );
  if (
    !assigned ||
    assigned.kind !== "protester" ||
    assigned.wanted <= 0 ||
    assigned.state === "down" ||
    assigned.state === "detained"
  ) {
    e.policeTaskTargetId = undefined;
    assigned = undefined;
  }
  if (assigned) {
    e.order = null;
    if (w.order) e.orderSeen = w.order.id;
  }
  if (assigned && assigned.violentT <= 0) {
    const targetBuilding = assigned.buildingId
      ? w.map.buildings.find((building) => building.id === assigned.buildingId)
      : undefined;
    const point = assigned.buildingId ? targetBuilding?.entrance : assigned;
    if (!point) e.policeTaskTargetId = undefined;
    else {
      const d = dist(e, point);
      if (d > 72) {
        e.state = "patrol";
        moveTo(w, e, point.x, point.y, e.speed, dt);
      } else {
        e.state = "idle";
        e.dir = Math.atan2(point.y - e.y, point.x - e.x);
      }
      return;
    }
  }
  // engage violent protester nearby
  const violent = assigned?.violentT
    ? assigned
    : nearest(
        w,
        e,
        (o) =>
          o.kind === "protester" && o.violentT > 0 && o.state !== "detained",
        140,
      );
  if (violent) {
    const d = dist(e, violent);
    if (d < 36 && e.cooldown <= 0) {
      // baton
      e.state = "engage";
      e.cooldown = 1.4;
      violent.stun = Math.max(violent.stun, 1.1);
      violent.hp -= e.shield ? 8 : 12;
      w.tension = clamp(w.tension + 0.8, 0, 100);
      fx(w, "ring", violent.x, violent.y, 0.3, undefined, "#8fb7ff");
      if (violent.hp <= 0) downEntity(w, violent);
    } else if (
      d < 40 &&
      violent.violentT > 0 &&
      random(w) < 0.5 + b.discipline * 0.4
    ) {
      e.state = "detain";
      e.actingOn = violent.id;
      return;
    } else if (d >= 36) {
      e.state = "engage";
      moveTo(w, e, violent.x, violent.y, e.speed * 1.15, dt);
      return;
    }
  } else if (e.state === "engage") e.state = "idle";
  // opportunistic detain when tension high
  if (!w.persistent && w.tension > 62) {
    const hot = nearest(
      w,
      e,
      (o) =>
        o.kind === "protester" &&
        o.brain.aggression > 0.72 &&
        o.state !== "detained" &&
        o.violentT <= 0,
      42,
    );
    if (hot && random(w) < 0.4) {
      e.state = "detain";
      e.actingOn = hot.id;
      return;
    }
  }
  // gas deployment
  if (e.gas > 0 && e.cooldown <= 0 && w.tension > 70) {
    const crowd = w.entities.filter(
      (o) =>
        o.kind === "protester" &&
        o.state !== "down" &&
        o.state !== "detained" &&
        dist(o, e) < 150,
    );
    if (crowd.length >= 5) {
      const cx = crowd.reduce((s, o) => s + o.x, 0) / crowd.length;
      const cy = crowd.reduce((s, o) => s + o.y, 0) / crowd.length;
      deployGas(w, e, cx, cy);
      return;
    }
  }
  // gas avoidance for non-shielded
  const g = w.gases.find((gg) => dist(gg, e) < gg.r);
  if (g && !e.shield) {
    moveTo(w, e, e.x + (e.x - g.x) * 2, e.y + (e.y - g.y) * 2, e.speed, dt);
    return;
  }
  // orders / commander plan / line
  if (e.order) {
    moveTo(w, e, e.order.x, e.order.y, e.speed, dt);
    return;
  }
  const cops = w.entities.filter((o) => o.kind === "police" && !o.remove);
  const idx = cops.findIndex((o) => o.id === e.id);
  if (w.tension > 66) {
    // commander logic: push toward violent cluster
    const vs = w.entities.filter(
      (o) => o.kind === "protester" && o.violentT > 0 && o.state !== "detained",
    );
    if (vs.length > 0) {
      const cx = vs.reduce((s, o) => s + o.x, 0) / vs.length;
      const cy = vs.reduce((s, o) => s + o.y, 0) / vs.length;
      moveTo(
        w,
        e,
        cx + ((idx % 5) - 2) * 30,
        cy + 60 + Math.floor(idx / 5) * 26,
        e.speed * 0.9,
        dt,
      );
      return;
    }
  }
  const lp = w.map.policeLine[idx % w.map.policeLine.length];
  moveTo(w, e, lp.x, lp.y, e.speed * 0.8, dt);
  e.state = "patrol";
}

function updateMilitary(w: World, e: Entity, dt: number) {
  if (e.isPlayer || e.remote) return;
  e.think -= dt;
  if (e.think > 0) {
    if (e.target) moveTo(w, e, e.target.x, e.target.y, e.speed * 0.7, dt);
    return;
  }
  e.think = 0.35 + random(w) * 0.3;
  const target = nearest(
    w,
    e,
    (o) => o.kind === "protester" && o.violentT > 0 && o.state !== "detained",
    260,
  );
  if (target) {
    e.target = null;
    e.dir = Math.atan2(target.y - e.y, target.x - e.x);
    if (w.tension > 55 && target.recentThrowT > 0 && dist(e, target) <= 240) {
      if (target.warnedT <= 0) {
        // warning first — strict ROE
        fx(w, "flash", e.x + Math.cos(e.dir) * 18, e.y - 20, 0.2);
        say(e, w.map.id === "delhi" ? "रुको! Warning!" : "Halte! Warning!");
        for (const o of w.entities)
          if (o.kind === "protester" && dist(o, e) < 220) o.warnedT = 4;
        e.cooldown = 1.5;
        w.tension = clamp(w.tension + 2, 0, 100);
      } else if (e.cooldown <= 0 && roeValid(w, e, target)) {
        fireBullet(w, e, target, true);
      }
    }
    return;
  }
  // patrol checkpoints
  const cp =
    w.map.checkpoints[
      (e.id + Math.floor(w.time / 12)) % w.map.checkpoints.length
    ];
  e.target = {
    x: cp.x + ((e.brain.seed % 60) - 30),
    y: cp.y + ((e.brain.seed % 40) - 20),
  };
  moveTo(w, e, e.target.x, e.target.y, e.speed * 0.7, dt);
  e.state = "patrol";
}

function updateCivilian(w: World, e: Entity, dt: number) {
  e.think -= dt;
  const danger = nearest(
    w,
    e,
    (o) => (o.kind === "protester" && o.violentT > 0) || o.kind === "military",
    120,
  );
  const g = w.gases.find((gg) => dist(gg, e) < gg.r);
  if ((danger || g) && e.state !== "flee") {
    e.state = "flee";
    e.stateT = 3;
  }
  if (e.state === "flee") {
    if (w.persistent) {
      const shelter = w.map.buildings.find(
        (b) => b.entrance && b.id && dist(e, b.entrance) < 36,
      );
      if (shelter?.id && enterBuilding(w, e, shelter.id)) {
        e.think = 10;
        return;
      }
    }
    e.stateT -= dt;
    if (e.target) moveTo(w, e, e.target.x, e.target.y, e.speed * 1.5, dt);
    else {
      e.target = {
        x: clamp(e.x + (random(w) - 0.5) * 600, 40, w.map.w - 40),
        y: clamp(e.y + (random(w) - 0.5) * 600, 40, w.map.h - 40),
      };
    }
    if (e.stateT <= 0) {
      e.state = "wander";
      e.target = null;
    }
    return;
  }
  if (e.think > 0) {
    if (e.target) moveTo(w, e, e.target.x, e.target.y, e.speed * 0.6, dt);
    return;
  }
  e.think = 1 + random(w) * 2;
  // inspired to join?
  if (w.morale > 70 && e.brain.courage > 0.8 && random(w) < 0.1) {
    e.kind = "protester";
    e.faction = "protester";
    e.sign = true;
    say(e, "I'm joining!");
    feed(w, `${e.name} (civilian) joined the protest.`, "info");
    return;
  }
  if (random(w) < 0.3 && e.brain.chattiness > 0.7)
    say(e, w.map.id === "delhi" ? "What's happening?" : "C'est quoi ce bruit?");
  e.target = {
    x: clamp(e.x + (random(w) - 0.5) * 400, 40, w.map.w - 40),
    y: clamp(e.y + (random(w) - 0.5) * 400, 40, w.map.h - 40),
  };
}

function downEntity(w: World, e: Entity) {
  if (e.state === "down") return;
  e.state = "down";
  e.stateT = w.persistent ? 30 : 8;
  if (w.persistent) {
    e.deathUntil = w.time + 30;
    emitEvent(w, "death", { targetId: e.id });
  }
  e.violentT = 0;
  w.tension = clamp(w.tension + 16, 0, 100);
  w.violenceRate += 3;
  feed(w, `🚑 ${e.name} is down. The crowd is furious.`, "bad");
  if (e.isPlayer) {
    feed(
      w,
      w.persistent
        ? "You are down. Choose a new role after the 30-second recovery period."
        : "You were taken down. Respawning at your spawn point…",
      "bad",
    );
  }
}

function updateTruck(w: World, e: Entity, dt: number) {
  if (e.state === "drive" && e.truckPath) {
    const p = e.truckPath[e.truckIdx!];
    const dx = p.x - e.x,
      dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    e.dir = Math.atan2(dy, dx);
    if (d < 12) {
      e.truckIdx!++;
      if (e.truckIdx! >= e.truckPath.length) {
        e.state = "unload";
        e.stateT = 3;
        fx(w, "ring", e.x, e.y, 1, undefined, "#ffd75e");
      }
    } else {
      // shortcut: vehicles use person-sized clearance; expand footprints before vehicle combat.
      moveTo(w, e, p.x, p.y, e.speed, dt);
    }
  } else if (e.state === "unload") {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      const dep = w.map.depots[e.truckFaction!];
      for (
        let i = 0;
        i < 4 && w.entities.filter((o) => o.kind === "crate").length < 20;
        i++
      ) {
        const c = makeEntity(
          w,
          "crate",
          e.truckFaction!,
          dep.x + (random(w) - 0.5) * 90,
          dep.y + (random(w) - 0.5) * 70,
          "Supplies",
        );
        Object.assign(c, collideBuildings(w.map, c.x, c.y, 9));
        c.crateFaction = e.truckFaction;
        w.entities.push(c);
      }
      emitEvent(w, "supply_delivery", {
        actorId: e.id,
        faction: e.truckFaction,
        amount: 4,
      });
      feed(
        w,
        `📦 ${e.truckFaction === "police" ? "Police" : "Protester"} supplies delivered at the depot — grab a crate!`,
        "good",
      );
      fx(w, "text", dep.x, dep.y - 30, 2.5, "SUPPLIES HERE!", "#ffd75e");
      e.remove = true;
    }
  }
}

/* ---------------- player rank / actions ---------------- */
export function playerRank(w: World): number {
  return rankFor(w.careerDetentions);
}

export function doAction(
  w: World,
  action: "primary" | "secondary" | "special",
  targetId?: number,
) {
  const p = w.player;
  if (
    !p ||
    p.remove ||
    w.over ||
    p.state === "down" ||
    p.state === "detained" ||
    p.stun > 0
  )
    return;
  if (p.buildingId && action !== "primary") return;
  if (p.kind === "protester") {
    if (action === "primary") {
      if (p.cooldown > 0) return;
      p.cooldown = 2;
      // chant
      p.chantT = 4;
      say(
        p,
        CHANTS[w.map.id][Math.floor(random(w) * CHANTS[w.map.id].length)],
        2.5,
      );
      w.morale = clamp(w.morale + 4, 0, 100);
      w.tension = clamp(w.tension + 1, 0, 100);
      w.earned += 2;
      if (w.persistent) emitEvent(w, "chant", { actorId: p.id, amount: 1 });
      fx(w, "ring", p.x, p.y, 0.8, undefined, "#ffb14d");
    } else if (action === "secondary") {
      if (p.stones > 0 && p.cooldown <= 0) {
        p.stones--;
        const aim = p.target ?? { x: w.camX, y: w.camY };
        throwStone(w, p, aim.x, aim.y);
        feed(
          w,
          `You threw a stone. You are now flagged VIOLENT — police & military may engage.`,
          "bad",
        );
      } else if (p.cooldown <= 0) {
        say(p, "No stones. Grab supplies from a crate.", 2);
        w.tension = clamp(w.tension + 1.5, 0, 100);
        w.morale = clamp(w.morale + 2, 0, 100);
        p.cooldown = 1.5;
      }
    }
  } else if (p.kind === "police") {
    if (action === "primary") {
      const t = nearest(
        w,
        p,
        (o) =>
          o.kind === "protester" &&
          o.state !== "down" &&
          o.state !== "detained" &&
          (w.persistent
            ? validDetention(w, o)
            : o.violentT > 0 || (w.tension > 60 && o.brain.aggression > 0.65)),
        44,
        targetId,
      );
      if (t) {
        p.state = "detain";
        p.actingOn = t.id;
        say(p, "You're coming with me.", 1.6);
      } else
        feed(
          w,
          "No detainable target in reach (need a violent or high-risk protester within reach).",
          "info",
        );
    } else if (action === "secondary" && p.cooldown <= 0) {
      const t = nearest(
        w,
        p,
        (o) =>
          o.kind === "protester" &&
          o.state !== "down" &&
          o.state !== "detained",
        50,
        targetId,
      );
      if (t) {
        p.cooldown = 1.2;
        t.stun = 1.4;
        t.hp -= 12;
        w.tension = clamp(w.tension + 1, 0, 100);
        fx(w, "ring", t.x, t.y, 0.3, undefined, "#8fb7ff");
        if (t.hp <= 0) downEntity(w, t);
      }
    } else if (action === "special") {
      if (p.gas > 0 && p.cooldown <= 0 && p.target)
        deployGas(w, p, p.target.x, p.target.y);
      else
        feed(
          w,
          p.gas > 0
            ? "On cooldown."
            : "No tear gas. Fund the police or grab a supply crate.",
          "info",
        );
    }
  } else if (p.kind === "military") {
    if (action === "primary" && p.cooldown <= 0) {
      const t = nearest(w, p, (o) => roeValid(w, p, o), 240, targetId);
      if (!t) {
        feed(w, "No target in range (240).", "info");
        return;
      }
      if (!roeValid(w, p, t)) {
        feed(
          w,
          "Fire withheld: warn an active recent threat within range and tension above 55.",
          "info",
        );
        return;
      }
      fireBullet(w, p, t, true);
    } else if (action === "secondary" && p.cooldown <= 0) {
      // warning shot
      fx(w, "flash", p.x, p.y - 22, 0.25);
      say(p, w.map.id === "delhi" ? "रुको! WARNING!" : "HALTE! WARNING!", 2);
      for (const o of w.entities) {
        if (
          !o.remove &&
          o.state !== "down" &&
          o.state !== "detained" &&
          o.kind === "protester" &&
          dist(o, p) < 220
        ) {
          o.warnedT = 4;
          if (random(w) < 0.5 + (1 - o.brain.courage) * 0.4) {
            o.state = "flee";
            o.stateT = 2.5;
          }
        }
      }
      w.tension = clamp(w.tension + 2, 0, 100);
      p.cooldown = 1;
    }
  }
}

export function issueOrder(
  w: World,
  x: number,
  y: number,
  mode: "move" | "hold" | "line",
) {
  if (
    w.over ||
    !w.player ||
    w.player.remove ||
    w.player.state === "down" ||
    w.player.state === "detained" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    (w.role !== "police" && w.role !== "military")
  )
    return;
  ({ x, y } = collideBuildings(w.map, x, y, 9));
  w.order = { id: ++w.orderSeq, x, y, mode, t: 22, issuer: w.playerName };
  fx(w, "siren", x, y, 22, mode.toUpperCase(), "#4da3ff");
  const n = 4 + playerRank(w) * 3;
  feed(
    w,
    `📣 ${RANKS[playerRank(w)]} ${w.playerName} ordered ${mode.toUpperCase()} — up to ${n} officers will comply.`,
    "good",
  );
}

/* ---------------- market & bets ---------------- */
export function buy(w: World, id: string, qty: number) {
  if (w.over || !Number.isSafeInteger(qty) || qty === 0 || Math.abs(qty) > 1000)
    return;
  const ins = w.instruments.find((i) => i.id === id);
  if (!ins) return;
  const cost = ins.price * qty;
  if (qty > 0 && w.wallet < cost) {
    feed(w, "Not enough coins.", "bad");
    return;
  }
  if (qty < 0 && (w.holdings[id] ?? 0) < -qty) return;
  w.wallet -= cost;
  w.holdings[id] = (w.holdings[id] ?? 0) + qty;
  w.stats.tradeProfit -= cost;
  ins.price = clamp(ins.price + qty * 0.15, 3, 400);
}

export function portfolioValue(w: World): number {
  return w.instruments.reduce(
    (s, i) => s + (w.holdings[i.id] ?? 0) * i.price,
    0,
  );
}

export function fund(
  w: World,
  faction: "protester" | "police",
  amount: number,
) {
  if (
    !["protester", "police"].includes(faction) ||
    w.over ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    w.entities.filter((e) => e.kind === "truck" || e.kind === "crate").length >=
      20
  )
    return;
  if (w.wallet < amount) {
    feed(w, "Not enough coins to fund.", "bad");
    return;
  }
  w.wallet -= amount;
  w.stats.funded += amount;
  spawnSupply(w, faction);
  if (faction === "protester") w.morale = clamp(w.morale + amount / 40, 0, 100);
}

export function betOdds(
  w: World,
  type: "free60" | "detain60" | "violent60",
): number {
  const t = w.tension / 100;
  if (type === "free60") return Math.round((1.3 + t * 1.6) * 100) / 100;
  if (type === "detain60") return Math.round((2.6 - t * 1.2) * 100) / 100;
  return Math.round((2.8 - t * 1.5) * 100) / 100;
}

export function placeBet(
  w: World,
  entityId: number,
  type: Bet["type"],
  stake: number,
) {
  if (
    w.over ||
    !Number.isSafeInteger(stake) ||
    stake <= 0 ||
    w.bets.length >= 100
  )
    return;
  const e = w.entities.find((o) => o.id === entityId);
  if (
    !e ||
    e.remove ||
    e.state === "down" ||
    e.state === "detained" ||
    w.wallet < stake ||
    !["free60", "detain60", "violent60"].includes(type) ||
    (type === "violent60" && e.everViolent)
  )
    return;
  if (type !== "detain60" && e.kind !== "protester") return;
  if (type === "detain60" && e.kind !== "police") return;
  w.wallet -= stake;
  w.bets.push({
    id: w.nextId++,
    entityId,
    entityName: e.name,
    type,
    stake,
    odds: betOdds(w, type),
    deadline: w.time + 60,
    startDetentions: e.detentionsThisRound,
    status: "open",
  });
  feed(
    w,
    `🎲 Bet ${stake}₿ on ${e.name} (${type === "free60" ? "stays free 60s" : type === "detain60" ? "detains within 60s" : "turns violent 60s"}) @ ${betOdds(w, type)}x`,
    "market",
  );
}

type Bet = World["bets"][number];

function resolveBets(w: World) {
  for (const b of w.bets) {
    if (b.status !== "open" || w.time < b.deadline) continue;
    const e = w.entities.find((o) => o.id === b.entityId);
    let won = false;
    if (b.type === "free60")
      won = !!e && e.state !== "detained" && e.state !== "down" && !e.remove;
    else if (b.type === "detain60")
      won = !!e && e.detentionsThisRound > b.startDetentions;
    else won = !!e && !!e.everViolent;
    b.status = won ? "won" : "lost";
    if (won) {
      const payout = Math.round(b.stake * b.odds);
      w.wallet += payout;
      w.stats.betProfit += payout - b.stake;
      feed(w, `💰 Bet WON on ${b.entityName}: +${payout}₿`, "good");
    } else {
      w.stats.betProfit -= b.stake;
      feed(w, `Bet lost on ${b.entityName} (−${b.stake}₿).`, "bad");
    }
  }
}

function marketTick(w: World) {
  const violent = w.entities.filter(
    (o) => o.kind === "protester" && o.violentT > 0,
  ).length;
  const fair: Record<string, number> = {
    calm: clamp(105 - w.tension * 0.85, 8, 200),
    chaos: clamp(15 + w.tension * 1.25 + violent * 2, 5, 300),
    glass: clamp(28 + w.damage * 0.55, 10, 350),
    media: clamp(35 + w.violenceRate * 9 + w.tension * 0.4, 10, 300),
  };
  for (const ins of w.instruments) {
    ins.prev = ins.price;
    const noise = (random(w) - 0.5) * (2 + w.tension / 25);
    ins.price = clamp(
      ins.price + (fair[ins.id] - ins.price) * 0.18 + noise,
      3,
      400,
    );
    ins.history.push(ins.price);
    if (ins.history.length > 80) ins.history.shift();
  }
}

/* ---------------- main update ---------------- */
export function spawnPlayer(
  w: World,
  role: Role,
  name: string,
  identity: string,
): Entity | null {
  if (role === "watcher") return null;
  const existing = w.entities.find(
    (e) => e.profileId === identity && !e.remove,
  );
  if (existing) return existing;
  const point = w.map.spawns[role];
  const player = makeEntity(w, role, role, point.x, point.y, name);
  Object.assign(player, collideBuildings(w.map, player.x, player.y, 9));
  player.remote = true;
  player.isPlayer = true;
  player.profileId = identity;
  player.speed = 110;
  player.sign = role === "protester";
  if (role === "protester") player.stones = 3;
  w.entities.push(player);
  return player;
}

export function updatePlayer(
  w: World,
  p: Entity,
  input: InputState,
  dt: number,
) {
  if (!Number.isFinite(dt) || dt <= 0 || !w.entities.includes(p)) return;
  dt = Math.min(dt, 0.05);
  const oldX = p.x,
    oldY = p.y;
  p.moving = false;
  p.running = false;
  if (p && !p.remove && p.state !== "down" && p.state !== "detained") {
    if (p.stun <= 0) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (p.state === "detain" && (dx || dy)) {
        const held = w.entities.find((o) => o.id === p.actingOn);
        if (held && held.detainOfficer === p.id) {
          held.detainProgress = 0;
          held.detainOfficer = null;
        }
        p.state = "idle";
        p.actingOn = null;
      }
      if (dx || dy) {
        const l = Math.hypot(dx, dy);
        dx /= l;
        dy /= l;
        const sp =
          p.speed *
          (input.sprint ? 1.5 : 1) *
          (w.persistent && Math.min(p.hunger, p.thirst) < 30 ? 0.8 : 1);
        p.dir = Math.atan2(dy, dx);
        const np = p.buildingId
          ? insidePosition(w, p, p.x + dx * sp * dt, p.y + dy * sp * dt)
          : collideBuildings(w.map, p.x + dx * sp * dt, p.y + dy * sp * dt, 9);
        p.x = np.x;
        p.y = np.y;
      }
      // player detain channel
      if (p.state === "detain" && p.actingOn != null) {
        const t = w.entities.find((o) => o.id === p.actingOn);
        if (
          !t ||
          t.remove ||
          t.state === "detained" ||
          t.state === "down" ||
          !interactionClear(w, p, t) ||
          dist(p, t) > 52
        ) {
          p.state = "idle";
          p.actingOn = null;
        } else {
          if (t.detainOfficer == null || t.detainOfficer === p.id) {
            t.detainOfficer = p.id;
            t.detainProgress += dt * 1.1;
          }
          if (t.detainProgress >= 1.2) {
            detain(w, p, t);
            p.state = "idle";
            p.actingOn = null;
          }
        }
      }
    }
  }

  p.moving = Math.hypot(p.x - oldX, p.y - oldY) > 0.01;
  p.running = p.moving && input.sprint;
}

export function update(w: World, dt: number, input: InputState) {
  if (w.over || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  w.time += dt;
  w.tick++;
  w.violenceRate = Math.max(0, w.violenceRate - dt * 0.35);

  const p = w.player;
  if (p && !p.remote) updatePlayer(w, p, input, dt);

  // watcher camera
  if (w.role === "watcher") {
    const sp = (420 * dt) / w.zoom;
    w.camX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * sp;
    w.camY += ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * sp;
  } else if (p) {
    w.camX += (p.x - w.camX) * Math.min(1, dt * 5);
    w.camY += (p.y - w.camY) * Math.min(1, dt * 5);
  }
  w.camX = clamp(w.camX, 0, w.map.w);
  w.camY = clamp(w.camY, 0, w.map.h);

  if (!w.order || w.order.t <= 0) for (const e of w.entities) e.order = null;
  // Progress belongs to one officer; cancelling or leaving reach clears it in simulation.
  for (const e of w.entities) {
    if (e.kind !== "protester" || e.state === "detained") continue;
    const holder = w.entities.find(
      (o) =>
        !o.remove &&
        o.state === "detain" &&
        o.id === e.detainOfficer &&
        o.actingOn === e.id &&
        o.stun <= 0 &&
        interactionClear(w, o, e) &&
        dist(o, e) <= 48,
    );
    if (!holder) {
      e.detainProgress = 0;
      e.detainOfficer = null;
    }
  }
  // timers per entity
  for (const e of w.entities) {
    if (e.remove) continue;
    if (!e.isPlayer) {
      e.moving = false;
      e.running = false;
    }
    if (e.hp <= 0 && e.state !== "down") downEntity(w, e);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.violentT = Math.max(0, e.violentT - dt);
    e.recentThrowT = Math.max(0, e.recentThrowT - dt);
    e.warnedT = Math.max(0, e.warnedT - dt);
    e.chantT = Math.max(0, e.chantT - dt);
    e.bubbleT = Math.max(0, e.bubbleT - dt);
    if (e.bubbleT <= 0) e.bubble = null;
    if (e.stun > 0) {
      e.stun -= dt;
      continue;
    }
    if (e.state === "down") {
      e.stateT = Math.max(0, e.stateT - dt);
      if (w.persistent && e.isPlayer) continue;
      if (e.stateT <= 0) {
        if (e.isPlayer) {
          const s = w.map.spawns[e.faction as "protester"];
          e.x = s.x;
          e.y = s.y;
          e.hp = e.maxHp;
          e.state = "idle";
        } else e.remove = true;
      }
      continue;
    }
    if (e.state === "detained" && w.persistent) {
      e.custodyUntil ??= w.time + 20;
      if (w.time >= e.custodyUntil) {
        e.state = "idle";
        e.detainedBy = null;
        e.detainOfficer = null;
        e.detainProgress = 0;
        e.wanted = 0;
        e.violentT = 0;
        e.recentThrowT = 0;
        e.custodyUntil = undefined;
        emitEvent(w, "release", { targetId: e.id });
      }
      continue;
    }
    if (e.state === "detained") {
      const dz = w.map.detainZone;
      if (
        moveTo(
          w,
          e,
          dz.x + (e.id % 5) * 14 - 28,
          dz.y + (e.id % 3) * 14,
          60,
          dt,
        )
      ) {
        e.stateT += dt;
        if (e.stateT > 4) {
          if (e.isPlayer) {
            Object.assign(
              e,
              collideBuildings(
                w.map,
                w.map.spawns[e.faction].x,
                w.map.spawns[e.faction].y,
                9,
              ),
            );
            e.state = "idle";
            e.stateT = 0;
            e.detainedBy = null;
            e.detainOfficer = null;
            e.detainProgress = 0;
            e.hp = e.maxHp;
          } else e.remove = true;
        }
      }
      continue;
    }
    if (e.remote || e.buildingId) continue;
    if (
      w.persistent &&
      (e.hunger < 45 || e.thirst < 45) &&
      e.kind !== "truck" &&
      e.kind !== "crate"
    ) {
      const resource = w.resources
        ?.filter((r) => r.food > 0 || r.water > 0)
        .sort((a, b) => dist(a, e) - dist(b, e))[0];
      if (resource) {
        moveTo(w, e, resource.x, resource.y, e.speed, dt);
        continue;
      }
    }
    switch (e.kind) {
      case "protester":
        updateProtester(w, e, dt);
        break;
      case "police":
        updatePolice(w, e, dt);
        break;
      case "military":
        updateMilitary(w, e, dt);
        break;
      case "civilian":
        updateCivilian(w, e, dt);
        break;
      case "truck":
        updateTruck(w, e, dt);
        break;
      case "crate": {
        const taker = nearest(
          w,
          e,
          (o) =>
            o.faction === e.crateFaction &&
            (o.kind === "protester" || o.kind === "police"),
          24,
        );
        if (taker) {
          e.remove = true;
          if (e.crateFaction === "protester") {
            const roll = random(w);
            if (roll < 0.5) {
              taker.stones = Math.min(12, taker.stones + 3);
              if (taker.isPlayer)
                feed(
                  w,
                  "📦 +3 stones. Careful — throwing flags you violent.",
                  "good",
                );
            } else if (roll < 0.8) {
              taker.shield = true;
              taker.maxHp = 140;
              taker.hp = Math.min(taker.hp + 40, 140);
              if (taker.isPlayer)
                feed(w, "📦 Improvised shield: +40 HP.", "good");
            } else {
              taker.sign = true;
              w.morale = clamp(w.morale + 5, 0, 100);
              if (taker.isPlayer)
                feed(w, "📦 Fresh banner! Crowd morale +5.", "good");
            }
          } else {
            const roll = random(w);
            if (roll < 0.5) {
              taker.gas = Math.min(3, taker.gas + 1);
              if (taker.isPlayer)
                feed(
                  w,
                  "📦 +1 tear gas canister (T to deploy at cursor).",
                  "good",
                );
            } else {
              taker.shield = true;
              taker.maxHp = 150;
              taker.hp = Math.min(taker.hp + 50, 150);
              if (taker.isPlayer) feed(w, "📦 Riot shield: +50 HP.", "good");
            }
          }
          if (!taker.isPlayer && taker.brain.chattiness > 0.6)
            say(taker, "Supplies!");
        }
        break;
      }
    }
  }

  // gas damage & fear
  for (const g of w.gases) {
    g.t += dt;
    for (const e of w.entities) {
      if (
        !e.remove &&
        !e.buildingId &&
        e.state !== "down" &&
        (e.kind === "protester" || e.kind === "civilian") &&
        dist(e, g) < g.r &&
        e.state !== "detained"
      ) {
        e.hp -= dt * 3;
        if (e.hp <= 0) downEntity(w, e);
      }
    }
  }
  w.gases = w.gases.filter((g) => g.t < g.dur);

  // separation (soft crowd physics)
  const solids = w.entities.filter(
    (e) =>
      !e.remove &&
      !e.buildingId &&
      e.kind !== "truck" &&
      e.kind !== "crate" &&
      e.state !== "down",
  );
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i],
        b = solids[j];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 324 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (18 - d) * 0.5;
        const ux = dx / d,
          uy = dy / d;
        if (!a.isPlayer) {
          a.x -= ux * push;
          a.y -= uy * push;
        }
        if (!b.isPlayer) {
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }

  for (const e of solids)
    if (e.isPlayer) {
      e.x = clamp(e.x, 9, w.map.w - 9);
      e.y = clamp(e.y, 9, w.map.h - 9);
    }

  for (const e of solids)
    if (!e.remote) Object.assign(e, collideBuildings(w.map, e.x, e.y, 9));

  // projectiles
  for (const pr of w.projectiles) {
    pr.t += dt;
    const k = Math.min(1, pr.t / pr.dur);
    pr.x = pr.sx + (pr.tx - pr.sx) * k;
    pr.y = pr.sy + (pr.ty - pr.sy) * k;
    if (k >= 1) {
      if (pr.kind === "stone") {
        fx(w, "smoke", pr.tx, pr.ty, 0.4, undefined, "#999", 8);
        const hit = w.entities.find(
          (o) =>
            !o.remove &&
            !o.buildingId &&
            o.state !== "down" &&
            o.state !== "detained" &&
            o.kind !== "crate" &&
            o.kind !== "truck" &&
            dist(o, { x: pr.tx, y: pr.ty }) < 22,
        );
        let damaged = false;
        if (
          hit &&
          (hit.kind === "police" ||
            hit.kind === "military" ||
            hit.kind === "civilian")
        ) {
          hit.hp -= hit.shield ? 6 : 14;
          if (w.persistent && hit.hp <= 25) {
            const attacker = w.entities.find((e) => e.id === pr.from);
            if (attacker) attacker.imminentThreatUntil = w.time + 2;
          }
          fx(
            w,
            "text",
            hit.x,
            hit.y - 18,
            1,
            `-${hit.shield ? 6 : 14}`,
            "#ff8f6b",
          );
          if (hit.hp <= 0) downEntity(w, hit);
          damaged = true;
        }
        for (const s of w.map.buildings) {
          if (s.kind !== "shop" || s.broken) continue;
          if (
            pr.tx > s.x - 8 &&
            pr.tx < s.x + s.w + 8 &&
            pr.ty > s.y - 8 &&
            pr.ty < s.y + s.h + 8
          ) {
            s.hp -= 18;
            w.damage += 18;
            damaged = true;
            fx(w, "text", pr.tx, pr.ty, 1, "CRASH!", "#ffd75e");
            if (s.hp <= 0) {
              s.broken = true;
              w.damage += 40;
              feed(
                w,
                `🪟 ${s.name ?? "A shop"}'s front is smashed! GLAZ stock is soaring.`,
                "market",
              );
              w.tension = clamp(w.tension + 6, 0, 100);
            }
            break;
          }
        }
        if (damaged) w.violenceRate += 0.5;
      } else if (pr.kind === "bullet") {
        const t = w.entities.find((o) => o.id === pr.targetId);
        if (
          t &&
          !t.remove &&
          !t.buildingId &&
          t.state !== "down" &&
          t.state !== "detained"
        ) {
          t.hp -= 55;
          t.stun = 1.5;
          fx(w, "text", t.x, t.y - 18, 1, "-55", "#ff5d5d");
          if (t.hp <= 0) downEntity(w, t);
        }
      } else if (pr.kind === "gascan") {
        w.gases.push({ x: pr.tx, y: pr.ty, r: 95, t: 0, dur: 12 });
        w.tension = clamp(w.tension + 4, 0, 100);
        feed(w, "💨 Tear gas deployed!", "bad");
      }
      pr.t = pr.dur + 1;
    }
  }
  w.projectiles = w.projectiles.filter((pr) => pr.t <= pr.dur);

  // effects
  for (const f of w.effects) f.t += dt;
  w.effects = w.effects.filter((f) => f.t < f.dur);

  // tension drift
  const violent = w.entities.filter(
    (o) => o.kind === "protester" && o.violentT > 0 && o.state !== "detained",
  ).length;
  const target = clamp(
    20 + violent * 7 + w.morale * 0.25 + w.violenceRate * 3,
    0,
    100,
  );
  w.tension += (target - w.tension) * dt * 0.06;
  w.morale = clamp(w.morale - dt * 0.25 + violent * dt * 0.1, 0, 100);

  // order expiry
  if (w.order) {
    w.order.t -= dt;
    if (w.order.t <= -2) w.order = null;
  }

  // market
  w.marketT += dt;
  if (w.marketT >= 1.5) {
    w.marketT = 0;
    marketTick(w);
    resolveBets(w);
  }

  w.entities = w.entities.filter((e) => !e.remove);

  if (w.persistent) {
    updateWorldRules(w, dt);
    replenishPopulation(w);
    return;
  }

  // end conditions
  const activeProtesters = w.entities.filter(
    (e) =>
      e.kind === "protester" && e.state !== "detained" && e.state !== "down",
  ).length;
  if (w.time >= w.duration) endRound(w, "The 5-minute round is over.");
  else if (activeProtesters === 0)
    endRound(w, "The crowd has been fully dispersed.");
  else if (w.morale <= 1)
    endRound(w, "The crowd lost morale and dispersed peacefully.");
}

function endRound(w: World, reason: string) {
  if (w.over) return;
  w.over = true;
  w.overReason = reason;
  w.wallet += Math.round(portfolioValue(w));
  w.holdings = {};
  for (const bet of w.bets)
    if (bet.status === "open") {
      w.wallet += bet.stake;
      bet.status = "refunded";
    }
  // role earnings
  if (w.role === "protester") {
    const alive =
      w.player && w.player.state !== "detained" && w.player.state !== "down";
    w.earned += Math.round(w.morale * 1.5) + (alive ? 80 : 0);
  } else if (w.role === "military") {
    w.earned +=
      (w.player?.lawfulShots ?? 0) * 20 + 60 - w.stats.roeViolations * 50;
  } else if (w.role === "police") {
    w.earned += 40;
  }
  w.earned = Math.max(0, Math.round(w.earned));
  feed(w, `ROUND OVER — ${reason}`, "info");
}

function replenishPopulation(w: World) {
  if (w.time < (w.populationAt ?? 0)) return;
  w.populationAt = w.time + 5;
  const humans = w.entities.filter((e) => e.isPlayer && !e.remove).length;
  const targets = {
    protester: Math.max(12, 30 - humans),
    police: Math.max(6, 12 - Math.floor(humans / 2)),
    military: 2,
    civilian: 8,
  } as const;
  for (const kind of ["protester", "police", "military", "civilian"] as const) {
    const bots = w.entities.filter(
      (e) => !e.isPlayer && !e.remove && e.kind === kind,
    );
    if (bots.length > targets[kind] + 2) {
      bots[bots.length - 1].remove = true;
      continue;
    }
    if (bots.length >= targets[kind]) continue;
    const count = bots.length;
    const anchors =
      kind === "protester"
        ? w.map.rallyPoints
        : kind === "police"
          ? w.map.policeLine
          : kind === "military"
            ? w.map.checkpoints
            : [];
    const anchor = anchors.length
      ? anchors[count % anchors.length]
      : w.map.spawns[kind];
    const point =
      kind === "protester"
        ? rallyTarget({ id: count + 1 }, anchor, 55, 0)
        : {
            x: anchor.x + (random(w) - 0.5) * (kind === "civilian" ? 500 : 50),
            y: anchor.y + (random(w) - 0.5) * (kind === "civilian" ? 300 : 50),
          };
    const e = makeEntity(
      w,
      kind,
      kind,
      point.x,
      point.y,
      NAMES[w.map.id][Math.floor(random(w) * NAMES[w.map.id].length)],
    );
    if (kind === "protester") e.rallyIdx = count % w.map.rallyPoints.length;
    Object.assign(e, collideBuildings(w.map, e.x, e.y, 9));
    e.journalist = kind === "civilian" && bots.length < 2;
    w.entities.push(e);
  }
}
