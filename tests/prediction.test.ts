import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, update } from "../src/game/engine";
import { predictCharacter } from "../src/game/prediction";
const input = {
  up: false,
  down: false,
  left: false,
  right: true,
  sprint: false,
  mouseX: 0,
  mouseY: 0,
};
test("visual prediction is bounded and cannot change authoritative health, ammo or position", () => {
  const w = createWorld("paris", "protester", "Test", "test", 0, 0);
  const player = w.player!,
    before = structuredClone(player);
  const short = predictCharacter(w.map, player, input, 0.15),
    long = predictCharacter(w.map, player, input, 100);
  assert.deepEqual(long, short);
  assert.deepEqual(player, before);
  assert.equal(short.hp, player.hp);
  assert.equal(short.stones, player.stones);
  assert.ok(
    Math.hypot(short.x - player.x, short.y - player.y) <=
      player.speed * 0.15 + 0.001,
  );
  assert.equal(
    predictCharacter(w.map, { ...player, state: "detained" }, input, 0.1).x,
    player.x,
  );
});

test("movement speed follows the player role for local and remote spawns", async () => {
  const { spawnPlayer } = await import("../src/game/engine");
  const speeds = (["protester", "police", "military"] as const).map((role) => {
    const world = createWorld("paris", role, "Test", role, 0, 0);
    const local = world.player!.speed;
    const remote = spawnPlayer(world, role, "Remote", `remote-${role}`)!.speed;
    return [local, remote];
  });
  for (const [local, remote] of speeds) assert.equal(local, remote);
  assert.ok(speeds[0][0] > speeds[1][0]);
  assert.ok(speeds[1][0] > speeds[2][0]);
});

test("existing player and bot speeds are normalized by role", () => {
  const world = createWorld("paris", "protester", "Test", "test", 0, 0);
  const bot = world.entities.find((entity) => entity.kind === "protester")!;
  world.player!.speed = 110;
  bot.speed = 110;
  update(world, 0.01, { ...input, right: false });
  assert.equal(world.player!.speed, 120);
  assert.equal(bot.speed, 120);
});
