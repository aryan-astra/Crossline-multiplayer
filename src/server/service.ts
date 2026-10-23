import { randomUUID } from "node:crypto";
import {
  createWorld,
  doAction,
  feed,
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
} from "../game/world-rules";
import type { Entity, InputState, MapId, Role, World } from "../game/types";
import {
  parseMessage,
  type ClientMessage,
  type Prediction,
  type Snapshot,
} from "../network/protocol";
import { Store } from "./store";

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
        w.player = null;
        w.role = "watcher";
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
  private entity(id: string): Entity | undefined {
    return this.worlds[this.store.profile(id).mapId].entities.find(
      (e) => e.profileId === id && !e.remove,
    );
  }
  join(id: string, mapId: MapId, role: Role) {
    if (
      !maps.includes(mapId) ||
      !["protester", "police", "military", "watcher"].includes(role)
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
            if (entity && p.deathUntil > 0) {
              entity.state = "down";
              entity.hp = 0;
              entity.deathUntil = p.deathUntil;
              entity.stateT = Math.max(0, p.deathUntil - w.time);
            }
          }
        }
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
    }
  }
  command(id: string, message: ClientMessage) {
    if (!parseMessage(message)) throw new Error("Invalid command");
    if (message.type === "join")
      return this.join(id, message.mapId, message.role);
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
                (e) => !e.remove && (e.kind === "truck" || e.kind === "crate"),
              ).length >= 20
            )
              throw new Error("Supply routes at capacity");
            this.store.credit(
              id,
              -20,
              "supply funding",
              `${id}:${message.requestId}`,
            );
            spawnSupply(w, message.faction);
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
    try {
      if (message.type === "order") issueOrder(w, message.x, message.y, "move");
      else if (message.type === "action") {
        if (message.action === "interact") {
          if (collectResource(w, e))
            feed(
              w,
              e.name + " collected essentials; food and water restored.",
              "good",
            );
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
              e.name + " entered " + (building.name ?? "the building") + ".",
              "good",
            );
          else feed(w, "Move to a marked open doorway to enter.");
        } else doAction(w, message.action, message.targetId);
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
      this.settle(w);
    }
    if (Math.floor(this.time / 5) > Math.floor((this.time - dt) / 5)) {
      const worlds = maps.map((id) => this.worlds[id]);
      const tension =
        worlds.reduce((sum, w) => sum + w.tension, 0) / worlds.length;
      const damage = worlds.reduce((sum, w) => sum + w.damage, 0),
        violence = worlds.reduce((sum, w) => sum + w.violenceRate, 0);
      const fair: Record<string, number> = {
        calm: 105 - tension * 0.85,
        chaos: 15 + tension * 1.25,
        glass: 28 + damage * 0.55,
        media: 35 + violence * 9 + tension * 0.4,
      };
      for (const w of worlds)
        for (const instrument of w.instruments)
          instrument.price = Math.round(
            Math.max(3, Math.min(400, fair[instrument.id])),
          );
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
    const entities =
      p.role === "watcher"
        ? w.entities
        : w.entities.filter(
            (e) =>
              e === player ||
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
    };
  }
}
