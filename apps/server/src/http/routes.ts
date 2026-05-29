import { sql } from "drizzle-orm";
import type { GuestAuth } from "../auth/guest-auth.js";
import type { Db } from "../db/connection.js";
import { insertRoom, getRoom, getGame, getGameLog } from "../db/repositories.js";

// Simple in-memory token bucket for rate limiting
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, requestsPerMinute: number) {
    this.capacity = capacity;
    this.refillRate = requestsPerMinute / 60;
  }

  isAllowed(key: string): boolean {
    const now = Date.now() / 1000;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
}

const authLimiter = new RateLimiter(10, 10); // 10 requests per minute
const roomsLimiter = new RateLimiter(5, 5); // 5 requests per minute

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for") ?? "unknown";
}

export interface HttpDeps {
  auth: GuestAuth;
  db: Db;
  boardSize: number;
}

export function createHttpHandler(deps: HttpDeps) {
  const { auth, db, boardSize } = deps;

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;

    // --- Health ---
    if (url.pathname === "/healthz" && method === "GET") {
      try {
        // Check DB connectivity with a simple query
        db.run(sql`SELECT 1`);
        return Response.json({ ok: true });
      } catch (error) {
        return Response.json({ ok: false }, { status: 503 });
      }
    }

    // --- Guest Auth: Issue ---
    if (url.pathname === "/auth/guest" && method === "POST") {
      const clientIp = getClientIp(req);
      if (!authLimiter.isAllowed(clientIp)) {
        return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "60" } });
      }
      const playerId = crypto.randomUUID();
      const token = await auth.issue(playerId);
      return Response.json({ token, playerId });
    }

    // --- Guest Auth: Refresh ---
    if (url.pathname === "/auth/refresh" && method === "POST") {
      const body = (await req.json()) as Record<string, unknown>;
      const token = typeof body["token"] === "string" ? body["token"] : "";
      if (!token) {
        return Response.json({ error: "missing-token" }, { status: 400 });
      }
      const result = await auth.refresh(token);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 401 });
      }
      return Response.json({ token: result.token });
    }

    // --- Room Create ---
    if (url.pathname === "/rooms" && method === "POST") {
      const clientIp = getClientIp(req);
      if (!roomsLimiter.isAllowed(clientIp)) {
        return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "60" } });
      }
      const identity = await extractAuth(req, auth);
      if (!identity) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let bots = 0;
      let boardSize = 4; // MOR-64: allow client to override
      const contentType = req.headers.get("content-type") ?? "";
      if (req.body && contentType.includes("application/json")) {
        const body = (await req.json()) as Record<string, unknown>;

        const rawBots = body["bots"];
        if (rawBots !== undefined) {
          if (typeof rawBots !== "number" || !Number.isInteger(rawBots) || rawBots < 0 || rawBots > 3) {
            return Response.json({ error: "invalid-bots" }, { status: 400 });
          }
          bots = rawBots;
        }

        const rawBoardSize = body["boardSize"];
        if (rawBoardSize !== undefined) {
          if (typeof rawBoardSize !== "number" || !Number.isInteger(rawBoardSize) || rawBoardSize < 4 || rawBoardSize > 8) {
            return Response.json({ error: "invalid-boardSize" }, { status: 400 });
          }
          boardSize = rawBoardSize;
        }
      }

      const roomSize = bots > 0 ? 1 + bots : boardSize;
      const roomId = crypto.randomUUID();
      insertRoom(db, roomId, roomSize, bots, new Date()).run();
      return Response.json({ roomId }, { status: 201 });
    }

    // --- Game History ---
    const historyMatch = url.pathname.match(/^\/games\/([^/]+)\/history$/);
    if (historyMatch && method === "GET") {
      const identity = await extractAuth(req, auth);
      if (!identity) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const gameId = historyMatch[1]!;
      const game = getGame(db, gameId);
      if (!game) {
        return Response.json({ error: "not-found" }, { status: 404 });
      }
      const rows = getGameLog(db, gameId);
      const entries = rows.map((r: { entry: unknown }) => r.entry);
      return Response.json({ entries });
    }

    return new Response("Not Found", { status: 404 });
  };
}

async function extractAuth(
  req: Request,
  auth: GuestAuth,
): Promise<{ playerId: string } | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const result = await auth.verify(token);
  if (!result.ok) return null;
  return { playerId: result.playerId };
}
