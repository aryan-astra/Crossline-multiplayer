# Executed validation

23 October 2026, Windows, Node24.20.0/npm12.2.0. This record supersedes the earlier local-practice validation. Original prototype directories remain preserved and were not executed.

## Automated checks

- npm run validate passed after the gameplay/UI pass: Prettier, ESLint, TypeScript, **68 tests passed, zero failed/skipped**, production server compilation and Next16.4.2 build. Test duration5.65s; Next production build and static generation succeeded.
- Real HTTP/WebSocket integration tests cover two identities, replicated movement/bots/objective, stale sequence rejection, reconnect/tab replacement, foreign origins, malformed/oversized/forged commands, rate limits and autonomous ticking.
- Store/service tests cover restart, token hashing, transaction rollback, duplicate receipts/payouts, overdraft/short rejection, supply debit/delivery, role exposure restrictions, military top-five/expiry, death/respawn, custody recovery and event reward replay.
- Deterministic simulation tests cover fixed steps, full seeded rounds, collision/navigation, objective capture/contesting/recovery, interiors/capacity, resources, wanted/threat constraints and bounded populations. Camera/client/render tests cover role zoom, interpolation boundaries, lifecycle cleanup, terminal replacement close, LAN request IDs and renderer purity.
- npm audit --omit=dev: zero reported vulnerabilities after updating Next16.3.8 to16.4.2. Full audit still reports five development-chain entries from braces/micromatch/fast-glob/Next ESLint. No forced downgrade was applied.

## Actual browser checks

Production frontend at127.0.0.1:3001 was previously tested using two isolated Chrome contexts with distinct cookie identities, protester and spectator. All seven supplied-integration menu images loaded. Both HUDs showed connected/two online and no page errors. After the gameplay/UI pass, the production app at127.0.0.1:3000 was rechecked in the in-app browser at1158×649 and390×844.

Keyboard movement changed the protester x830 to903.3333333333326, y1420. The spectator received that exact authoritative position and entity ID. Across **27 matching server ticks**, captured bot objects and objective objects were byte-for-byte equal in both contexts. This verifies shared state rather than local approximation.

In the latest browser run, the retained homepage hero and location/role art loaded. The revised, wider camera showed more city geometry and fewer wanted labels. Chanting through the HUD increased server-owned credits71→72 and score2→3. At390×844, the HUD started collapsed, touch movement and action controls were visible, the chant button also changed credits and score, and document width matched the viewport with no horizontal overflow. Browser console had no warnings or errors.

After graceful stop/restart, the actual SQLite world/account readback retained the same identities, balances70/33, lifeId1, calm holding1, protester position903.3333333333326/1420 and objective cycle4; the restarted world continued ticking. Final browser auto-reconnect after this restart was not re-inspected.

## Measurements

npm run benchmark runs900 headless ticks/scenario, seed42, excluding network/SQLite/rendering:

| Humans/bots | p50 tick ms | p95 tick ms | elapsed ms |
| ----------- | ----------: | ----------: | ---------: |
| 1/20        |       0.176 |       0.902 |        306 |
| 2/50        |       0.467 |       1.932 |        643 |
| 5/100       |       1.879 |       5.657 |       2126 |
| 10/adaptive |       0.726 |       2.341 |        924 |

npm run endurance passed **1800 simulated seconds /36000 steps**, two authoritative worlds/two idle humans plus in-memory SQLite, with a controller restart halfway. Actual runtime70.99s; median tick1.383ms, p95 5.276ms, max80.627ms. Entity counts stayed51–57/location, events≤256, feed≤40, transient effects/projectiles bounded; finite coordinates and nonpenetrating geometry assertions passed. Idle balances stayed69 and life allocations did not duplicate. Post-GC heap5.65→7.82MB; RSS grew75.5MB (includes native allocator/SQLite caches, not proof of a leak-free host). Snapshot samples98.8–101.7KB indicate roughly1MB/s/client at10Hz before framing. This is a real bandwidth bottleneck; no large concurrency claim follows.

Desktop HUD reported2.0ms render work for47 visible entities at1158×649 in this short sample. This excludes network/server work and is not a sustained FPS or real Android hardware claim. See RENDERING.md for headless draw-call comparisons.

## Limits and remaining checks

No real Android device, internet deployment, cloud free-tier soak, public authentication/anti-Sybil defense, calibrated betting odds, full equipment life-budget economy, full command hierarchy, rich licensed audio library or exhaustive long-running economy balance test was completed. Thirty simulated minutes is not a day-long operational soak. Headless scenarios do not certify supported client counts. Existing promotional image provenance is documented in ART_DIRECTION.md; no new image generation was used for this phase. Remote CI execution is separate from locally passing validation.
