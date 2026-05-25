import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

const isBun = typeof globalThis.Bun !== "undefined";

function createBunDb(filename: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/bun-sqlite");
  const sqlite = new Database(filename);
  sqlite.exec("PRAGMA journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

function createNodeDb(filename: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

export function createDb(filename: string = ":memory:") {
  return isBun ? createBunDb(filename) : createNodeDb(filename);
}

export function applySchema(db: Db) {
  db.run(sql`CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    board_size INTEGER NOT NULL,
    bot_count INTEGER NOT NULL DEFAULT 0,
    phase TEXT NOT NULL,
    game_id TEXT,
    created_at INTEGER NOT NULL,
    game_ended_at INTEGER
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS move_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    entry TEXT NOT NULL
  )`);
}

export type Db = ReturnType<typeof createDb>;
