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
> - **`jose`** for JWT creation and verification (guest-first auth; no sign-up wall)
>
> ### Auth strategy
> Guest-first with JWT sessions. On first visit the server auto-creates a guest identity and issues a signed JWT. The client stores it in `localStorage` and sends it as a `Bearer` token on HTTP requests and as a query param during WS upgrade. The server validates the JWT and binds session → player → seat. Social/OAuth login is deferred (add `arctic` when needed).
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

> **Process:** TDD throughout. After Phase 0 (scaffold), every implementation item is preceded by a `tests:` item written first, watched fail, then made green. Phases are ordered so each layer can be tested in isolation before the next layer is built on top.

### Phase 0 — Scaffold & tooling (no game logic yet)

- [ ] Initialize Bun workspace at root with `apps/client`, `apps/server`, `packages/shared`, plus `bunfig.toml`, root `package.json`, root `.oxlintrc.json`
- [ ] Root `tsconfig.json` with project references for all three workspaces; `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] Wire root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`
- [ ] Set up Vitest in workspace mode so `apps/client`, `apps/server`, `packages/shared` share runner config; verify empty suites run green in each
- [ ] Set up Playwright at the root pointing at the client preview server; one trivial spec must pass
- [ ] Stub `scripts/deploy.sh` (single script that will later build + ship both server and client) so the deploy path exists from day one
- [ ] Cold-start gate: `bun install && bun run typecheck && bun run lint && bun run test` all pass on the empty scaffold

### Phase 1 — Shared domain primitives (TDD)

- [ ] Define type contracts in `packages/shared`: `Player`, `PlayerColor`, seat-state union (`active` | `vacant` | `empty`), `GameState`, `GameStatus`, `Token`, `Cell`, and `ClientMessage` / `ServerMessage` discriminated unions keyed by `type`
- [ ] Encode locked constants and defaults: `S ∈ 4..8`, `K=13`, `L=4`, `M=4`; palette of 8 colors; rule flags (`extraTurnOnSix`, `captureSendsHome`, `mustRollSixToStart`); timings (turn 30s, kick at 3 misses, post-game 60s, idle 15min, retention 24h)
- [ ] tests → impl: cell-ID parse/serialize for `Y/<seat>/<slot>`, `T/<index>`, `H/<seat>/<i>` with 1-indexed bounds and rejection of malformed IDs
- [ ] tests → impl: per-seat `start = T/((si−1)×K+1)` and `entry = T/((si−1)×K)` with seat-1 wrap to `T/(S×K)` for every `S ∈ 4..8`
- [ ] tests → impl: clockwise track stepping with wraparound; transition from entry square into `H/<si>/1`
- [ ] tests → impl: safe-square detection (exactly the `S` start squares) and home-column overshoot rejection (no bounce-back)
- [ ] tests → impl: deterministic palette draw — `S` unique colors from the 8-color palette under an injected RNG

### Phase 2 — Server-authoritative game engine (TDD)

- [ ] Wrap a seedable CSPRNG so every engine test is reproducible from a seed; expose only the seam, not the raw generator
- [ ] tests → impl: tiebreaker first-roll (highest wins; ties re-roll; only active seats roll; empty/vacant skipped)
- [ ] tests → impl: roll resolution — `drv ∈ 1..6`, extra turn on 6 granted **regardless of whether a legal move existed**, three-consecutive-six forfeit ends the turn
- [ ] tests → impl: legal-move generation — deploy requires 6, no overshoot, opponent cannot land on or pass through a same-color block
- [ ] tests → impl: movement reducer — deploy from yard, track step with wraparound, capture (single opponent token only; never on safe; never own color)
- [ ] tests → impl: same-color blocks (≥2 tokens form a block, opponents cannot land/pass/capture, voluntary break)
- [ ] tests → impl: home-column entry, capacity-1 occupancy, no captures inside, exact-roll required to land
- [ ] tests → impl: terminal conditions — 4 home squares occupied = win, sole-survivor instant win, zero-active-seats abort
- [ ] tests → impl: full standings (placements 1..#initially-active; game continues after each finish until standings filled)
- [ ] tests → impl: missed-turn handling — auto-roll, deterministic auto-pick (lowest-numbered legal token starting at `Y/<seat>/1`), kick after 3 consecutive misses (tokens wiped, seat → `vacant`, player → spectator); counter resets when the player acts on their own
- [ ] tests → impl: append-only move log + state reconstruction — replaying the log from any seed reproduces the exact canonical snapshot

### Phase 3 — Transport, room services, persistence (TDD)

- [ ] tests → impl: room lifecycle — link-only create, owner authority, join until cap `S`, ready gating, owner-only start, rematch with re-drawn colors and currently-seated players auto-seated, 60s post-game window, 15min pre-game idle expiry
- [ ] tests → impl: WebSocket protocol routing — validate every incoming `ClientMessage`, reject malformed, dispatch to room/engine, broadcast `ServerMessage` to all subscribers and spectators
- [ ] tests → impl: reconnect — passive resync via move-log replay; reconnect alone never resets the missed-turn counter
- [ ] tests → impl: guest auth — `jose` JWT issue on first visit, verify on subsequent requests; token refresh; reject expired/tampered tokens
- [ ] Boot `Bun.serve()` with HTTP + WS upgrade, connection registry, JWT verification on upgrade, session→seat binding
- [ ] tests → impl: Drizzle repositories on in-memory SQLite for rooms, players, games, and the move log; 24h retention policy on completed games
- [ ] HTTP endpoints: health, guest-auth (issue/refresh token), room create, game-history fetch (read-only)

### Phase 4 — Client shell & Duna design system

- [ ] Boot Vite 8 + Vue 3 (`<script setup>`) + Vue Router 4 + Pinia + `@tanstack/vue-query` in `apps/client`; `@` → `src/`
- [ ] Tailwind v4 CSS-first `@theme` block populated from `design.md` (palette, type scale, spacing, radii, surfaces, subtle inset shadow) — no `tailwind.config.js`
- [ ] Build shared UI primitives per `design.md`: Primary Filled Button, Ghost Button, Simple Card, Elevated Card, Text Input, Announcement Pill
- [ ] Routes: home, room (lobby), match, post-game; session store; TanStack Query client confined to non-realtime flows (room creation, history, profile)
- [ ] WS client wrapper with auto-reconnect; on resync the client replaces local state from the server snapshot — never reconciles locally

### Phase 5 — Match UI (parametric board)

- [ ] Render parametric board for any `S ∈ 4..8` — cross shape for `S=4`, star for `S≥5` — arms evenly spaced clockwise (`360°/S`)
- [ ] Apply client-side rotation so the **local** seat appears at bottom-left (chess-style); underlying coordinates are unchanged
- [ ] Draw yards (`M=4` slots), track (`1..S×K`), home columns (`L=4`); render safe markers, blocks, and per-seat colors from server state
- [ ] Roll CTA gated on `activeSeat == me`; render legal moves; forced-pick and auto-pass flows handled
- [ ] Animate deploy, track movement, capture, and home entry **only** from server events — no client-side simulation
- [ ] Render server-authoritative turn timer (deadline broadcast), missed-turn warnings, reconnect banner, spectator mode
- [ ] Post-game standings + rematch CTA (owner-only) within the 60s window

### Phase 6 — End-to-end coverage & deployment

- [ ] Playwright: create room → share link → second client joins → owner starts → first roll
- [ ] Playwright: full turn — roll, pick, capture, extra-turn-on-six, three-consecutive-six forfeit
- [ ] Playwright: timeout auto-roll + kick after 3 missed turns + spectator downgrade
- [ ] Playwright: reconnect mid-game restores the authoritative state from the move log
- [ ] Playwright: rematch re-draws colors and re-seats currently-connected players
- [ ] Finalize `scripts/deploy.sh`: build server (Bun bundle), build client (`vite build`), upload both artifacts to the target host over SSH, run DB migrations, restart service — runnable as a single `./scripts/deploy.sh`
- [ ] Smoke-run `deploy.sh` against a staging host

### Deferred (kept behind explicit config / rule boundaries — never hard-coded)

- Owner succession when the owner disconnects or quits (§7 `[OPEN]`)
- Bot AI heuristics beyond the deterministic timeout auto-pick (§13)
- Room-config variant matrix (§14)
- 2D coordinate generation refinement for `S ≥ 5` rendering (§10.10)
