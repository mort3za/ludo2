import { describe, it, expect, beforeEach } from "vitest";
import { TIMINGS } from "@ludo/shared";
import { createHttpHandler } from "./routes.js";
import { createGuestAuth, type GuestAuth } from "../auth/guest-auth.js";
import { createDb, applySchema, type Db } from "../db/connection.js";
import { insertGame, appendLogEntry, saveGameSnapshot, completeGame } from "../db/repositories.js";

describe("HTTP routes", () => {
  let auth: GuestAuth;
  let db: Db;
  let handler: ReturnType<typeof createHttpHandler>;

  beforeEach(() => {
    auth = createGuestAuth("test-secret-32-chars-for-hs256!!");
    db = createDb();
    applySchema(db);
    handler = createHttpHandler({ auth, db });
  });

  // --- Health ---
  describe("GET /healthz", () => {
    it("returns ok when db is healthy", async () => {
      const res = await handler(new Request("http://localhost/healthz"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });
  });

  // --- Guest Auth ---
  describe("POST /auth/guest", () => {
    it("issues a token without requiring a body", async () => {
      const res = await handler(new Request("http://localhost/auth/guest", { method: "POST" }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string; playerId: string };
      expect(body.token).toBeDefined();
      expect(body.playerId).toBeDefined();
    });

    it("issues distinct playerIds for separate requests", async () => {
      const res1 = await handler(new Request("http://localhost/auth/guest", { method: "POST" }));
      const res2 = await handler(new Request("http://localhost/auth/guest", { method: "POST" }));
      const a = (await res1.json()) as { playerId: string };
      const b = (await res2.json()) as { playerId: string };
      expect(a.playerId).not.toBe(b.playerId);
    });
  });

  describe("POST /auth/refresh", () => {
    it("refreshes a valid token", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string };
      expect(body.token).toBeDefined();
    });

    it("rejects invalid token", async () => {
      const res = await handler(
        new Request("http://localhost/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "garbage" }),
        }),
      );
      expect(res.status).toBe(401);
    });
  });

  // --- Room Create ---
  describe("POST /rooms", () => {
    it("creates a room and returns id", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { roomId: string };
      expect(body.roomId).toBeDefined();
      expect(typeof body.roomId).toBe("string");
    });

    it("rejects missing auth", async () => {
      const res = await handler(new Request("http://localhost/rooms", { method: "POST" }));
      expect(res.status).toBe(401);
    });

    it("accepts bots:1 and returns roomId", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bots: 1 }),
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { roomId: string };
      expect(body.roomId).toBeDefined();
    });

    it("rejects bots > 3", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bots: 4 }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects negative bots", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bots: -1 }),
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  // --- Game History ---
  describe("GET /games/:id/history", () => {
    it("returns the move log for a game", async () => {
      insertGame(db, "g1", "room-1", new Date(1000)).run();
      appendLogEntry(db, "g1", 0, { type: "roll", seat: 1, value: 3 }).run();
      appendLogEntry(db, "g1", 1, {
        type: "move",
        seat: 1,
        tokenId: "t1",
        from: "Y/1/1",
        to: "T/1",
      }).run();

      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/games/g1/history", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { entries: unknown[] };
      expect(body.entries).toHaveLength(2);
    });

    it("returns 404 for unknown game", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/games/nope/history", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(404);
    });

    it("rejects missing auth", async () => {
      const res = await handler(new Request("http://localhost/games/g1/history"));
      expect(res.status).toBe(401);
    });
  });

  // --- Post-game Result ---
  describe("GET /rooms/:id/result", () => {
    function seedFinishedGame(roomId: string, completedAt: Date) {
      const snapshot = JSON.stringify({
        state: { gameId: "g1", status: "finished", standings: [1, 2] },
      });
      saveGameSnapshot(db, "g1", roomId, snapshot, new Date(1000)).run();
      completeGame(db, "g1", completedAt).run();
    }

    it("returns the finished state within the post-game window", async () => {
      seedFinishedGame("room-1", new Date(Date.now() - 60_000));
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms/room-1/result", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { state: { status: string; standings: number[] } };
      expect(body.state.status).toBe("finished");
      expect(body.state.standings).toEqual([1, 2]);
    });

    it("returns 410 once the post-game window has elapsed", async () => {
      seedFinishedGame("room-1", new Date(Date.now() - TIMINGS.postGameWindow - 1000));
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms/room-1/result", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(410);
    });

    it("returns 404 when the room has no completed game", async () => {
      const token = await auth.issue("p1");
      const res = await handler(
        new Request("http://localhost/rooms/ghost/result", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(404);
    });

    it("rejects missing auth", async () => {
      const res = await handler(new Request("http://localhost/rooms/room-1/result"));
      expect(res.status).toBe(401);
    });
  });

  // --- 404 ---
  describe("unknown routes", () => {
    it("returns 404", async () => {
      const res = await handler(new Request("http://localhost/nope"));
      expect(res.status).toBe(404);
    });
  });
});
