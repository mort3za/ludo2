## 🧩 Prompt #1 — Recommended Project Stack And Scaffold

> You are setting up a **single Git repository monorepo** for a real-time multiplayer Ludo game. The frontend and backend should live in the same repo, but as separate apps with a shared package for contracts and constants.
>
> ### Architecture Decision
>
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
>
> - one dependency graph
> - shared TypeScript contracts without publishing a package
> - simpler local development
> - easier coordinated changes across UI, networking, and rules
>
> ### Game Engine Decision
>
> Do **not** add a rendering-focused game engine such as Phaser or Pixi for this project.
>
> Instead, implement a **server-authoritative game rules engine** inside `apps/server/src/game/`.
>
> That server-side engine is responsible for:
>
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
>
> - board rendering
> - piece animation
> - UI state
> - player input
> - displaying synchronized state from the server
>
> ### `apps/client` setup
>
> Build the client as a Vue application with the following stack:
>
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
>
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
>
> Build the backend using Bun with native WebSocket support.
>
> Required stack:
>
> - **Bun** runtime
> - `Bun.serve()` with WebSocket upgrade handling
> - TypeScript strict mode
> - entry point `src/index.ts`
> - **Drizzle ORM** for persistence
> - **SQLite** for initial development and local deployment
> - **`jose`** for JWT creation and verification (guest-first auth; no sign-up wall)
>
> ### Auth strategy
>
> Guest-first with JWT sessions. On first visit the server auto-creates a guest identity and issues a signed JWT. The client stores it in `localStorage` and sends it as a `Bearer` token on HTTP requests and as a query param during WS upgrade. The server validates the JWT and binds session → player → seat. Social/OAuth login is deferred (add `arctic` when needed).
>
> Important: database code belongs only to the server app. Do not place Drizzle or SQLite in the client app.
>
> Server folder structure:
>
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
>
> Create a pure TypeScript shared package with no framework dependencies.
>
> This package should contain only shared contracts and deterministic helpers that are safe for both client and server.
> Use **Vitest** for unit tests in shared deterministic logic.
>
> Export the following as initial stubs:
>
> - `types/player.ts` — `Player`, `PlayerColor`
> - `types/game.ts` — `GameState`, `GameStatus`, `Piece`, `Cell`
> - `types/ws.ts` — `ClientMessage`, `ServerMessage` as discriminated unions by `type`
> - `constants/board.ts` — board size, safe cells, entry cells, home stretch indices per color
> - `constants/rules.ts` — rule flags such as `extraTurnOnSix`, `captureSendsHome`, `mustRollSixToStart`
>
> Optional shared helpers are allowed only if they stay deterministic and transport-agnostic.
>
> Shared package structure:
>
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
>
> Generate the root workspace with:
>
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
>
> Generate every config file and folder with real content.
> Use placeholders only where explicitly marked as future work.
> Keep the codebase ready for the next prompt, which will implement the server-authoritative Ludo rules engine.

---

## Process

TDD throughout. After Phase 0 (scaffold), every implementation item is preceded by a `tests:` item written first, watched fail, then made green. Phases are ordered so each layer can be tested in isolation before the next layer is built on top.

Per-phase implementation tasks are tracked in Linear: [Ludo 2 — Real-time Multiplayer](https://linear.app/morteza67/project/ludo-2-real-time-multiplayer-b73cedf52453).

### Deferred (kept behind explicit config / rule boundaries — never hard-coded)

- Owner succession when the owner disconnects or quits (§7 `[OPEN]`)
- Bot AI heuristics beyond the deterministic timeout auto-pick (§13)
- Room-config variant matrix (§14)
- 2D coordinate generation refinement for `S ≥ 5` rendering (§10.10)
