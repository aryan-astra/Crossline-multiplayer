# Executed validation

## 24 October 2026 — Crossline lobby and live-server repair

The title screen is now a single fixed viewport with retained cinematic artwork, a shared vector Crossline mark/favicon, and in-place callsign → city → entry area → role setup. Browser checks at 1366×768 and 390×844 confirmed viewport/document dimensions match. At 390×844 the entire role step fit without internal scrolling; Back and Enter stayed visible. Blank names showed an inline error and focused the input. Paris selection, area selection, entering the authoritative game, leaving back to setup, and a chant updating score to 1 were exercised. The browser reported no warnings/errors. Short landscape review found an intro/footer overlap; the rebuilt 844×390 title screen now ends its intro at 281.9 px, above the footer at 338.4 px, with document dimensions matching the viewport.

An existing four-hour world exposed a real navigation/collision regression: a row-order nearest-node scan repeatedly swept long polygon segments, and overlapping footprints could cycle to an unchanged but blocked collision result. Queries now try nearest cells, use a direct walkability predicate, validate resolved collision points, and cap graph-entry visibility tests at 32 before deterministic local steering. Startup warms both static graphs. Regressions cover overlapping Paris footprints and a narrow passage missed by the coarse grid. This is bounded steering, not proof that every possible narrow passage has an optimal route.

A copied SQLite world (original preserved), 120 service ticks over both locations, measured startup 210.5 ms, median 27.4 ms, p95 62.9 ms and maximum 97.4 ms with the production preview also running. Before this repair five saved-world ticks measured 1.0–3.9 seconds each. `/api/health` subsequently returned HTTP 200 immediately and the browser connected. These are local samples, not sustained 30 Hz or free-tier capacity certification; the p95 still exceeds the 33 ms tick budget.

Static geometry now arrives once per active socket/map; repeated snapshots carry authoritative building damage and negotiated WebSocket compression. The real two-socket test checks decoded map equality, replicated player state, one initial map frame, compact JSON below 70% of full JSON and a representative deflate result below half of compact JSON. Reconnect clears map caches; a repaired building does not retain a cached broken flag. A map frame dropped by backpressure is retried before compact snapshots. Payload limits and origin validation remain enforced.

Final `npm run validate` passed formatting, lint, TypeScript, **87 tests with zero failures/skips**, and production build. This includes HTTPS public-origin acceptance, Secure cookies and rejection of spoofed forwarded headers. A receiver-close race seen under contention was corrected to preserve the library's bounded protocol-close handshake. The short-height CSS refinement also passed production build and the browser recheck. The final city-boundary guard for queued financial commands passed another 35 focused client/service/transport tests, scoped lint and TypeScript compilation; the production build includes it. Runtime `npm audit --omit=dev` reports zero vulnerabilities. No public deployment or free-tier soak was executed.

Two actual browser contexts with isolated guest cookies completed onboarding as Paris protester and spectator. Across **99 matching server ticks**, the full player entity and objective were byte-for-byte equal in both received snapshots. Keyboard movement changed authoritative y from 750 to 658.3333333333343; movement toward a building stayed blocked. Each socket received two map frames (its initial Delhi state, then its selected Paris state), rather than geometry per snapshot. Both warning/error consoles were empty. The spectator's Markets & supplies button opened real charts, holdings and transaction controls. This final browser pass used the production server at `http://127.0.0.1:3000/` with existing saved worlds; no data reset was performed.

A subsequent manual market check observed reconnects and several seconds of transaction feedback delay. One purchase eventually changed credits 69→42 and holdings to one ORDR unit. An unconfirmed sell did not reliably survive reconnect. The browser now retains unacknowledged financial commands and replays the same receipt IDs, shows pending/accepted feedback, and clears confirmed requests. The new client regression exercises trade, prediction and funding replay and verifies confirmed requests are not replayed again; existing service tests check durable idempotency. A final rebuilt-browser purchase showed the pending notice, then “Transaction accepted by the server” and one ORDR unit within the one-second observation. Live-world latency and free-tier capacity still need a sustained soak; a passing local build does not certify them.

23 October 2026, Windows, Node24.20.0/npm12.2.0. This record supersedes the earlier local-practice validation. Original prototype directories remain preserved and were not executed.

## Latest geography, controls and spectator pass

`npm run validate` passed with **80 tests, zero failures/skips**, formatting, lint, TypeScript and production build. The subsequent queued-input limiter change passed focused ESLint and all 13 transport/render tests; the production server was rebuilt and restarted using the same isolated QA database. Runtime dependency audit still reports zero vulnerabilities. Earlier measurements below predate the OSM geometry and do not certify its cost or endurance.

Both playable maps now load OSM building rings and street lines. Geography tests cover open anchors/spawns, routable depots, polygon clearance and collinear/thin-wall navigation. Existing tests verify actual delivery on all four supply routes. Legacy checkpoint migration preserves the profile and event sequence while updating geometry. Three audio tests cover distance/pan, event deduplication, mute/reset history and node cleanup. The render test limits overlapping crowd speech without changing simulation state.

Two independent browser cookie sessions at `localhost:3004` (protester) and `qa.localhost:3004` (spectator) were connected together. Across **91 matching ticks**, the spectator received the exact player position and objective from the player session. After clicking Chant and holding D, x changed1002.2154758171598→1079.2154758171607; credits45→46 and score0→1. A held touch movement button also changed authoritative y750→724.3333333333336. Both browser warning/error logs were empty in the final build.

The market header link opened real price-history charts and holdings. A purchase changed credits69→48 with one ORDR unit; selling returned holdings to zero and credits65. Funding debited20 credits (65→45) and emitted the truck-en-route event. The45-credit balance survived the production restart. Settings enabled Web Audio at0.4 without browser errors; no physical headphone calibration or recorded city ambience was checked.

At390×844, the HUD started collapsed, document width stayed390, header ended at102.5 and the action bar began at670.4. Expanded inspector placement also stayed between the header and footer. Desktop inspector/header/footer did not overlap. The corrected favicon and retained menu imagery loaded. Screenshots are local ignored artifacts (`artifacts/mobile-player.png`, `artifacts/spectator-market.png`). Render work during the short spectator samples was5.7–8.1ms with roughly53–60 entities; this is not sustained FPS certification.

Latest `npm run benchmark`: 900 ticks per scenario, seed42, headless simulation only. The local production preview remained running, so these are development-machine measurements with contention, not isolated capacity results.

| Humans/bots | p50 tick ms | p95 tick ms | maximum ms | elapsed ms |
| ----------- | ----------: | ----------: | ---------: | ---------: |
| 1/20        |       3.630 |      21.147 |   1135.193 |       7111 |
| 2/50        |       6.744 |      14.308 |    947.180 |       8044 |
| 5/100       |      15.881 |      28.553 |    600.155 |      15786 |
| 10/adaptive |       7.363 |      14.150 |    639.936 |       7662 |

Static navigation edges are swept once and cached; sorting candidate cells no longer allocates coordinate objects per comparison. Cold navigation still has substantial spikes, and both worlds share one server thread. Actual browser snapshots sampled202.6–202.8KB, approximately2MB/s/client at10Hz before framing. Map handshakes/deltas and navigation warm-up/spatial queries remain high-priority work. The previous30-minute endurance run was not repeated on the OSM maps. Public concurrency, day-long economy balance and low-end physical-device comfort remain unverified.

## Automated checks

- `npm run validate` passes after the player framing pass: Prettier, ESLint, TypeScript, **73 tests passed, zero failed/skipped**, production server compilation and Next16.4.2 build. The deterministic 300-second twin-world scenario and Next production static generation succeeded.
- Real HTTP/WebSocket integration tests cover two identities, replicated movement/bots/objective, stale sequence rejection, reconnect/tab replacement, foreign origins, malformed/oversized/forged commands, rate limits and autonomous ticking.
- Store/service tests cover restart, token hashing, transaction rollback, duplicate receipts/payouts, overdraft/short rejection, supply debit/delivery, role exposure restrictions, military top-five/expiry, death/respawn, custody recovery and event reward replay.
- Deterministic simulation tests cover fixed steps, full seeded rounds, collision/navigation, objective capture/contesting/recovery, interiors/capacity, resources, wanted/threat constraints and bounded populations. Camera/client/render tests cover role zoom, interpolation boundaries, lifecycle cleanup, terminal replacement close, LAN request IDs and renderer purity.
- `npm audit --omit=dev`: zero runtime dependency vulnerabilities. Full audit reports five High findings through the dev-only Next ESLint chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), tracked as [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The advisory has no patched release; `npm audit fix --force` proposes a breaking downgrade to `eslint-config-next@14.2.35`, so it was not applied. Recheck when a safe upstream release exists.

## Actual browser checks

Production frontend at127.0.0.1:3001 was previously tested using two isolated Chrome contexts with distinct cookie identities, protester and spectator. All seven supplied-integration menu images loaded. Both HUDs showed connected/two online and no page errors. After the gameplay/UI pass, the production app at127.0.0.1:3000 was rechecked in the in-app browser at1158×649 and390×844.

Keyboard movement changed the protester x830 to903.3333333333326, y1420. The spectator received that exact authoritative position and entity ID. Across **27 matching server ticks**, captured bot objects and objective objects were byte-for-byte equal in both contexts. This verifies shared state rather than local approximation.

In the latest browser run, the retained homepage hero and location/role art loaded. The revised, wider camera showed more city geometry and fewer wanted labels. Chanting through the HUD increased server-owned credits71→72 and score2→3. At390×844, the HUD started collapsed, touch movement and action controls were visible, the chant button also changed credits and score, and document width matched the viewport with no horizontal overflow. Browser console had no warnings or errors.

The dispatch/reward build was also run as an isolated production server at127.0.0.1:3002 using a temporary SQLite file. A police guest received a server-issued wanted target outside ordinary interest range; “Highlight on map” selected it, and the minimap marker followed it. After a clean server restart, the page reloaded and rejoined successfully; it first showed no active incident, then displayed a new dispatch after a fresh wanted event. No browser console warnings or errors appeared. Headless tests additionally verify assignment handoff, bot fallback, peaceful-target pursuit, command priority, cross-map isolation, objective payouts and no replay after restart.

The latest production build was run at127.0.0.1:3004 with an isolated temporary SQLite file. Paris/protester selection led to the revised open-plaza spawn (480,760), with the player and nearby crowd visible together. WASD movement shifted the world while the camera tracked the character; chanting changed server-owned credits69→70 and score0→1. At390×844 emulated mobile size, there was no horizontal overflow, the HUD started collapsed, and the 42px movement controls and 44px action buttons stayed inside the viewport. The browser console had no warnings or errors. Render work measured4.3ms with48 entities on desktop and2.4–5.4ms with55–56 entities on mobile. These are short local samples, not sustained FPS or hardware certification.

After an earlier graceful stop/restart, the SQLite world/account readback retained the same identities, balances70/33, lifeId1, calm holding1, protester position903.3333333333326/1420 and objective cycle4; the restarted world continued ticking. That earlier browser auto-reconnect was not re-inspected; the later isolated preview reload and rejoin were.

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

No real Android device, internet deployment, cloud free-tier soak, public authentication/anti-Sybil defense, calibrated betting odds, full equipment life-budget economy, full command hierarchy, rich licensed audio library or exhaustive long-running economy balance test was completed. Thirty simulated minutes is not a day-long operational soak. Headless scenarios do not certify supported client counts. Existing promotional image provenance is documented in ART_DIRECTION.md; no new image generation was used for this phase. Remote CI execution is separate from locally passing validation. The current preview replaces the older port3000 process; historical port3004 measurements above used isolated test data.
