import test from "node:test";
import assert from "node:assert/strict";
import { placeName } from "../src/game/place-names";

test("fictional place labels preserve punctuation and source-independent text", () => {
  assert.equal(placeName("New Delhi"), "Dew Nelhi");
  assert.equal(placeName("Paris"), "Arisp");
  assert.equal(placeName("Sansad Marg · 12"), "Mansad Sarg · 12");
  assert.equal(placeName("123"), "123");
});
