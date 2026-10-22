import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/engine";
import { drawFrame } from "../src/game/render";

test("rendering cannot advance or mutate detention or match state", () => {
  const w = createWorld("delhi", "police", "Test", "test", 1000, 0);
  w.entities[0].detainProgress = 0.6;
  const before = JSON.stringify(w);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "createRadialGradient" || key === "createLinearGradient")
          return () => gradient;
        if (key === "measureText") return () => ({ width: 12 });
        return () => {};
      },
    },
  ) as CanvasRenderingContext2D;
  for (let frame = 0; frame < 120; frame++)
    drawFrame(ctx, w, 800, 600, {} as HTMLCanvasElement);
  assert.equal(JSON.stringify(w), before);
});
