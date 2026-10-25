import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
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
