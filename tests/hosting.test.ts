import test from "node:test";
import assert from "node:assert/strict";
import { isLanAddress, onlineOrigin } from "../src/server/hosting";
import { createGameServer } from "../src/server/transport";
import { Store } from "../src/server/store";
import { once } from "node:events";

test("LAN and online authorities keep separate session cookies and room state", async () => {
  const stores = [new Store(":memory:"), new Store(":memory:")];
  const games = stores.map((store, index) =>
    createGameServer({
      store,
      tick: false,
      mode: index === 0 ? "lan" : "online",
    }),
  );
  try {
    for (const game of games) {
      game.server.listen(0, "127.0.0.1");
      await once(game.server, "listening");
    }
    const sessions = [];
    for (const game of games) {
      const address = game.server.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(base + "/api/session");
      sessions.push({
        cookie: response.headers.get("set-cookie")!.split("=")[0],
        profile: (await response.json()).profile,
      });
      const config = await (await fetch(base + "/api/connection")).json();
      assert.equal(config.mode, game === games[0] ? "lan" : "online");
    }
    assert.notEqual(sessions[0].cookie, sessions[1].cookie);
    assert.notEqual(sessions[0].profile.id, sessions[1].profile.id);
    games[0].service.worlds.delhi.tension = 90;
    assert.notEqual(games[1].service.worlds.delhi.tension, 90);
  } finally {
    for (const game of games) await game.close();
    for (const store of stores) store.close();
  }
});

test("LAN membership uses the actual peer address and accepts private IPv4/IPv6 only", () => {
  for (const ip of [
    "127.0.0.1",
    "::1",
    "::ffff:192.168.1.8",
    "10.0.0.2",
    "172.16.1.2",
    "172.31.1.2",
    "fd12::1",
    "fe80::1",
  ])
    assert.equal(isLanAddress(ip), true, ip);
  for (const ip of [
    "8.8.8.8",
    "172.32.0.2",
    "192.169.0.1",
    "2001:db8::1",
    "garbage",
    "999.1.1.1",
  ])
    assert.equal(isLanAddress(ip), false, ip);
});
test("online links are explicit web origins without credentials or embedded paths", () => {
  assert.equal(onlineOrigin(), null);
  assert.equal(onlineOrigin("https://game.example/"), "https://game.example");
  for (const value of [
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com/?key=secret",
  ])
    assert.throws(() => onlineOrigin(value));
});
