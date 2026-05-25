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
  phase: text("phase", { enum: ["lobby", "playing", "post-game"] }).notNull(),
  gameId: text("game_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  gameEndedAt: integer("game_ended_at", { mode: "timestamp_ms" }),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const moveLog = sqliteTable("move_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull(),
  seq: integer("seq").notNull(),
  entry: text("entry", { mode: "json" }).notNull(),
});
