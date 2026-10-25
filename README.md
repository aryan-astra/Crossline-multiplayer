# Crossline — Crowd Command

Persistent multiplayer browser crowd simulation integrating STREETS / Crowd Command and FLASHPOINT / Rally Lines. Earlier engineering documents use the provisional name FAULTLINE.

## Run

Use Node.js **24.x, at least 24.20** and npm. No paid service, external database or API key is required.

```sh
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:3000. PowerShell alternative port: `$env:PORT=3001`. Production: `npm run build` then `npm start`. The custom Node server supplies Next, WebSockets and built-in SQLite. Running Next directly omits multiplayer. Runtime data lives in ignored `data/crossline.sqlite`.

Set HOST=0.0.0.0 intentionally for LAN play and use the host's LAN address. Separate browser profiles or a private window create separate players; ordinary tabs share a cookie and replace the same identity's connection. Guest progress survives refresh/restart but clearing cookies loses account access.

For friends on the **same Wi-Fi or LAN**, run `npm run build` once, then `npm run start:lan`. The launcher prints this machine's local IPv4 addresses. Friends open the printed address (not `127.0.0.1`) while the host stays running. Allow Node only on your trusted private network if Windows asks. This does not configure firewalls, router forwarding or an internet tunnel. Players on different internet connections need an HTTPS/WSS deployment; see [deployment options](docs/DEPLOYMENT_OPTIONS.md).

## Play

The illustrated title screen opens two setup steps: callsign/city, then entry area/role. Play in Dew Nelhi or Arisp, fictional districts with attributed OSM street geometry. Entry areas place new characters only; saved characters resume in place. WASD/arrows move, Shift sprints, E/Space is the role's primary action, Q secondary, T uses equipped protester gear or supplied police gas. F collects essentials, loots a stocked shop when hungry/thirsty, or interacts with the Constitution Book. B enters/exits near a doorway. C then click commands police. Spectators pan/zoom, inspect/follow people, trade, predict outcomes or fund deliveries. Touch devices get a joystick; desktop uses keyboard. Settings suspend your input; the public world continues.

The minimap stays visible at lower left. Only human protesters can capture the Book. At high tension, nearby crowd bots support players breaching the yellow barricades; police and military guard the open objective area. Roadside stones, sticks and bats replenish with a fixed cap. Funded essentials deliver food/water and first aid; equipment packs deliver faction gear. Rare fictional arms cost 500 game credits and contain three rounds. All outcomes, prices and charges remain server-owned.

The title screen reports which authority is running. LAN and online use separate processes, database files and cookies. Online is unavailable until a public server is configured. For an HTTPS deployment, set `PUBLIC_ORIGIN=https://your-host` and run `npm run start:online`; optionally set `ONLINE_URL` on the LAN host to link to it. LAN mode checks the actual peer address; do not expose it through a public proxy or tunnel. See [networking](docs/NETWORKING.md) for limitations.

Military appointments are temporary and earned through police performance. Death requires a 30-second wait and explicit protester/police respawn choice. Custody is temporary. New guests receive 69 persistent fictional credits once; life allowance is separate. No real money or payment system exists.

## Structure

- `server.ts`: combined frontend/game entry point.
- `src/server/`: transport, authoritative service, SQLite store.
- `src/network/`: versioned commands and browser connection.
- `src/game/`: headless simulation, AI, maps, navigation, camera and Canvas renderer.
- `src/app/`, `src/components/`: illustrated menu, snapshot-driven HUD/input.
- `tests/`, `docs/`: regressions, audits, measured validation and limits.

Original prototypes remain preserved locally and ignored. Source A supplied maps, rendering and rules; Source B supplied formation and rally algorithms. Menu images remain separate from collision geometry.

The 4400 × 3000 street layouts and building footprints use OpenStreetMap extracts for Jantar Mantar and Place de la République. Ordinary buildings have marked entrances and generated interiors; monuments and walls do not. Facades, interiors and events are fictional; see [map sources and ODbL attribution](docs/MAP_SOURCES.md). Spectators can open **Exchange** directly from the header to see price histories, holdings, virtual trades and supply funding. Settings includes opt-in directional event sound.

The play view starts with a compact city/health/wallet capsule, an optional inspector and a small action dock. Overview, People and News open on demand. Touch devices get a circular movement joystick and thumb actions; desktop windows never gain a joystick just because they are narrow. Spectators get a dedicated **Exchange** with live simulated quotes, portfolio values, predictions and supply routes. Career & rankings shows guest progression alongside public scores. Balances and outcomes come from server snapshots. The server targets30 fixed steps/second and yields after each step; under overload the shared simulation slows. WebSocket compression is disabled after a browser input-backlog regression; static maps are still sent once per connection/location. See [networking](docs/NETWORKING.md) for the bandwidth tradeoff.

## Validate

```sh
npm run validate
npm run benchmark
npm run endurance
npm audit --omit=dev
```

CI uses Node24.20.0. See docs/VALIDATION.md for executed results, docs/IMPLEMENTATION_AUDIT.md for the pre-change audit, and ARCHITECTURE.md, NETWORKING.md, SIMULATION.md, AI_DESIGN.md, ECONOMY.md, RENDERING.md, DEPLOYMENT_OPTIONS.md and ROADMAP.md for actual contracts and remaining work.
