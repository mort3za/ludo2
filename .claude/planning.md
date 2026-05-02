## 🧩 Prompt #1 — Recommended Project Stack And Scaffold

> You are setting up a **single Git repository monorepo** for a real-time multiplayer Ludo game. The frontend and backend should live in the same repo, but as separate apps with a shared package for contracts and constants.
>
> ### Architecture Decision
> Use a **Bun workspace monorepo** in one repository with this top-level structure:
>
> ```text
> .
> ├── apps/
> │   ├── client/
> │   └── server/
> ├── packages/
> │   └── shared/
> ├── scripts/
> ├── package.json
> ├── bunfig.toml
> ├── tsconfig.json
> └── .oxlintrc.json
> ```
>
> This is intentionally a **single repo**. It gives us:
> - one dependency graph
> - shared TypeScript contracts without publishing a package
> - simpler local development
> - easier coordinated changes across UI, networking, and rules
>
> ### Game Engine Decision
> Do **not** add a rendering-focused game engine such as Phaser or Pixi for this project.
>
> Instead, implement a **server-authoritative game rules engine** inside `apps/server/src/game/`.
>
> That server-side engine is responsible for:
> - turn order
> - dice rolls
> - legal move validation
> - piece movement
> - captures
> - extra-turn rules
> - win conditions
> - reconnect-safe state reconstruction
> - anti-cheat validation
>
> The client should only handle:
> - board rendering
> - piece animation
> - UI state
> - player input
> - displaying synchronized state from the server
>
> ### `apps/client` setup
> Build the client as a Vue application with the following stack:
> - **Vite 8**
> - **Vue 3** with `<script setup>` and TypeScript
> - **Vue Router 4**
> - **Pinia** for client-side UI and session state
> - **Tailwind CSS v4** using the CSS-first setup, with no `tailwind.config.js`
> - **OXC** via `oxlint`
> - **Vitest** as the test runner
> - **Playwright** for end-to-end browser testing
> - **TanStack Query** (`@tanstack/vue-query`) only for non-realtime HTTP flows such as auth, profile, lobby discovery, match history, and settings
> - path alias `@` → `src/`
>
> Client folder structure:
> ```text
> apps/client/
> ├── src/
> │   ├── app/
> │   ├── pages/
> │   ├── widgets/
> │   ├── features/
> │   │   ├── lobby/
> │   │   ├── match/
> │   │   ├── auth/
> │   │   └── profile/
> │   ├── entities/
> │   │   ├── player/
> │   │   ├── room/
> │   │   └── game/
> │   ├── shared/
> │   │   ├── api/
> │   │   ├── lib/
> │   │   ├── ui/
> │   │   └── config/
> │   ├── stores/
> │   ├── router/
> │   ├── styles/
> │   └── main.ts
> ├── index.html
> ├── package.json
> ├── tsconfig.json
> └── vite.config.ts
> ```
>
> ### `apps/server` setup
> Build the backend using Bun with native WebSocket support.
>
> Required stack:
> - **Bun** runtime
> - `Bun.serve()` with WebSocket upgrade handling
> - TypeScript strict mode
> - entry point `src/index.ts`
> - **Drizzle ORM** for persistence
> - **SQLite** for initial development and local deployment
>
> Important: database code belongs only to the server app. Do not place Drizzle or SQLite in the client app.
>
> Server folder structure:
> ```text
> apps/server/
> ├── src/
> │   ├── index.ts
> │   ├── config/
> │   ├── http/
> │   ├── ws/
> │   │   ├── server.ts
> │   │   ├── connections.ts
> │   │   ├── router.ts
> │   │   └── messages/
> │   ├── rooms/
> │   │   ├── room-manager.ts
> │   │   ├── room.ts
> │   │   └── presence.ts
> │   ├── game/
> │   │   ├── engine.ts
> │   │   ├── reducer.ts
> │   │   ├── rules/
> │   │   ├── actions/
> │   │   ├── validators/
> │   │   ├── rng/
> │   │   └── snapshots/
> │   ├── auth/
> │   ├── db/
> │   │   ├── client.ts
> │   │   ├── schema/
> │   │   ├── migrations/
> │   │   └── repositories/
> │   └── lib/
> ├── package.json
> └── tsconfig.json
> ```
>
> ### `packages/shared` setup
> Create a pure TypeScript shared package with no framework dependencies.
>
> This package should contain only shared contracts and deterministic helpers that are safe for both client and server.
> Use **Vitest** for unit tests in shared deterministic logic.
>
> Export the following as initial stubs:
> - `types/player.ts` — `Player`, `PlayerColor`
> - `types/game.ts` — `GameState`, `GameStatus`, `Piece`, `Cell`
> - `types/ws.ts` — `ClientMessage`, `ServerMessage` as discriminated unions by `type`
> - `constants/board.ts` — board size, safe cells, entry cells, home stretch indices per color
> - `constants/rules.ts` — rule flags such as `extraTurnOnSix`, `captureSendsHome`, `mustRollSixToStart`
>
> Optional shared helpers are allowed only if they stay deterministic and transport-agnostic.
>
> Shared package structure:
> ```text
> packages/shared/
> ├── src/
> │   ├── types/
> │   ├── constants/
> │   ├── protocol/
> │   └── index.ts
> ├── package.json
> └── tsconfig.json
> ```
>
> ### Root workspace requirements
> Generate the root workspace with:
> - root `package.json` with workspace scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`
> - root `tsconfig.json` with project references for each workspace package
> - root `.oxlintrc.json`
> - root `bunfig.toml`
> - root Vitest setup suitable for running tests in `apps/client`, `apps/server`, and `packages/shared`
> - root Playwright setup for browser end-to-end flows against the client app
> - strict TypeScript across all packages with `strict: true` and `noUncheckedIndexedAccess: true`
> - use Vitest for unit and integration-style tests around pure game rules, protocol handling, and client logic
> - use Playwright for end-to-end flows such as login, lobby creation, room join, match start, reconnect, and turn progression UI
>
> ### Output requirements
> Generate every config file and folder with real content.
> Use placeholders only where explicitly marked as future work.
> Keep the codebase ready for the next prompt, which will implement the server-authoritative Ludo rules engine.

---

## Todo

- [ ] Scaffold the Bun workspace monorepo with `apps/client`, `apps/server`, `packages/shared`, and root config files.
- [ ] Configure strict TypeScript project references, shared scripts, `oxlint`, Vitest, and Playwright at the workspace root.
- [ ] Create the shared package exports for board constants, rule constants, player/game/websocket types, and deterministic helpers.
- [ ] Encode the documented board model in shared code: `S=4..8`, `K=13`, `L=4`, `M=4`, slash-delimited cell IDs, start squares, entry squares, and home-column metadata.
- [ ] Implement the server bootstrap with `Bun.serve()`, HTTP entrypoints, WebSocket upgrade flow, connection registry, and message routing.
- [ ] Build room and presence management for owner-controlled lobby creation, link-based joins, ready state, bots, spectators, rematch, and room closure.
- [ ] Implement the server-authoritative rules engine for roll resolution, legal move generation, movement, captures, safe squares, blocks, home-column movement, extra turns, and placement tracking.
- [ ] Add move logging and snapshot/rebuild support so game state is reconstructible from the log for replay and reconnect.
- [ ] Add SQLite + Drizzle on the server for rooms, players, game history, and retained move logs.
- [ ] Build the Vue client shell with router, Pinia, Tailwind v4, Duna design tokens, and app pages for lobby, room, and match views.
- [ ] Implement the real-time match UI: board rendering, seat rotation, token animation, turn timer, roll/move controls, reconnect resync, and spectator mode.
- [ ] Add automated coverage for deterministic rules, protocol contracts, room flow, reconnect behavior, and end-to-end lobby-to-match scenarios.

## Step-by-Step Implementation Plan

### 1. Scaffold the monorepo foundation

Create the Bun workspace structure exactly as specified in this prompt. Add the root `package.json`, `bunfig.toml`, `tsconfig.json`, and `.oxlintrc.json`, then create package manifests and local `tsconfig.json` files for `apps/client`, `apps/server`, and `packages/shared`.

### 2. Lock shared domain primitives first

Before building transport or UI, define the shared types and constants from the gameplay docs so both apps depend on one canonical model.

Required outputs:
- `Player`, `PlayerColor`, seat state, room config, and ownership concepts.
- `GameState`, `GameStatus`, token/cell types, and discriminated WebSocket message unions.
- Board constants for seat count bounds, `K=13`, `L=4`, `M=4`, start squares, entry squares, and safe-square detection.
- Rule constants for deploy-on-6, extra-turn-on-6, three-consecutive-sixes forfeit, exact-roll home logic, capture behavior, and timeout defaults.

### 3. Implement deterministic board/rules helpers in `packages/shared`

Add pure helpers for pathing and legality checks that can be unit-tested independently of sockets or persistence.

Sequence:
1. Parse and validate cell IDs.
2. Resolve per-seat start and entry squares for any `S` in `4..8`.
3. Compute clockwise track stepping with wraparound.
4. Model home-column entry and exact-roll validation.
5. Encode safe-square and block-related legality helpers.

### 4. Stand up the backend shell

Create the Bun server entrypoint and wire HTTP plus WebSocket transport. Keep this layer thin: it should accept connections, authenticate sessions later, and hand commands to room/game services.

Sequence:
1. `src/index.ts` boots config and server.
2. `ws/server.ts` handles upgrades and broadcasts.
3. `ws/connections.ts` tracks connected clients and seat bindings.
4. `ws/router.ts` dispatches validated client messages.
5. `http/` exposes health and future room/history endpoints.

### 5. Build lobby, room, and presence services

Implement the pre-game lifecycle described in the docs before match logic is exposed in the client.

Scope:
- Owner-created rooms with unique shareable links.
- Configurable seat cap `S`, bot allocation, and room rules.
- Join, leave, ready, spectator, owner-only start, and post-game rematch flow.
- Seat states: active, vacant, and empty.
- Idle-room expiry before game start and close behavior after the post-game window.

### 6. Implement the server-authoritative game engine

This is the core slice and should remain fully deterministic. The engine should consume game state plus a command and produce the next state plus emitted events.

Implementation order:
1. Turn state, active-seat rotation, and initial tiebreaker roll.
2. Die rolling with server-side RNG and consecutive-six tracking.
3. Legal move generation for all four tokens.
4. Deploy, track movement, and wraparound.
5. Captures and safe-square exceptions.
6. Same-color stacking and opponent block traversal restrictions.
7. Home-column entry, occupancy limits, and overshoot rejection.
8. Extra-turn resolution, pass turns, and automatic next-player selection.
9. Finish detection, standings, sole-survivor win, and zero-active-seat abort.

### 7. Add timeout, AFK, and reconnect behavior

Layer the multiplayer timing rules on top of the engine after base legality works.

Scope:
- 30-second authoritative turn timer.
- Auto-roll and deterministic auto-pick on timeout.
- Consecutive missed-turn tracking.
- Temporary bot-controlled turns during the grace window.
- Kick after 3 consecutive misses, token removal, and spectator downgrade.
- Full state resync from move log on reconnect.

### 8. Persist rooms and completed games on the server

After the in-memory flow works, add Drizzle + SQLite for local persistence.

Persist at minimum:
- Room metadata and configuration.
- Player/session to seat mappings.
- Game headers and current lifecycle status.
- Append-only move log sufficient to rebuild state.
- Final standings and retained replay metadata.

### 9. Build the client shell and information architecture

Create the Vue app structure around routing and reusable UI primitives before drawing the full board.

Scope:
- App boot, router, query client, and Pinia stores.
- Pages for home/lobby, room, match, and post-game results.
- Shared UI primitives styled with the Duna tokens from `design.md`.
- Tailwind v4 CSS-first theme variables matching the documented palette, typography, spacing, surfaces, and shape system.

### 10. Implement the match UI

Only after the server protocol is stable should the interactive board be added.

Sequence:
1. Render the parametric board using the shared board metadata.
2. Rotate the board so the local player's seat appears at bottom-left.
3. Render yards, track cells, home columns, tokens, and safe/block states.
4. Add roll CTA, legal-move highlighting, and forced-move/autopass handling.
5. Animate movement and captures from authoritative server events.
6. Show turn timer, reconnect state, missed-turn warnings, and spectator mode.

### 11. Cover the critical paths with tests

Testing should follow the implementation order rather than wait until the end.

Minimum coverage targets:
1. Shared helper tests for cell parsing, stepping, entry, overshoot, and safe-square logic.
2. Engine tests for deploy, capture, blocks, extra turns, consecutive sixes, home-column rules, and win conditions.
3. Room service tests for join/ready/start/rematch and owner-only permissions.
4. WebSocket protocol tests for message validation and reconnect resync.
5. Playwright flows for create room, join room, start game, take turns, timeout autopick, reconnect, and post-game rematch.

### 12. Leave deferred decisions isolated

The docs still mark some items as open or deferred. Keep them behind explicit rule/config boundaries rather than hard-coding assumptions into the engine.

Current deferred surfaces:
- Owner succession when the owner disconnects or quits.
- Bot heuristic policy beyond the deterministic timeout placeholder.
- Full room-config variants in the future `§14` pass.
- Detailed 2D board coordinate generation for `S >= 5` rendering refinement.
