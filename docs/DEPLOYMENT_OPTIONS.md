# Crossline deployment options

Research checked against official documentation on 22 October 2026. The baseline is local practice; no cloud deployment or multiplayer hosting capacity has been verified.

## Playable baseline

Use the pinned npm environment documented in the README. `npm run build` creates the Next.js production application and `npm start` serves it on loopback. The project requires Node.js within the range in `package.json`. No database, account, service token, or environment secret is required for practice.

A Node-compatible Next.js host is the direct deployment path. A static export could reduce infrastructure needs because the integrated game has no APIs, but it must first be configured and built successfully; the ordinary `.next` directory is not a static site upload. Public hosting configuration and real device checks remain deployment work.

## Future multiplayer hosts

| Option                                  | Benefit                                                                | Cost/constraint                                                                 | Status                         |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Small persistent Node WebSocket service | Familiar runtime, direct profiling, explicit room lifecycle            | Service availability, regional latency, monitoring, backups, and active compute | Reference candidate            |
| Cloudflare Durable Objects              | One managed coordination point per room; storage and WebSocket support | Single-object throughput, duration billing, hibernation/restart constraints     | Candidate requiring benchmarks |
| WebRTC peer-assisted networking         | Can move some traffic off the central service                          | Signaling, TURN relay costs, host migration, untrusted clients                  | Deferred                       |
| Browser-only static practice            | No authoritative backend operating cost                                | No trusted multiplayer, progression, or economy                                 | Current product boundary       |

## Cloudflare free-tier reality

SQLite-backed Durable Objects are available on Workers Free. Current daily compute allowances are 100,000 requests and 13,000 GB-s; exceeding a free limit causes the relevant operations to fail. Incoming WebSocket messages use a 20:1 request-billing ratio. Duration uses the allocated 128 MB, including non-hibernatable idle periods. Separate storage allowances and paid-plan charges apply. [Official pricing, updated 18 October 2026](https://developers.cloudflare.com/durable-objects/platform/pricing/).

An illustrative continuously active 0.128 GB room consumes about 11,059 GB-s per day: 0.128 × 86,400. That is most of the free duration allowance before additional rooms. This is arithmetic, not measured capacity or a complete hosting quote. Recheck plan limits when deploying.

An object is single-threaded with a soft 1,000 requests/second limit. A 30-second default per-invocation CPU ceiling is not a practical simulation tick budget. [Official limits, updated 1 June 2026](https://developers.cloudflare.com/durable-objects/platform/limits/).

Hibernation retains sockets while discarding memory. [Official WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). Scheduled timers prevent hibernation, so a continuously ticking match does not receive idle-lobby savings. Empty rooms should stop ticking and recovery must use persisted state. [Official lifecycle, updated 15 October 2026](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

Select this host only after measuring representative room population, tick p95, message frequency, snapshot size, concurrent room count, restart recovery, and actual metered usage. No free multiplayer scale is promised.

## Persistence choice

Do not add PostgreSQL merely because both prototypes included a database layer. It adds server operation, upgrades, backups, network configuration, and credentials to a baseline that currently needs none. [Official PostgreSQL server setup](https://www.postgresql.org/docs/current/runtime.html).

Later, PostgreSQL is a reasonable option for global accounts and an atomic virtual transaction ledger; per-room SQLite is another option for room checkpoints. Neither makes browser-provided match results authoritative. Define cross-room settlement ownership before choosing storage. Use access-controlled connections and verified TLS according to the chosen driver's documentation. [PostgreSQL client authentication](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html), [PostgreSQL SSL verification](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Release gates

- Run lint, type checks, headless simulation tests, and the production build.
- Exercise menu, map and role selection, input, camera, interactions, HUD, and round exit in a real browser.
- Verify source assets have permission for redistribution before adding them to public builds.
- For multiplayer releases, complete the two-client and abuse tests in `NETWORKING.md`, then profile actual hosting workloads.
- Store secrets in the hosting platform's secret configuration; never commit local environment files or database dumps.

GitHub source publication and a green CI run do not constitute a deployed or production-ready multiplayer service.

## Dependency audit boundary

The integration updated Next.js to 16.3.8 and PostCSS to 8.5.31. The executed production-only audit (`npm audit --omit=dev`) reported zero vulnerabilities at initialization. The full development dependency audit still reports a `braces` advisory with no patched release available in the checked registry (latest 3.0.3). Production audit results do not imply the development toolchain is advisory-free; track the exact audit output in the root validation record and recheck before release.
