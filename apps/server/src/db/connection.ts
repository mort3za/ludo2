import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";

export function createDb(filename: string = ":memory:") {
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  return db;
}

export type Db = ReturnType<typeof createDb>;
