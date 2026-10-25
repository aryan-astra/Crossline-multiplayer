# Executed validation

## 25 October 2026 — expanded districts, distributed bots and snapshot deltas

`npm run validate` passed formatting, lint, TypeScript, **113 tests with no failures or skips**, and the production build. The two seeded 300-second headless rounds matched. Delivery tests reached both faction depots on both maps without crossing solids. Tests also cover migration of active/offline saved characters without changing balances, human-initiated objectives, distributed bot routes, idle-aim throws, map bounds, building entry/exit, delta reconstruction, optional-field removal, event resets, legacy-client compatibility and transport security.

The maps now use 4400 × 3000 frames and expanded OSM extracts at unchanged geographic scale. The Python importer's `--self-test` passed. Original prototype folders and runtime database files were preserved. Interior rooms, decorative greenery and facade colors are generated gameplay details, not surveyed OSM interiors.

In the in-app browser, a held ArrowRight input was sent at 102281.597975 and the first authoritative changed player position arrived at 102281.687528: **89.55ms**. Two independent cookie identities then received identical player x coordinates across five matching ticks during keyboard movement. Sample deltas were roughly 5.8–12.8KB, rather than the previous approximately 105KB actor snapshots; event-heavy updates vary. This is local evidence, not internet latency or public capacity certification.

A fresh protester joined with three stones. Pressing Q produced a server-owned traveling projectile and reduced ammunition to two. An existing empty loadout displayed the server's reload message. Walking to a marked Delhi doorway changed the prompt to Enter, B opened its generated interior, and B returned through the same door. The spectator funded a crowd delivery: credits changed 46→26 once and the desk showed its truck en route. Actual arrival is covered by headless tests; it was not continuously watched in this browser pass.

At 390 × 844 with coarse-pointer emulation, document dimensions matched the viewport. The circular joystick appeared only with touch emulation; dragging sent rightward inputs and then released all directions. The inspector/minimap is on the left; the translucent leaderboard is on the right. No warning/error console entries were reported in the three tested game tabs. Screenshots are saved locally under ignored `artifacts/`.

A final presentation-only change separates the title screen from the approximately 1.44MB city/simulation JavaScript chunk. Lint, type checking, formatting and the production build passed again. The in-app browser loaded the title and opened onboarding without requesting that chunk; entering the city requested it and displayed an explicit loading state. The 113-test suite predates this import-boundary change; game rules were unchanged.

The final 900-tick-per-scenario headless benchmark measured p95 **4.243ms** for 1 human/20 bots, **9.379ms** for 2/50, **20.717ms** for 5/100, and **13.261ms** for 10/adaptive population. Maximum samples reached 75.9–110.9ms. It excludes network, SQLite and rendering, and memory deltas include GC noise. A read-only sample of the persisted Delhi workload after bounding local route search averaged about 2–3ms per simulation update; this is a short diagnostic, not an endurance result. Cached full-map ground canvases require about 52.8MB of raw RGBA storage per city before browser overhead.

Physical Android hardware, public internet load, long-duration economy balance and a repeated 30-minute endurance run were not checked in this pass. Free-tier provider quotas are documented in deployment research; no cloud deployment or unlimited-player claim is made.

## 25 October 2026 — input backlog, minimal HUD and touch joystick

`npm run validate` passed formatting, lint, TypeScript, **99 tests (zero failures or skips)** and the production build. Two deterministic300-second headless rounds with62 bots reproduced matching results. New coverage checks peaceful travel through the existing rally anchors, objective holding/contribution, corrected blocked rally targets, safe cached-route reuse, joystick dead-zone/directional clamping, disabled compression negotiation and coalescing of unfinished snapshot writes. The30-minute endurance run below predates these AI/navigation changes and was not repeated for this pass.

The original loopback probe reproduced1082–1286ms movement delay. A Node client with compression disabled received movement in169–181ms, but a real in-app browser still queued compressed small inputs: outgoing sequence380 versus acknowledged92. Merely tuning compression or disabling compression only on outbound snapshots was insufficient. After disabling negotiation entirely and reconnecting, an actual browser ArrowRight input at sequence152 received a matching acknowledgement and first changed authoritative x1002.215→1009.549 in **85.52ms**. The held movement continued to x1064.549, then stabilized after key release. These are local samples, not a supported internet-latency or concurrency guarantee.

The default play view now has a small status capsule, optional inspector, corner tools and compact context/actions, with no full-width bars. At390×844 with coarse-pointer emulation, document dimensions matched the viewport; the112px circular joystick appeared at the lower left with role actions to the right. In-app pointer dragging sent seven rightward inputs, moved x1064.549→1090.215, then sent false direction inputs and stopped. Chant changed authoritative credits69→70. A narrow desktop viewport alone does not reveal a joystick. Native touch-event injection is unavailable in this in-app browser; this pass used pointer dragging with touch emulation, not physical Android hardware.

After the final rebuild, two separate cookie identities in the in-app browser (LAN-origin protester and loopback-origin spectator) received identical player coordinates across62 matching authoritative ticks. The keyboard-driven movement was visible to the spectator and stopped on release. Actor snapshot samples were104878–104897 UTF-8 bytes each: roughly1.05MB/s per client at the nominal10Hz rate, before framing. Compression is intentionally disabled in both directions to address the reproduced queue. Compact entity payloads and sustained multi-client bandwidth measurements remain a priority. [Input research](INPUT_RESEARCH.md) records primary documentation and the tradeoffs. Protester player-issued squad orders and multiple capturable objectives remain outside this route correction.

## 25 October 2026 — field HUD and spectator exchange

`npm run validate` passed formatting, lint, TypeScript, **91 tests (zero failures or skips)** and the production build. Added checks cover quote presentation and fees, invalid LAN ports, ignoring snapshots before the acknowledged join, yielding between overloaded simulation steps, and preventing an automatic repeat throw during an existing violent episode. Under overload the shared clock now slows instead of running consecutive catch-up steps ahead of network I/O.

The production version was checked in the in-app browser. Callsign → Paris → Republic square → Spectator entered Paris directly. Selling the existing single ORDR unit produced a server acceptance receipt, cleared the holding and changed credits46→66. Funding a crowd delivery debited20 credits and showed an en-route truck with its authoritative ID and changing world position. Prediction buttons explained missing selected protesters and unavailable objective phases. No prediction was purchased in this browser pass; settlement remains covered by service tests.

At an emulated390×844 viewport, document dimensions matched the viewport with no page overflow. Quotes and order buttons were readable; exchange content scrolls internally. This check found redundant movement controls consuming exchange space and an ineffective spectator Run button; those were removed from that context. Camera arrows remain available when the exchange closes. This is viewport emulation, not physical-device certification.

The LAN launcher ran on the local private interface and its printed URL answered `/api/health` successfully. No router or firewall settings changed, and no second physical device was tested.

The OSM-map endurance run passed1800 simulated seconds /36000 steps across two authoritative worlds with in-memory SQLite and a controller restart. Tick cost: p50 **13.219ms**, p95 **29.421ms**, maximum **274.4ms**. Entity counts stayed51–55; post-GC heap8.86→9.32MB, RSS growth97,177,600bytes. Full JSON snapshot samples were144–153KB before wire compression/static-map omission. Measurements exclude rendering and network delivery, establish no supported concurrency, and do not prove balanced win rates. CPU spikes, entity bandwidth, day-long economics and public account recovery remain outstanding.

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

# Engine and game interface revision — 25 October 2026

This section supersedes older counts and measurements below for this revision. Node v24.22.1, Windows. Formatting, ESLint, TypeScript, **140 tests with zero failures/skips**, and the production build passed. The final mobile card-padding adjustment also passed formatting and a subsequent production build. `npm audit --omit=dev` reported zero vulnerabilities; this does not certify absence of application vulnerabilities.

Tests cover human-only objective participation (including forged NPC profile fields), disconnect cancellation, preserved saved progress/broken barricades, route jitter/unreachable destinations/topology changes, bounded visual prediction, shield durability, selected-target/visibility combat, empty ammunition, roadside caps, advertised delivery contents, shop stock/cooldowns, server-owned supply prices and durable duplicate receipts. HTTP/WebSocket tests cover distinct identities, shared authoritative state, replay rejection, input flooding, origin checks and separate LAN/online authorities. Two independently seeded 300-second headless rounds matched.

The recent-violence regression first failed with linear decay: an idle world's value remained above 20 after 15 simulation seconds. Exponential decay and a 100-point cap made it pass. An earlier static-minimap cache regression also failed before the renderer cache was added. No test failure was marked as a pass.

## Browser checks

The production app ran at `127.0.0.1:3000` and `localhost:3000` in the in-app browser with separate guest cookies. A held desktop key changed authoritative x from 1932.2282 to 1987.2282. Another input sample reached a changed authoritative y after **127.7 ms**, with subsequent snapshots approximately 100 ms apart. This is one local network-observation sample, not a percentile or physical display-latency measurement. Q reduced stones from three to two.

Across six matching moving ticks, the spectator received the same player y coordinates as the player session, including 1431.0011, 1438.3345 and 1471.3345. These were received network frames, not independent local simulation. The spectator bought one ORDR unit, sold it back to zero holdings, then funded essentials: credits 65 → 45 and an en-route truck appeared. Prices changed between displayed quote and execution as documented. Both warning/error console logs were empty during these checks.

The title art, disabled unconfigured Online mode, two-step setup, compact menu, live exchange, supplies catalog and permanent minimap were inspected. At emulated 390 × 844, document width was 390 with no page overflow; the map's right edge was 120 and bottom 628, while joystick/action controls occupied the lower region starting at 708/712. Touch emulation exposed the joystick; the ordinary desktop view did not. Screenshots are ignored local artifacts under `artifacts/`. No physical Android hardware was used.

## Headless performance sample

`npm run benchmark`, seed 42, 900 ticks per scenario, excludes rendering, transport and SQLite. This run preceded the final transient-violence decay adjustment; it is not a saved-world capacity certification. Server startup began during the benchmark, so some contention was present.

| Humans / bots | Median tick ms | p95 tick ms | Max tick ms |
| ------------- | -------------: | ----------: | ----------: |
| 1 / 20        |          2.069 |       3.318 |      58.683 |
| 2 / 50        |          3.613 |       6.126 |      45.400 |
| 5 / 100       |          8.053 |      13.657 |      69.654 |
| 10 / adaptive |          4.984 |      10.238 |      51.682 |

Cold spikes remain above a 33.3 ms step budget. Physical mobile comfort, sustained internet concurrency, cloud free-tier load and a new long-duration endurance run were not checked. No public server was deployed. Existing accounts and SQLite data were preserved; this was not a reset. See [engine review](ENGINE_REVIEW.md), [networking](NETWORKING.md) and [roadmap](ROADMAP.md) for remaining limits.
