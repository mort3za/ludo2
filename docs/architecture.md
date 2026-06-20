# Architecture

Distilled decisions behind the scaffold. For in-flight work see
[../.claude/planning.md](../.claude/planning.md); per-phase tasks live in Linear.

## Repository — Bun workspace monorepo

Single repo, separate apps, one shared contracts package:

```text
.
├── apps/
│   ├── client/   # Vue SPA
│   └── server/   # Bun WebSocket + rules engine
├── packages/
│   └── shared/   # framework-free contracts & deterministic helpers
├── scripts/
└── (root config: package.json, bunfig.toml, tsconfig.json, .oxlintrc.json)
```

Rationale: one dependency graph, shared TypeScript contracts without publishing,
simpler local dev, easier coordinated changes across UI / networking / rules.

Strict TypeScript everywhere (`strict: true`, `noUncheckedIndexedAccess: true`);
root `tsconfig.json` uses project references per package.

## Game engine — server-authoritative

No rendering engine (Phaser/Pixi). The rules engine lives in
`apps/server/src/game/` and owns: turn order, dice rolls, legal-move validation,
piece movement, captures, extra-turn rules, win conditions, reconnect-safe state
reconstruction, anti-cheat validation.

The client only renders board + pieces, animates, holds UI state, takes input, and
displays server-synchronized state. It never decides game outcomes.

## Client stack (`apps/client`)

Vite 8 · Vue 3 (`<script setup>` + TS) · Vue Router 4 · Pinia (UI/session state) ·
Tailwind CSS v4 (CSS-first, **no** `tailwind.config.js`) · oxlint (OXC) · Vitest ·
Playwright (e2e) · TanStack Query (`@tanstack/vue-query`) for non-realtime HTTP only
(auth, profile, lobby discovery, match history, settings). Path alias `@` → `src/`.

Folder structure follows feature-sliced layering: `app/ pages/ widgets/ features/
entities/ shared/ stores/ router/ styles/`.

## Server stack (`apps/server`)

Bun runtime · `Bun.serve()` with WebSocket upgrade handling · TypeScript strict ·
entry `src/index.ts` · Drizzle ORM · SQLite (local/dev) · `jose` for JWT.

Database code lives **only** in the server app — never in the client.

## Auth — guest-first JWT

On first visit the server auto-creates a guest identity and issues a signed JWT
(no sign-up wall). The client stores it in `localStorage` and sends it as a `Bearer`
token on HTTP and as a query param on WS upgrade. The server validates the JWT and
binds session → player → seat. Social/OAuth is deferred (add `arctic` when needed).

## Shared package (`packages/shared`)

Pure TypeScript, no framework deps — only contracts and deterministic, transport-
agnostic helpers safe for both client and server. Vitest for unit tests.

- `types/player.ts` — `Player`, `PlayerColor`
- `types/game.ts` — `GameState`, `GameStatus`, `Piece`, `Cell`
- `types/ws.ts` — `ClientMessage` / `ServerMessage` (discriminated unions by `type`)
- `constants/board.ts` — board size, safe/entry cells, per-color home-stretch indices
- `constants/rules.ts` — rule flags (`extraTurnOnSix`, `captureSendsHome`, `mustRollSixToStart`)

## Testing

TDD throughout. Vitest for pure game rules, protocol handling, and client logic;
Playwright for e2e flows (login, lobby creation, room join, match start, reconnect,
turn progression).
