# Crossline simulation

## Implemented scope

`src/game/engine.ts` is a headless TypeScript rules module. It owns entity state, interactions, timed effects, projectiles, crowd metrics, supply delivery, and the disposable match economy. It imports world geometry, navigation, and AI helpers without React or browser APIs. `GameScreen` supplies input and scheduling; `render.ts` draws without advancing or mutating rules.

World types retain legacy names including `careerDetentions`, `remote`, and `lastSync`. They do not establish a career service or networking implementation. The root application starts each round with player ID `local-practice`, 1,000 virtual credits, zero career detentions, and no remote entities. All roles are available for practice; there is no trusted military unlock.

## Randomness and ownership

`createWorld` accepts a seed, defaulting to `1`. Its unsigned 32-bit linear congruential generator advances with `Math.imul(state, 1664525) + 1013904223`, then divides by 2^32. Personalities, initial positions, decision variation, supplies, and markets use this per-world generator. Names use a seeded Fisher–Yates shuffle. Event and entity IDs belong to each world.

World construction clones the map template with `structuredClone`. Shop damage belongs to that round rather than mutating `MAPS` or another world. Identical seed, simulation steps, ordered actions, and input produce a reproducible rules run in the tested JavaScript environment. This is not a claim of cross-engine lockstep networking or a replay format.

The renderer uses `Math.random` for decorative texture and window noise. That randomness does not consume simulation RNG or change world state; screenshots need not be pixel-identical. Animation phases follow world time. Drawing additional frames must not alter detention progress or entity timers.

## Time and input

`src/game/loop.ts` defines a step of 1/30 second. `advance` accumulates elapsed time, caps each added frame interval at 0.25 second, and runs complete fixed steps. Invalid or negative elapsed time is ignored. The client skips simulation while paused or hidden; blur and visibility changes clear held input and pending accumulation. Excess suspended time is discarded rather than attempting unbounded catch-up.

`update` rejects invalid/non-positive deltas, caps direct-call deltas to 0.05 second, and stops after round completion. Actions use explicit engine functions. Keyboard actions occur when events arrive; reproducible tests must supply the same action ordering rather than assume equal wall-clock durations imply equal inputs.

HUD snapshots refresh roughly every 200 ms. Displayed frame-work timing combines update and drawing work; it is not server capacity, GPU timing, or p95 frame latency.

## World and movement

The maps use internal IDs `delhi` and `paris`; the menu presents fictional Meridian Quarter and Concord Square with their architectural inspirations. Initial populations contain 34 protesters, 14 police, 4 military agents, and 10 civilians. Player-controlled roles add one entity; spectator mode adds no physical player.

Buildings are axis-aligned rectangles. Movement uses a radius of 9 world units, projects overlaps out of geometry, and clamps positions inside map bounds. Player diagonal input is normalized. Crowd separation pushes nearby non-player entities apart, then reapplies building collision. This is soft separation rather than a rigid-body physics engine.

Navigation first checks a direct segment against expanded buildings. If blocked, it builds a conservative 40-unit grid cached by map identity in a `WeakMap`, finds a reachable start, and performs four-neighbor breadth-first search. Entities cache paths until destinations change; intermediate waypoints are consumed as they are reached.

The grid can reject narrow passages that a continuous planner could traverse. Unreachable goals use a closest reachable endpoint; if no visible open start exists, the entity stays in place. Progress is not guaranteed through every possible custom map. Geometry changes would require cache invalidation; current broken shopfronts remain collidable rectangles. New searches can inspect the whole grid, so larger worlds and populations need profiling.

## Roles and state transitions

- Protesters rally, chant, react to threats, flee, and may throw when supplied. Personality parameters influence thresholds and choices.
- Police patrol, respond to active threats, channel detention, and follow eligible formation commands. Progress belongs to one officer; cancellation or loss of valid reach clears abandoned progress. Completed detention rejects already detained, down, or removed targets.
- Military agents patrol checkpoints and use warning/engagement rules. `roeValid` requires tension above 55, a warned active protester with recent throwing activity, range at most 240, and a target neither down nor detained. These are fictional game rules.
- Civilians wander and flee danger. Spectators pan the camera, inspect entities, and use local market and supply controls.

Down and detained entities use dedicated timed paths instead of ordinary role AI. Detained bots move toward the detention zone before removal; a detained player can return to a spawn. Removed entities are filtered from the world. Commands expire rather than remaining permanent conflicting objectives.

## Lifetime and economy

Rounds last at most 300 simulation seconds and can end earlier when the crowd disperses or morale collapses. End-of-round handling rejects repeated execution, liquidates holdings, and refunds open bets. Betting statuses prevent already resolved bets being paid by repeated updates. This in-memory behavior is not durable transactional settlement.

Market updates run approximately every 1.5 simulation seconds. Stakes, quantities, and supply amounts are validated by engine actions. Bets are capped at 100 records; event feed at 40 entries; instrument histories at 80 samples. Supply creation is bounded by truck/crate counts. Effects, gas, projectiles, and removed entities expire through updates. Ordinary agents are not endlessly respawned.

Linear neighbor scans and pairwise separation produce quadratic work as the crowd grows. No thousand-agent, mobile, or server-capacity claim is made. Persistent wallets would additionally need integer ledger units, authentication, durable idempotency, and atomic settlement; none is implemented.

## Verification

Headless coverage lives in `tests/simulation.test.ts`, `tests/ai.test.ts`, `tests/loop.test.ts`, and `tests/render.test.ts`. Run `npm test`; consult the README validation record for actual results. Expand unreachable-goal recovery, adversarial geometry, larger crowds, and deterministic action replay before promising those capabilities.
