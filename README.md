# Crossline

A browser crowd simulation built by auditing and integrating STREETS / Crowd Command (Source A) and FLASHPOINT / Rally Lines (Source B). Crossline supersedes the brief's FAULTLINE working title.

**Playable local practice baseline.** This release has no shared multiplayer, accounts, saved career, or persistent money. Separate browser sessions run independent worlds. All four roles are available for practice. No real-money transactions exist.

## Run locally

Use Node.js 22 LTS or 24 and npm. Neither prototype declared Bun support or supplied a lockfile; this integration uses a committed npm lockfile.

```sh
npm ci --ignore-scripts
npm run dev
```

Open [localhost:3000](http://127.0.0.1:3000). Choose a fictional city inspired by Delhi or Paris, a role, and a callsign. No database, credentials, or environment configuration is required.

```sh
npm run validate    # lint, types, headless tests, production build
npm run build
npm start          # serve the production build
```

## Play

| Control           | Action                                              |
| ----------------- | --------------------------------------------------- |
| WASD / arrow keys | Move your character; pan as spectator               |
| Shift             | Sprint                                              |
| E / Space         | Chant, detain, or engage according to role          |
| Q                 | Protester secondary, police baton, military warning |
| T                 | Police gas, when supplied                           |
| C then click      | Issue a police formation order                      |
| Mouse wheel       | Zoom                                                |
| Click a person    | Inspect; spectator can place a practice bet         |
| Pause / Exit      | Pause or discard this session                       |

Touch movement and primary/secondary buttons are provided. The spectator panel exposes session-only trading and supply funding. Military engagement requires a recently violent target, an active warning, range, and sufficient tension. Invalid engagement is rejected. Practice credit balances start at 1,000 each round and reset on exit.

## Integration

Source A supplies the procedural Canvas map and character rendering, collision geometry, role interactions, match market, and supply mechanics. Source B supplies centered perpendicular formation slots and deterministic golden-angle rally targets. The integration adds seeded world-local randomness, fixed simulation steps, isolated map copies, bounded navigation, collision-safe separation, action validation, and regression tests.

The insecure original APIs were excluded: neither prototype established trusted identity or verified wallet/career/outcome changes. Source A's presence polling did not synchronize simulations. PostgreSQL and Drizzle are unnecessary for a disposable practice match. The original source folders are preserved locally and ignored by Git; the source audit records their evidence and defects without duplicating the archives into the repository.

## Structure

```text
src/app/                menu, route, layout, styling
src/components/         canvas driver, HUD, input and lifecycle
src/game/               headless rules, AI, maps, navigation, renderer
tests/                  deterministic and integration regressions
docs/                   audit, decisions, limitations and roadmap
.github/workflows/      CI validation
```

A single application avoids monorepo overhead. When a real room server exists, the headless engine can become a shared package without depending on React or Canvas.

## Engineering documents

- [Source comparison](docs/SOURCE_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Networking and authority](docs/NETWORKING.md)
- [Simulation](docs/SIMULATION.md)
- [AI design](docs/AI_DESIGN.md)
- [Economy](docs/ECONOMY.md)
- [Deployment options and researched limits](docs/DEPLOYMENT_OPTIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Executed validation](docs/VALIDATION.md)
- [Homepage art direction and replacement artwork](docs/ART_DIRECTION.md)

## Limits and ownership

This is an integration baseline, not a production multiplayer release. Bots use bounded navigation and explainable rules; large crowd scaling, tactics, balance, audio, animated sprite assets, and authoritative services remain future work. Canvas performance must be measured on target hardware before selecting WebGL. Tests prove reproducibility for the covered seed/input/runtime combinations, not cross-platform lockstep compatibility.

The supplied prototypes contained no LICENSE or original image files. The homepage combines their layout and typography with seven newly generated replacement illustrations in `public/img/`; it does not claim to recover their absent artwork. Bebas Neue and Barlow are bundled locally with their SIL Open Font Licenses in `public/fonts/`. See [art direction and prompts](docs/ART_DIRECTION.md). Procedural source code is reused under the user's integration instruction; its redistribution rights still need confirmation before adding an open-source license. Dependency license metadata is recorded in the installed packages.
