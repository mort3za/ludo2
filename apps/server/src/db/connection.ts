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

export type Db = ReturnType<typeof createDb>;
