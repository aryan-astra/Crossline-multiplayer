# Rendering and cameras

FAULTLINE retains the merged Canvas2D renderer. This change adds depth, visibility handling and camera helpers to the existing procedural art; it does not introduce an asset engine or replace the homepage artwork. No images, sprite downloads or dependencies were added.

## Coordinate and layer contract

Simulation collisions stay in ordinary 2D world coordinates. Buildings have a ground footprint; the renderer raises their existing roof drawing by 7 units for walls, 22 for shops, 35 for Delhi blocks and 48 for Paris blocks. Facades, windows/sills, Paris balcony rails, side shading and directional shadows connect roofs to the original ground footprint. Existing observatory instruments, Paris monument, shop awnings and roof equipment are preserved.

Visible buildings and outdoor entities share a depth queue. A building sorts by its front ground edge (`y+h`), characters by foot position (`y`). The facade/roof can therefore occlude somebody behind a building, while a character in front remains visible. This is a restrained top-down 2.5D projection, not full 3D geometry. Trees retain their intentional overhead foliage layer. Conservative culling margins include tall roofs, monument extensions, body equipment and speech bubbles.

Ground textures are built once using a private cosmetic seed. Broken glass fragments also use stable geometry-derived offsets. Neither consumes simulation randomness or changes snapshots. People use role uniforms/equipment, clothing/skin variation and ID-derived hair/accessories; hairstyle/headwear does not determine role, courage, aggression or intent. Walking/running follows authoritative `moving`/`running` flags, with state-based fallback for older fixtures. Idle feet are still; detained hands, active detention, downed and death/respawn states have separate presentation. The shared `down` state is distinguished visually by `deathUntil` when the death lifecycle applies.

`World.objective` renders an open Constitution Book on a civic plinth with its authoritative status and bounded capture progress. It also appears on the minimap. Resource stations and enterable door markers are visible. Rendering never increments capture, needs, arrests, health or rewards.

## Interior visibility

`Building.interior` supplies room dimensions/capacity/solid obstacles; `Entity.buildingId` supplies occupancy. An indoor entity's x/y are interior-local. Outdoor rendering and minimap omit indoor characters. When the local player is inside, the main canvas shows that room's tiled floor, obstacle furniture, walls, exit cue and only occupants of the same building. Camera presentation cannot authorize entry or invent occupancy; the server simulation owns both. Interior rendering currently centers directly on the player's local position; it does not reveal nearby outdoor actors through a translucent roof.

## Camera API

`src/game/camera.ts` is independent of React and network state:

| Role      | Initial/fixed zoom | User zoom |
| --------- | ------------------ | --------- |
| Protester | 1.65               | Fixed     |
| Police    | 1.15               | Fixed     |
| Military  | 0.78               | Fixed     |
| Watcher   | 0.85               | 0.45–2    |

`cameraZoom(role)` supplies the profile. `clampZoom(role, requested)` rejects nonfinite requests and keeps non-watchers fixed. `trackCamera(current,target,dt)` uses exponential smoothing, so equivalent elapsed time produces equivalent tracking at different display rates. `constrainCamera(camera,viewport,world,zoom)` keeps viewport edges within the world and centers an axis when the viewport exceeds it. The client driver owns applying these helpers, watcher pan/pinch/follow, and device-pixel scaling. Camera restrictions are presentation rules; clients must not be trusted to authorize hidden game outcomes.

## Measured tradeoffs

Before editing, a headless instrumented Canvas context rendered the old compiled renderer for 1,000 frames after 100 warm-up frames: **383.02 ms total, 2,738 recorded Canvas method calls per frame**. Scene: Delhi initial 63 entities, camera `(1450,1180)`, zoom 1, 800×600 logical viewport. The revised renderer under the same proxy method recorded **155.53 ms total and 1,068 calls/frame**, approximately 61% fewer submitted calls. This is JavaScript traversal/mock-call timing on the development host; it excludes Canvas rasterization, text layout, browser compositing and GPU work. It is **not** an FPS or Android performance claim. Runtime noise and other in-progress simulation changes also limit precision. Close fixed-role cameras naturally benefit more from culling than a zoomed-out watcher.

The comparison is reproducible by compiling tests, requiring `createWorld`/`drawFrame` from `.test-build`, drawing an unchanged initial world to a proxy context with no-op drawing methods, counting calls, warming 100 frames and timing 1,000. Browser measurements should use actual server snapshots at each camera profile, DPR 1/2, gas/crowd activity and mobile viewports. Do not extrapolate the proxy result into supported user counts.

The main integration agent's browser smoke run observed **6.8 ms of client render work** at a 1920×840 viewport with 47 entities and no console errors. This HUD sample includes presentation work for authoritative snapshots; it is not a sustained FPS distribution or a maximum-capacity result. The screenshot review also exposed misleading NPC respawn labels, which were corrected and covered by a regression test.

PixiJS remains a reasonable GPU renderer candidate: its official [performance guide](https://pixijs.com/8.x/guides/concepts/performance-tips) discusses batching, caching and explicit culling. [Phaser's documentation](https://docs.phaser.io/) offers a broader engine with WebGL/Canvas support. Neither was installed or benchmarked against this project, so no comparative speed advantage is claimed. Migrating would require retaining procedural geometry or building texture atlases, replacing draw/input integration and rechecking text/depth/interior behavior. First measure real Canvas bottlenecks; a reduced traversal with no dependency is currently the smaller verified improvement.

## Verification and limits

Camera tests cover fixed role limits/malformed values, frame-rate-independent tracking and world-edge behavior. Renderer tests cover snapshot purity over repeated draws, depth ordering/culling, same-building interior visibility, objective marker/status and distinct NPC/player down-state labeling. These are headless logic checks; the browser smoke sample above is separate evidence. Broader visual validation and hardware profiling remain necessary. There is no sprite atlas, GPU batching, dynamic light/shadow solver or precise per-pixel occlusion; tree foliage and large monument margins remain deliberate approximations.
