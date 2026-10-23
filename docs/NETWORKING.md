# Networking

The custom Node server owns two location simulations at 30 fixed steps/second. Browser input is sent at 20Hz and snapshots at10Hz; browsers never advance independent public worlds. One active socket per guest identity prevents duplicate bodies; use separate browser profiles/private windows for multiple players.

GET /api/session creates/resumes a guest; POST changes its name. Cryptographically random tokens are stored hashed and sent in HttpOnly SameSite=Strict cookies. Origin checks protect writes/upgrades. GET /api/health and /api/leaderboards expose public data. /socket uses version1, monotonic per-connection sequence numbers and bounded request IDs. Inputs/actions are validated; stale sequences, role bypasses and overdrafts fail. Economic receipt fingerprints survive reconnect/restart and reject changed payloads under reused keys.

Transport bounds payload size, message rate and outbound buffering, checks heartbeat liveness, expires input after half a simulation second, and saves/removes disconnected characters after a grace period. Reconnect restores identity without a fresh wallet or duplicate body. Settings stop local input, not public time.

The input budget uses a monotonic token bucket: 60 messages/second with at most 120 queued messages in a burst. This tolerates short network or event-loop stalls without removing the flood bound. Non-input actions retain their separate 10/second limit, and three malformed frames still close the connection. The transport test accepts an 80-message queued burst and rejects a further flood.

Active roles receive nearby entities; spectators receive a full location for observation. Snapshots include authoritative bots, objective, deliveries and outcomes. Police receive one server-assigned wanted dispatch and the target entity even outside ordinary interest range; assignments are scoped to a map and move to another officer when a player disconnects. Interpolation is visual only. JSON still repeats map metadata: delta compression/static-map handshake are future measured optimizations. Host bandwidth/CPU bound scale; unlimited concurrency is not claimed.

Guest cookies are bearer identities. Clearing cookies creates another guest; no verified-human identity, account recovery, anti-Sybil system or public-internet abuse guarantee exists. Run exactly one host process against the world database. HTTPS and proxy/origin hardening are required before public deployment. Tests exercise real two-socket replication and persistence; see VALIDATION.md for browser evidence.
