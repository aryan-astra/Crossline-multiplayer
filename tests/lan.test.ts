import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
test("LAN launcher rejects invalid ports before exposing a server", () => {
  for (const PORT of ["0", "65536", "not-a-port"]) {
    const result = spawnSync(process.execPath, ["scripts/start-lan.mjs"], {
      env: { ...process.env, PORT },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PORT must be an integer/);
    assert.ok(!result.stdout.includes("Crossline LAN address"));
  }
});
