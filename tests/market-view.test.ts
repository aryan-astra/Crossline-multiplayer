import assert from "node:assert/strict";
import test from "node:test";
import { quoteView, portfolioValue } from "../src/game/market-view";
import type { Instrument } from "../src/game/types";
const item: Instrument = {
  id: "calm",
  ticker: "ORDR",
  name: "Order",
  desc: "Test",
  price: 20.4,
  prev: 20,
  history: [10, 20, 15],
};
test("quote presentation keeps empty and flat histories finite and chart bounds correct", () => {
  for (const history of [[], [20], [20, 20], [10, 20, 15]]) {
    const view = quoteView({ ...item, history });
    assert.ok(!/NaN|Infinity/.test(view.path));
    for (const point of view.path.split(" ")) {
      const [x, y] = point.slice(1).split(",").map(Number);
      assert.ok(x >= 4 && x <= 396 && y >= 12 && y <= 116);
    }
  }
  assert.equal(quoteView(item).buy, 21);
  assert.equal(quoteView(item).sell, 19);
  const candles = quoteView({
    ...item,
    history: Array.from({ length: 80 }, (_, i) => i + 1),
  }).candles;
  assert.equal(candles.length, 20);
  assert.deepEqual(
    [candles[0].open, candles[0].close, candles[0].low, candles[0].high],
    [1, 4, 1, 4],
  );
  assert.deepEqual([candles.at(-1)!.open, candles.at(-1)!.close], [77, 80]);
  assert.ok(
    Math.abs(portfolioValue([item], { calm: 3, unknown: 100 }) - 61.2) < 1e-9,
  );
});
