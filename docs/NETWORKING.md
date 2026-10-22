# Crossline networking

## Current implementation

The integrated application is local practice. It has no multiplayer transport, room service, authentication, API routes, database, or persistent player profile. Opening two browser sessions creates two independent worlds. Bots, detention results, prices, bets, supplies, and round outcomes are not synchronized.

The source prototypes contain presence/synchronization code, but that transport does not establish shared simulation authority. It is excluded from the integrated runtime. No sequence validation, authenticated room membership, authoritative transaction ledger, or replay-safe reward settlement should be inferred from the local engine.

## Planned authority

The recommended next milestone is one authoritative simulation owner per room. It runs the same headless rules used in tests; browsers send intentions such as movement input or an interaction request. Clients interpolate snapshots and may predict their own movement. The authority validates every consequential action.

| Server authority: planned                    | Browser-local presentation             |
| -------------------------------------------- | -------------------------------------- |
| Server-issued identity and permissions       | Camera and viewport                    |
| Room membership and accepted input           | Input sampling and prediction          |
| Movement/collision validation                | Animation and interpolation            |
| Arrest, combat, and match outcomes           | Particles, audio, minimap presentation |
| Progression and unlocks                      | HUD layout and graphics preferences    |
| Virtual balances, bets, settlement, supplies | Cached assets and cosmetic preferences |

These boundaries are a design, not implemented server functionality.

## Planned protocol requirements

Before exposing public matches:

1. Bind a server-issued session to authenticated room membership. A browser-supplied player ID cannot select another player's identity.
2. Version all messages. Reject unknown message types, oversized payloads, non-finite coordinates, invalid enums, and out-of-range values. Rate-limit input and enforce room/player limits.
3. Include a monotonic input sequence per session and an explicit server tick. Reject stale/replayed inputs under a defined replay window; acknowledgements let clients discard accepted prediction history. Reconnects establish a new or explicitly resumed session epoch.
4. Accept action requests, never arbitrary wallet deltas, career increments, target HP, positions, or claimed match winners. Check role, range, cooldown, target lifetime, collision, and available resources on the server.
5. Publish authoritative snapshots with acknowledgements. Reconcile predictions against those snapshots. A local correction must never create a reward.
6. Persist final match identifiers and unique settlement keys. Apply debits, credits, and settlement records atomically so retries cannot issue duplicate payouts. Sequence numbers alone do not provide durable financial idempotency.
7. Define disconnect, timeout, checkpoint, restart, room completion, and reconnect policies before relying on process memory.

Only virtual practice money exists in the baseline. No real-money wagering is planned.

## Transport alternatives

| Approach                                   | Tradeoff                                                                                                           | Direction                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Authoritative WebSocket server             | Simple ownership, continuous compute, deployment/monitoring responsibility                                         | Reference implementation for the next milestone   |
| Lightweight server with browser simulation | Cheap only when consequential actions remain independently verifiable; diverging simulations complicate validation | Limit browsers to prediction and presentation     |
| Cloudflare Durable Object per room         | Managed coordination and storage; single-threaded room and active-duration costs                                   | Benchmark as a host after rules and protocol work |
| WebRTC peer/host simulation                | Requires signaling and ICE/TURN support; player-controlled authority can cheat or disconnect                       | Defer competitive use                             |
| Hybrid server rules plus local visuals     | Preserves trusted outcomes while offloading presentation                                                           | Recommended model                                 |

WebRTC does not supply its own signaling service, and TURN can relay traffic when direct paths fail. [Official WebRTC connection guide](https://webrtc.org/getting-started/peer-connections). Browser transport security is not proof of honest gameplay. [W3C WebRTC Recommendation](https://www.w3.org/TR/webrtc/).

Durable Objects coordinate multiple WebSocket clients, and hibernation can retain connections while resetting object memory. [Official WebSocket documentation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). This does not implement a game's authentication, validation, snapshots, persistence, or recovery.

## Multiplayer acceptance gate

Use two isolated browser sessions against one room and prove they observe the same server-owned detention and match result. Test packet replay, malformed input, impossible movement, duplicate interactions, late joining, disconnect/reconnect, and server restart. Test economic retries concurrently against durable storage. Measure server tick p95, bandwidth, message rate, and capacity before making cost or population claims. These multiplayer checks are pending because the integrated baseline has no room server.
