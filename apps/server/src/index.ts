import { createGuestAuth } from "./auth/guest-auth.js";
import { createRoom, joinRoom, joinAsSpectator, addBotMember, type Room } from "./rooms/room.js";
import { createRouter, type WsClient, type RoomStore } from "./ws/router.js";
import { parseClientMessage } from "./ws/protocol.js";
import { createHttpHandler } from "./http/routes.js";
import { createDb, applySchema } from "./db/connection.js";
import { getRoom, purgeOldGames } from "./db/repositories.js";
import { SERVER_PORT, TIMINGS, type ServerMessage } from "@ludo/shared";

// --- Configuration ---
const PORT = Number(process.env["PORT"] ?? SERVER_PORT);
const DEFAULT_JWT_SECRET = "dev-secret-change-in-production-32ch";
const JWT_SECRET = process.env["JWT_SECRET"] ?? DEFAULT_JWT_SECRET;
const BOARD_SIZE = 4;

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
const router = createRouter(rooms);
const httpHandler = createHttpHandler({ auth, db, boardSize: BOARD_SIZE });

// Map Bun WebSocket → WsClient for lifecycle management
const wsClients = new WeakMap<object, WsClient>();
// Track all active WebSocket connections for graceful shutdown
const wsConnections = new Set<object>();

interface WsData {
  playerId: string;
  roomId: string;
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

      const upgraded = server.upgrade(req, {
        data: { playerId: result.playerId, roomId },
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Delegate all other HTTP requests to the handler
    return httpHandler(req);
  },
  websocket: {
    open(ws) {
      const { playerId, roomId } = ws.data;

      // Track this connection for graceful shutdown
      wsConnections.add(ws);

      // Ensure room exists in memory; read config from DB if persisted there.
      if (!rooms.has(roomId)) {
        const dbRoom = getRoom(db, roomId);
        const size = dbRoom?.boardSize ?? BOARD_SIZE;
        const botCount = dbRoom?.botCount ?? 0;
        let room: Room = createRoom(roomId, size, Date.now());
        for (let i = 0; i < botCount; i++) {
          const result = addBotMember(room);
          if (result.ok) room = result.room;
        }
        rooms.set(roomId, room);
      }

      // Join room
      const room = rooms.get(roomId)!;
      const isExistingMember = room.members.has(playerId) || room.spectators.has(playerId);
      let joinResult = joinRoom(room, playerId);

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
      } else if (joinResult.ok && joinResult.room.phase === "lobby") {
        router.broadcastLobby(roomId, joinResult.room);
      }

      // Re-emit game state for reconnecting players and spectators
      const session = router.getGameSession(roomId);
      if (session && session.state.status !== "finished") {
        client.send({ type: "state", state: session.state });
        // Send turn message with current deadline
        client.send({
          type: "turn",
          seat: session.state.activeSeat,
          deadline: Date.now() + 30000,
        });
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

console.log(`Server listening on http://localhost:${server.port}`);

// Schedule daily game retention purge
const purgeIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
let purgeInterval = setInterval(() => {
  const cutoff = new Date(Date.now() - TIMINGS.gameRetention);
  const result = purgeOldGames(db, cutoff);
  if (result.changes > 0) {
    console.log(`[purge] Removed ${result.changes} old game records`);
  }
}, purgeIntervalMs);

// Graceful shutdown handler
let isShuttingDown = false;
const hardTimeoutMs = 5000;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[${signal}] Graceful shutdown initiated...`);

  // Set hard timeout to force exit
  const hardTimeout = setTimeout(() => {
    console.warn("Graceful shutdown timeout reached, force exiting...");
    process.exit(0);
  }, hardTimeoutMs);

  // Clear scheduled tasks
  clearInterval(purgeInterval);

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
    console.log("Graceful shutdown complete");
    process.exit(0);
  }, 100);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
