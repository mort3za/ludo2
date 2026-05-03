import { describe, it, expect, beforeEach } from "vitest";
import { createHttpHandler, type HttpDeps } from "./routes.js";
import { createGuestAuth, type GuestAuth } from "../auth/guest-auth.js";
import { createDb, applySchema, type Db } from "../db/connection.js";
import { insertGame, completeGame, appendLogEntry, insertRoom } from "../db/repositories.js";

describe("HTTP routes", () => {
  let auth: GuestAuth;
  let db: Db;
  let handler: ReturnType<typeof createHttpHandler>;

  beforeEach(() => {
    auth = createGuestAuth("test-secret-32-chars-for-hs256!!");
    db = createDb();
    applySchema(db);
    handler = createHttpHandler({ auth, db, boardSize: 4 });
  });

  // --- Health ---
  describe("GET /health", () => {
    it("returns ok", async () => {
      const res = await handler(new Request("http://localhost/health"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    });
  });

  // --- Guest Auth ---
  describe("POST /auth/guest", () => {
    it("issues a token for valid name", async () => {
      const res = await handler(
        new Request("http://localhost/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Alice" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string; playerId: string };
      expect(body.token).toBeDefined();
      expect(body.playerId).toBeDefined();
    });

    it("rejects empty name", async () => {
      const res = await handler(
        new Request("http://localhost/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "" }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects long name", async () => {
      const res = await handler(
        new Request("http://localhost/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "a".repeat(31) }),
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/refresh", () => {
    it("refreshes a valid token", async () => {
      const token = await auth.issue("p1", "Alice");
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
      const token = await auth.issue("p1", "Alice");
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

      const token = await auth.issue("p1", "Alice");
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
      const token = await auth.issue("p1", "Alice");
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

  // --- 404 ---
  describe("unknown routes", () => {
    it("returns 404", async () => {
      const res = await handler(new Request("http://localhost/nope"));
      expect(res.status).toBe(404);
    });
  });
});
