# Persistent-world implementation contract

Audit before invasive changes, 23 October 2026. The merged root currently has Next 16/React 19, a separate deterministic Canvas-compatible TypeScript engine, seeded map copies, navigation and 17 headless tests. It has no backend, authenticated identity, database, shared simulation or persistent economy. `GameScreen` creates a browser-owned five-minute world and imports economy mutations directly. Its pause control halts that browser's rules; all roles can change zoom. Those boundaries must change for the new directive.

Retain the maps, procedural renderer, collision/navigation, role interactions, seeded random source and tested helpers. Do not bring back the unauthenticated prototype APIs. Preserve original source folders and existing Git history. New work is on `feat/persistent-public-world`.

## Single authoritative representation

- One local Node process owns exactly two internal location simulations (`delhi` = Mantar Jantar; `paris` = Paris/Republica Plaza). No user-facing rooms.
- Each location uses the existing `World`. Human entities are server-created, skipped by NPC brains and advanced once per fixed tick using validated input. Browsers render snapshots; they do not independently decide bot actions or balances.
- `updatePlayer(world, entity, input, dt)` is the shared human movement/channel function. `update(world, dt, idle)` advances NPCs once with `world.player=null` for persistent worlds. Existing practice tests keep their legacy semantics for nonpersistent worlds.
- Simulation events have monotonic IDs and typed outcomes. Server services consume only validated events for persistent progression and rewards. Rendering never mutates rules.
- SQLite owns guest sessions, profiles, life IDs, earned balances, ledger entries, prediction contracts, positions, world checkpoints and processed event IDs. Transactions own consequential changes; movement remains in memory.
- One guest profile per server-issued opaque session. A reconnect replaces its old transport and never creates a duplicate character or grant. Wallet/score/role permissions cannot be supplied as authoritative client data.
- Versioned WebSocket input has increasing sequence numbers, bounded schema, operation IDs for transactions, rate limits and backpressure. Snapshots contain only public state and the current account's data.
- Client-local camera state is applied after receiving snapshots. Protester/police/military zoom is fixed by a shared profile; watcher alone has free zoom/pan/follow.

## Work ownership

Simulation agent: engine/types/maps/navigation/world rules and simulation tests. Renderer agent: renderer/camera/render tests. Research agent: detailed audit and official deployment/library evidence. Primary agent: protocol, SQLite store, server coordinator/transport, browser connection, menus/HUD, integration tests and final validation. No independent duplicate world models or rewrites are authorized.

No paid services, cloud accounts, payment integration, new image generation or custom-map UI. Existing homepage art can remain as already supplied/generated presentation assets; new playable assets are procedural.
