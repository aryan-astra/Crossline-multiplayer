# Engine review — 25 October 2026

Crossline uses a custom TypeScript fixed-step simulation, Node authority, SQLite persistence and a Canvas 2D renderer. React owns menus and HUD, not bot decisions. This pass keeps those boundaries rather than introducing a second game engine.

## Findings and changes

- Routes were sensitive to small target changes. Navigation now reuses routes within an 80-unit target threshold, uses direct clear paths, caches unreachable results and invalidates routes when barricade topology changes. Tests cover moving targets, unreachable destinations and reopening a broken barrier.
- Bots could retain motion flags at a zero-length destination. The shared movement path now reports stopped motion. NPCs support nearby humans at high tension and damage barricades on a cooldown; they cannot activate or advance Book capture.
- Static minimap geometry was redrawn every frame. A regression failed before caching (`0 !== 1` cache creation assertion); it now passes. Static geometry is cached across network snapshots, while people and barricade changes remain live. Minimap updates run at 10 Hz. The active city alone keeps its full ground canvas.
- Local movement uses the same collision helper as the authority for at most 150 ms of visual prediction. It cannot award damage, money, custody or objective progress. Other actors retain snapshot interpolation. Reconciliation still follows authoritative snapshots; this is bounded visual prediction, not a full input replay system.
- Default rendering caps pixel ratio at 1; players can choose higher quality. This reduces fill work on dense displays without altering collision coordinates.
- Persistent market prices used two independent update paths. A single 1.5-second server update now synchronizes price, previous price and history across both cities. Charts aggregate real samples into OHLC candles with a bounded scale.
- A live saved-world snapshot showed recent violence above 52,000. Linear subtraction allowed long sessions to accumulate effectively permanent unrest. The transient activity signal now decays exponentially over a 15-second time constant and caps at 100; a quiet-world regression failed before this change. Historical stats and balances remain intact.

## Why keep this renderer

A GPU renderer can improve sprite throughput but does not fix repeated pathfinding, authority delays or menus obscuring play. No dependency or renderer migration was introduced. Consider WebGL only after measured frame profiles show Canvas drawing dominates on target hardware. Cold navigation remains a measurable spike; startup prewarming and modest population limits remain important.

The saved-world routing investigation sampled Delhi at 176.8 ms for a cold pass over 30 targets and 40.8 ms total for the next 30 passes; Paris sampled 133.4 ms cold over 16 targets and 105.4 ms for the following 30 passes. These are routing-only samples, not complete server tick or input-latency measurements. Current whole-simulation results belong in [validation](VALIDATION.md).

## Boundaries

The architecture remains a single authority per process, with two shared cities. LAN and online start separate processes and stores; arbitrary user-created room codes and horizontal room scheduling are not implemented. Building interiors are generated game spaces, not surveyed real interiors. Vehicle clearance remains person-sized. Public concurrency and physical mobile-device latency require deployment/hardware measurement.
