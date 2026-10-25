# Roadmap

This change implements shared local server simulation, persisted guests/ledger/checkpoints, authenticated WebSocket commands, continuous objectives, resources/interiors, custody/death, server role actions and appointments, snapshot-driven cameras/HUD, virtual markets/predictions/supplies, and deterministic/persistence/transport checks. See VALIDATION.md for executed evidence and omissions.

Next priorities:

1. Measure sustained multi-client admission budgets and remaining spikes. One-time map transfer, entity deltas, indexed collision queries, graph warm-up and bounded local route search are implemented. WebSocket compression stays disabled after a reproduced input backlog. Fresh-world benchmarks alone are insufficient: include persisted-world workloads and browser input latency.
2. Low-end Android endurance, accessibility/touch tuning and balance from observed play. Current OSM scenes escalate rapidly; conduct sustained faction/market balance sessions before a public release.
3. Public account recovery, anti-Sybil/collusion controls, backups and hard-crash drills.
4. Expand city-specific sprite animation/audio within measured budgets. This pass adds original generated title artwork; gameplay remains procedural Canvas geometry.
5. Richer command delegation, equipment/buildings, news economy and complete life-budget spending.
6. Evaluate Cloudflare adapters against measured compute/write/bandwidth budgets.

Custom maps, paid services, real-money gambling, ML agents and unlimited concurrency are outside this build. Missing features are documented rather than represented by fake screens.

## Candidate gameplay improvements — not implemented

1. A brief playable first-life tutorial teaching movement, collecting gear, shop entry and the Book through contextual prompts.
2. Commander regroup pings and visible bot intent, with short attack wind-ups and clear crowd support boundaries.
3. Supply escorts and interception with vehicle-sized collision and recoverable cargo, after route profiling.
4. District rotations, optional crowd-density overlays and recorded authoritative replays for diagnosing stuck agents.
5. Invite-code rooms with bounded player/bot budgets and recoverable public accounts before larger public competition.

Each needs a small playable acceptance scenario and a measured CPU/network budget. More decorative menus are not a priority over input latency and readable play.
