import { describe, it, expect, beforeEach } from "vitest";
import { createDb, applySchema, type Db } from "./connection.js";
import {
  insertPlayer,
  getPlayer,
  insertRoom,
  getRoom,
  updateRoomPhase,
  insertGame,
  getGame,
  completeGame,
  appendLogEntry,
  getGameLog,
  purgeOldGames,
} from "./repositories.js";

describe("repositories", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb();
    applySchema(db);
  });

  describe("players", () => {
    it("inserts and retrieves a player", () => {
      insertPlayer(db, "p1", "Alice", new Date(1000)).run();
      const player = getPlayer(db, "p1");
      expect(player).toBeDefined();
      expect(player!.name).toBe("Alice");
    });

    it("does not fail on duplicate insert", () => {
      insertPlayer(db, "p1", "Alice", new Date(1000)).run();
      insertPlayer(db, "p1", "Alice2", new Date(2000)).run();
      const player = getPlayer(db, "p1");
      expect(player!.name).toBe("Alice"); // First insert wins
    });

    it("returns undefined for missing player", () => {
      const player = getPlayer(db, "ghost");
      expect(player).toBeUndefined();
    });
  });

  describe("rooms", () => {
    it("inserts and retrieves a room", () => {
      insertRoom(db, "room-1", 4, new Date(1000)).run();
      const room = getRoom(db, "room-1");
      expect(room).toBeDefined();
      expect(room!.boardSize).toBe(4);
      expect(room!.phase).toBe("lobby");
    });

    it("updates room phase", () => {
      insertRoom(db, "room-1", 4, new Date(1000)).run();
      updateRoomPhase(db, "room-1", "playing").run();
      const room = getRoom(db, "room-1");
      expect(room!.phase).toBe("playing");
    });
  });

  describe("games", () => {
    it("inserts and retrieves a game", () => {
      insertGame(db, "game-1", "room-1", new Date(2000)).run();
      const game = getGame(db, "game-1");
      expect(game).toBeDefined();
      expect(game!.status).toBe("playing");
      expect(game!.roomId).toBe("room-1");
    });

    it("completes a game", () => {
      insertGame(db, "game-1", "room-1", new Date(2000)).run();
      completeGame(db, "game-1", new Date(5000)).run();
      const game = getGame(db, "game-1");
      expect(game!.status).toBe("completed");
      expect(game!.completedAt).toEqual(new Date(5000));
    });
  });

  describe("move log", () => {
    it("appends and retrieves log entries in order", () => {
      appendLogEntry(db, "game-1", 0, { type: "roll", seat: 1, value: 3 }).run();
      appendLogEntry(db, "game-1", 1, {
        type: "move",
        seat: 1,
        tokenId: "t1",
        from: "Y/1/1",
        to: "T/1",
      }).run();

      const entries = getGameLog(db, "game-1");
      expect(entries).toHaveLength(2);
      expect((entries[0]!.entry as unknown as { type: string }).type).toBe("roll");
      expect((entries[1]!.entry as unknown as { type: string }).type).toBe("move");
      expect(entries[0]!.seq).toBe(0);
      expect(entries[1]!.seq).toBe(1);
    });

    it("returns empty array for unknown game", () => {
      const entries = getGameLog(db, "nonexistent");
      expect(entries).toEqual([]);
    });
  });

  describe("retention", () => {
    it("purges games completed before cutoff", () => {
      insertGame(db, "old-game", "room-1", new Date(1000)).run();
      completeGame(db, "old-game", new Date(2000)).run();
      appendLogEntry(db, "old-game", 0, { type: "roll", seat: 1, value: 3 }).run();

      insertGame(db, "new-game", "room-1", new Date(5000)).run();
      completeGame(db, "new-game", new Date(6000)).run();
      appendLogEntry(db, "new-game", 0, { type: "roll", seat: 1, value: 5 }).run();

      // Purge games completed before 3000
      const purged = purgeOldGames(db, new Date(3000));
      expect(purged).toBe(1);

      expect(getGame(db, "old-game")).toBeUndefined();
      expect(getGameLog(db, "old-game")).toEqual([]);
      expect(getGame(db, "new-game")).toBeDefined();
      expect(getGameLog(db, "new-game")).toHaveLength(1);
    });

    it("does not purge in-progress games", () => {
      insertGame(db, "active-game", "room-1", new Date(1000)).run();
      // Not completed — no completedAt

      const purged = purgeOldGames(db, new Date(99999));
      expect(purged).toBe(0);
      expect(getGame(db, "active-game")).toBeDefined();
    });
  });
});
