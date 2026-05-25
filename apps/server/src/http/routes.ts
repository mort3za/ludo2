import type { GuestAuth } from "../auth/guest-auth.js";
import type { Db } from "../db/connection.js";
import { insertRoom, getRoom, getGame, getGameLog } from "../db/repositories.js";

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
    if (url.pathname === "/health" && method === "GET") {
      return Response.json({ status: "ok" });
    }

    // --- Guest Auth: Issue ---
    if (url.pathname === "/auth/guest" && method === "POST") {
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
      const identity = await extractAuth(req, auth);
      if (!identity) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const roomId = crypto.randomUUID();
      insertRoom(db, roomId, boardSize, new Date()).run();
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
