# Playability delivery plan

Updated: 26 October 2026. This is the working checklist for the player's reported issues. Checked items require executed evidence; a feature existing in source is not proof it feels correct in play. Original source folders and saved player progress stay preserved.

## Goal 1 — Read the city while playing

- [x] Show overhead callsigns for local players, friends and bots without selecting them.
- [x] Distinguish humans and bots; retain seeded city-specific bot names.
- [x] Highlight roadside stones, sticks and bats, with a nearby pickup prompt.
- [x] Keep the minimap visible on desktop and touch layouts, including landscape phones.
- [x] Open the inspector only after an intentional actor selection or its button.

Acceptance: render regressions cover names and pickup prompts; browser checks cover empty ground taps, actor selection and map/control placement.

## Goal 2 — Make actions predictable

- [x] Set base movement to protester > police > military for humans and bots.
- [x] Apply the same movement rules to server simulation and client prediction.
- [x] Explain unavailable actions: missing stones/gear, cooldowns, range and life state.
- [x] Play damage feedback from authoritative state and retain mute/volume controls.
- [x] Confirm keyboard and touch controls call the same validated actions.

Acceptance: headless tests cover actual actions and movement distances, plus audio event deduplication; browser checks cover the feedback players see.

## Goal 3 — Give crowds useful jobs

- [x] Reproduce distribution in both fresh and restored worlds.
- [x] Spread peaceful crowds through city routes; retain response to orders.
- [x] Keep bots from capturing the Constitution; support barrier pressure as tension rises.
- [x] Maintain police in inner and outer defense positions, with military support.
- [x] Check the arrangement after simulation time, rather than only at spawn.
- [x] Measure simulation cost with the revised behavior.

Acceptance: fixed-seed population/behavior tests and benchmark results. Active players must not be repositioned by a migration.

## Goal 4 — Complete and verify this delivery

- [x] Run formatting, lint, types, tests and production build.
- [x] Start the production LAN server and smoke test through the in-app browser.
- [x] Exercise two independent clients against the same authoritative world.
- [x] Commit related fixes in focused local commits.
- [x] Record remaining device checks and limitations honestly.

## Goal 5 — Define the public release

- [x] Check official current free hosting limits for the existing Node/WebSocket/SQLite server.
- [x] Explain one shared world, its capacity and persistence boundaries.
- [x] Document what can run now and what requires a Cloudflare adapter.
- [x] Offer 10–20 concrete gameplay additions and 10–15 game design questions.

## Remaining earlier requests — tracked, not claimed complete

- [ ] Replace procedural gameplay characters/props with a coherent, animated city-specific sprite set after an atlas/render budget is established. Generated title/city/role artwork already exists in `public/img/`; it is not world geometry.
- [ ] Conduct long sessions on real low-end Android and iOS hardware with touch/audio enabled.
- [ ] Measure persisted-world input latency under multiple devices and public-network conditions.
- [ ] Balance supply escorts/interception, shop interactions, weapons and faction escalation through actual play sessions.
- [ ] Add recoverable public accounts, abuse controls, backup/restore drills and durable deployment before promising persistent public careers.
- [ ] Implement a measured public shared-world hosting adapter if the selected host cannot run the current server.

The broader [roadmap](ROADMAP.md), [source audit](SOURCE_AUDIT.md), [art direction](ART_DIRECTION.md) and [deployment options](DEPLOYMENT_OPTIONS.md) remain the references for long-term work. This checklist does not authorize claiming all earlier product ideas finished.
