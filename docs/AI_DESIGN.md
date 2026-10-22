# AI design

Crossline currently runs autonomous agents inside one browser's local practice world. They are rule-based simulation agents, not remotely synchronized players. No trained model, LLM service or paid inference dependency is used.

## Implemented behavior

`src/game/engine.ts` retains Source A's typed entity states and personality parameters: aggression, courage, discipline, greed, chattiness and a personal offset seed. Not every parameter drives a distinct decision; their existence does not imply a sophisticated utility model. Protesters alternate marching/chanting, react to gas and nearby threats, and can escalate by throwing. Police pursue eligible protesters, channel detention, respond to orders according to discipline/rank, and form a line. Military warns nearby protesters and uses the same `roeValid` gate as player firing: active recent violent threat, warning, tension above 55, valid target state and range. Civilians wander, flee trouble, and can join the crowd.

Protester/police/military tactical decisions generally recur at approximately 0.3–0.65 simulation seconds. Movement continues between decisions. Civilian decisions use a longer interval. Local threat checks and some state transitions still happen per simulation step. These are bounded heuristic state machines, not independent planning processes.

Randomness is owned by each world. The integer LCG advances from the seed supplied to `createWorld`; unrelated worlds do not share RNG state. The browser driver uses fixed simulation steps. Reproducibility means the same seed, ordered action inputs and update steps reproduce the same state in the tested runtime; cross-engine floating-point lockstep has not been established.

## What was integrated from Source B

`src/game/ai.ts` implements `formationSlot(order, members, me, spacing=26)`, adapted from FLASHPOINT. It computes a squad centroid, points the advance direction toward the order and spaces officers on its perpendicular. Offsets are centered using `(index - (count - 1)/2) * spacing`. Coincident centroid/order uses a stable vertical heading. The root police order path calls this function rather than stacking complying officers at a single coordinate.

The same module includes tested `rallyTarget`, the Source B golden-angle milling formula: angle `id*2.399 + time*0.03`, radius fraction `0.25 + ((id*37)%60)/100`. It consumes no RNG. The engine calls it when selecting a march target around Source A's multiple rally points, using a 100-unit radius. This integrates personal spreading; it does not import B's entire cohesion/separation system.

Source B's entire police/military/protester FSM was not copied. Its exaggerated velocity intercept, player-custody reset, missing route planning and misuse of detention state for voluntary exits make a wholesale merge unsafe. Its four-squad commander is a future design reference; the current root command model remains Source A's rank-dependent set of complying officers.

## Movement and lifecycle constraints

Root movement uses `src/game/navigation.ts` waypoint routing and collision geometry, followed by the engine's collision correction. This makes navigation independent of presentation coordinates. Navigation is deliberately coarse; dense crowds, narrow gates, formations and dynamic body blocking need longer soak tests and profiling before stronger liveness claims.

Detention has an explicit channel owner and rejects targets already down, removed or detained. Lost channels clear progress. Actions reject inactive players. Removed entities are filtered, and repeat detention cannot award the same transition twice. Projectile and delayed effects must be reviewed alongside state changes because a valid target at action time may be unavailable at impact time.

## Validation and remaining work

`tests/ai.test.ts` verifies formation spacing, centering, stable fallback, deterministic milling and radius bounds. Additional engine tests cover seeded behavior and gameplay rules; the authoritative list of executed checks belongs in the validation report/README, rather than assuming all planned tests pass.

The current engine still performs linear neighbor/entity scans and pairwise crowd separation. Benchmark before introducing Source B's spatial hash, GPU work, workers or more decision systems. Priorities are long-running no-stuck/no-penetration tests over both maps, narrow gate/escort cases, target removal during channel/flight, stable formation heading, and separate accounting for simulated departures versus arrests. Military constraints are game rules for fictional practice scenarios, not claims about real-world procedures.
