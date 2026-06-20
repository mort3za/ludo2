# Implementation Plan — Mock State, AI Personalities, Remaining Backlog

Goal (from `/goal`): finish the remaining open tickets; add + implement an AI-personalities
feature; do the reusable mock-state task **first** so it can back the personality tests.
Commit after each task once tested & verified.

Decisions confirmed with user:

- Factory lives in `apps/server/src/test/`.
- Three personalities: **Aggressor / Defender / Sprinter**.
- Scope this run: everything except the explicitly-deferred MOR-61 (tiebreaker).

---

## Task 1 — Finalize reusable game-state mock (FIRST)

### Problem

Three test files each define their own private `makeState` helper with drifting signatures:

- `apps/server/src/rooms/game-session.test.ts` — `(overrides: Partial<GameState>) => GameState`
- `apps/server/src/game/ai/driver.test.ts` — `(overrides) => GameState` + a `makeSession` wrapper
- `apps/server/src/game/ai/picker.test.ts` — `(tokens, activeSeat, diceValue) => GameState`

No single builder exists for injecting an arbitrary scenario.

### Deliverable

`apps/server/src/test/make-state.ts` — a single, fully-parameterized builder:

```ts
import type { GameState, Seat, Token, PlayerColor } from "@ludo/shared";

// Token shorthand: tok("b1", "blue", "T/5")
export function tok(id: string, color: PlayerColor, cell: string): Token;

// Seat shorthand with sensible defaults (active, human).
export function seat(index: number, color: PlayerColor, over?: Partial<Seat>): Seat;

// Default = 2-seat (blue seat1, red seat2), status "rolling", empty tokens.
// Every GameState field overridable. Seats overridable wholesale.
export function makeState(overrides?: Partial<GameState>): GameState;
```

Defaults must match what the current helpers produce so migration is behavior-preserving:

- seats: `[seat(1,"blue"), seat(2,"red")]` both `state:"active"`, `isBot:false`
- `gameId:"test"`, `status:"rolling"`, `activeSeat:1`, `diceValue:null`,
  `consecutiveSixes:0`, `standings:[]`, `tokens:[]`

### Migration

- `picker.test.ts`: its `makeState(tokens, activeSeat, diceValue)` becomes a thin local wrapper
  over the shared builder **or** call sites switch to `makeState({ tokens, activeSeat, diceValue, status:"moving" })`.
  Keep its local `t`/`move` or replace `t` with `tok`. Preserve `status:"moving"` default it used.
- `driver.test.ts`: replace local `makeState`; keep `makeSession` (driver-specific: rng/colorToSeat/etc.).
- `game-session.test.ts`: replace local `makeState`; keep `finishedToken` (domain-specific helper).

### Verify

`bun run test` (server scope) green with zero behavioral changes. No new lint errors.

### Commit

`test: add reusable game-state factory and migrate suites` (via /commit-general).

---

## Task 2 — Three AI personalities, randomly assigned to bots

### Design

Personality = a **scoring weight profile** consumed by `pickMove`. Keep scoring deterministic
given a personality (randomness only in _assignment_), so tests stay deterministic.

#### 2a. Shared contract (`packages/shared`)

New `packages/shared/src/types/ai.ts` (re-exported from `index.ts`):

```ts
export type BotPersonality = "aggressor" | "defender" | "sprinter";
export const BOT_PERSONALITIES: readonly BotPersonality[] = ["aggressor", "defender", "sprinter"];
export const PERSONALITY_TITLES: Record<BotPersonality, string> = {
  aggressor: "Aggressor",
  defender: "Defender",
  sprinter: "Sprinter",
};
```

Add `personality?: BotPersonality` to `Seat` (`packages/shared/src/types/game.ts`) — optional so
existing states/tests without it remain valid; treated as the default profile when absent.

#### 2b. Picker refactor (`apps/server/src/game/ai/picker.ts`)

Decompose `score()` into additive weighted components, each normalized so weights compare sanely:

- `captureValue` — destination captures a lone opponent
- `deployValue` — move leaves the yard (deploy on 6)
- `escapeValue` — `from` cell is in danger (opponent 1–6 behind) and move escapes it
- `progressValue` — `tokenProgress(to)` advancement toward home

```ts
interface Weights {
  capture: number;
  deploy: number;
  escape: number;
  progress: number;
}
const PROFILES: Record<BotPersonality, Weights> = {
  // Aggressor: captures dominate; low regard for self-safety.
  aggressor: { capture: 1000, deploy: 300, escape: 150, progress: 1 },
  // Defender: escaping danger dominates; captures still good; cautious advance.
  defender: { capture: 500, deploy: 250, escape: 900, progress: 1 },
  // Sprinter: max advancement + eager deploy; captures only incidental.
  sprinter: { capture: 400, deploy: 800, escape: 200, progress: 5 },
};
const DEFAULT: BotPersonality = "aggressor"; // == legacy behavior baseline
```

`pickMove(legalMoves, state, mySeat, personality?)` — new optional 4th arg. When omitted, use the
active seat's `personality` from state, else `DEFAULT`. Existing call (driver) will pass it
explicitly. **Back-compat**: with `personality` omitted and DEFAULT = aggressor weights chosen so
the 1000/500/300 ordering matches today's priority (capture > deploy > escape > progress) — the
existing picker.test.ts cases must still pass unchanged.

> Verification note: confirm aggressor weights reproduce every existing picker.test assertion
> (capture>deploy, capture>advance, deploy>advance, advance-furthest, home>track). Tune if needed.

#### 2c. Assignment at bot creation (`apps/server/src/rooms/room.ts`)

`addBotMember(room, pickPersonality?)` — inject a `() => BotPersonality` selector (default uses
`crypto`-based pick) so tests are deterministic. Store on the member:

```ts
export interface RoomMember { ...; kind: "human" | "bot"; personality?: BotPersonality; }
```

Random selection: uniform over `BOT_PERSONALITIES`. No manual selection anywhere; field is carried
so a title can surface in the UI later (`PERSONALITY_TITLES`).

#### 2d. Propagate to seat (`apps/server/src/rooms/init-game.ts`)

When building a seat for a bot member, set `personality: member.personality`.

#### 2e. Driver passes it (`apps/server/src/game/ai/driver.ts`)

`pickMove(moves, session.state, session.state.activeSeat, activeSeat.personality)`.

#### 2f. Wiring check

`ws/router.ts` rooms/lobby broadcast — confirm whether `RoomMember.personality` needs to surface
in `LobbyPlayer`. Per requirement it's bot-internal for now → **do not** expose in lobby payload
unless a test demands it. Grep callers of `addBotMember` (router + tests) and update signatures.

### Tests (use the Task-1 factory)

- `picker.test.ts` (extend): one crafted state where capture / escape / progress moves are all
  available and the three personalities each pick a **different** tokenId
  (aggressor→capture, defender→escape, sprinter→furthest-progress/deploy).
- `room.test.ts` (extend): `addBotMember` stores a personality; with an injected selector the
  stored value is deterministic; selector cycles through all three over repeated calls.
- `init-game` test (existing or new): bot seat carries `personality`; human seat does not.
- Shared: trivial test that `BOT_PERSONALITIES` has 3 entries and titles map covers them.

### Verify

Full `bun run test` + `bun run typecheck` + lint green. Existing solo-vs-ai e2e still valid
(no protocol change).

### Commit

`feat: three AI personalities randomly assigned to bots` (via /commit-general).

---

## Task 3 — Finish remaining backlog tickets

Order chosen to land low-risk closeouts first, then features, then ops. Commit per ticket.

### 3.0 Closeouts (code appears already landed — verify against acceptance, then close)

- **MOR-63 Rematch flow** — router `rematch` case + PostGamePage button exist. Verify acceptance
  criteria, run rematch test(s) + e2e `rematch.spec.ts`, then mark Done. Fix any gap.
- **MOR-83 Remove name-entry** — `guestLogin()` arg-less, CreateRoomPage removed, RoomPage updated.
  Verify no `name-input`/`guestLogin(arg)`/"Enter your name" remain, run create-room/turn-flow/
  reconnect e2e, then mark Done.

### 3.1 Phase 9 polish

- **MOR-64** Board-size selector on create flow (rooms now created from home — wire `?size`/control).
- **MOR-65** Capture toast/animation (client; driven by existing `moved`/capture server events).
- **MOR-66** Mobile layout pass.
- **MOR-67** Spectator wiring.

### 3.2 Phase 10 ops/hardening

- **MOR-69** Persist DB to disk (file-backed SQLite).
- **MOR-70** Health endpoint `GET /healthz`.
- **MOR-71** Graceful shutdown on SIGTERM.
- **MOR-72** JWT_SECRET fail-fast in production.
- **MOR-73** Disconnect indicator in lobby and match.
- **MOR-74** CI pipeline (GitHub Actions).
- **MOR-75** Playwright config + golden-path e2e.
- **MOR-76** Rate limiting on auth + room creation.
- **MOR-77** Schedule game retention purge.
- **MOR-78** Schedule idle-room expiry.
- **MOR-79** Structured server logging.

### 3.3 Tech debt

- **MOR-68** Unify GameSession types (mutable vs snapshot+log).

### Deferred (NOT in scope)

- **MOR-61** Phase 8: Tiebreaker phase wiring (DEFERRED).

Each ticket: read full issue via Linear `get_issue`, implement per acceptance criteria TDD where
the issue says so, run relevant tests + typecheck + lint, commit, then set issue state → Done.

---

## New Linear tickets to create (Task 0, before coding)

1. **Test infra: reusable game-state factory for scenario injection** (backs personality tests).
2. **Feat: three AI personalities (Aggressor/Defender/Sprinter), randomly assigned to bots.**

Both in project `Ludo 2 — Real-time Multiplayer`, team `Morteza`.
