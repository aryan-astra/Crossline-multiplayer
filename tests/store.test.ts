import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../src/server/store";
import { createWorld } from "../src/game/engine";
import type { Prediction } from "../src/network/protocol";

test("accounts, tokens, characters, holdings, bets and world checkpoints survive restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "crossline-store-"));
  const file = join(dir, "nested", "world.sqlite");
  let store = new Store(file);
  try {
    const { token, profile } = store.createGuest("  Ada\n Lovelace ");
    assert.equal(profile.name, "Ada Lovelace");
    assert.equal(profile.credits, 69);
    assert.equal(profile.lifeCredits, 69);
    assert.equal(token.length, 64);
    assert.equal(store.identify("wrong"), null);
    assert.equal(store.identify("a".repeat(64)), null);
    assert.deepEqual(store.identify(token), profile);
    assert.equal("tokenHash" in store.profile(profile.id), false);
    const world = createWorld(
      "delhi",
      "protester",
      profile.name,
      profile.id,
      69,
      0,
      19,
    );
    world.time = 12;
    store.saveCharacter(profile.id, world.player);
    store.saveWorld("delhi", world);
    store.setHolding(profile.id, "calm", 2);
    store.setMeta("next-appointment", 900);
    const bet: Prediction = {
      id: "prediction:1",
      profileId: profile.id,
      mapId: "delhi",
      contract: "capture120",
      stake: 5,
      odds: 2,
      deadline: 120,
      cycle: 1,
      status: "open",
    };
    store.saveBet(bet);
    const renamed = store.rename(profile.id, "Grace Hopper");
    renamed.score = 7;
    renamed.policeScore = -2;
    store.saveProfile(renamed);
    store.close();
    assert.equal(readFileSync(file).includes(Buffer.from(token)), false);
    store = new Store(file);
    assert.equal(store.identify(token)!.name, "Grace Hopper");
    assert.equal(store.profile(profile.id).credits, 69);
    assert.equal(store.recentLedger(profile.id).length, 1);
    assert.deepEqual(store.holdings(profile.id), { calm: 2 });
    assert.deepEqual(store.character(profile.id), world.player);
    assert.equal(store.checkpoint("delhi")!.time, 12);
    assert.equal(store.checkpoint("delhi")!.player, null);
    assert.equal(store.checkpoint("paris"), null);
    assert.deepEqual(store.bets(profile.id), [bet]);
    assert.equal(store.meta("next-appointment", 0), 900);
    assert.equal(store.meta("missing", 123), 123);
    assert.equal(store.rankings()[0].policeScore, -2);
    assert.equal(store.rankings()[0].credits, 69);
    store.saveCharacter(profile.id, null);
    assert.equal(store.character(profile.id), null);
    store.saveBet({ ...bet, status: "won" });
    assert.deepEqual(store.openBets(profile.id), []);
    assert.deepEqual(store.recentBets(profile.id, 1), [
      { ...bet, status: "won" },
    ]);
    assert.throws(() => store.recentBets(profile.id, 101), /limit/);
    assert.throws(() => store.saveBet({ ...bet, status: "lost" }), /settled/);
    assert.throws(() => store.saveBet({ ...bet, stake: 50 }), /accepted/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("credits and operation receipts are idempotent and durable", () => {
  const dir = mkdtempSync(join(tmpdir(), "crossline-receipts-"));
  let store = new Store(join(dir, "world.sqlite"));
  try {
    const { profile, token } = store.createGuest("Tester");
    assert.equal(store.credit(profile.id, 10, "Objective", "reward:1"), true);
    assert.equal(store.credit(profile.id, 10, "Objective", "reward:1"), false);
    assert.equal(store.profile(profile.id).credits, 79);
    assert.throws(
      () => store.credit(profile.id, 20, "Objective", "reward:1"),
      /reused/,
    );
    const payload = { kind: "buy", quantity: 2 };
    const result = store.operate(profile.id, "request:1", payload, () => {
      store.credit(profile.id, -20, "Purchase", "purchase:1");
      store.setHolding(profile.id, "calm", 2);
      return { accepted: true, quantity: 2 };
    });
    assert.deepEqual(result, { accepted: true, quantity: 2 });
    store.close();
    store = new Store(join(dir, "world.sqlite"));
    assert.deepEqual(store.identify(token), store.profile(profile.id));
    assert.deepEqual(
      store.operate(profile.id, "request:1", payload, () => {
        throw new Error("Must not run twice");
      }),
      result,
    );
    assert.equal(store.profile(profile.id).credits, 59);
    assert.deepEqual(store.holdings(profile.id), { calm: 2 });
    assert.throws(
      () =>
        store.operate(
          profile.id,
          "request:1",
          { ...payload, quantity: 3 },
          () => null,
        ),
      /reused/,
    );
    assert.equal(
      store.operate(profile.id, "void", {}, () => undefined),
      undefined,
    );
    assert.equal(
      store.operate(profile.id, "void", {}, () => {
        throw new Error("Duplicate void");
      }),
      undefined,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validation, overdrafts, transaction failures and nested failures cannot create partial balances", () => {
  const store = new Store(":memory:");
  try {
    const { profile } = store.createGuest("Tester");
    for (const amount of [
      NaN,
      Infinity,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      -70,
    ]) {
      assert.throws(() =>
        store.credit(
          profile.id,
          amount,
          "Invalid",
          `invalid:${String(amount)}`,
        ),
      );
    }
    assert.equal(store.profile(profile.id).credits, 69);
    assert.equal(store.recentLedger(profile.id).length, 1);
    assert.throws(() => store.createGuest("A"), /Name/);
    assert.throws(() => store.rename(profile.id, "x".repeat(25)), /Name/);
    assert.throws(() => store.saveProfile({ ...profile, credits: -1 }));
    assert.throws(() => store.saveProfile({ ...profile, score: NaN }));
    assert.throws(() => store.setHolding(profile.id, "calm", -1));
    assert.throws(() => store.setHolding(profile.id, "unknown", 1));
    assert.throws(() => store.setMeta("clock", Infinity));
    assert.throws(
      () =>
        store.operate(profile.id, "failure", {}, () => {
          store.credit(profile.id, 20, "Rollback", "rollback:1");
          store.setHolding(profile.id, "calm", 3);
          throw new Error("Failure after writes");
        }),
      /after writes/,
    );
    assert.equal(store.profile(profile.id).credits, 69);
    assert.deepEqual(store.holdings(profile.id), {});
    assert.equal(store.recentLedger(profile.id).length, 1);
    assert.equal(
      store.operate(profile.id, "failure", {}, () => "retried"),
      "retried",
    );
    store.atomic(() => {
      store.credit(profile.id, 1, "Outer", "outer");
      assert.throws(() =>
        store.atomic(() => {
          store.credit(profile.id, 5, "Inner", "inner");
          throw new Error("Inner failure");
        }),
      );
      assert.equal(store.profile(profile.id).credits, 70);
    });
    assert.equal(store.profile(profile.id).credits, 70);
    assert.equal(
      store.recentLedger(profile.id).some((entry) => entry.key === "inner"),
      false,
    );
    assert.throws(
      () =>
        store.atomic(() => {
          store.credit(profile.id, 2, "Async rollback", "async");
          return Promise.resolve();
        }),
      /synchronous/,
    );
    assert.equal(store.profile(profile.id).credits, 70);
  } finally {
    store.close();
  }
});

test("future schema versions are rejected rather than overwritten", () => {
  const dir = mkdtempSync(join(tmpdir(), "crossline-schema-"));
  const file = join(dir, "future.sqlite");
  try {
    const db = new DatabaseSync(file);
    db.exec("PRAGMA user_version=2");
    db.close();
    assert.throws(() => new Store(file), /Unsupported/);
    const reopened = new DatabaseSync(file);
    assert.equal(
      reopened.prepare("PRAGMA user_version").get()!.user_version,
      2,
    );
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
