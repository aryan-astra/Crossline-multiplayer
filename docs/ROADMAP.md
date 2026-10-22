# Crossline roadmap

## Baseline delivered

Local practice: menu, two location definitions, four roles, procedural city geometry and characters, fixed-step movement/camera, autonomous crowds, formations, role actions, HUD/minimap, session market/bets/supply deliveries, headless tests and CI. All results are disposable. See VALIDATION.md for commands actually executed.

## 1. Authoritative multiplayer vertical slice

Implement one small room with a server-owned simulation before adding profile rewards. Use authenticated membership, versioned bounded messages, input sequences/acknowledgements, server ticks, replay protection, action rate limits, snapshots and interpolation. Measure room CPU and bandwidth. Demonstrate two independent browser contexts observing the same bot state and detention outcome. Test reconnect, stale input, malicious coordinates, disconnection and room cleanup. Select a Node WebSocket service or Cloudflare Durable Object only after the deployment comparison and a workload benchmark.

## 2. Persistence and transaction integrity

Select a storage service against actual identity/transaction needs. Add migrations and server-derived results. Career and unlocks must come from validated match results. Virtual economy settlement requires an append-only ledger, unique transaction keys, atomic balances, and idempotent reward delivery. Test retries, concurrent spending and duplicate settlement. Keep real-money payments out of scope.

## 3. Simulation and command depth

Measure and improve navigation around narrow gates, pursuit timeouts, local threat response, explicit squad ownership and command expiry. Add per-agent morale/stress only when behavior tests justify it. Preserve personality-seeded reproducibility and combat/custody invariants. Replace quadratic neighbor/separation work with Source B's spatial hashing after a larger-crowd benchmark demonstrates the need.

## 4. Presentation and optimization

Confirm source ownership and asset licensing. Commission a consistent sprite/texture set with atlases and animations. Add audio/accessibility settings and complete mobile parity for special actions and map commands. Capture median/p95 rule and frame times across desktop/mobile devices and entity counts. Try WebGL batching only if measured Canvas draw work misses the target budget; preserve world coordinate/collision rules.

## 5. Product systems

After authority and persistence pass adversarial integration tests, add career menus, session discovery, economic balancing, supply logistics depth and spectator tools. Publish service budgets and operational recovery procedures before inviting public players. No milestone is complete merely because its interface exists.
