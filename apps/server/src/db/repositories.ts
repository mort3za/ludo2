import { eq, lt, and, or, inArray, isNull, isNotNull, desc } from "drizzle-orm";
import { games, moveLog, players, rooms } from "./schema.js";
import type { Db } from "./connection.js";
import type { LogEntry } from "../game/snapshots/game-log.js";

// --- Players ---

export function insertPlayer(db: Db, id: string, name: string, now: Date) {
  return db.insert(players).values({ id, name, createdAt: now }).onConflictDoNothing();
}

export function getPlayer(db: Db, id: string) {
  return db.select().from(players).where(eq(players.id, id)).get();
}

// --- Rooms ---

export function insertRoom(db: Db, id: string, boardSize: number, botCount: number, now: Date) {
  return db.insert(rooms).values({
    id,
    ownerId: null,
    boardSize,
    botCount,
    phase: "lobby",
    gameId: null,
    createdAt: now,
    gameEndedAt: null,
    deletedAt: null,
  });
}

/**
 * Fetch a room row, soft-deleted ones included — callers need to tell an expired
 * link (row present, `deletedAt` set) apart from one that never existed.
 */
export function getRoom(db: Db, id: string) {
  return db.select().from(rooms).where(eq(rooms.id, id)).get();
}

export function updateRoomPhase(db: Db, id: string, phase: "lobby" | "playing" | "post-game") {
  return db.update(rooms).set({ phase }).where(eq(rooms.id, id));
}

export function updateRoomOptions(
  db: Db,
  id: string,
  options: {
    wallEnabled: boolean;
    autoMoveEnabled: boolean;
    timerEnabled: boolean;
    startGuardEnabled: boolean;
    consecutiveSixLimitEnabled: boolean;
  },
) {
  return db
    .update(rooms)
    .set({
      wallEnabled: options.wallEnabled,
      autoMoveEnabled: options.autoMoveEnabled,
      timerEnabled: options.timerEnabled,
      startGuardEnabled: options.startGuardEnabled,
      consecutiveSixLimitEnabled: options.consecutiveSixLimitEnabled,
    })
    .where(eq(rooms.id, id));
}

// --- Games ---

export function insertGame(db: Db, id: string, roomId: string, now: Date) {
  return db.insert(games).values({ id, roomId, status: "playing", createdAt: now });
}

export function getGame(db: Db, id: string) {
  return db.select().from(games).where(eq(games.id, id)).get();
}

export function completeGame(db: Db, id: string, now: Date) {
  return db.update(games).set({ status: "completed", completedAt: now }).where(eq(games.id, id));
}

/**
 * Persist (or update) an in-progress game's full state so it survives a server
 * restart. Upserts a "playing" row keyed by game id.
 */
export function saveGameSnapshot(db: Db, id: string, roomId: string, snapshot: string, now: Date) {
  return db
    .insert(games)
    .values({ id, roomId, status: "playing", createdAt: now, snapshot })
    .onConflictDoUpdate({ target: games.id, set: { snapshot, status: "playing" } });
}

/**
 * The most recently completed game for a room, if any — used to serve the
 * post-game result (from its persisted snapshot) for the post-game window,
 * independently of any live in-memory session.
 */
export function getLatestCompletedGame(db: Db, roomId: string) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.roomId, roomId), eq(games.status, "completed"), isNull(games.deletedAt)))
    .orderBy(desc(games.completedAt))
    .get();
}

/**
 * Active games to restore on boot: those still flagged "playing" with a snapshot.
 * Soft-deleted games are skipped — otherwise a game abandoned mid-play would be
 * resurrected on every restart, outliving the match link it belongs to.
 */
export function getActiveGames(db: Db) {
  return db
    .select({ roomId: games.roomId, snapshot: games.snapshot })
    .from(games)
    .where(and(eq(games.status, "playing"), isNull(games.deletedAt)))
    .all();
}

/** Remove a game and its move log entirely — used to clean up a finished game. */
export function deleteGame(db: Db, id: string): void {
  db.delete(moveLog).where(eq(moveLog.gameId, id)).run();
  db.delete(games).where(eq(games.id, id)).run();
}

// --- Move Log ---

export function appendLogEntry(db: Db, gameId: string, seq: number, entry: LogEntry) {
  return db.insert(moveLog).values({ gameId, seq, entry: entry as unknown as string });
}

export function getGameLog(db: Db, gameId: string) {
  return db.select().from(moveLog).where(eq(moveLog.gameId, gameId)).orderBy(moveLog.seq).all();
}

// --- Expiry (soft delete) ---

/**
 * Soft-delete every live room created before `cutoff` along with its games, and
 * return the affected room ids so the caller can evict them from memory.
 *
 * Rows are marked, not removed: the id has to keep resolving so an expired link
 * can be answered with "expired" rather than being silently recreated as a fresh
 * lobby. The retention purge reclaims the rows for good later.
 */
export function softDeleteExpiredRooms(db: Db, cutoff: Date, now: Date): string[] {
  const expired = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(isNull(rooms.deletedAt), lt(rooms.createdAt, cutoff)))
    .all();
  if (expired.length === 0) return [];

  const ids = expired.map((r: { id: string }) => r.id);
  db.update(rooms).set({ deletedAt: now }).where(inArray(rooms.id, ids)).run();
  db.update(games)
    .set({ deletedAt: now })
    .where(and(isNull(games.deletedAt), inArray(games.roomId, ids)))
    .run();

  return ids;
}

// --- Retention (hard delete) ---

export function purgeOldGames(db: Db, cutoff: Date) {
  // Games that finished — completed normally or soft-deleted with their room —
  // before the cutoff. Their snapshots are the bulkiest rows we store, so they
  // are reclaimed rather than kept indefinitely.
  const oldGames = db
    .select({ id: games.id })
    .from(games)
    .where(
      or(
        and(isNotNull(games.completedAt), lt(games.completedAt, cutoff)),
        and(isNotNull(games.deletedAt), lt(games.deletedAt, cutoff)),
      ),
    )
    .all();

  for (const game of oldGames) {
    db.delete(moveLog).where(eq(moveLog.gameId, game.id)).run();
    db.delete(games).where(eq(games.id, game.id)).run();
  }

  return oldGames.length;
}

/**
 * Reclaim soft-deleted rooms that passed the retention cutoff. Their links then
 * read as unknown rather than expired, which is accurate once the match is this
 * far in the past — and it stops the table growing without bound.
 */
export function purgeSoftDeletedRooms(db: Db, cutoff: Date): number {
  const stale = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(isNotNull(rooms.deletedAt), lt(rooms.deletedAt, cutoff)))
    .all();

  for (const room of stale) {
    db.delete(rooms).where(eq(rooms.id, room.id)).run();
  }

  return stale.length;
}
