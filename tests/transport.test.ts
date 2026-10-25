import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { createGameServer } from "../src/server/transport";
import { Store } from "../src/server/store";
import type { Profile, ServerMessage, Snapshot } from "../src/network/protocol";
import { readServerMessage } from "../src/network/client";
import type { MapDef, MapId } from "../src/game/types";

async function setup(tick = false, publicOrigin?: string) {
  const store = new Store(":memory:");
  const game = createGameServer({ store, tick, publicOrigin });
  game.server.listen(0, "127.0.0.1");
  await once(game.server, "listening");
  const address = game.server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const connections: WebSocket[] = [];
  async function guest(name: string) {
    const response = await fetch(`${origin}/api/session`, {
      method: "POST",
      headers: {
        Origin: publicOrigin ?? origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const body = (await response.json()) as { profile: Profile };
    return { cookie: cookie.split(";")[0], profile: body.profile };
  }
  async function connect(cookie: string) {
    const ws = new WebSocket(`${origin.replace("http", "ws")}/socket`, {
      headers: { Cookie: cookie, Origin: publicOrigin ?? origin },
    });
    connections.push(ws);
    const messages: (
      | Snapshot
      | Extract<ServerMessage, { type: "ack" | "error" }>
    )[] = [];
    const maps = new Map<MapId, MapDef>();
    const rawFrames: string[] = [];
    ws.on("message", (raw) => {
      rawFrames.push(raw.toString());
      const message = readServerMessage(raw.toString(), maps);
      if (message && message.type !== "map") messages.push(message);
    });
    ws.on("error", () => {});
    await once(ws, "open");
    async function wait<T extends ServerMessage>(
      predicate: (message: ServerMessage) => message is T,
    ): Promise<T>;
    async function wait(
      predicate: (message: ServerMessage) => boolean,
    ): Promise<ServerMessage>;
    async function wait(predicate: (message: ServerMessage) => boolean) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = messages.find(predicate);
        if (value) return value;
        await delay(10);
      }
      throw new Error(
        `Timed out waiting for server event: ${JSON.stringify(messages.map((m) => ({ type: m.type, seq: "seq" in m ? m.seq : m.tick })))}`,
      );
    }
    return {
      ws,
      messages,
      rawFrames,
      wait,
      send: (value: unknown) => ws.send(JSON.stringify(value)),
    };
  }
  async function close() {
    for (const ws of connections) ws.terminate();
    await game.close();
    store.close();
  }
  return { ...game, store, origin, guest, connect, close };
}

test("explicit HTTPS proxy origin accepts the public site, sets secure cookies and rejects forwarded-header spoofing", async () => {
  const game = await setup(false, "https://crossline.example");
  try {
    const guest = await game.guest("Proxy player");
    const response = await fetch(`${game.origin}/api/session`);
    assert.match(response.headers.get("set-cookie")!, /; Secure/);
    const socket = await game.connect(guest.cookie);
    await socket.wait(
      (message): message is Snapshot => message.type === "snapshot",
    );
    const rejected = await fetch(`${game.origin}/api/session`, {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": "attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Spoof" }),
    });
    assert.equal(rejected.status, 403);
  } finally {
    await game.close();
  }
});

test("overloaded simulation yields to network I/O instead of chaining catch-up steps", async () => {
  const game = await setup(true);
  let calls = 0,
    maxCalls = 0;
  game.service.advance = () => {
    calls++;
    maxCalls = Math.max(maxCalls, calls);
    if (calls === 1)
      setImmediate(() => {
        calls = 0;
      });
    const end = performance.now() + 45;
    while (performance.now() < end) {
      /* Deliberate workload beyond the 33ms step budget. */
    }
  };
  try {
    await delay(250);
    const response = await fetch(`${game.origin}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(maxCalls, 1);
  } finally {
    await game.close();
  }
});

test("live snapshots skip compression and coalesce while a write is unfinished", async () => {
  const original = WebSocket.prototype.send;
  const frames: { type: string; compress?: boolean }[] = [];
  let release: (() => void) | undefined;
  WebSocket.prototype.send = function (
    data,
    options?: Parameters<typeof original>[1] | ((error?: Error) => void),
    callback?: (error?: Error) => void,
  ) {
    const config = typeof options === "function" ? {} : (options ?? {});
    const done = typeof options === "function" ? options : callback;
    const type = typeof data === "string" ? JSON.parse(data).type : undefined;
    if (["snapshot", "delta", "map", "ack"].includes(type))
      frames.push({ type, compress: config.compress });
    if (type === "snapshot") {
      return original.call(this, data, config, (error) => {
        release = () => done?.(error);
      });
    }
    return original.call(this, data, config, done);
  };
  const game = await setup();
  try {
    const guest = await game.guest("Backpressure QA");
    const connection = await game.connect(guest.cookie);
    assert.equal(connection.ws.extensions, "");
    await connection.wait((m) => m.type === "snapshot");
    const sentCount = () =>
      frames.filter((f) => ["snapshot", "delta"].includes(f.type)).length;
    const count = sentCount();
    connection.send({ v: 1, seq: 1, requestId: "ping-busy", type: "ping" });
    await connection.wait((m) => m.type === "ack" && m.seq === 1);
    await delay(250);
    assert.equal(sentCount(), count);
    assert.ok(
      frames
        .filter((f) => ["snapshot", "delta"].includes(f.type))
        .every((f) => f.compress === false),
    );
    assert.ok(frames.some((f) => f.type === "map" && f.compress === false));
    release?.();
    await delay(150);
    assert.ok(sentCount() > count);
  } finally {
    WebSocket.prototype.send = original;
    await game.close();
  }
});

test("two authenticated WebSocket sessions share server movement, bot state and objective; replay is rejected", async () => {
  const game = await setup();
  try {
    const actor = await game.guest("Actor"),
      observer = await game.guest("Observer");
    const first = await game.connect(actor.cookie),
      second = await game.connect(observer.cookie);
    first.send({
      v: 1,
      seq: 1,
      requestId: "join-actor",
      type: "join",
      supportsDeltas: true,
      mapId: "delhi",
      role: "protester",
    });
    second.send({
      v: 1,
      seq: 1,
      requestId: "join-observer",
      type: "join",
      supportsDeltas: true,
      mapId: "delhi",
      role: "watcher",
    });
    await first.wait((m) => m.type === "ack" && m.seq === 1);
    await second.wait((m) => m.type === "ack" && m.seq === 1);
    const player = game.service.worlds.delhi.entities.find(
      (e) => e.profileId === actor.profile.id,
    )!;
    assert.ok(player);
    const x = player.x;
    first.send({
      v: 1,
      seq: 2,
      requestId: "move",
      type: "input",
      input: {
        up: false,
        down: false,
        left: false,
        right: true,
        sprint: false,
        mouseX: player.x + 100,
        mouseY: player.y,
      },
    });
    await first.wait((m) => m.type === "ack" && m.seq === 2);
    for (let i = 0; i < 6; i++) game.service.advance(1 / 30);
    const tick = game.service.worlds.delhi.tick;
    const a = await first.wait(
      (m): m is Snapshot => m.type === "snapshot" && m.tick === tick,
    );
    const b = await second.wait(
      (m): m is Snapshot => m.type === "snapshot" && m.tick === tick,
    );
    assert.equal(
      first.rawFrames.filter((raw) => JSON.parse(raw).type === "map").length,
      1,
    );
    const baseline = JSON.stringify(
      game.service.snapshot(actor.profile.id, 1, 2),
    );
    const compact = first.rawFrames.find((raw) => {
      const frame = JSON.parse(raw);
      return ["snapshot", "delta"].includes(frame.type) && frame.tick === tick;
    })!;
    assert.ok(
      compact.length < baseline.length * 0.7,
      `${compact.length} < ${baseline.length} * 0.7`,
    );
    assert.equal(JSON.parse(compact).type, "delta");
    assert.equal(first.ws.extensions, "");
    assert.deepEqual(
      JSON.parse(JSON.stringify(a.world.map)),
      JSON.parse(JSON.stringify(game.service.worlds.delhi.map)),
    );
    const seenA = a.world.entities.find(
      (e) => e.profileId === actor.profile.id,
    )!;
    const seenB = b.world.entities.find(
      (e) => e.profileId === actor.profile.id,
    )!;
    assert.ok(seenA.x > x);
    assert.equal(seenA.x, seenB.x);
    assert.equal(seenA.y, seenB.y);
    assert.deepEqual(a.world.objective, b.world.objective);
    for (const entity of a.world.entities.filter((e) => !e.profileId)) {
      const other = b.world.entities.find((e) => e.id === entity.id)!;
      assert.ok(other);
      assert.deepEqual(
        [entity.x, entity.y, entity.state],
        [other.x, other.y, other.state],
      );
    }
    first.send({
      v: 1,
      seq: 2,
      requestId: "replayed",
      type: "action",
      action: "primary",
    });
    const stale = await first.wait((m) => m.type === "error" && m.seq === 2);
    assert.match("message" in stale ? stale.message : "", /Stale/);
    first.send({
      v: 1,
      seq: 3,
      requestId: "escalate",
      type: "join",
      mapId: "delhi",
      role: "military",
    });
    await first.wait((m) => m.type === "error" && m.seq === 3);
    assert.equal(game.store.profile(actor.profile.id).role, "protester");
    const health = (await fetch(`${game.origin}/api/health`).then((r) =>
      r.json(),
    )) as { ok: boolean; online: number };
    assert.deepEqual(health, { ok: true, online: 2 });
  } finally {
    await game.close();
  }
});

test("legacy joins continue receiving full snapshots", async () => {
  const game = await setup();
  try {
    const legacy = await game.guest("Legacy client");
    const socket = await game.connect(legacy.cookie);
    socket.send({
      v: 1,
      seq: 1,
      requestId: "legacy-join",
      type: "join",
      mapId: "delhi",
      role: "watcher",
    });
    await socket.wait((m) => m.type === "ack" && m.seq === 1);
    await delay(250);
    const frames = socket.rawFrames.map((raw) => JSON.parse(raw));
    assert.ok(frames.filter((frame) => frame.type === "snapshot").length >= 2);
    assert.equal(
      frames.some((frame) => frame.type === "delta"),
      false,
    );
  } finally {
    await game.close();
  }
});

test("reconnection and replacing a tab preserve one guest identity, character and allocation", async () => {
  const game = await setup();
  try {
    const actor = await game.guest("Returning");
    const first = await game.connect(actor.cookie);
    first.send({
      v: 1,
      seq: 1,
      requestId: "join",
      type: "join",
      mapId: "delhi",
      role: "police",
    });
    await first.wait((m) => m.type === "ack" && m.seq === 1);
    const id = game.service.worlds.delhi.entities.find(
      (e) => e.profileId === actor.profile.id,
    )!.id;
    const closed = once(first.ws, "close");
    const replacement = await game.connect(actor.cookie);
    await closed;
    replacement.send({
      v: 1,
      seq: 1,
      requestId: "rejoin",
      type: "join",
      mapId: "delhi",
      role: "police",
    });
    await replacement.wait((m) => m.type === "ack" && m.seq === 1);
    const disconnected = once(replacement.ws, "close");
    replacement.ws.close();
    await disconnected;
    const resumed = await game.connect(actor.cookie);
    resumed.send({
      v: 1,
      seq: 1,
      requestId: "resume",
      type: "join",
      mapId: "delhi",
      role: "police",
    });
    await resumed.wait((m) => m.type === "ack" && m.seq === 1);
    assert.deepEqual(
      game.service.worlds.delhi.entities
        .filter((e) => !e.remove && e.profileId === actor.profile.id)
        .map((e) => e.id),
      [id],
    );
    const response = await fetch(`${game.origin}/api/session`, {
      headers: { Cookie: actor.cookie },
    });
    const body = (await response.json()) as { profile: Profile };
    assert.equal(body.profile.id, actor.profile.id);
    assert.equal(body.profile.credits, 69);
    assert.equal(game.store.recentLedger(actor.profile.id).length, 1);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally {
    await game.close();
  }
});

test("HTTP and WebSocket boundaries reject foreign origins, missing identity, oversized and forged data", async () => {
  const game = await setup();
  try {
    const response = await fetch(`${game.origin}/api/session`, {
      method: "POST",
      headers: {
        Origin: "https://foreign.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Attacker" }),
    });
    assert.equal(response.status, 403);
    const actor = await game.guest("Authenticated");
    const reject = async (
      headers: Record<string, string>,
      expected: number,
    ) => {
      const ws = new WebSocket(`${game.origin.replace("http", "ws")}/socket`, {
        headers,
      });
      ws.on("error", () => {});
      await new Promise<void>((resolve, reject) => {
        ws.on("unexpected-response", (_request, reply) => {
          reply.resume();
          ws.terminate();
          try {
            assert.equal(reply.statusCode, expected);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        ws.on("open", () => {
          ws.terminate();
          reject(new Error("Unauthorized socket opened"));
        });
      });
    };
    await reject({ Origin: game.origin }, 401);
    await reject(
      { Origin: "https://foreign.invalid", Cookie: actor.cookie },
      403,
    );
    const client = await game.connect(actor.cookie);
    client.send({
      v: 1,
      seq: 1,
      requestId: "forged",
      type: "credit",
      amount: 100000,
    });
    await client.wait((m) => m.type === "error");
    assert.equal(game.store.profile(actor.profile.id).credits, 69);
    const closing = once(client.ws, "close");
    client.ws.send("x".repeat(8193));
    const [code] = await closing;
    assert.equal(code, 1009);
  } finally {
    await game.close();
  }
});

test("automatic authoritative ticks advance both public locations without a browser", async () => {
  const game = await setup(true);
  try {
    const before = game.service.worlds.delhi.tick;
    await delay(150);
    assert.ok(game.service.worlds.delhi.tick > before);
    assert.equal(
      game.service.worlds.delhi.tick,
      game.service.worlds.paris.tick,
    );
  } finally {
    await game.close();
  }
});

test("malformed frames, input floods and repeated API calls are bounded", async () => {
  const game = await setup();
  try {
    const actor = await game.guest("Limits");
    const invalid = await game.connect(actor.cookie);
    const invalidClosed = once(invalid.ws, "close");
    for (let i = 0; i < 3; i++) invalid.ws.send("not json");
    assert.equal((await invalidClosed)[0], 1008);
    const flood = await game.connect(actor.cookie);
    const floodClosed = once(flood.ws, "close");
    for (let seq = 1; seq <= 80; seq++)
      flood.send({ v: 1, seq, requestId: `ping:${seq}`, type: "ping" });
    await flood.wait((m) => m.type === "ack" && m.seq === 80);
    for (let seq = 81; seq <= 280; seq++)
      flood.send({ v: 1, seq, requestId: `ping:${seq}`, type: "ping" });
    assert.equal((await floodClosed)[0], 1008);
    const statuses = [];
    for (let i = 0; i < 65; i++)
      statuses.push(
        (
          await fetch(`${game.origin}/api/session`, {
            headers: { Cookie: actor.cookie },
          })
        ).status,
      );
    assert.ok(statuses.includes(429));
    assert.equal(game.store.profile(actor.profile.id).credits, 69);
  } finally {
    await game.close();
  }
});
