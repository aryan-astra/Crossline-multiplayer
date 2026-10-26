import { randomUUID } from "node:crypto";
import {
  createWorld,
  doAction,
  feed,
  initializeRoadsidePickups,
  issueOrder,
  spawnPlayer,
  spawnSupply,
  update,
  updatePlayer,
} from "../game/engine";
import {
  collectResource,
  enterBuilding,
  exitBuilding,
  interactObjective,
  lootShop,
} from "../game/world-rules";
import { collideBuildings } from "../game/maps";
import { entryPoint, type AreaId } from "../game/locations";
import { supplyOption } from "../game/equipment";
import { placeName } from "../game/place-names";
import { prewarmNavigation } from "../game/navigation";
import type { Entity, InputState, MapId, Role, World } from "../game/types";
import {
  parseMessage,
  type ClientMessage,
  type PoliceDispatch,
  type Prediction,
  type Snapshot,
} from "../network/protocol";
import { Store } from "./store";
import { upgradeWorldMap } from "./map-upgrade";

const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  mouseX: 0,
  mouseY: 0,
};
const maps: MapId[] = ["delhi", "paris"];
const active = (e: Entity) =>
  !e.remove && e.state !== "down" && e.state !== "detained";
type PoliceAssignment = { mapId: MapId; targetId: number };
export class GameService {
  worlds: Record<MapId, World>;
  private players = new Map<
    string,
    { input: InputState; at: number; seen: number; connected: boolean }
  >();
  private saved = 0;
  private eventCursors = new Map<MapId, number>();
  private pending = new Map<string, Prediction>();
  private appointments = new Map<string, number>();
  private policeTasks = new Map<string, PoliceAssignment>();
  private appointmentCycle = 0;
  constructor(readonly store: Store) {
    this.worlds = Object.fromEntries(
      maps.map((id, index) => {
        const w =
          store.checkpoint(id) ??
          createWorld(
            id,
            "watcher",
            "Public world",
            "server",
            0,
            0,
            index + 41,
            { persistent: true },
          );
        upgradeWorldMap(w, store);
        initializeRoadsidePickups(w);
        w.player = null;
        w.role = "watcher";
        prewarmNavigation(w.map);
        for (const e of w.entities.filter((e) => e.profileId))
          this.players.set(e.profileId!, {
            input: { ...idle },
            at: 0,
            seen: w.time,
            connected: false,
          });
        return [id, w];
      }),
    ) as Record<MapId, World>;
    this.syncMarketQuotes();
    for (const mapId of maps)
      this.eventCursors.set(mapId, store.meta(`events:${mapId}`, 0));
    for (const bet of store.openBets())
      if (bet.status === "open") this.pending.set(bet.id, bet);
    for (const w of Object.values(this.worlds))
      for (const e of w.entities)
        if (e.profileId)
          this.appointments.set(
            e.profileId,
            store.profile(e.profileId).appointmentUntil,
          );
    this.appointmentCycle = store.meta("appointmentCycle", 0);
  }
  get time() {
    return Math.max(...maps.map((id) => this.worlds[id].time));
  }
  private syncMarketQuotes() {
    for (const world of Object.values(this.worlds)) {
      if (world === this.worlds.delhi) continue;
      for (const instrument of world.instruments) {
        const shared = this.worlds.delhi.instruments.find(
          (item) => item.id === instrument.id,
        );
        if (!shared) continue;
        instrument.prev = shared.prev;
        instrument.price = shared.price;
        instrument.history = [...shared.history];
      }
    }
  }
  private entity(id: string): Entity | undefined {
    return this.worlds[this.store.profile(id).mapId].entities.find(
      (e) => e.profileId === id && !e.remove,
    );
  }
  private reconcilePoliceTasks(w: World) {
    const targets = w.entities
      .filter((e) => active(e) && e.kind === "protester" && e.wanted > 0)
      .sort((a, b) => b.wanted - a.wanted || a.id - b.id);
    const targetById = new Map(targets.map((target) => [target.id, target]));
    const humans = w.entities.filter(
      (e) =>
        active(e) &&
        e.kind === "police" &&
        !!e.profileId &&
        this.players.get(e.profileId)?.connected,
    );
    const bots = w.entities.filter(
      (e) => active(e) && e.kind === "police" && !e.isPlayer && !e.remote,
    );
    const humanById = new Map(
      humans.map((officer) => [officer.profileId!, officer]),
    );
    const assignedTargets = new Set<number>();
    const assignedHumans = new Set<string>();
    const humanTaskTargets = new Set<number>();
    for (const [profileId, task] of this.policeTasks) {
      if (task.mapId !== w.map.id) continue;
      const officer = humanById.get(profileId);
      if (
        !officer ||
        !targetById.has(task.targetId) ||
        assignedTargets.has(task.targetId)
      ) {
        this.policeTasks.delete(profileId);
        continue;
      }
      assignedHumans.add(profileId);
      humanTaskTargets.add(task.targetId);
      assignedTargets.add(task.targetId);
    }
    const botTaskOwners = new Map<number, Entity>();
    for (const bot of bots) {
      const targetId = bot.policeTaskTargetId;
      if (targetId == null) continue;
      if (
        !targetById.has(targetId) ||
        assignedTargets.has(targetId) ||
        botTaskOwners.has(targetId)
      ) {
        bot.policeTaskTargetId = undefined;
        continue;
      }
      botTaskOwners.set(targetId, bot);
      assignedTargets.add(targetId);
    }
    const freeHumans = humans.filter(
      (officer) => !assignedHumans.has(officer.profileId!),
    );
    const freeBots = bots.filter(
      (officer) => officer.policeTaskTargetId == null,
    );
    const nearest = (officers: Entity[], target: Entity) =>
      officers
        .map((officer) => ({
          officer,
          distance: Math.hypot(officer.x - target.x, officer.y - target.y),
        }))
        .sort(
          (a, b) => a.distance - b.distance || a.officer.id - b.officer.id,
        )[0]?.officer;
    for (const target of targets) {
      if (humanTaskTargets.has(target.id)) continue;
      const botOwner = botTaskOwners.get(target.id);
      if (freeHumans.length) {
        if (botOwner) {
          botOwner.policeTaskTargetId = undefined;
          botTaskOwners.delete(target.id);
          assignedTargets.delete(target.id);
        } else if (assignedTargets.has(target.id)) {
          continue;
        }
        const officer = nearest(freeHumans, target)!;
        freeHumans.splice(freeHumans.indexOf(officer), 1);
        assignedHumans.add(officer.profileId!);
        humanTaskTargets.add(target.id);
        this.policeTasks.set(officer.profileId!, {
          mapId: w.map.id,
          targetId: target.id,
        });
        assignedTargets.add(target.id);
      } else if (!assignedTargets.has(target.id) && freeBots.length) {
        const officer = nearest(freeBots, target)!;
        freeBots.splice(freeBots.indexOf(officer), 1);
        officer.order = null;
        officer.policeTaskTargetId = target.id;
        assignedTargets.add(target.id);
      }
    }
  }
  join(id: string, mapId: MapId, role: Role, areaId: AreaId = "gathering") {
    if (
      !maps.includes(mapId) ||
      !["protester", "police", "military", "watcher"].includes(role) ||
      !["gathering", "approach"].includes(areaId)
    )
      throw new Error("Invalid location or role");
    if (!this.players.has(id) && this.players.size >= 64)
      throw new Error("Public world at player capacity");
    const p = this.store.profile(id),
      old = this.entity(id),
      saved = this.store.character(id),
      previous = old ?? saved;
    if (
      previous?.state === "detained" &&
      previous.custodyUntil != null &&
      previous.custodyUntil <= this.worlds[p.mapId].time
    ) {
      previous.state = "idle";
      previous.detainedBy = null;
      previous.detainOfficer = null;
      previous.detainProgress = 0;
      previous.wanted = 0;
      previous.violentT = 0;
      previous.recentThrowT = 0;
      previous.custodyUntil = undefined;
      this.store.saveCharacter(id, previous);
    }
    const changing = p.mapId !== mapId || p.role !== role;
    if (role === "military" && p.appointmentUntil <= this.time)
      throw new Error("Military appointments are earned by police performance");
    if (
      role === "military" &&
      old?.kind !== "military" &&
      Object.values(this.worlds)
        .flatMap((w) => w.entities)
        .filter((e) => e.isPlayer && !e.remove && e.kind === "military")
        .length >= 5
    )
      throw new Error("All five military appointments are occupied");
    if (
      changing &&
      (p.deathUntil > 0 ||
        previous?.state === "down" ||
        previous?.state === "detained")
    )
      throw new Error("Wait for release or respawn");
    if (
      changing &&
      previous &&
      ((previous.wanted ?? 0) > 0 ||
        previous.violentT > 0 ||
        previous.hp < previous.maxHp ||
        previous.cooldown > 0)
    )
      throw new Error(
        "Cannot change role or location during an active incident",
      );
    if (
      changing &&
      p.role !== role &&
      (this.store.openBets(id).length > 0 ||
        Object.values(this.store.holdings(id)).some((q) => q > 0) ||
        this.store.meta(`fund:${id}`, 0) > this.time)
    )
      throw new Error(
        "Close financial exposure and funding cooldown before changing role",
      );
    if (
      !changing &&
      this.players.get(id)?.connected &&
      (old || role === "watcher")
    ) {
      if (old) old.name = p.name;
      return;
    }
    const backups = structuredClone(this.worlds);
    try {
      this.store.atomic(() => {
        if (changing && old) old.remove = true;
        if (changing) this.store.saveCharacter(id, null);
        p.mapId = mapId;
        p.role = role;
        this.store.saveProfile(p);
        const w = this.worlds[mapId];
        if (!this.entity(id) && role !== "watcher") {
          const character = this.store.character(id);
          if (character && character.kind === role) {
            character.id = w.nextId++;
            character.remove = false;
            character.remote = true;
            character.isPlayer = true;
            w.entities.push(character);
          } else {
            const entity = spawnPlayer(w, role, p.name, id);
            if (entity) {
              const point = entryPoint(w.map, role, areaId);
              Object.assign(
                entity,
                collideBuildings(w.map, point.x, point.y, 9),
              );
            }
            if (entity && p.deathUntil > 0) {
              entity.state = "down";
              entity.hp = 0;
              entity.deathUntil = p.deathUntil;
              entity.stateT = Math.max(0, p.deathUntil - w.time);
            }
          }
        }
        const joined = this.entity(id);
        if (joined) joined.name = p.name;
        this.checkpoint();
      });
    } catch (error) {
      this.worlds = backups;
      throw error;
    }
    this.appointments.set(id, p.appointmentUntil);
    this.players.set(id, {
      input: { ...idle },
      at: this.time,
      seen: this.time,
      connected: true,
    });
    for (const mapId of maps) this.reconcilePoliceTasks(this.worlds[mapId]);
  }
  input(id: string, input: InputState) {
    const state = this.players.get(id);
    if (!state?.connected) throw new Error("Join a world first");
    state.input = { ...input };
    state.at = this.time;
    state.seen = this.time;
    const e = this.entity(id);
    if (e) e.target = { x: input.mouseX, y: input.mouseY };
  }
  disconnect(id: string) {
    const state = this.players.get(id);
    if (state) {
      state.connected = false;
      state.input = { ...idle };
      state.seen = this.time;
      const player = this.entity(id);
      if (player) player.objectiveUntil = undefined;
      this.reconcilePoliceTasks(this.worlds[this.store.profile(id).mapId]);
    }
  }
  command(id: string, message: ClientMessage) {
    if (!parseMessage(message)) throw new Error("Invalid command");
    if (message.type === "join")
      return this.join(id, message.mapId, message.role, message.areaId);
    if (message.type === "input") return this.input(id, message.input);
    if (message.type === "ping") return;
    if (!this.players.get(id)?.connected) throw new Error("Join a world first");
    const p = this.store.profile(id),
      w = this.worlds[p.mapId],
      e = this.entity(id);
    if (message.type === "observe") {
      if (p.role !== "watcher")
        throw new Error("Only spectators can switch observation locations");
      return this.join(id, message.mapId, "watcher");
    }
    if (message.type === "respawn") {
      if (!e || e.state !== "down" || (e.deathUntil ?? Infinity) > w.time)
        throw new Error("Respawn is not available yet");
      const backup = structuredClone(w);
      try {
        e.remove = true;
        p.role = message.role;
        p.lifeId++;
        p.lifeCredits = 69;
        p.deathUntil = 0;
        p.appointmentUntil = 0;
        this.store.atomic(() => {
          this.store.saveProfile(p);
          this.store.saveCharacter(id, null);
          spawnPlayer(w, message.role, p.name, id);
          this.checkpoint();
        });
      } catch (error) {
        this.worlds[p.mapId] = backup;
        throw error;
      }
      this.appointments.set(id, 0);
      return;
    }
    if (
      message.type === "trade" ||
      message.type === "bet" ||
      message.type === "fund"
    ) {
      const backup = structuredClone(w);
      const { seq: _seq, v: _v, ...payload } = message;
      void _seq;
      void _v;
      try {
        this.store.operate(id, message.requestId, payload, () => {
          if (p.role !== "watcher")
            throw new Error("Financial actions require the spectator role");
          const active = this.store.openBets(id);
          const blockedUntil = this.store.meta(`fund:${id}`, 0);
          if (message.type !== "fund" && blockedUntil > this.time)
            throw new Error(
              "Funding cooldown: wait 60 seconds before trading or predicting",
            );
          if (message.type === "trade") {
            const ins = this.worlds.delhi.instruments.find(
              (i) => i.id === message.instrument,
            );
            if (!ins) throw new Error("Unknown instrument");
            const holdings = this.store.holdings(id),
              qty = (holdings[ins.id] ?? 0) + message.quantity;
            if (qty < 0) throw new Error("Insufficient holdings");
            const value = Math.round(ins.price) * message.quantity,
              fee = Math.max(1, Math.ceil(Math.abs(value) * 0.02));
            this.store.credit(
              id,
              -value - fee,
              "market trade",
              `${id}:${message.requestId}`,
            );
            this.store.setHolding(id, ins.id, qty);
          } else if (message.type === "fund") {
            if (
              active.length ||
              Object.values(this.store.holdings(id)).some((q) => q > 0)
            )
              throw new Error("Close predictions and positions before funding");
            if (
              w.entities.filter(
                (e) =>
                  !e.remove &&
                  !e.roadsidePickup &&
                  (e.kind === "truck" || e.kind === "crate"),
              ).length >= 20
            )
              throw new Error("Supply routes at capacity");
            const supply = supplyOption(message.faction, message.kind);
            if (!supply)
              throw new Error(
                "That supply loadout is unavailable for this faction",
              );
            this.store.credit(
              id,
              -supply.price,
              "supply funding",
              `${id}:${message.requestId}`,
            );
            spawnSupply(w, message.faction, supply.kind);
            this.store.setMeta(`fund:${id}`, this.time + 60);
          } else {
            if (
              active.length >= 5 ||
              message.stake > Math.max(1, Math.floor(p.credits * 0.2))
            )
              throw new Error(
                "Prediction limit: five open contracts, at most 20% of balance each",
              );
            const target = w.entities.find(
              (e) =>
                e.id === message.targetId &&
                e.kind !== "truck" &&
                e.kind !== "crate" &&
                !e.remove &&
                e.state !== "down" &&
                e.state !== "detained",
            );
            if (message.contract === "free60" && !target)
              throw new Error("Select an active person");
            if (
              (message.contract === "capture120" ||
                message.contract === "defend120") &&
              (!w.objective ||
                w.objective.status !== "protected" ||
                w.objective.progress > 0)
            )
              throw new Error(
                "Objective predictions are suspended during active capture or recovery",
              );
            this.store.credit(
              id,
              -message.stake,
              "prediction stake",
              `${id}:${message.requestId}`,
            );
            this.store.saveBet({
              id: randomUUID(),
              profileId: id,
              mapId: p.mapId,
              contract: message.contract,
              targetId: target?.id,
              stake: message.stake,
              odds: 2,
              deadline: w.time + (message.contract.endsWith("120") ? 120 : 60),
              cycle: w.objective?.cycle ?? 0,
              status: "open",
            });
          }
          this.checkpoint();
          return { accepted: true };
        });
        this.pending = new Map(
          this.store
            .bets()
            .filter((b) => b.status === "open")
            .map((b) => [b.id, b]),
        );
      } catch (error) {
        this.worlds[p.mapId] = backup;
        throw error;
      }
      return;
    }
    if (!e || e.state === "down" || e.state === "detained")
      throw new Error("Your character cannot act");
    if (e.kind === "military" && p.appointmentUntil <= this.time)
      throw new Error("Military appointment expired");
    w.player = e;
    w.role = p.role;
    w.playerName = p.name;
    w.careerDetentions = p.detentions;
    const feedBefore = w.feedSeq;
    try {
      if (message.type === "order") issueOrder(w, message.x, message.y, "move");
      else if (message.type === "action") {
        if (message.action === "secondary" && e.kind === "protester") {
          if (e.stones <= 0)
            throw new Error(
              "Out of stones. Collect a protester supply crate to reload.",
            );
          if (e.cooldown > 0)
            throw new Error(
              "Recovering from your last action. Try again shortly.",
            );
        }
        if (message.action === "interact") {
          if (collectResource(w, e))
            feed(
              w,
              e.name + " collected essentials; food and water restored.",
              "good",
            );
          else if (lootShop(w, e))
            feed(w, e.name + " took food from a shop.", "good");
          else if (interactObjective(w, e))
            feed(
              w,
              e.name +
                " joined the Constitution Book objective. Stay nearby to contribute.",
              "good",
            );
          else
            feed(
              w,
              "Nothing to use here. Reach a supply point or the Constitution Book as a protester.",
            );
        } else if (message.action === "exit") {
          if (exitBuilding(w, e))
            feed(w, e.name + " left the building.", "good");
          else feed(w, "Move to the marked interior exit before leaving.");
        } else if (message.action === "enter") {
          const building = w.map.buildings
            .filter((b) => b.entrance && b.interior && b.id)
            .sort(
              (a, b) =>
                Math.hypot(a.entrance!.x - e.x, a.entrance!.y - e.y) -
                Math.hypot(b.entrance!.x - e.x, b.entrance!.y - e.y),
            )[0];
          if (building?.id && enterBuilding(w, e, building.id))
            feed(
              w,
              e.name +
                " entered " +
                (building.name ? placeName(building.name) : "the building") +
                ".",
              "good",
            );
          else feed(w, "Move to a marked open doorway to enter.");
        } else doAction(w, message.action, message.targetId);
        if (w.feedSeq > feedBefore) return w.feed[0].text;
      }
    } finally {
      w.player = null;
      w.role = "watcher";
    }
  }
  advance(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05)
      throw new Error("Invalid simulation step");
    for (const mapId of maps) {
      const w = this.worlds[mapId];
      for (const e of w.entities.filter((e) => e.profileId && !e.remove)) {
        if (e.kind === "military" && e.state !== "down") {
          if (
            (this.appointments.get(e.profileId!) ?? 0) <= this.time &&
            e.state !== "detain"
          ) {
            const profile = this.store.profile(e.profileId!);
            e.kind = "police";
            e.faction = "police";
            profile.role = "police";
            this.store.saveProfile(profile);
          }
        }
        const state = this.players.get(e.profileId!);
        if (state && !state.connected && w.time - state.seen > 20) {
          this.store.saveCharacter(e.profileId!, e);
          e.remove = true;
          this.players.delete(e.profileId!);
          continue;
        }
        updatePlayer(
          w,
          e,
          state && state.connected && this.time - state.at < 0.5
            ? state.input
            : idle,
          dt,
        );
      }
      update(w, dt, idle);
      this.reconcilePoliceTasks(w);
      this.settle(w);
    }
    if (Math.floor(this.time / 1.5) > Math.floor((this.time - dt) / 1.5)) {
      const worlds = maps.map((id) => this.worlds[id]);
      const average = (value: (w: World) => number) =>
        worlds.reduce((sum, w) => sum + value(w), 0) / worlds.length;
      const tension = average((w) => w.tension);
      const damage = average((w) => w.damage);
      const violence = average((w) => w.violenceRate);
      const fair: Record<string, number> = {
        calm: Math.max(8, Math.min(200, 105 - tension * 0.85)),
        chaos: Math.max(5, Math.min(300, 15 + tension * 1.25)),
        glass: Math.max(10, Math.min(350, 28 + damage * 0.55)),
        media: Math.max(10, Math.min(300, 35 + violence * 9 + tension * 0.4)),
      };
      for (const instrument of this.worlds.delhi.instruments) {
        instrument.prev = instrument.price;
        instrument.price = Math.round(
          Math.max(
            3,
            Math.min(
              400,
              instrument.price +
                (fair[instrument.id] - instrument.price) * 0.22,
            ),
          ),
        );
        instrument.history.push(instrument.price);
        if (instrument.history.length > 80) instrument.history.shift();
      }
      this.syncMarketQuotes();
    }
    for (const [id, state] of this.players)
      if (!state.connected && this.time - state.seen > 20)
        this.players.delete(id);
    this.appoint();
    if (this.time - this.saved >= 5) this.checkpoint();
  }
  private settle(w: World) {
    const cursor = this.eventCursors.get(w.map.id) ?? 0,
      events = w.events.filter((e) => e.id > cursor);
    const due = Array.from(this.pending.values())
      .filter((b) => b.mapId === w.map.id && b.status === "open")
      .map((b) => ({ ...b }));
    if (!events.length && !due.some((b) => w.time >= b.deadline)) return;
    this.store.atomic(() => {
      for (const event of events) {
        const actor = w.entities.find((e) => e.id === event.actorId),
          target = w.entities.find((e) => e.id === event.targetId);
        if (
          event.type === "objective_capture" ||
          event.type === "objective_defense"
        ) {
          const faction = event.faction === "police" ? "Police" : "Protesters";
          feed(
            w,
            `${faction} ${event.type === "objective_capture" ? "secured" : "defended"} the Constitution Book.${actor?.profileId ? ` ${actor.name} led individual contributions.` : ""}`,
            "good",
          );
        }
        for (const bet of due) {
          if (
            bet.contract === "free60" &&
            bet.targetId === event.targetId &&
            (event.type === "detention" || event.type === "death")
          )
            bet.failed = true;
          if (
            bet.contract === "capture120" &&
            event.type === "objective_capture" &&
            event.details === `cycle:${bet.cycle}`
          )
            ((bet.failed = false), (bet.resolved = true));
          if (
            bet.contract === "defend120" &&
            event.type === "objective_capture" &&
            event.details === `cycle:${bet.cycle}`
          )
            bet.failed = true;
          if (
            bet.contract === "defend120" &&
            event.type === "objective_defense" &&
            event.details === `cycle:${bet.cycle}`
          )
            bet.resolved = true;
        }
        if (target?.profileId && event.type === "death") {
          const p = this.store.profile(target.profileId);
          p.deathUntil = target.deathUntil ?? w.time + 30;
          p.appointmentUntil = 0;
          this.store.saveProfile(p);
          this.appointments.set(p.id, 0);
        }
        if (!actor?.profileId) continue;
        const rewards: Partial<Record<typeof event.type, number>> = {
          chant: 1,
          detention: 8,
          evasion: 4,
          objective_contribution: 3,
          objective_team_reward: 5,
          objective_capture: 15,
          objective_defense: 10,
        };
        const reward = rewards[event.type] ?? 0,
          p = this.store.profile(actor.profileId);
        if (event.type === "unjustified_detention") {
          p.penalties++;
          p.policeScore -= 10;
          p.score -= 10;
          this.store.saveProfile(p);
        } else if (reward) {
          p.score += reward;
          if (actor.kind === "police" || actor.kind === "military") {
            p.policeScore += reward;
            if (event.type === "detention") p.detentions++;
          } else p.protesterScore += reward;
          this.store.saveProfile(p);
          this.store.credit(
            p.id,
            reward,
            event.type,
            `${w.map.id}:event:${event.id}`,
          );
        }
      }
      for (const bet of due) {
        if (w.time >= bet.deadline) this.finishBet(w, bet);
        this.store.saveBet(bet);
      }
      if (events.length)
        this.store.setMeta(`events:${w.map.id}`, events.at(-1)!.id);
      this.saveWorld(w);
    });
    if (events.length) this.eventCursors.set(w.map.id, events.at(-1)!.id);
    for (const bet of due)
      if (bet.status === "open") this.pending.set(bet.id, bet);
      else this.pending.delete(bet.id);
  }
  private finishBet(w: World, b: Prediction) {
    const target = w.entities.find((e) => e.id === b.targetId && !e.remove);
    if (b.contract === "free60" && !target && !b.failed) {
      b.status = "refunded";
      this.store.credit(
        b.profileId,
        b.stake,
        "prediction refund",
        `settle:${b.id}`,
      );
      return;
    }
    const won =
      !b.failed &&
      (b.contract === "free60" ||
        (b.contract === "defend120" && b.resolved === true) ||
        (b.contract === "capture120" && b.resolved === true) ||
        (b.contract === "unrest60" && w.tension >= 60));
    b.status = won ? "won" : "lost";
    if (won)
      this.store.credit(
        b.profileId,
        b.stake * b.odds,
        "prediction payout",
        `settle:${b.id}`,
      );
    const p = this.store.profile(b.profileId);
    p.watcherProfit += won ? b.stake : -b.stake;
    this.store.saveProfile(p);
  }
  private appoint() {
    const cycle = Math.floor(this.time / 900);
    if (cycle <= this.appointmentCycle) return;
    this.store.atomic(() => {
      const profiles = Array.from(this.players.entries())
        .filter(([, state]) => state.connected)
        .map(([id]) => this.store.profile(id));
      const eligible = profiles
        .filter((p) => p.role === "police")
        .map((p) => ({
          ...p,
          recent: p.policeScore - this.store.meta(`policeWindow:${p.id}`, 0),
        }))
        .filter((p) => p.recent > 0)
        .sort((a, b) => b.recent - a.recent || a.id.localeCompare(b.id))
        .slice(0, 5);
      for (const p of profiles) {
        p.appointmentUntil = eligible.some((e) => e.id === p.id)
          ? (cycle + 1) * 900
          : 0;
        this.store.saveProfile(p);
        this.appointments.set(p.id, p.appointmentUntil);
        this.store.setMeta(`policeWindow:${p.id}`, p.policeScore);
      }
      this.store.setMeta("appointmentCycle", cycle);
    });
    this.appointmentCycle = cycle;
  }
  private saveWorld(w: World) {
    this.store.saveWorld(w.map.id, { ...w, player: null });
    for (const e of w.entities.filter((e) => e.profileId && !e.remove))
      this.store.saveCharacter(e.profileId!, e);
  }
  checkpoint() {
    this.store.atomic(() => {
      for (const id of maps) this.saveWorld(this.worlds[id]);
    });
    this.saved = this.time;
  }
  snapshot(id: string, ack: number, online: number): Snapshot {
    const p = this.store.profile(id),
      w = this.worlds[p.mapId],
      player = this.entity(id) ?? null;
    const assignment =
      p.role === "police" ? this.policeTasks.get(id) : undefined;
    const target =
      assignment?.mapId === p.mapId
        ? w.entities.find((e) => e.id === assignment.targetId && active(e))
        : undefined;
    const building = target?.buildingId
      ? w.map.buildings.find((item) => item.id === target.buildingId)
      : undefined;
    const policeTask: PoliceDispatch | undefined = target
      ? {
          targetId: target.id,
          name: target.name,
          wantedLevel: target.wanted,
          x: building?.entrance?.x ?? target.x,
          y: building?.entrance?.y ?? target.y,
          inBuilding: !!target.buildingId,
        }
      : undefined;
    const entities =
      p.role === "watcher"
        ? w.entities
        : w.entities.filter(
            (e) =>
              e === player ||
              e.id === policeTask?.targetId ||
              (player &&
                e.buildingId === player.buildingId &&
                Math.hypot(e.x - player.x, e.y - player.y) < 1100),
          );
    return {
      v: 1,
      type: "snapshot",
      tick: w.tick,
      ack,
      self: p,
      world: {
        ...w,
        entities,
        player,
        role: p.role,
        playerName: p.name,
        playerId: id,
        wallet: p.credits,
        careerDetentions: p.detentions,
        holdings: this.store.holdings(id),
        instruments: this.worlds.delhi.instruments,
      },
      holdings: this.store.holdings(id),
      predictions: this.store.recentBets(id),
      rankings: this.store.rankings(),
      online,
      appointmentIn: 900 - (this.time % 900),
      ...(policeTask ? { policeTask } : {}),
    };
  }
}
