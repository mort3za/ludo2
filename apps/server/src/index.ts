import { createGuestAuth } from "./auth/guest-auth.js";
import { createRoom, joinRoom } from "./rooms/room.js";
import { createRouter, type WsClient, type RoomStore } from "./ws/router.js";
import { parseClientMessage } from "./ws/protocol.js";
import { createHttpHandler } from "./http/routes.js";
import { createDb, applySchema } from "./db/connection.js";
import type { ServerMessage } from "@ludo/shared";

// --- Configuration ---
const PORT = Number(process.env["PORT"] ?? 3000);
const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production-32ch";
const BOARD_SIZE = 4;

// --- Singletons ---
const auth = createGuestAuth(JWT_SECRET);
const db = createDb(); // in-memory SQLite
applySchema(db);
const rooms: RoomStore = new Map();
const router = createRouter(rooms);
const httpHandler = createHttpHandler({ auth, db, boardSize: BOARD_SIZE });

// Map Bun WebSocket → WsClient for lifecycle management
const wsClients = new WeakMap<object, WsClient>();

interface WsData {
  playerId: string;
  name: string;
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
        data: { playerId: result.playerId, name: result.name, roomId },
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
      const { playerId, name, roomId } = ws.data;

      // Ensure room exists (link-only create)
      if (!rooms.has(roomId)) {
        rooms.set(roomId, createRoom(roomId, BOARD_SIZE, Date.now()));
      }

      // Join room
      const room = rooms.get(roomId)!;
      const joinResult = joinRoom(room, playerId, name);
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

      if (!joinResult.ok) {
        client.send({ type: "error", message: joinResult.error });
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
      const client = wsClients.get(ws);
      if (!client) return;
      router.removeClient(client);
      wsClients.delete(ws);
    },
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
