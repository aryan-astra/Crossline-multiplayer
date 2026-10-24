# Roadmap

This change implements shared local server simulation, persisted guests/ledger/checkpoints, authenticated WebSocket commands, continuous objectives, resources/interiors, custody/death, server role actions and appointments, snapshot-driven cameras/HUD, virtual markets/predictions/supplies, and deterministic/persistence/transport checks. See VALIDATION.md for executed evidence and omissions.

Next priorities:

1. Profile remaining simulation spikes and entity traffic under realistic load. One-time map transfer, WebSocket compression, graph warm-up and bounded narrow-passage steering are implemented; entity deltas, richer spatial queries and measured admission budgets remain. Saved-world p95 still exceeds the 33 ms tick budget in the local sample.
2. Low-end Android endurance, accessibility/touch tuning and balance from observed play. Current OSM scenes escalate rapidly; conduct sustained faction/market balance sessions before a public release.
3. Public account recovery, anti-Sybil/collusion controls, backups and hard-crash drills.
4. Cleared-provenance art/animation/audio within measured budgets. Existing generated promotional art is retained; no new generation was required.
5. Richer command delegation, equipment/buildings, news economy and complete life-budget spending.
6. Evaluate Cloudflare adapters against measured compute/write/bandwidth budgets.

Custom maps, paid services, real-money gambling, ML agents and unlimited concurrency are outside this build. Missing features are documented rather than represented by fake screens.
