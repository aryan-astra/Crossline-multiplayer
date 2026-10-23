# Deployment options

Supported now: one local Node24.20.x process, Next frontend, ws transport and built-in SQLite. npm run dev starts development; npm run build then npm start serves production. PORT defaults3000, HOST127.0.0.1, DATA_FILE data/crossline.sqlite. Set HOST0.0.0.0 intentionally for LAN play. No paid account is required.

Keep runtime SQLite/WAL out of Git. Stop gracefully or use SQLite backup tooling for consistent backups. One process owns the public worlds. A static export or ordinary serverless Next route deployment cannot host this continuous WebSocket simulation. A VM/container requires a durable volume, HTTPS and host bandwidth/uptime.

Client authority cannot safely own outcomes/money. WebRTC needs signaling/relay and malicious-host handling. PostgreSQL adds a service without a current need. Cloudflare Durable Objects could own locations, but Node HTTP/SQLite must be adapted to platform sockets/storage. Hibernation helps idle sockets; active ticks still consume compute. Do not assume continuous two-world operation fits a free tier.

No cloud deployment, paid hosting or donation/payment integration was created. DEPLOYMENT_RESEARCH.md records current primary sources and limits. Select deployment after measured endurance/bandwidth and security work.
