# Input and HUD decisions — 25 October 2026

## Findings from the running game

The loopback movement probe reproduced1082–1286ms from first input to an authoritative position change with compression enabled. Disabling compression in the Node probe gave169–181ms, but this alone was insufficient evidence: the actual in-app browser still built a backlog of small compressed input messages. Its outgoing sequence reached380 while the server acknowledged92. Disabling server negotiation entirely and reconnecting the same player produced an85.52ms first authoritative movement sample. Key release sent false directions and positions then stabilized. No client-owned position or outcome was introduced.

## Sources and choices

- The [ws maintainers' compression guidance](https://github.com/websockets/ws/blob/master/README.md#websocket-compression) describes compression's CPU/memory overhead and recommends workload-specific testing. Keep compression off on this host until both browser input latency and bandwidth are measured together. One unfinished snapshot write suppresses newer disposable snapshots, preventing an outbound history queue. This costs bandwidth and is not a public-concurrency solution.
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) documents pointer capture, cancellation and device-independent pointer IDs. The joystick captures one pointer, clamps its thumb, uses a dead zone and clears directions on release, cancellation, lost capture, blur and visibility changes. CSS `pointer: coarse` reveals touch controls; small viewport width alone does not. No joystick dependency or user-agent guessing is needed.
- Glenn Fiedler's [Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/) explains the latency/smoothness tradeoff and bandwidth cost of repeated snapshots. Retain visual interpolation and server-owned movement. Local prediction would not repair an accumulating input queue; it would conceal it until reconciliation. Prediction/replay can be evaluated separately after transport remains responsive under measured load.

## Player-facing layout

The default HUD leaves its inspector closed. City, role, health, connection and virtual credits occupy a small corner capsule. Inspect, Exchange (spectators) and Menu are separate edge controls. Detailed news, rankings, help and settings open on demand. The context prompt and action dock replace the full-width footer. Touch players receive a circular joystick at the left and role actions at the right. The map remains the central surface.

These are local measurements and emulated pointer checks. They do not certify physical Android touch behavior, internet latency, long-running balance or supported player capacity.
