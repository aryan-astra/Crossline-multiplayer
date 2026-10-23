import test from "node:test";
import assert from "node:assert/strict";
import {
  connectWorld,
  isStaleSnapshot,
  readServerMessage,
} from "../src/network/client";

test("client rejects malformed JSON and incompatible server messages", () => {
  for (const raw of [
    "{",
    "null",
    "[]",
    '{"v":2,"type":"ack","seq":1,"message":"ok"}',
    '{"v":1,"type":"snapshot","tick":1,"ack":1}',
  ])
    assert.equal(readServerMessage(raw), null);
  assert.deepEqual(
    readServerMessage('{"v":1,"type":"error","seq":1,"message":"Not allowed"}'),
    { v: 1, type: "error", seq: 1, message: "Not allowed" },
  );
});

test("same-world tick resets are accepted only after reconnect", () => {
  assert.equal(isStaleSnapshot(4, 100, true, false), true);
  assert.equal(isStaleSnapshot(4, 100, true, true), false);
  assert.equal(isStaleSnapshot(4, 100, false, false), false);
});

test("connection sequences commands, reuses cookie identity on reconnect, and cancels on exit", async (t) => {
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    constructor() {
      sockets.push(this);
    }
    send(raw: string) {
      this.sent.push(raw);
    }
    close(code = 1006) {
      this.readyState = 3;
      this.onclose?.({ code });
    }
  }
  let requests = 0;
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.fetch = async () => {
    requests++;
    return { ok: true } as Response;
  };
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { href: "http://localhost:3000", protocol: "http:" } },
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalSocket;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const connection = connectWorld({
    name: "Test",
    join: () => ({ type: "join", mapId: "delhi", role: "watcher" }),
    onSnapshot() {},
    onNotice() {},
    onStatus() {},
  });
  t.after(() => connection.close());
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests, 1);
  sockets[0].readyState = 1;
  sockets[0].onopen!();
  connection.send({ type: "ping" });
  assert.deepEqual(
    sockets[0].sent.map((raw) => JSON.parse(raw).seq),
    [1, 2],
  );
  assert.equal(JSON.parse(sockets[0].sent[0]).type, "join");
  sockets[0].bufferedAmount = 70_000;
  assert.equal(connection.send({ type: "ping" }), false);
  sockets[0].close();
  t.mock.timers.tick(1000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(sockets.length, 2);
  assert.equal(requests, 1);
  sockets[1].readyState = 1;
  sockets[1].onopen!();
  assert.equal(JSON.parse(sockets[1].sent[0]).seq, 1);
  connection.close();
  t.mock.timers.tick(30_000);
  assert.equal(sockets.length, 2);
  assert.equal(connection.send({ type: "ping" }), false);
  for (const code of [4001, 1008])
    await t.test(
      `policy close ${code} is terminal and never reconnects`,
      async () => {
        const statuses: string[] = [];
        const terminal = connectWorld({
          name: "Test",
          join: () => ({ type: "join", mapId: "delhi", role: "watcher" }),
          onSnapshot() {},
          onNotice() {},
          onStatus(status) {
            statuses.push(status);
          },
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        const socket = sockets.at(-1)!;
        socket.readyState = 1;
        socket.onopen!();
        const count = sockets.length;
        socket.close(code);
        t.mock.timers.tick(60_000);
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(sockets.length, count);
        assert.equal(
          statuses.at(-1),
          code === 4001
            ? "Session active in another tab"
            : "Connection rejected",
        );
        assert.equal(terminal.send({ type: "ping" }), false);
        terminal.close();
      },
    );
  await t.test(
    "LAN HTTP can generate request IDs without randomUUID",
    async () => {
      const cryptoDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "crypto",
      );
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          getRandomValues: (buffer: Uint32Array) => buffer.fill(0x12345678),
        },
      });
      const insecure = connectWorld({
        name: "Test",
        join: () => ({ type: "join", mapId: "delhi", role: "watcher" }),
        onSnapshot() {},
        onNotice() {},
        onStatus() {},
      });
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        const socket = sockets.at(-1)!;
        socket.readyState = 1;
        socket.onopen!();
        assert.equal(
          JSON.parse(socket.sent[0]).requestId,
          "12345678123456781234567812345678",
        );
      } finally {
        insecure.close();
        if (cryptoDescriptor)
          Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
        else Reflect.deleteProperty(globalThis, "crypto");
      }
    },
  );
});
