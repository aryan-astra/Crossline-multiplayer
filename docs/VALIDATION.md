# Executed validation

Validated on 22 October 2026 using Windows, Node.js 24.20.0 and npm 12.2.0. The originals were inspected without executing their PostgreSQL applications or modifying their directories. This record describes the integrated root application.

## Toolchain and automated checks

| Check                          | Actual result                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install --ignore-scripts` | Installed dependencies; generated npm lockfile. Source package scripts inspected first; installation lifecycle hooks disabled.                       |
| Pinned security updates        | Next.js 16.2.6 → 16.3.8; PostCSS 8.5.8 → 8.5.31. Production build and rules tests passed after updates.                                              |
| `npm run validate`             | Passed: Prettier check, ESLint, TypeScript, 17 Node tests, Next production build.                                                                    |
| Full test run                  | 17 passed, zero failed/skipped; 21.59 seconds total in final run.                                                                                    |
| Production build               | Next 16.3.8 generated `/`, `/_not-found`, `/icon.svg`; final compilation 2.2 seconds, followed by successful type/static generation phases.          |
| `npm audit --omit=dev`         | Zero reported production vulnerabilities.                                                                                                            |
| `npm audit`                    | Five high development dependency entries, all from the `braces` → `micromatch` → `fast-glob` → Next ESLint chain. No critical entries after updates. |

The remaining [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) covers the checked latest braces release, 3.0.3. No patched registry version was available. This affects development glob processing; it is not bundled into the game. Do not claim the full toolchain audit is clean. npm's proposed forced downgrade of Next ESLint was not applied. The [Next advisory](https://github.com/advisories/GHSA-4jqv-mc3x-m676) identifies 16.3.8 as a fixed version for the relevant 16.x range.

## Headless behavior covered

- Fixed-step equivalence at 30/60/120 rendering callbacks, bounded elapsed catch-up, invalid elapsed input.
- Two full 300-second worlds with identical seed and inputs reproduce exactly, including interleaved updates. Different seeds create different populations.
- World map destruction cannot affect another world or map templates.
- Player straight/diagonal movement covers 110 world units per second, camera follows, sprint respects building clearance.
- Primary-action cooldown; detained, down and removed actors cannot farm actions.
- Projectile duration uses the chosen aim point's distance.
- Finite integer economy validation, holdings/balance checks, bounded bet/supply state.
- Shared military warning, recent violence, distance and tension rules.
- Detention ownership, cancellation and single outcome counting.
- Spawn/separation building invariants on both maps.
- Navigation around an obstructing block; all four map/faction supply routes deliver four crates without entering solids.
- Expired cached orders are cleared.
- Round close refunds open bets and liquidates holdings exactly once.
- Source B formation spacing/centering and reproducible bounded rally spreading.
- Drawing 120 frames cannot mutate simulation/detention state.

## Actual browser checks

Playwright exercised the production server at `127.0.0.1:3001` after rebuilding and restarting it:

- Menu, callsign, location and all four role flows; both map names load.
- Protester chanting raises displayed morale; movement keys and camera rendering load without page exceptions.
- Pause activated by Space on its focused button; native dialog moves focus to Resume, freezes the clock, and resumes using Escape. Exit returns to menu and re-entry works.
- Spectator buys one share (holding becomes ×1), places a 50-credit bet (one open bet), and funds a police supply truck (simulation event appears). Physical supply delivery is additionally checked headlessly.
- Police formation button emits an actual LINE order. Military engagement without an eligible target is withheld; warning control works without a runtime exception.
- A separate 390×844 touch context renders a 780×1688 backing canvas at DPR 2, exposes touch movement and special/zoom controls, and has no menu horizontal overflow.
- One paused spectator context stays frozen while an independent police context advances. This confirms independent practice sessions; it is **not a multiplayer synchronization test**.
- A forged POST to the old `/api/sync` returns 404. The insecure source API is not exposed.
- Final combined browser run reported zero page errors. Screenshots were inspected locally under ignored `artifacts/`.

Early automation attempts used a nonmatching accessible-name selector, waited for a native option to be visible instead of attached, and used a stale server across rebuilds. Those harness issues were corrected; only successfully completed checks are reported above. A production server should be restarted after replacing its build directory.

## Performance observations

Final twin full-round headless rules run: 20.71 seconds for two 300-second worlds (12,000 calls at 0.05 seconds), including equality checks at completion. Earlier runs ranged higher under different code/host load; this is an observation, not a stable benchmark contract.

A separate 900-tick sample at 30 Hz on the host measured:

| Map      | Median tick | p95 tick | Maximum   | Total      |
| -------- | ----------- | -------- | --------- | ---------- |
| Meridian | 0.821 ms    | 3.264 ms | 31.715 ms | 1,092.8 ms |
| Concord  | 0.595 ms    | 2.106 ms | 15.579 ms | 802.7 ms   |

These exclude Canvas/React/network work. Observed browser HUD frame-work samples were about 3.7 ms on desktop and 9.9 ms in the emulated touch/DPR2 context. They measure JavaScript simulation/draw work over a short HUD sampling window, not presentation frame intervals, GPU time, or real mobile hardware performance. No server capacity, sustained FPS, or thousand-agent claim follows from them.

## Not verified

Original database endpoints, external database operation, hosted deployment, GitHub Actions execution on GitHub, real synchronized multiplayer, cross-platform lockstep, real mobile hardware, large crowd scaling, long-duration operational resilience, asset/source redistribution licenses, and persistent money/progression. GitHub push verification is reported separately in the handoff; CI configuration alone is not a successful remote run.

## Homepage visual revision

The user rejected the first schematic homepage. The revised homepage restores Source A's condensed title/callsign panel and Source B's illustrated hero/location/role flow, with replacement artwork documented in ART_DIRECTION.md. After revision, formatting, ESLint, TypeScript and the production build passed. Playwright confirmed all seven images load, no horizontal overflow at 1440px desktop or 390px touch width, callsign gating, pressed selection states, correct Concord/police deployment, working formation orders, spectator deployment, retained callsign on exit, and military deployment in a DPR2 touch context. The completed browser run reported zero page errors. Screenshots of both layouts were inspected locally. Simulation source and tests were unchanged by this visual revision.
