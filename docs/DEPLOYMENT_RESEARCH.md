# Local multiplayer technology and deployment research

Checked 23 October 2026. Sources below are official documentation or maintainer repositories. This document records research and implementation recommendations; it does not certify a cloud deployment or completed game feature.

## Decision

Use the installed Node.js 24.20.0 runtime with the existing Next/React frontend, one local HTTP server, `ws` for WebSockets, shared headless rules, and built-in `node:sqlite` for local persistence. Maintain two internal location simulations behind one public-world experience. Do not add cloud accounts, payment services, external database requirements, private rooms, a monorepo, or a second game engine merely to implement networking.

This is an engineering inference from the inspected code and requirements: the project already has usable deterministic rules, collision geometry, a procedural renderer and React HUD, while its missing components are trusted shared ownership and persistence.

## Node SQLite: use documentation matching the runtime

The installed release is 24.20.0. Its SQLite API is `DatabaseSync`, not the `Database` class shown in current unversioned Node documentation. SQLite is marked release-candidate stability, not fully stable. Methods run synchronously. Relevant operations are `exec`, `prepare`, statement `run/get/all`, and database `close`; statements bind parameters. The constructor supports `timeout` in milliseconds, enables foreign keys by default, and disables loadable extensions by default. [Exact Node 24.20.0 documentation](https://nodejs.org/download/release/v24.20.0/docs/api/sqlite.html).

An executed in-memory smoke check on this machine created a STRICT table, inserted 69 using bound parameters inside `BEGIN IMMEDIATE`/`COMMIT`, read it back, verified `PRAGMA foreign_keys` equals 1, and closed the database. `StatementSync.close` is absent in 24.20.0; do not copy that method from newer 24.x examples.

Keep database work outside movement ticks. Use small indexed transactions for credits, operations, settlements and accounts, and periodic bounded checkpoints. Add schema versions, rollback handling, unique operation/event keys, nonnegative integer credit constraints and restart tests. Synchronous I/O can stall the event loop: measure commit/checkpoint latency, then isolate persistence in a worker if measurements require it. A transaction must not contain awaited work or user SQL. The game must stop or report a failed critical commit rather than presenting uncommitted money as durable.

## WebSocket server and Next integration

`ws` is a Node implementation; browsers should use native `WebSocket`. Its maintained examples cover HTTP upgrade authentication and ping/pong detection of broken connections. Compression is disabled server-side by default and adds CPU/memory overhead. Preserve that default initially. A heartbeat should terminate a missed-pong connection and let application-level grace/recovery determine character lifetime; TCP closing alone does not decide gameplay rewards. [Maintainer README and examples](https://github.com/websockets/ws).

Use `WebSocketServer({ noServer: true, maxPayload: ... })` and authorize the HTTP upgrade before `handleUpgrade`. Validate endpoint path, session and permitted origin, then validate each versioned message and sequence. The library's large default payload ceiling is unsuitable for tiny game inputs. `bufferedAmount` reports unsent queued bytes; impose a queue budget, skip superseded snapshots and close persistently slow receivers. Send only when OPEN, handle send/error callbacks and clear heartbeat timers on shutdown. [Version 8 API documentation](https://github.com/websockets/ws/blob/8.18.3/doc/ws.md).

Custom Next servers are appropriate when the integrated router cannot supply the required server behavior. The server entry is not processed by the Next compiler; standalone output does not trace custom-server files and is incompatible with this deployment pattern. [Official Next custom-server guide](https://nextjs.org/docs/app/guides/custom-server).

For this application a custom server permits one origin for HTTP, cookies and WebSockets. Keep Next's own development upgrade handling working: only claim the game endpoint and forward other upgrade requests appropriately. Compile/run the server explicitly rather than assuming `next build` bundles it. A separate port is a viable alternative but adds origin/cookie/dev orchestration work. Select and pin a reviewed compatible `ws` 8.x release through the project's npm workflow; versioned documentation is not an assertion that 8.18.3 is the newest available version.

Security implementation must reject client-reported money, progression, positions, capture outcomes and role grants. Session secrets stay out of snapshots/logs. Resume tokens are credentials, not display IDs. Persist operation idempotency with the balance mutation; a transport sequence number alone cannot prevent replay after a process restart.

## Renderer comparison

| Option             | Practical fit                                                                                                                 | Decision                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Existing Canvas 2D | Already renders geometry, characters, equipment and effects with no new dependency; repeated procedural paths remain CPU work | Retain while measuring and improving caching/culling                                            |
| PixiJS 8           | GPU-oriented sprites, spritesheets, reusable graphics and batching; expensive dynamic vector/text work still needs care       | Preferred measured migration candidate                                                          |
| Phaser             | Integrated scenes, loop, input, cameras, animation, physics and rendering systems                                             | Useful for a new engine-owned game; duplicates the existing React/rules/input architecture here |

Pixi recommends spritesheets and stable graphics, warns that changing text can be expensive, and notes culling can help GPU-bound scenes while hurting CPU-bound scenes. It does not promise speedups for every workload. [Official Pixi performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips). Phaser's Game instance initializes and updates its internal systems and renderer, which would require integrating an additional lifecycle. [Official Phaser Game guide](https://docs.phaser.io/phaser/concepts/game).

Measure identical seeded views on named hardware: frame-interval median/p95, Canvas draw CPU separately from rules, visible agents, viewport/DPR, memory over time, and short/long runs at representative populations. Existing `docs/VALIDATION.md` contains prior small-scene measurements; they are not a head-to-head Pixi benchmark or new-release acceptance results. Build an equivalent cached-sprite Pixi scene before claiming a migration benefit. Regardless of renderer, collision remains in world coordinates; 2.5D facade offsets do not move hitboxes.

## Cloudflare future compatibility and cost

No cloud resource is required or provisioned. Node's process, filesystem SQLite and `ws` are not drop-in Worker deployments. Keep transport and persistence behind explicit application boundaries so a later port can use WebSocket/DO and D1 APIs without moving trust to clients.

| Service                       | Verified free allowances/limits                                            | Consequence                                                                         |
| ----------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Workers                       | 100,000 requests/day, 10 ms CPU per request, 128 MB memory                 | Route/auth/SSR work has limits; not a guarantee for continuous simulation           |
| Workers Static Assets         | Static asset requests free/unlimited; 20,000 files/version and 25 MiB/file | Could serve an intentionally exported frontend; does not host the Node game process |
| SQLite-backed Durable Objects | 100,000 requests/day, 13,000 GB-s/day                                      | Continuous location coordinators consume active duration even when few players act  |
| D1                            | 5 million rows read/day, 100,000 rows written/day, 5 GB total              | Persist outcomes/checkpoints, not per-entity per-frame movement                     |
| D1 database limits            | 10 free databases, 500 MB per database, 50 queries per Worker invocation   | Account storage and single-database capacity differ                                 |

Workers limits are from [official limits, updated 12 October 2026](https://developers.cloudflare.com/workers/platform/limits/). Static delivery billing is described in [official Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Invoking a Worker before asset serving still consumes Worker allowances.

Durable Objects charge active duration using their 128 MB allocation; incoming WebSocket messages have a 20:1 billing ratio. [Official DO pricing, updated 18 October 2026](https://developers.cloudflare.com/durable-objects/platform/pricing/). At 0.128 GB, two continuously active location objects consume about 22,118 GB-s/day (2 × 0.128 × 86,400), exceeding the 13,000 free allowance before request/storage usage. This is a quota calculation, not a measured bill.

Objects are single-threaded with a soft 1,000 requests/second limit. [Official DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/). Scheduled intervals/timeouts prevent hibernation; idle socket support does not make an active 30 Hz world free. Memory is discarded during hibernation, requiring recovery from durable state. [Official DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

D1 counts rows read/scanned and written, including relevant index work, rather than simply query count. [Official D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Its per-database 500 MB free limit and invocation bounds require separate consideration. [Official D1 limits](https://developers.cloudflare.com/d1/platform/limits/). The asynchronous D1 API supplies transactional batches; it is not the same API as synchronous `DatabaseSync`, so a port must preserve settlement invariants rather than mechanically replace method names. [Official D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Illustration: even one persisted row per second per 100 agents is 8.64 million row writes/day, vastly above D1's free allowance. Two 30 Hz worlds updating 100 rows each would be 518.4 million writes/day before indexes. In-memory ticks plus batched meaningful events are therefore essential. A free tier must never be made to appear viable by replacing authoritative outcomes with browser assertions.

## Future geographic maps: research only

No custom-map UI or disabled placeholder should be added. A future importer could transform licensed road/building vector data into the existing geometry representation, with bounded area/complexity, coordinate conversion, validation and fictionalized gameplay placement. Raster map tiles cannot supply navigation/collision geometry by themselves.

OSM data is ODbL-licensed and requires attribution and license disclosure; distributing a derived database can invoke share-alike obligations. [OSM copyright and license](https://www.openstreetmap.org/copyright). The standard public tile service has limited capacity, requires visible attribution and proper caching/identification, prohibits bulk downloading/prefetching, and has no SLA. Use suitable data extracts or a permitted provider/self-hosting for future imports; do not scrape its tiles into game assets. [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

Provider-specific API and geocoding quotas/licensing must be researched when that feature is actually selected. Current fictional maps do not require geographic queries or a network tile dependency.

## Validation still required

Implement and run isolated-browser synchronization, heartbeat/reconnect, privilege rejection, duplicate-grant/settlement, database rollback/restart, slow receiver and endurance tests. Profile simulation/server CPU, persistence pauses, snapshot bytes and queues before defining capacity. Local operation ceases when the host is powered off; persisted recovery is continuity, not an always-running cloud world.
