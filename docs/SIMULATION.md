# Persistent simulation

`src/game/engine.ts` and `src/game/world-rules.ts` contain headless TypeScript rules. The authoritative service owns account identities, appointments, balances and durable transactions; these modules own physical entities, timed actions, objectives, needs and transient events. Rendering never advances or mutates rules.

## Ownership and stepping

`createWorld(map, role, name, identity, wallet, career, seed, { persistent: true })` creates continuous rules and initializes the Constitution Book, selected interiors and essentials. The legacy default remains a disposable 300-second practice world for regression compatibility. Persistent worlds ignore round-end clocks, dispersed crowds and depleted morale. They do not call `endRound` or settle a global match.

`spawnPlayer(world, role, name, profileId)` creates one physical entity per identity, with `isPlayer` and `remote` both true; watchers have no physical entity. `remote` now means externally driven input, not an independently approximated avatar. The authoritative driver calls `updatePlayer(world, entity, input, dt)` once for each human, then calls `update(world, dt, idleInput)` once for the shared NPC/timer step. `update` skips human movement when their entity is remote, including when `world.player` is temporarily assigned for a contextual action. `world.time` and `world.tick` advance only in `update`. Direct deltas must be finite and positive and are capped at 0.05 seconds. The service supplies fixed steps.

`doAction` and `issueOrder` retain the legacy `world.player` context. The server must set and restore that pointer around the authenticated actor's action. Legacy `wallet`, `earned`, `careerDetentions` and round statistics are not account authorization or durable rewards. The persistent service consumes explicit events rather than trusting those totals.

## Determinism and bounded state

Every world owns its integer LCG state, entity IDs, event IDs and cloned map geometry. Seeded Fisher-Yates shuffling and ordered inputs reproduce rules in the tested JavaScript runtime. This is not a claim of cross-engine lockstep. Renderer cosmetic randomness consumes no simulation RNG.

`World.events` keeps the most recent 256 events. Each event has a monotonic per-world ID, tick, simulation time, type and optional actor/target/amount/faction/details. Events include chant, wanted, evasion, detention, unjustified detention, release, death, supply delivery, resource collection, objective capture, defense, contributions and witnessed news. Account settlement and durable event records belong to the server. Durable deduplication must include world identity and a persisted event sequence or epoch; two maps and two process lifetimes can otherwise reuse numeric IDs.

Effects, gases, projectiles, feeds and price histories expire or are capped. Bets and supplies have explicit limits. Persistent population maintenance runs every five seconds: target bot counts are `max(12, 30-humans)` protesters, `max(6, 12-floor(humans/2))` police, two military and eight civilians. Each check adds or removes at most one bot per kind, with a two-bot despawn hysteresis. The original 62-bot initial population converges toward those targets. Humans are never removed by population maintenance. Public connection limits remain a service responsibility.

## World geometry and interiors

Internal map IDs stay `delhi` and `paris`. Jantar Mantar, New Delhi and Place de la République, Paris use bundled OpenStreetMap street centerlines and building polygons. See MAP_SOURCES.md for the exact extracts, projection and attribution. Interiors, visual facades, security deployments and events remain fictional.

Outdoor movement uses world coordinates, radius-nine circle/polygon collision (rectangles remain supported for fixtures), normalized diagonal input and collision correction after crowd separation. Direct swept-circle clearance and a cached 40-unit four-neighbor BFS grid route around buildings. Paths are reused until targets move 20 units. Grid edges are swept-tested so thin walls cannot be crossed between cell centers. Static shop damage does not remove collision geometry.

Up to three selected shops per map define a doorway and a shared interior template: 240 by 180 units, capacity six, two solid furniture rectangles. `enterBuilding` validates the entity, active state, physical doorway proximity and live occupancy. `buildingId` distinguishes indoor space; entity x/y become interior-local coordinates. Indoor movement uses interior bounds and furniture collision. `exitBuilding` requires returning to the interior doorway and returns to the same exterior entrance. Outdoor crowd collisions, resources, objective presence and ordinary projectile hits exclude indoor occupants. Detention channels require the same space and unobstructed interaction. The renderer hides indoor occupants from outdoor views.

Occupancy is derived from authoritative entities rather than maintained in a second counter. Removed/disconnected occupants stop consuming capacity. Indoor bots rest briefly and return through the doorway. The template is deliberately small; multi-floor spaces, interior pathfinding and complex furniture arrangements are not implemented.

## Constitution Book cycles

Each map has one fixed civic objective. Defaults are 12 seconds to capture, at least two active protesters within 65 units, 180 seconds of defensive control and 60 seconds of recovery. These values are server configuration in the world state.

Humans call `interactObjective` within range to begin participation; the participation window expires after capture duration plus three seconds. Bots can participate through their objective behavior. Any active police/military defender in the area contests capture. Contested or unsupported progress decays. A lone protester cannot instantly capture. Defense time accrues only while defenders are present and attackers are absent.

Capture/defense creates one faction event and per-entity contribution events, then enters recovery. The winning distinction goes to the eligible participant with the highest contribution, with numeric entity ID breaking ties. Contributors must still exist, be active and belong to the winning faction; departed contributors are pruned. Recovery advances the local cycle without ending the world or resetting account progression. The server applies persistent rewards and economic consequences exactly once. Objective state must be restored with world configuration if cycles are meant to survive restarts.

## Detention, wanted status and death

Persistent detention requires an active protester with a current validated violent timer, never merely an aggression trait or wanted designation. An officer channels within reach and clear line of interaction; movement, target disappearance, obstruction and space changes interrupt. Progress belongs to one officer. Attempting to complete custody on a peaceful target emits an unjustified-detention penalty event and does not arrest them. A successful transition emits once and starts 20 seconds of temporary custody. The character stays alive, releases in place, and is not respawned. An indoor detainee is brought through that building's entrance before custody.

Qualifying stone throws increment wanted level to a maximum of five and refresh a 90-second decay deadline. Subsequent levels decay every 30 seconds. One qualifying evasion check occurs after 60 seconds, only if active police were actually nearby; at most three checks are eligible per life. Wanted status never authorizes military fire by itself.

Persistent military fire additionally requires an imminent threat timer, recent active violence, an active target, a prior warning, tension above 55, valid range and line of sight. Imminent threat is set after an actual damaging stone impact leaves a target at 25 HP or lower, rather than for simply carrying or throwing an object. This is an explicit fictional game rule, not real-world legal or tactical guidance. Fire at ineligible targets is withheld.

Zero health enters `down`, emits death once, and sets `deathUntil` 30 seconds ahead. Persistent human bodies never automatically respawn: the service validates cooldown, role reassignment, appointment loss and new-life resources. Persistent NPC bodies expire and population maintenance can replace them. Death and detention remain separate transitions.

## Needs and supplies

Hunger and thirst start at 100 and decay slowly, stopping at 20 without unattended starvation damage. Values below 30 reduce player movement speed by 20%. Two public essential stations per map provide food/water independently of spectator wealth. Each holds up to six of each resource and replenishes three every 60 seconds. Collection validates physical reach and need, consumes stock and replenishes at most 40 need units. NPCs seek stocked resources when needs are low.

`spawnSupply(world, faction)` creates a bounded navigable delivery after the server validates and records funding. Trucks unload finite crates; stone inventory is capped at 12 and gas at three. Vehicle collision currently uses person-sized clearance; larger footprints are needed before vehicle combat or driving gameplay.

## Verification and limits

`tests/world-rules.test.ts` exercises persistent stepping beyond 300 seconds, idempotent human spawning, capture/contesting/recovery, defensive cycles, custody/release, death cooldown, unjustified detention, military constraints, interior occupancy/collision/doors, wanted decay, essential replenishment, witnessed/bounded events and population caps. Existing seeded simulation, collision, navigation, projectile, finance and supply-route regressions remain.

A successful unit run does not establish browser synchronization, durable account settlement, transport security, realistic Android performance or restart persistence; those need service and browser tests. Pathfinding remains coarse and can hold at a nearest reachable endpoint on arbitrary disconnected maps. Existing four supply routes are tested. Geometry cache invalidation, adaptive distant simulation and spatial hashing remain future performance work.
