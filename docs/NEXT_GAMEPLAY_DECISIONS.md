# Next gameplay decisions

26 October 2026. These are proposals and questions, not shipped functionality. Current work is tracked in [PLAYABILITY_PLAN.md](PLAYABILITY_PLAN.md).

## Suggested additions, in priority order

1. **First-life field tutorial:** teach movement, collecting a highlighted item, using it, entering a shop and reaching the Book through four short playable steps.
2. **Friend finder:** mark friends on the minimap, with opt-in squad colors and a regroup ping.
3. **Readable bot intent:** show a small march, defend, support or retreat symbol when inspecting a bot, plus its current reason.
4. **Telegraphed attacks:** show a brief wind-up and direction before melee damage, with a clear shield-break cue.
5. **Rally route signs:** ground arrows toward the next civic gathering so the city has understandable routes.
6. **Crowd orders:** regroup, march and disperse orders with limited radius and duration, visible to their recipients.
7. **Defense sectors:** officers cover assigned inner/outer sectors and hand suspects off without abandoning every entrance.
8. **District tension:** local disturbances affect nearby behavior before contributing to citywide tension.
9. **Supply escort events:** a real delivery route, visible arrival estimate, stuck-vehicle recovery and a cargo manifest.
10. **Equipment inventory:** one clear equipped slot, durability and ammunition, with explicit pickup/swap feedback.
11. **Shop identities:** distinct tea stalls, bakeries, pharmacies and cafés with useful replenishment roles and consistent city art.
12. **Spectator event cards:** explain which world event moved a virtual price; keep the chart, holdings and funding controls on one readable panel.
13. **Fair-play report/replay:** short authoritative event replays for suspicious actions and stuck-bot diagnosis.
14. **World news timeline:** concise player-caused developments, objective captures and supply arrivals; bounded history and no fabricated events.
15. **Accessibility presets:** scalable text, strong team contrast, remappable keys, reduced effects and separate sound categories.
16. **Reconnect recovery:** a clear reconnecting overlay and recovered character state after a brief network interruption.

Each proposal needs an acceptance scenario, CPU/network budget and abuse review. No real-money betting, paid inference or client-owned currency is proposed.

## Twelve questions about the game

Answer by number; short answers are enough. Existing preferences already constrain these: peaceful bots march/respond to orders, only humans capture the Book, and spectator funding must deliver real supplies.

1. What should count as winning a public-world session: capturing the Book, holding it for a period, faction score over a day, or continuous play without an overall winner?
2. How long should one typical play session feel: 5–10 minutes, 20–30 minutes, or longer?
3. Should new players start in a quiet district or near the main confrontation?
4. Should nearby bot protesters follow any human protester, or only someone who earned a leader role?
5. Which crowd orders should launch first: follow, regroup, march to a marker, retreat, or hold a barrier?
6. How should a police bot choose between protecting its assigned defense sector and pursuing a wanted player?
7. Should ordinary players be able to command police immediately, or earn that permission through rank?
8. Should melee attacks aim toward the pointer, the movement direction, or the nearest valid target?
9. What should happen after detention: a brief custody timer, escape/rescue gameplay, or a choice to respawn?
10. Should supplies be safe deliveries or contestable convoys that can be intercepted? If intercepted, can cargo change faction?
11. How rare should firearms be, and should deaths lose carried equipment, a portion of credits, both, or neither?
12. Which art direction fits the playable city best: crisp pixel sprites, illustrated flat 2D sprites, or the current procedural style with richer animation?

## Open-source reuse decisions

The current engine uses a headless TypeScript simulation, Canvas 2D presentation, shared collision/prediction code, server authority and existing bounded navigation. The reported hidden names and empty-ground inspector bug occur in our presentation/input code; a renderer swap would still require fixing those paths.

- **Phaser:** MIT-licensed game framework with input, cameras, sprites and texture-atlas animation. Worth a small presentation prototype if animated sprites become the next milestone. Preserve the authoritative simulation rather than moving rules into scene callbacks. [Maintainer repository](https://github.com/phaserjs/phaser), [official documentation](https://docs.phaser.io/).
- **PixiJS:** a rendering option for an atlas-heavy, batched scene. Its ticker/scene graph does not supply authoritative game rules or bot behavior. Compare the same district and actor count against Canvas before selecting it. [Official render-loop guide](https://pixijs.com/8.x/guides/concepts/render-loop).
- **PathFinding.js:** MIT-licensed grid search algorithms, useful as a reference or comparison fixture. Our world uses irregular OSM footprints and existing line-of-sight/route caching; a grid replacement needs navigation accuracy and cost measurements first. [Maintainer repository and license](https://github.com/qiao/PathFinding.js).

No new runtime or engine dependency was installed for these fixes. No source or art from the reference game was copied. The generated hero, city illustrations and role portraits already in `public/img/` are retained; role portraits are now integrated into onboarding. A consistent gameplay sprite atlas and real-device rendering measurements remain an explicit milestone.
