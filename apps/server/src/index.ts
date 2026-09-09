import { createGuestAuth } from "./auth/guest-auth.js";
import {
  createRoom,
  joinRoom,
  joinAsSpectator,
  addBotMember,
  isExpired,
  isPastMatchLifetime,
  type Room,
} from "./rooms/room.js";
import { createRouter, type WsClient, type RoomStore } from "./ws/router.js";
import { parseClientMessage } from "./ws/protocol.js";
import { createHttpHandler } from "./http/routes.js";
import { createDb, applySchema } from "./db/connection.js";
import {
  getRoom,
  purgeOldGames,
  purgeSoftDeletedRooms,
  softDeleteExpiredRooms,
  updateRoomOptions,
  saveGameSnapshot,
  completeGame,
  deleteGame,
  getActiveGames,
} from "./db/repositories.js";
import { deserializeGame } from "./rooms/game-persistence.js";
import { SERVER_PORT, TIMINGS, type ServerMessage } from "@ludo/shared";
import { logger } from "./lib/logger.js";
import type { ServerWebSocket } from "bun";
import { join, resolve, normalize } from "node:path";

// --- Configuration ---
const PORT = Number(process.env["PORT"] ?? SERVER_PORT);
const DEFAULT_JWT_SECRET = "dev-secret-change-in-production-32ch";
const JWT_SECRET = process.env["JWT_SECRET"] ?? DEFAULT_JWT_SECRET;

// Optional: serve the built client (SPA) so the server is the single origin.
// Unset in dev (Vite serves the client); set to the client dist dir in production.
const STATIC_DIR = process.env["STATIC_DIR"];
const STATIC_ROOT = STATIC_DIR ? resolve(STATIC_DIR) : null;
const API_PREFIXES = ["/healthz", "/auth", "/rooms", "/games"];
const isApiPath = (p: string) => API_PREFIXES.some((a) => p === a || p.startsWith(a + "/"));

// Validate JWT_SECRET in production
if (process.env["NODE_ENV"] === "production") {
  if (!JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET || JWT_SECRET.length < 32) {
    console.error(
      "FATAL: JWT_SECRET must be set to a 32+ character secret in production. " +
        "Set the JWT_SECRET environment variable to a strong, random value.",
    );
    process.exit(1);
  }
}

// --- Singletons ---
const auth = createGuestAuth(JWT_SECRET);
const db = createDb(); // in-memory SQLite
applySchema(db);
const rooms: RoomStore = new Map();
const router = createRouter(rooms, {
  persistOptions: (roomId, options) => updateRoomOptions(db, roomId, options).run(),
  persistGame: (roomId, gameId, snapshot) =>
    saveGameSnapshot(db, gameId, roomId, snapshot, new Date()).run(),
  completeGame: (gameId) => completeGame(db, gameId, new Date()).run(),
});

/**
 * Enforce the absolute match lifetime: soft-delete rooms (and their games) whose
 * link has outlived TIMINGS.matchLifetime, then evict them from memory so their
 * turn timers and bot schedules stop.
 *
 * This is what makes a shared link actually stop working. The phase-window sweep
 * below can't do it: it only reclaims idle lobbies and elapsed post-game windows,
 * and never a "playing" room — so a game abandoned mid-turn would otherwise live
 * in memory (and be restored from its snapshot on every boot) forever.
 */
function sweepExpiredMatches(now: number): void {
  const expiredIds = softDeleteExpiredRooms(
    db,
    new Date(now - TIMINGS.matchLifetime),
    new Date(now),
  );
  for (const roomId of expiredIds) {
    if (!rooms.has(roomId)) continue;
    // Tell anyone still connected why the room vanished, before it does.
    router.broadcast(roomId, { type: "error", message: "room-expired" });
    rooms.delete(roomId);
    router.forgetRoom(roomId);
  }
  if (expiredIds.length > 0) {
    logger.info("Expired matches past their lifetime", { count: expiredIds.length });
  }
}

// Retire stale matches before restoring anything, so an expired room can never
// come back from a snapshot written before its link ran out.
sweepExpiredMatches(Date.now());

// Restore games that were in progress before a restart so players can resume
// where they left off (requires a file-backed DB_PATH; :memory: starts empty).
for (const row of getActiveGames(db)) {
  if (!row.snapshot) continue;
  const restored = deserializeGame(row.roomId, row.snapshot, Date.now());
  if (!restored) continue;
  rooms.set(row.roomId, restored.room);
  router.restoreSession(row.roomId, restored.session);
}

const httpHandler = createHttpHandler({ auth, db });

// Map Bun WebSocket → WsClient for lifecycle management
const wsClients = new WeakMap<object, WsClient>();
// Track all active WebSocket connections for graceful shutdown
const wsConnections = new Set<ServerWebSocket<WsData>>();

interface WsData {
  playerId: string;
  roomId: string;
  /** Client-chosen display name, validated server-side on join. */
  name?: string;
}

const server = Bun.serve<WsData>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // --- WebSocket upgrade ---
    if (url.pathname.startsWith("/ws/")) {
      const roomId = url.pathname.slice(4); // strip "/ws/"
      if (!roomId) {
        return new Response("Missing room ID", { status: 400 });
      }

      // Extract token from query string
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing token", { status: 401 });
      }

      const result = await auth.verify(token);
      if (!result.ok) {
        return new Response("Invalid token", { status: 401 });
      }

      const name = url.searchParams.get("name") ?? undefined;
      const upgraded = server.upgrade(req, {
        data: { playerId: result.playerId, roomId, name },
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // --- Static client (SPA) ---
    if (STATIC_ROOT && req.method === "GET" && !isApiPath(url.pathname)) {
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      const candidate = resolve(STATIC_ROOT, "." + (rel.startsWith("/") ? rel : "/" + rel));
      if (candidate.startsWith(STATIC_ROOT) && !url.pathname.endsWith("/")) {
        const file = Bun.file(candidate);
        if (await file.exists()) return new Response(file);
      }
      // SPA fallback: serve index.html for client-side routes
      return new Response(Bun.file(join(STATIC_ROOT, "index.html")), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Delegate all other HTTP requests to the handler
    return httpHandler(req);
  },
  websocket: {
    open(ws) {
      const { playerId, roomId } = ws.data;

      // Track this connection for graceful shutdown
      wsConnections.add(ws);

      // A match link only resolves while its room is live. Without this check a
      // socket to /ws/<anything> would conjure a fresh lobby on the spot, so every
      // URL — including ones that never existed, and ones long past their
      // lifetime — behaved like a valid match forever.
      const dbRoom = getRoom(db, roomId);
      const unavailable = !dbRoom
        ? "room-not-found"
        : dbRoom.deletedAt !== null || isPastMatchLifetime(dbRoom.createdAt.getTime(), Date.now())
          ? "room-expired"
          : null;
      if (unavailable) {
        ws.send(JSON.stringify({ type: "error", message: unavailable } satisfies ServerMessage));
        wsConnections.delete(ws);
        ws.close();
        return;
      }

      // Ensure room exists in memory, seeded from its persisted config.
      if (!rooms.has(roomId)) {
        let room: Room = createRoom(roomId, dbRoom.boardSize, Date.now());
        // Restore lobby-chosen options so they survive a server restart.
        room.options = {
          wallEnabled: dbRoom.wallEnabled,
          autoMoveEnabled: dbRoom.autoMoveEnabled,
          timerEnabled: dbRoom.timerEnabled,
          startGuardEnabled: dbRoom.startGuardEnabled,
          consecutiveSixLimitEnabled: dbRoom.consecutiveSixLimitEnabled,
        };
        for (let i = 0; i < dbRoom.botCount; i++) {
          const result = addBotMember(room);
          if (result.ok) room = result.room;
        }
        rooms.set(roomId, room);
      }

      // Join room
      const room = rooms.get(roomId)!;
      const isExistingMember = room.members.has(playerId) || room.spectators.has(playerId);
      let joinResult = joinRoom(room, playerId, ws.data.name);

      // If room is full and game is running, allow as spectator
      if (!joinResult.ok && joinResult.error === "room-full" && room.phase === "playing") {
        joinResult = joinAsSpectator(room, playerId);
      }

      if (joinResult.ok) {
        rooms.set(roomId, joinResult.room);
      }

      // Create WsClient and register
      const client: WsClient = {
        playerId,
        roomId,
        send(msg: ServerMessage) {
          ws.send(JSON.stringify(msg));
        },
      };
      wsClients.set(ws, client);
      router.addClient(client);

      if (!joinResult.ok && !isExistingMember) {
        client.send({ type: "error", message: joinResult.error });
      } else {
        // Broadcast for a fresh join OR a reconnect of a retained member, so
        // everyone sees the updated presence and the (re)joining client gets a
        // lobby snapshot. addClient above already marked them connected.
        const current = rooms.get(roomId)!;
        if (current.phase === "lobby") {
          router.broadcastLobby(roomId, current);
        }
      }

      // Re-emit game state for reconnecting players and spectators
      const session = router.getGameSession(roomId);
      if (session && session.state.status !== "finished") {
        client.send({ type: "state", state: session.state });
        // Only send a turn message when the game is awaiting a roll — the
        // state message already carries the full status (including "moving"),
        // and a spurious turn message would force the client back to "rolling",
        // causing the next roll attempt to be rejected with "not-rolling".
        if (session.state.status === "rolling") {
          client.send({
            type: "turn",
            seat: session.state.activeSeat,
            // Replay the live turn's deadline so the rejoining client's countdown
            // matches the still-running server timer — never reset it.
            deadline: session.turnDeadline,
          });
        }
        // Broadcast reconnect presence to all players in room
        const reconnectingSeat = session.state.seats.find((s) => s.playerId === playerId)?.index;
        if (reconnectingSeat !== undefined) {
          router.broadcast(roomId, { type: "presence", seat: reconnectingSeat, connected: true });
        }
      }
    },
    message(ws, message) {
      const client = wsClients.get(ws);
      if (!client) return;

      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      const parsed = parseClientMessage(raw);
      if (!parsed.ok) {
        client.send({ type: "error", message: parsed.error });
        return;
      }

      router.dispatch(client, parsed.message);
    },
    close(ws) {
      wsConnections.delete(ws);
      const client = wsClients.get(ws);
      if (!client) return;
      router.handleClose(client);
      wsClients.delete(ws);
    },
  },
});

logger.info("Server started", { port: server.port });

// Schedule daily retention purge: hard-delete what expiry already retired.
const purgeIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
let purgeInterval = setInterval(() => {
  const cutoff = new Date(Date.now() - TIMINGS.gameRetention);
  const games = purgeOldGames(db, cutoff);
  const purgedRooms = purgeSoftDeletedRooms(db, cutoff);
  if (games > 0 || purgedRooms > 0) {
    logger.info("Purged retired records", { games, rooms: purgedRooms });
  }
}, purgeIntervalMs);

// Schedule idle room expiry check (every 1 minute)
const expireIntervalMs = 60 * 1000; // 1 minute
let expireInterval = setInterval(() => {
  const now = Date.now();

  // Absolute lifetime first: it applies to every phase and ignores whether
  // anyone is connected, so it also catches rooms the phase windows below skip.
  sweepExpiredMatches(now);

  let expiredCount = 0;
  for (const [roomId, room] of rooms) {
    // A room is reclaimed only once everybody has left — i.e. no client is
    // connected — and its phase window has elapsed: idle lobbies, and finished
    // games past their post-game viewing/rematch window. Disconnected members
    // are retained (their seats and the room's ownership persist), so emptiness
    // is measured by live connections, not by the members map.
    if (
      isExpired(room, now) &&
      (room.phase === "lobby" || room.phase === "post-game") &&
      !router.hasConnectedPlayers(roomId) &&
      room.spectators.size === 0
    ) {
      // The persisted game is kept (flagged completed) for the whole post-game
      // window so a mid-window restart doesn't lose it; delete it now.
      if (room.phase === "post-game" && room.gameId) {
        deleteGame(db, room.gameId);
      }
      rooms.delete(roomId);
      router.forgetRoom(roomId);
      expiredCount++;
    }
  }
  if (expiredCount > 0) {
    logger.info("Expired idle rooms", { count: expiredCount });
  }
}, expireIntervalMs);

// Graceful shutdown handler
let isShuttingDown = false;
const hardTimeoutMs = 5000;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Graceful shutdown initiated", { signal });

  // Set hard timeout to force exit
  const hardTimeout = setTimeout(() => {
    logger.warn("Graceful shutdown timeout reached, force exiting", {});
    process.exit(0);
  }, hardTimeoutMs);

  // Clear scheduled tasks
  clearInterval(purgeInterval);
  clearInterval(expireInterval);

  // Stop accepting new connections
  server.stop();

  // Send shutdown notification to all connected clients and close them
  for (const ws of wsConnections) {
    const client = wsClients.get(ws);
    if (client) {
      // Send shutdown message
      client.send({ type: "error", message: "server-restart" });
    }
    // Close with code 1012 (service restart)
    ws.close(1012);
  }
  wsConnections.clear();

  // Give connections time to close, then exit
  setTimeout(() => {
    clearTimeout(hardTimeout);
    logger.info("Graceful shutdown complete", {});
    process.exit(0);
  }, 100);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
