# Debug Start State Plan

## Overview

Add a server-only debug start state fixture that can be loaded from a JSON file path in config. When configured, the server initializes new games from the normal room-derived state and then applies validated gameplay overrides from the fixture. Clients continue sending the normal `start` message and never provide debug state.

## Design Decisions

- Keep room membership, seat assignment, player ids, bot flags, and colors server-owned.
- Store fixture data in JSON files under `tests/fixtures/`.
- Load the optional fixture path from server config, not from `src/index.ts` directly.
- Validate fixture contents against the room-derived base state before applying them.
- Reuse the same initialization path for local debugging and automated testing.

## Fixture Shape

The fixture file contains only gameplay overrides:

```json
{
  "status": "moving",
  "activeSeat": 1,
  "diceValue": 6,
  "consecutiveSixes": 1,
  "standings": [],
  "tokens": [
    { "id": "1-1", "cell": "T/38" },
    { "id": "1-2", "cell": "H/1/3" }
  ]
}
```

Notes:

- `tokens` is partial by token id; unspecified tokens keep their default cells.
- Seats are not accepted from fixtures.
- Token ids must already exist in the base state.
- Cell strings must be syntactically valid and semantically consistent with the chosen token.

## Tasks

### 1. Server fixture contract

- Add a server-side type for debug start overrides.
- Add parsing and validation helpers for JSON fixture files.

### 2. Config and loader

- Add a dedicated server config module for the optional fixture path.
- Load the fixture file once and expose the parsed result to runtime code.

### 3. Game initialization

- Extend initialization to accept optional debug overrides.
- Build the normal room-based state first, then apply validated overrides.

### 4. Runtime wiring

- Pass the loaded fixture through server bootstrap into the router/init path.
- Keep websocket and client contracts unchanged.

### 5. Tests

- Red/green unit tests for fixture application in `init-game.test.ts`.
- Validation tests for malformed fixture content.
- One integration-style router test that confirms start uses the configured fixture.

## Verification

- `bun --filter @ludo/server test -- apps/server/src/rooms/init-game.test.ts`
- `bun --filter @ludo/server test -- apps/server/src/ws/router.test.ts`
- `bun --filter @ludo/server typecheck`

## Risks

- A global fixture path affects the whole server process. That is acceptable for local runs and dedicated test runs, but not for mixed parallel scenarios with different fixtures.
- Invalid fixture files must fail clearly; partial silent fallback would make debugging unreliable.
