## 🧩 Prompt #1 — Project Scaffold

> You are setting up a **monorepo** for a real-time multiplayer Ludo game. Generate the full project scaffold with the following spec:
>
> ### Monorepo Structure
> Use a **Bun workspace** monorepo with two packages:
> - `apps/client` — Vue 3 frontend
> - `apps/server` — Bun WebSocket backend
> - `packages/shared` — shared TypeScript types and game constants (board layout, rule config, WebSocket message contracts)
>
> ### `apps/client` setup
> - **Vite 8** as the build tool
> - **Vue 3** with `<script setup>` and TypeScript
> - **OXC** as the linter (via `oxlint`)
> - **Pinia** for state management
> - **Tailwind CSS v4** (using the new CSS-first config, no `tailwind.config.js`)
> - **TanStack Query** (`@tanstack/vue-query`) for REST API calls
> - **Vue Router 4** for page routing
> - Path alias: `@` → `src/`
>
> ### `apps/server` setup
> - **Bun** runtime with native `Bun.serve()` WebSocket support
> - TypeScript strict mode
> - Entry point: `src/index.ts`
> - Folder structure:
>   - `src/ws/` — WebSocket handler and message router
>   - `src/rooms/` — room and session management
>   - `src/game/` — game engine (to be filled in later prompts)
>   - `src/auth/` — OAuth handling (to be filled in later prompts)
>   - `src/db/` — database access (to be filled in later prompts)
>
> ### `packages/shared` setup
> - Pure TypeScript, no framework dependencies
> - Export the following (as empty stubs for now):
>   - `types/player.ts` — `Player`, `PlayerColor`
>   - `types/game.ts` — `GameState`, `GameStatus`, `Piece`, `Cell`
>   - `types/ws.ts` — `ClientMessage`, `ServerMessage` (discriminated unions by `type` field)
>   - `constants/board.ts` — board size, safe cell indices, home stretch indices per color
>   - `constants/rules.ts` — rule flags: `extraTurnOnSix`, `capturesendsHome`, `mustRollSixToStart`
>
> ### Additional requirements
> - Root `package.json` with workspace scripts: `dev`, `build`, `lint`, `typecheck`
> - `tsconfig.json` at root with path references to each package
> - `.oxlintrc.json` at root
> - Strict TypeScript across all packages (`strict: true`, `noUncheckedIndexedAccess: true`)
> - No test setup needed at this stage
>
> **Output:** generate every config file and folder structure with real content. No placeholders except where explicitly marked "to be filled in later prompts".
