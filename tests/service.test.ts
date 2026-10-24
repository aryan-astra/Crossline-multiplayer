import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { GameService } from "../src/server/service";
import {
  emitEvent,
  interactObjective,
  markWanted,
} from "../src/game/world-rules";
import { createWorld, spawnSupply } from "../src/game/engine";
import { MAPS } from "../src/game/maps";
import type { AreaId } from "../src/game/locations";
import type { ClientMessage, Command } from "../src/network/protocol";

let sequence = 0;

test("entry area controls a new spawn but cannot teleport a returning character", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    const id = store.createGuest("New arrival").profile.id;
    service.join(id, "paris", "police", "approach");
    const w = service.worlds.paris;
    const person = w.entities.find((entity) => entity.profileId === id)!;
    assert.equal(person.x, w.map.checkpoints[1].x);
    assert.equal(person.y, w.map.checkpoints[1].y);
    const credits = store.profile(id).credits;
    service.disconnect(id);
    service.join(id, "paris", "police", "gathering");
    assert.equal(person.x, w.map.checkpoints[1].x);
    assert.equal(person.y, w.map.checkpoints[1].y);
    assert.equal(store.profile(id).credits, credits);
    assert.throws(
      () => service.join(id, "paris", "police", "roof" as AreaId),
      /Invalid/,
    );
  } finally {
    store.close();
  }
});

test("legacy map upgrade preserves profiles and event receipts while moving geometry", () => {
  const store = new Store(":memory:");
  try {
    const service = new GameService(store);
    const profile = store.createGuest("Returning player").profile;
    service.join(profile.id, "delhi", "protester");
    const before = store.profile(profile.id);
    const w = service.worlds.delhi;
    w.map.roadWays = undefined;
    w.map.objectivePoint = undefined;
    const entity = w.entities.find((item) => item.profileId === profile.id)!;
    entity.buildingId = "legacy-interior";
    entity.path = [{ x: 1, y: 1 }];
    const eventSeq = w.eventSeq;
    store.saveWorld("delhi", w);
    const upgraded = new GameService(store).worlds.delhi;
    assert.ok(upgraded.map.roadWays?.length);
    assert.deepEqual(store.profile(profile.id), before);
    assert.equal(upgraded.eventSeq, eventSeq);
    assert.equal(upgraded.objective?.x, MAPS.delhi.objectivePoint?.x);
    assert.equal(upgraded.objective?.y, MAPS.delhi.objectivePoint?.y);
    const restored = upgraded.entities.find((item) => item.id === entity.id)!;
    assert.equal(restored.buildingId, undefined);
    assert.equal(restored.path, undefined);
    assert.equal(restored.profileId, profile.id);
  } finally {
    store.close();
  }
});
function command(
  value: Command,
  requestId = `request:${++sequence}`,
): ClientMessage {
  return { ...value, v: 1, seq: ++sequence, requestId };
}
function setup() {
  const store = new Store(":memory:"),
    service = new GameService(store);
  for (const w of Object.values(service.worlds)) {
    w.entities = [];
    w.populationAt = Number.MAX_SAFE_INTEGER;
  }
  const profile = store.createGuest("Alice").profile;
  service.join(profile.id, "delhi", "watcher");
  return { store, service, id: profile.id };
}

test("financial requests persist once, reject key reuse and cannot create short positions", () => {
  const { store, service, id } = setup();
  try {
    service.worlds.delhi.instruments[0].price = 10;
    const buy = command(
      { type: "trade", instrument: "calm", quantity: 2 },
      "buy:once",
    );
    service.command(id, buy);
    service.command(id, { ...buy, seq: ++sequence });
    assert.equal(store.profile(id).credits, 48);
    assert.equal(store.holdings(id).calm, 2);
    assert.throws(
      () =>
        service.command(
          id,
          command(
            { type: "trade", instrument: "calm", quantity: 3 },
            buy.requestId,
          ),
        ),
      /reused/,
    );
    assert.throws(
      () =>
        service.command(
          id,
          command({ type: "trade", instrument: "calm", quantity: -3 }),
        ),
      /holdings/,
    );
    assert.equal(store.profile(id).credits, 48);
    service.command(
      id,
      command({ type: "trade", instrument: "calm", quantity: -2 }),
    );
    assert.equal(store.profile(id).credits, 67);
    assert.equal(store.holdings(id).calm, 0);
    assert.throws(
      () =>
        service.command(
          id,
          command({ type: "trade", instrument: "calm", quantity: NaN }),
        ),
      /Invalid/,
    );
  } finally {
    store.close();
  }
});

test("funding creates one bounded delivery, debits once and blocks market manipulation", () => {
  const { store, service, id } = setup();
  try {
    const fund = command({ type: "fund", faction: "police" }, "fund:once");
    service.command(id, fund);
    service.command(id, { ...fund, seq: ++sequence });
    assert.equal(store.profile(id).credits, 49);
    assert.equal(
      service.worlds.delhi.entities.filter((e) => e.kind === "truck").length,
      1,
    );
    assert.throws(
      () =>
        service.command(
          id,
          command({ type: "bet", contract: "unrest60", stake: 1 }),
        ),
      /cooldown/,
    );
    assert.equal(store.profile(id).credits, 49);
  } finally {
    store.close();
  }
});

test("world interactions report server-validated results to the shared feed", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "protester");
    const w = service.worlds.delhi;
    const player = w.entities.find((e) => e.profileId === id)!;
    const resource = w.resources![0];
    Object.assign(player, {
      x: resource.x,
      y: resource.y,
      hunger: 40,
      thirst: 40,
    });
    service.command(id, command({ type: "action", action: "interact" }));
    assert.ok(player.hunger > 40 && player.thirst > 40);
    assert.match(w.feed[0].text, /collected essentials/);

    player.hunger = 100;
    player.thirst = 100;
    Object.assign(player, { x: w.objective!.x, y: w.objective!.y });
    service.command(id, command({ type: "action", action: "interact" }));
    assert.ok((player.objectiveUntil ?? 0) > w.time);
    assert.match(w.feed[0].text, /joined the Constitution Book objective/);
  } finally {
    store.close();
  }
});

test("wanted dispatch assigns one nearby officer, reveals its target, and clears when wanted status ends", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "police");
    const nearer = store.createGuest("Nearer officer").profile,
      paris = store.createGuest("Paris officer").profile,
      suspect = store.createGuest("Suspect").profile;
    service.join(nearer.id, "delhi", "police");
    service.join(paris.id, "paris", "police");
    service.join(suspect.id, "delhi", "protester");
    const w = service.worlds.delhi,
      first = w.entities.find((e) => e.profileId === id)!,
      second = w.entities.find((e) => e.profileId === nearer.id)!,
      target = w.entities.find((e) => e.profileId === suspect.id)!;
    Object.assign(first, { x: 100, y: 1300 });
    Object.assign(second, { x: 400, y: 1300 });
    Object.assign(target, { x: w.map.w - 40, y: 1300 });
    markWanted(w, target);
    service.advance(0.05);

    assert.equal(service.snapshot(id, 1, 1).policeTask, undefined);
    assert.equal(
      service.snapshot(nearer.id, 1, 1).policeTask?.targetId,
      target.id,
    );
    assert.ok(
      service
        .snapshot(nearer.id, 1, 1)
        .world.entities.some((entity) => entity.id === target.id),
    );
    assert.equal(service.snapshot(paris.id, 1, 1).policeTask, undefined);

    service.disconnect(nearer.id);
    assert.equal(service.snapshot(id, 1, 1).policeTask?.targetId, target.id);
    target.wanted = 0;
    service.advance(0.05);
    assert.equal(service.snapshot(id, 1, 1).policeTask, undefined);
  } finally {
    store.close();
  }
});

test("police bots cover wanted targets until a connected human takes or leaves the assignment", () => {
  const { store, service, id } = setup();
  try {
    const w = service.worlds.delhi,
      bot = structuredClone(
        createWorld(
          "delhi",
          "watcher",
          "Template",
          "template",
          0,
          0,
        ).entities.find((e) => e.kind === "police")!,
      ),
      suspect = store.createGuest("Suspect").profile;
    bot.id = w.nextId++;
    bot.think = 10;
    w.entities.push(bot);
    service.join(suspect.id, "delhi", "protester");
    const target = w.entities.find((e) => e.profileId === suspect.id)!;
    markWanted(w, target);
    service.advance(0.05);
    assert.equal(bot.policeTaskTargetId, target.id);

    service.join(id, "delhi", "police");
    assert.equal(bot.policeTaskTargetId, undefined);
    assert.equal(service.snapshot(id, 1, 1).policeTask?.targetId, target.id);
    service.disconnect(id);
    assert.equal(bot.policeTaskTargetId, target.id);

    service.checkpoint();
    const restarted = new GameService(store);
    restarted.join(id, "delhi", "police");
    assert.equal(restarted.snapshot(id, 1, 1).policeTask?.targetId, target.id);
  } finally {
    store.close();
  }
});

test("objective payouts select a human leader and settle contributor rewards once", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "protester");
    const teammate = store.createGuest("Teammate").profile;
    service.join(teammate.id, "delhi", "protester");
    const w = service.worlds.delhi,
      objective = w.objective!,
      lead = w.entities.find((e) => e.profileId === id)!,
      helper = w.entities.find((e) => e.profileId === teammate.id)!;
    Object.assign(lead, { x: objective.x, y: objective.y });
    Object.assign(helper, { x: objective.x + 20, y: objective.y });
    objective.captureSeconds = 0.05;
    assert.equal(interactObjective(w, lead), true);
    assert.equal(interactObjective(w, helper), true);

    service.advance(0.05);
    assert.equal(w.objective!.status, "recovering");
    assert.equal(
      w.events.find((event) => event.type === "objective_capture")?.actorId,
      lead.id,
    );
    assert.equal(store.profile(id).credits, 92);
    assert.equal(store.profile(teammate.id).credits, 77);
    assert.match(w.feed[0].text, /secured the Constitution Book/);

    const restarted = new GameService(store);
    restarted.advance(0.05);
    assert.equal(store.profile(id).credits, 92);
    assert.equal(store.profile(teammate.id).credits, 77);
  } finally {
    store.close();
  }
});

test("prediction capture and payouts settle once; unrelated cycles cannot manufacture wins", () => {
  const { store, service, id } = setup();
  try {
    const bet = command(
      { type: "bet", contract: "capture120", stake: 5 },
      "bet:once",
    );
    service.command(id, bet);
    service.command(id, { ...bet, seq: ++sequence });
    assert.equal(store.profile(id).credits, 64);
    assert.equal(store.bets(id).length, 1);
    const w = service.worlds.delhi;
    emitEvent(w, "objective_capture", {
      details: `cycle:${w.objective!.cycle}`,
      faction: "protester",
    });
    service.advance(0.05);
    assert.equal(store.bets(id)[0].resolved, true);
    for (const world of Object.values(service.worlds)) world.time = 120;
    service.advance(0.05);
    service.advance(0.05);
    assert.equal(store.bets(id)[0].status, "won");
    assert.equal(store.profile(id).credits, 74);
    service.command(
      id,
      command({ type: "bet", contract: "capture120", stake: 5 }),
    );
    emitEvent(w, "objective_capture", {
      details: "cycle:999",
      faction: "protester",
    });
    service.advance(0.05);
    for (const world of Object.values(service.worlds)) world.time = 241;
    service.advance(0.05);
    assert.equal(store.bets(id).at(-1)!.status, "lost");
    assert.equal(store.profile(id).credits, 69);
  } finally {
    store.close();
  }
});

test("defense predictions require actual defense; unavailable free targets refund", () => {
  const { store, service, id } = setup();
  try {
    service.command(
      id,
      command({ type: "bet", contract: "defend120", stake: 5 }),
    );
    for (const w of Object.values(service.worlds)) w.time = 121;
    service.advance(0.05);
    assert.equal(store.bets(id)[0].status, "lost");
    const targetProfile = store.createGuest("Target").profile;
    service.join(targetProfile.id, "delhi", "protester");
    const target = service.worlds.delhi.entities.find(
      (e) => e.profileId === targetProfile.id,
    )!;
    service.command(
      id,
      command({
        type: "bet",
        contract: "free60",
        targetId: target.id,
        stake: 5,
      }),
    );
    target.remove = true;
    for (const w of Object.values(service.worlds)) w.time = 182;
    service.advance(0.05);
    assert.equal(store.bets(id).at(-1)!.status, "refunded");
    assert.equal(store.profile(id).credits, 64);
  } finally {
    store.close();
  }
});

test("authoritative death, disconnect and restart cannot bypass respawn or mint credits", () => {
  const dir = mkdtempSync(join(tmpdir(), "crossline-service-")),
    file = join(dir, "world.sqlite");
  let store = new Store(file);
  try {
    let service = new GameService(store);
    for (const w of Object.values(service.worlds)) {
      w.entities = [];
      w.populationAt = Number.MAX_SAFE_INTEGER;
    }
    const { token, profile } = store.createGuest("Survivor");
    service.join(profile.id, "delhi", "police");
    let entity = service.worlds.delhi.entities.find(
      (e) => e.profileId === profile.id,
    )!;
    entity.hp = 0;
    service.advance(0.05);
    service.disconnect(profile.id);
    service.checkpoint();
    store.close();
    store = new Store(file);
    service = new GameService(store);
    assert.equal(store.identify(token)!.id, profile.id);
    assert.throws(
      () => service.join(profile.id, "paris", "protester"),
      /release|respawn/,
    );
    service.join(profile.id, "delhi", "police");
    assert.throws(
      () =>
        service.command(
          profile.id,
          command({ type: "respawn", role: "protester" }),
        ),
      /not available/,
    );
    for (const w of Object.values(service.worlds)) w.time = 31;
    service.command(
      profile.id,
      command({ type: "respawn", role: "protester" }),
    );
    entity = service.worlds.delhi.entities.find(
      (e) => e.profileId === profile.id && !e.remove,
    )!;
    assert.equal(entity.kind, "protester");
    assert.equal(entity.hp, 100);
    assert.equal(store.profile(profile.id).credits, 69);
    assert.equal(store.profile(profile.id).lifeId, 2);
    assert.throws(
      () =>
        service.command(
          profile.id,
          command({ type: "respawn", role: "police" }),
        ),
      /not available/,
    );
    assert.equal(store.profile(profile.id).lifeId, 2);
    service.checkpoint();
    store.close();
    store = new Store(file);
    service = new GameService(store);
    service.join(profile.id, "delhi", "protester");
    assert.equal(store.profile(profile.id).credits, 69);
    assert.equal(store.profile(profile.id).lifeId, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saved death marker with missing body still blocks role switching", () => {
  const { store, service, id } = setup();
  try {
    const p = store.profile(id);
    p.role = "police";
    p.deathUntil = 30;
    store.saveProfile(p);
    service.disconnect(id);
    assert.throws(
      () => service.join(id, "paris", "protester"),
      /release|respawn/,
    );
    service.join(id, "delhi", "police");
    assert.equal(
      service.worlds.delhi.entities.find((e) => e.profileId === id)!.state,
      "down",
    );
    assert.throws(
      () => service.command(id, command({ type: "action", action: "primary" })),
      /cannot act/,
    );
  } finally {
    store.close();
  }
});

test("custody persists across reconnect and releases without granting a new life", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "protester");
    const entity = service.worlds.delhi.entities.find(
      (e) => e.profileId === id,
    )!;
    entity.state = "detained";
    entity.custodyUntil = 2;
    service.disconnect(id);
    service.join(id, "delhi", "protester");
    assert.throws(() => service.join(id, "paris", "police"), /release|respawn/);
    for (let i = 0; i < 45; i++) service.advance(0.05);
    assert.equal(entity.state, "idle");
    assert.equal(store.profile(id).lifeId, 1);
    assert.equal(store.profile(id).credits, 69);
  } finally {
    store.close();
  }
});

test("offline saved custody expires while the shared server keeps running", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "protester");
    const e = service.worlds.delhi.entities.find(
      (entity) => entity.profileId === id,
    )!;
    e.state = "detained";
    e.custodyUntil = 2;
    service.disconnect(id);
    for (const w of Object.values(service.worlds)) w.time = 21;
    service.advance(0.05);
    assert.equal(store.character(id)!.state, "detained");
    assert.doesNotThrow(() => service.join(id, "delhi", "police"));
    assert.equal(store.profile(id).lifeId, 1);
    assert.equal(store.profile(id).credits, 69);
  } finally {
    store.close();
  }
});

test("top five active positive officers are appointed deterministically and slots stay capped", () => {
  const { store, service } = setup();
  try {
    const officers = Array.from({ length: 6 }, (_, i) => {
      const p = store.createGuest(`Officer ${i}`).profile;
      p.policeScore = 20 - i;
      store.saveProfile(p);
      service.join(p.id, "delhi", "police");
      return p;
    });
    for (const w of Object.values(service.worlds)) w.time = 900;
    service.advance(0.05);
    assert.equal(
      officers.filter((p) => store.profile(p.id).appointmentUntil > 900).length,
      5,
    );
    for (const p of officers.slice(0, 5))
      service.join(p.id, "delhi", "military");
    assert.throws(
      () => service.join(officers[5].id, "delhi", "military"),
      /appointments/,
    );
    const sixth = store.profile(officers[5].id);
    sixth.appointmentUntil = 1800;
    store.saveProfile(sixth);
    assert.throws(() => service.join(sixth.id, "delhi", "military"), /five/);
    for (const w of Object.values(service.worlds)) w.time = 1801;
    service.advance(0.05);
    assert.ok(
      service.worlds.delhi.entities
        .filter((e) => e.profileId)
        .every((e) => e.kind !== "military"),
    );
  } finally {
    store.close();
  }
});

test("settled event rewards and objective checkpoint survive restart without replay", () => {
  const { store, service, id } = setup();
  try {
    service.join(id, "delhi", "police");
    const w = service.worlds.delhi,
      actor = w.entities.find((e) => e.profileId === id)!;
    emitEvent(w, "detention", { actorId: actor.id, amount: 10 });
    service.advance(0.05);
    assert.equal(store.profile(id).credits, 77);
    assert.equal(store.profile(id).detentions, 1);
    const restarted = new GameService(store);
    restarted.advance(0.05);
    assert.equal(store.profile(id).credits, 77);
    assert.equal(store.profile(id).detentions, 1);
    assert.equal(restarted.worlds.delhi.eventSeq, w.eventSeq);
    assert.deepEqual(restarted.worlds.delhi.objective, w.objective);
  } finally {
    store.close();
  }
});

test("global market quotes match across locations and financial exposure blocks role manipulation", () => {
  const { store, service, id } = setup();
  try {
    service.worlds.delhi.instruments[0].price = 10;
    service.worlds.paris.instruments[0].price = 400;
    service.join(id, "paris", "watcher");
    assert.equal(service.snapshot(id, 1, 1).world.instruments[0].price, 10);
    service.command(
      id,
      command({ type: "trade", instrument: "calm", quantity: 1 }),
    );
    assert.equal(store.profile(id).credits, 58);
    assert.throws(
      () => service.join(id, "paris", "protester"),
      /financial exposure/,
    );
    service.command(
      id,
      command({ type: "trade", instrument: "calm", quantity: -1 }),
    );
    service.command(
      id,
      command({ type: "bet", contract: "unrest60", stake: 5 }),
    );
    assert.throws(
      () => service.join(id, "paris", "police"),
      /financial exposure/,
    );
  } finally {
    store.close();
  }
});

test("prediction inputs reject vehicles and suspend already advancing objectives", () => {
  const { store, service, id } = setup();
  try {
    spawnSupply(service.worlds.delhi, "police");
    const truck = service.worlds.delhi.entities.find(
      (e) => e.kind === "truck",
    )!;
    assert.throws(
      () =>
        service.command(
          id,
          command({
            type: "bet",
            contract: "free60",
            targetId: truck.id,
            stake: 1,
          }),
        ),
      /active person/,
    );
    service.worlds.delhi.objective!.progress = 10;
    assert.throws(
      () =>
        service.command(
          id,
          command({ type: "bet", contract: "capture120", stake: 1 }),
        ),
      /suspended/,
    );
    assert.equal(store.profile(id).credits, 69);
  } finally {
    store.close();
  }
});

test("expired military authority is rejected before the next simulation step", () => {
  const { store, service, id } = setup();
  try {
    const p = store.profile(id);
    p.appointmentUntil = 1;
    store.saveProfile(p);
    service.join(id, "delhi", "military");
    for (const w of Object.values(service.worlds)) w.time = 2;
    assert.throws(
      () => service.command(id, command({ type: "action", action: "primary" })),
      /expired/,
    );
  } finally {
    store.close();
  }
});

test("64-member budget rejects overflow and disconnected spectators release their slots", () => {
  const { store, service, id } = setup();
  try {
    const ids = [id];
    for (let i = 0; i < 63; i++) {
      const p = store.createGuest(`Observer ${i}`).profile;
      service.join(p.id, "delhi", "watcher");
      ids.push(p.id);
    }
    const extra = store.createGuest("Extra observer").profile;
    assert.throws(() => service.join(extra.id, "delhi", "watcher"), /capacity/);
    for (const profileId of ids) service.disconnect(profileId);
    for (const w of Object.values(service.worlds)) w.time = 21;
    service.advance(0.05);
    assert.doesNotThrow(() => service.join(extra.id, "delhi", "watcher"));
  } finally {
    store.close();
  }
});

test("an idle tick does not query persisted profile, prediction or appointment state", () => {
  const { store, service } = setup();
  try {
    const unexpected = () => {
      throw new Error("Unexpected hot-path database query");
    };
    store.profile = unexpected;
    store.bets = unexpected;
    store.meta = unexpected;
    store.rankings = unexpected;
    assert.doesNotThrow(() => service.advance(0.05));
  } finally {
    store.close();
  }
});
