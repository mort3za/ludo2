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

export function createDb(filename?: string) {
  // Determine filename: explicit arg > env var > default to :memory:
  let dbPath = filename ?? process.env["DB_PATH"] ?? ":memory:";

  // In production, create parent directory if using file path
  if (process.env["NODE_ENV"] === "production" && dbPath !== ":memory:") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { mkdirSync } = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dirname } = require("path");
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch (e) {
      console.warn("Failed to create DB directory:", e);
    }
  }

  return isBun ? createBunDb(dbPath) : createNodeDb(dbPath);
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
    wall_enabled INTEGER NOT NULL DEFAULT 0,
    auto_move_enabled INTEGER NOT NULL DEFAULT 1,
    timer_enabled INTEGER NOT NULL DEFAULT 1,
    phase TEXT NOT NULL,
    game_id TEXT,
    created_at INTEGER NOT NULL,
    game_ended_at INTEGER
  )`);
  // Migrate pre-existing file databases that lack the option columns.
  addColumnIfMissing(db, "rooms", "wall_enabled", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "rooms", "auto_move_enabled", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(db, "rooms", "timer_enabled", "INTEGER NOT NULL DEFAULT 1");
  db.run(sql`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    snapshot TEXT
  )`);
  // Migrate pre-existing file databases that lack the snapshot column.
  addColumnIfMissing(db, "games", "snapshot", "TEXT");
  db.run(sql`CREATE TABLE IF NOT EXISTS move_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    entry TEXT NOT NULL
  )`);
}

export type Db = ReturnType<typeof createDb>;

/**
 * Add a column to an existing table when it isn't already present.
 * `ADD COLUMN` throws if the column exists, so we swallow that case — this
 * keeps `applySchema` idempotent against both fresh and previously-created DBs.
 */
function addColumnIfMissing(db: Db, table: string, column: string, definition: string): void {
  try {
    db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`));
  } catch {
    // Column already exists — nothing to do.
  }
}
