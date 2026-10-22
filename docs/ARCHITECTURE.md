# Crossline architecture

Crossline is the game name. FAULTLINE was the integration brief's working title. This initialization is a local practice game, with no shared multiplayer room, authenticated profile, persistent progression, or production economy.

## Implemented boundary

The root application uses Next.js 16.3.8, React/React DOM 19.2.6, TypeScript, and Canvas 2D. Versions are pinned in `package.json`; npm and its lockfile define the installation workflow. Development tooling includes PostCSS 8.5.31 and Prettier 3.6.2. PostgreSQL, Drizzle, and icon-library dependencies from the prototypes are unnecessary in this runtime.

The integration retains Source A's world definitions, renderer, and game mechanics as the starting point. Source B contributes centroid-relative squad formation and individual rally/milling offsets. Neither prototype is treated as an authoritative multiplayer engine. Read `SOURCE_AUDIT.md` for verified source defects and retention decisions.

| Area                 | Responsibility                                                               |
| -------------------- | ---------------------------------------------------------------------------- |
| `src/app`            | Application route, layout, metadata, styles                                  |
| `src/components`     | Menu, game driver, HUD, input lifecycle, round presentation                  |
| `src/game/types.ts`  | World, entity, action, and map types                                         |
| `src/game/maps.ts`   | World geometry, spawn data, collision definitions                            |
| `src/game/engine.ts` | World creation, simulation updates, interactions, match-local economy        |
| `src/game/ai.ts`     | Formation slots and deterministic crowd target helpers                       |
| `src/game/render.ts` | Static ground, characters, props, vehicles, effects, camera drawing, minimap |
| `tests`              | Headless rules and integration regressions                                   |
| `docs`               | Audit, architecture, boundaries, validation and milestones                   |

The original extracted directories remain preserved beside the integration and excluded from the new repository baseline. They are reference material, not alternate application roots to deploy.

## Simulation and presentation

The simulation imports no React or DOM APIs. The client driver owns the canvas, animation scheduling, browser input listeners, viewport size, and HUD refresh. `src/game/loop.ts` advances bounded fixed steps at 30 Hz, then the driver draws the world. `src/game/navigation.ts` supplies obstacle visibility, a per-map grid, and entity paths. Each world owns seeded random state and a cloned map. Drawing does not mutate simulation state, although decorative Canvas texture noise remains visually random. World coordinates determine movement and collision; canvas resolution and camera transforms affect presentation only.

Rendering remains Canvas 2D because neither prototype supplies evidence that a renderer rewrite is necessary. Static world drawing and dynamic actors use distinct rendering responsibilities. Map geometry is actual world data rather than an interactive promotional image. Do not infer asset redistribution rights from the mere presence of a file: unresolved-provenance source images are not required for the procedural baseline.

The engine still groups several related simulation systems in one module; this is a small single-application baseline, not a completed package architecture. Extract a rules subsystem when it gains an independent caller or measurable maintenance benefit. Create a workspace/monorepo only when a real room server must share the simulation and protocol with the browser.

## State ownership

During practice, the browser owns the entire disposable world. Virtual balances, holdings, bets, supply purchases, detention totals, and round results have only local practice significance. Restarting or editing browser state cannot grant a trusted career reward because no profile or settlement service exists.

Camera, visual animation, input state, selected panels, and effects are presentation concerns. A future server must own identity, membership, validated actions, detention/combat results, progression, wallet transactions, supplies, and match settlement. Adding a server does not make client-submitted outcomes trustworthy.

## Decisions and alternatives

- Keep Next.js and React: both sources already use this stack; preserving the application environment reduces integration risk. A static host remains possible if a static export is deliberately configured and validated later.
- Keep Canvas 2D: measure simulation and rendering separately before evaluating WebGL batching. [Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [WebGL resource and batching guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
- Keep local practice explicit: sharing player markers while each browser independently resolves bots and outcomes would produce inconsistent matches.
- Defer database and networking dependencies: neither is needed to verify the current game loop. Future room authority and durable settlement are separate milestones.

Validation commands and executed results are recorded in the README and audit. Documentation is not evidence that a check passed.
