# Crossline collaboration handoff

This guide coordinates work between the repository owner and a second contributor using Codex. Keep `main` as the shared, reviewed, runnable branch. Do not have two people or agents edit the same feature branch or push directly to `main`.

## Current shared baseline

- Canonical repository: <https://github.com/aryan-astra/Crossline-multiplayer>
- Shared branch: `main`
- Starting commit for this handoff: `72fb2b8` (`docs: record playability checks and release plan`)
- The old `feat/persistent-public-world` branch was merged and deleted. Create new short-lived branches from current `main`.
- Runtime: Node.js `>=24.20.0 <25`, npm, Next.js/React, TypeScript, Canvas 2D renderer, custom Node/WebSocket server, SQLite.
- Read [the source audit](SOURCE_AUDIT.md), [architecture](ARCHITECTURE.md), [playability plan](PLAYABILITY_PLAN.md), [roadmap](ROADMAP.md), [art direction](ART_DIRECTION.md), and [validation record](VALIDATION.md) before choosing work.

The playability plan records delivered checks separately from unfinished work. The project is playable, but it is not a finished, publicly scaled product. Do not describe local two-client checks as public-network validation or claim that all planned mechanics are complete.

## Suggested division of work

Use these as separate, non-overlapping lanes. Confirm who owns each lane in the PR description before coding. If priorities change, update the assignment here first.

### Contributor using the other Codex — gameplay art and renderer prototype

Own one small visual vertical slice: prototype a coherent gameplay sprite treatment for one player role, one bot role and a few roadside props, then show them in one representative city district. Preserve the current Canvas renderer unless a measured comparison justifies a change.

Primary files:

- `public/img/gameplay/**` (new, original assets only)
- `src/game/render.ts`
- `tests/render.test.ts`
- `docs/ART_DIRECTION.md`

Do not edit `GameScreen`, HUD styles, simulation rules, networking, persistence, package dependencies, or the other contributor's files without coordinating first. Establish the visual target and asset dimensions, preserve team colors and readable silhouettes, and report asset provenance. Compare draw cost/frame time against the existing renderer at the same actor count. Add focused renderer tests and provide a gameplay screenshot. Keep a clean fallback if the prototype misses the agreed budget. Do not use promotional art as map geometry.

### Repository owner / primary Codex — simulation, behavior, and operations

Own one independently testable simulation slice: profile the existing 100-bot stress scenario, identify the dominant simulation cost, and optimize that hotspot without changing the simulation contract. The current recorded p95 is 37.441 ms for five humans and 100 bots, above the 33.3 ms tick budget; use the same benchmark setup for comparison.

Primary files depend on the measured hotspot and may include `src/game/ai.ts`, `src/game/engine.ts`, `src/game/world-rules.ts`, `src/game/maps.ts`, `src/game/navigation.ts`, corresponding `tests/*`, and `docs/SIMULATION.md` or `docs/AI_DESIGN.md`.

Acceptance: record before/after p50 and p95 using the same fixed scenario; keep fixed-seed Delhi/Paris behavior tests passing; preserve distributed bots, defense rings, player movement and authoritative outcomes; add a focused regression test for the changed behavior. Do not claim success if p95 remains above budget—report the remaining bottleneck and measured result.

Do not edit the art contributor's renderer/assets/tests in parallel. Preserve server authority, deterministic fixed-seed tests, bounded work per tick, and current player rules. Profile before changing engines or adding dependencies.

### Backlog not assigned by this split

Keep these unassigned until the two contributors agree on ownership and acceptance criteria: durable public accounts and recovery, abuse controls, backup/restore drills, public hosting adapters, real-device endurance, economic balance, shop depth, supply interception, and persistent public operations. Existing idea lists are proposals, not shipped work.

## Working agreements

1. Create one branch and one PR per focused deliverable. Suggested names: `codex/gameplay-art-slice` and `codex/crowd-performance`; use a different name if that exact task is not selected.
2. Do not make concurrent edits to shared files. If a change needs another lane's file or API, open a small contract/PR first or agree on the interface in the PR discussion.
3. Keep each task small enough to review. Split large ideas into vertical slices with measurable acceptance criteria.
4. Commit only related files with descriptive conventional messages. Use your own configured Git identity/signing. Never put credentials, passphrases, `.env` files, local databases, or private user data in a prompt, commit, or PR.
5. Do not force-push shared branches, rewrite `main`, or push directly to canonical `main`. Do not merge your own PR unless the repository owner explicitly asks you to.
6. Before opening a PR, inspect the complete diff and run the relevant checks. For code changes, use the project's pinned Node/npm setup; typical commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Run focused tests while iterating and report commands that were not run.
7. PR descriptions must state: player problem, behavior changed, files touched, checks run/results, known limitations, and screenshots or a short capture for visual changes.
8. The repository owner reviews and merges one PR at a time into `main`, then asks the other contributor to base the next task on the updated `main`. Delete merged feature branches.

## Fork and branch setup

The second contributor should use their own fork as `origin` and this repository as `upstream`:

```sh
git remote -v
git remote add upstream https://github.com/aryan-astra/Crossline-multiplayer.git
git fetch upstream
git switch -c codex/gameplay-art-slice upstream/main
```

If `upstream` already exists, verify its URL rather than adding another remote. Push the feature branch to the contributor's fork and open a PR targeting `aryan-astra/Crossline-multiplayer:main`:

```sh
git status --short
git add <only-related-files>
git commit -m "feat: add a readable gameplay art slice"
git push -u origin codex/gameplay-art-slice
```

For the repository owner working from the canonical clone, create a new feature branch from the latest `origin/main`, push it, and open a PR. Keep local `main` clean. Do not merge work simply by copying files between checkouts.

Before starting a later task, fetch the latest upstream `main`. If an existing PR branch needs updates, prefer GitHub's update-branch action or merge `upstream/main` into that feature branch after checking the working tree. Never reset or force-push another contributor's branch.

## Copy/paste prompt for the other Codex agent

```text
You are contributing to Crossline, a browser-based multiplayer urban crowd simulation game. Work only in the assigned lane below. The canonical repository is https://github.com/aryan-astra/Crossline-multiplayer and the integration branch is main. Start from the latest upstream/main; submit your changes as a focused PR from your own feature branch/fork. Do not push to main, merge your own PR, rewrite shared history, or edit files owned by the other work lane without agreement.

Before coding, inspect README.md and docs/SOURCE_AUDIT.md, docs/ARCHITECTURE.md, docs/PLAYABILITY_PLAN.md, docs/ROADMAP.md, docs/ART_DIRECTION.md, docs/VALIDATION.md, plus the assigned source files and tests. Treat code and executed validation as evidence; do not assume README claims are working features. Do not overwrite the source audit or mark unfinished items complete without evidence.

Game rules and constraints: simulation outcomes, movement, identity, economy, detention, and match state remain server-authoritative. Keep simulation independent of React/rendering. Peaceful crowds march between objectives and respond to orders; bots do not capture the Constitution. Only a human player can capture it. Police hold inner and outer defense areas; escalation and barrier pressure must remain explainable and testable. Keep crowds distributed, movement bounded by the map, input responsive, and CPU work measured. Preserve the shared-world architecture; do not label independent local simulations as multiplayer. Avoid real-money gambling, paid LLM APIs, unnecessary dependencies, and unlicensed assets. Local/browser checks do not prove public scale or physical-phone quality.

ASSIGNED LANE: [replace with one lane and the exact task before sending]
SCOPE / FILE OWNERSHIP: [list allowed files; do not edit other lane's files]
ACCEPTANCE CRITERIA: [write 2-5 observable, testable outcomes]

First report a brief plan and any dependency/API contract needed. Then implement the smallest complete vertical slice, add/update focused tests, and run relevant checks. Keep commits focused and descriptive. Before submitting, inspect `git diff`, verify no secrets/build outputs/local databases are included, and ensure the branch is based on current upstream/main. Open a PR targeting the canonical repository's main branch. In your handoff, summarize files changed, behavior, exact commands/results, screenshots for visual work, and remaining risks. Do not claim checks or gameplay that you did not actually verify.
```

## Definition of done for collaboration

- The feature has one named owner, bounded file scope, and acceptance criteria before implementation.
- A focused PR is based on current `main`, with its full diff reviewed and required checks recorded.
- Any remaining platform, performance, licensing, or deployment limits are documented plainly.
- The repository owner merges only after review; the other contributor starts their next task from the updated `main`.
