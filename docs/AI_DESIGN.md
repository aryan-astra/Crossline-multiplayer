# Autonomous behavior

## Existing foundation retained

The engine retains Source A's explainable finite-state behavior, per-agent traits, think timers, movement/collision, detention channel, fear response, supplies and civilian conversion. Source B contributes tested `formationSlot`, which centers officers perpendicular to their advance, and deterministic golden-angle `rallyTarget`, which spreads agents around a rally point. Neither helper consumes random state.

Each world owns its RNG and fixed-step rules. Personalities affect aggression, courage, discipline and chattiness. Cosmetic appearance is independent from faction decisions and personality. There are no LLM calls, model training or paid AI dependencies.

## Persistent behavior

Organized nonviolent protesters with discipline at least 0.65 march through rally anchors. Only active human protesters with server-issued profiles can activate or advance Constitution Book capture; one human can capture when no defenders contest it. NPCs never add progress, including alongside humans. At tension 55 or higher, bots within 260 units of a human protester support that player at nearby barricades, inflicting 6–10 damage on a 1.2-second cooldown. Otherwise they spread around the human or continue their routes. Fear from nearby gas or threats takes precedence. Rally destinations resolve onto open ground. A fleeing agent near an accessible doorway can shelter, rest ten seconds and exit. Police and military retain faction commands; player-issued protester squad commands are not implemented.

Police pursue current validated violent actors, use timed nonlethal detention, and obey permitted formation commands according to rank/discipline. Higher-ranked unassigned police guard the civic objective. The server assigns each wanted person to one connected officer, with NPC officers covering unassigned cases; a dispatch alone never authorizes custody. Pure personality suspicion no longer authorizes custody in persistent mode. Channels clear if ownership, target state, space, range or obstacle visibility changes. Multiple officers cannot independently receive the same detention transition.

Military NPCs retain checkpoint patrol and warnings, but persistent fire uses the same restrictive eligibility function as humans: imminent harmful behavior, recent active violence, warning, tension/range and clear visibility. Wanted score alone does not permit firing. This is a fictional game constraint.

Civilians wander, react to danger and can join crowds. Two designated civilian units are journalists; new populations replace reporter slots when necessary. A reporter emits news only when active, in the same space and within 300 units of an event subject, with outdoor line of sight. News derives from authoritative events rather than invented browser messages. Reporters do not learn events globally.

Low-need NPCs seek stocked public food/water stations, using ordinary navigation, then consume finite resource stock. Needs never cause inevitable unattended starvation deaths. Shelter/needs are bounded game behaviors rather than economic agents with pretend wallets.

## Population and cost

A five-second maintenance cadence targets fewer bots as human population rises. Bot counts have minimums, maxima and despawn hysteresis; each maintenance pass changes at most one entity per faction. NPC deaths/custody departures can be replaced without creating an unbounded population. Real humans are never despawned to meet the bot budget.

Bots use cached coarse navigation with swept-safe edges and ordinary local separation. Routes tolerate small target jitter, cache unreachable results, and retry when a barricade breaks. Police/protester/military think approximately every 0.3–0.65 simulated seconds; some fear, movement, support and needs checks run every fixed step. Linear neighbor scans and pairwise separation remain suitable only for measured modest populations. Full simulation levels, group crowd approximation and spatial hashing are not implemented. Fourteen police anchors, including three inner guards, and six nearby military checkpoint anchors protect the open Book area; these are patrol destinations rather than immovable walls.

## Tests and current boundaries

AI helper tests cover formation spacing/centering and deterministic rally offsets. Simulation tests cover seeded reproduction, inactive-target guards, movement, collision after separation, obstacle routing, single-owner custody, expiring commands, strict fire eligibility and all four supply routes. Persistent rules tests cover continuous lifetimes, resource replenishment, capacity/doors, shared human stepping, objective events and adaptive population caps.

Bots do not perform sophisticated tactical planning, and the current coarse grid does not guarantee liveness on arbitrary future custom maps. Indoor bots use a short rest/exit behavior rather than general furniture navigation. Long-running server endurance and multi-client results should be taken from executed integration reports, not inferred from these rules descriptions.
