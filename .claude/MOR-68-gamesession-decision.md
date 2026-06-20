# MOR-68: GameSession Type Decision

## Summary

Two `GameSession` models exist in the codebase:

- **Mutable model** (`apps/server/src/rooms/game-session.ts`): Direct state mutations in `handleRoll` / `handleMove`
- **Snapshot+log model** (`apps/server/src/ws/reconnect.ts`, `apps/server/src/game/snapshots/game-log.ts`): Immutable state with event replay

## Decision: Keep Mutable Model

**Rationale:**

1. Mutable model is simpler, sufficient for in-memory play
2. Server restarts are acceptable (players reconnect, game resumes in-memory)
3. Snapshot+log offers value only if we persist logs to SQLite per action (not yet prioritized)
4. Snapshot+log code is well-tested but unused; can be kept as reference for future crash-recovery feature

**Status:** Snapshot+log code is marked as "tested but unused" and left in the repo as reference.

## Future Migration

If server-restart durability becomes a requirement:

1. Swap router.ts to use snapshot+log model
2. Write logs to game_log table per action (already has schema)
3. On server boot, replay logs for any in-progress games
4. Remove mutable game-session.ts once fully migrated

## Files

- `apps/server/src/rooms/game-session.ts` — **Active (mutable)**
- `apps/server/src/ws/reconnect.ts` — Tested, unused (snapshot+log)
- `apps/server/src/game/snapshots/game-log.ts` — Tested, unused (snapshot+log)
- Router continues to use mutable model

## Tests

All tests pass with mutable model. Snapshot+log tests in reconnect.ts still verify that model works correctly but is not exercised by integration tests.
