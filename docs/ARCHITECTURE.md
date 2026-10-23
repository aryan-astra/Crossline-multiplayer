# Architecture

Keep one TypeScript application: a monorepo provides little benefit while frontend, simulation and transport ship together. Next/React owns menus and HUD; Canvas 2D owns presentation; the public simulation runs only on the Node server.

server.ts prepares Next and the game HTTP/WebSocket server. Transport owns cookies, origins, limits, heartbeat and fixed scheduling. Service owns validated actions, membership, roles, rewards, economy and snapshots. Store owns SQLite schema, transactions, ledger and durable receipts. Protocol validates versioned commands. The browser owns input, visual interpolation, camera, quality and audio.

One process owns a continuous public world with two location simulations. JSON checkpoints preserve seeded random state, ticks, event IDs, objective cycles, geometry and characters. Profiles, holdings, predictions, ledger and receipts are separate database records. Simulation time pauses while powered off. Graceful shutdown and periodic checkpoints preserve progress; critical economic transactions checkpoint with ledger changes and event cursor updates to prevent reward replay.

Server authority covers identity, movement validation, health, custody/death, inventory, role appointments, objective outcomes, score and money. Browsers cannot submit achievements, balances or arbitrary teleports. Historical practice helpers remain for compatibility tests; the public browser never calls their update or money routines.

Fully authoritative local Node is operationally simple and has an honest cheating boundary. Client authority cannot safely own money. WebRTC adds signaling/relay/host-trust complexity; it does not make peers trustworthy. PostgreSQL adds an unnecessary local service. Durable Objects require a transport/storage adaptation and measured budget, not a configuration toggle. Current primary-source research is in DEPLOYMENT_RESEARCH.md.

Canvas is retained: culling improves the existing renderer without evidence justifying a GPU rewrite. Simulation imports no React/DOM. Promotional images do not define collision geometry. Original prototype folders remain preserved/ignored; source provenance and retention decisions are in SOURCE_AUDIT.md.
