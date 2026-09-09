import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  boardSize: integer("board_size").notNull(),
  botCount: integer("bot_count").notNull().default(0),
  wallEnabled: integer("wall_enabled", { mode: "boolean" }).notNull().default(false),
  autoMoveEnabled: integer("auto_move_enabled", { mode: "boolean" }).notNull().default(true),
  timerEnabled: integer("timer_enabled", { mode: "boolean" }).notNull().default(false),
  startGuardEnabled: integer("start_guard_enabled", { mode: "boolean" }).notNull().default(true),
  consecutiveSixLimitEnabled: integer("consecutive_six_limit_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  phase: text("phase", { enum: ["lobby", "playing", "post-game"] }).notNull(),
  gameId: text("game_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  gameEndedAt: integer("game_ended_at", { mode: "timestamp_ms" }),
  // Soft delete: set once the room outlives TIMINGS.matchLifetime. The row is
  // kept so an expired link can be answered with "expired" instead of being
  // silently recreated as a fresh lobby.
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  // Full in-progress game state (JSON) so a game survives a server restart.
  // Written on every state change; cleared when the game finishes.
  snapshot: text("snapshot"),
  // Soft delete: set when the owning room is soft-deleted. Keeps an abandoned
  // "playing" game from being restored on every boot, while the retention purge
  // reclaims the row (and its bulky snapshot) later.
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const moveLog = sqliteTable("move_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull(),
  seq: integer("seq").notNull(),
  entry: text("entry", { mode: "json" }).notNull(),
});
