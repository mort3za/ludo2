import type { ClientMessage, ServerMessage } from "@ludo/shared";
import { setReady, canStart, startGame, type Room } from "../rooms/room.js";
import { initGame } from "../rooms/init-game.js";
import { createCryptoRng } from "../game/rng/rng.js";
import {
  createGameSession,
  handleRoll,
  handleMove,
  type GameSession,
} from "../rooms/game-session.js";

export interface WsClient {
  playerId: string;
  roomId: string;
  send: (msg: ServerMessage) => void;
}

export type RoomStore = Map<string, Room>;

export interface Router {
  dispatch: (client: WsClient, message: ClientMessage) => void;
  broadcast: (roomId: string, msg: ServerMessage) => void;
  addClient: (client: WsClient) => void;
  removeClient: (client: WsClient) => void;
}

export function createRouter(rooms: RoomStore): Router {
  const clients = new Set<WsClient>();
  const gameSessions = new Map<string, GameSession>();

  function dispatch(client: WsClient, message: ClientMessage): void {
    const room = rooms.get(client.roomId);
    if (!room) {
      client.send({ type: "error", message: "room-not-found" });
      return;
    }

    if (!room.members.has(client.playerId)) {
      client.send({ type: "error", message: "not-in-room" });
      return;
    }

    switch (message.type) {
      case "ready": {
        const result = setReady(room, client.playerId, true);
        if (result.ok) {
          rooms.set(client.roomId, result.room);

          // Auto-start when all members are ready and requester is owner
          if (canStart(result.room, result.room.ownerId ?? "")) {
            const gameId = crypto.randomUUID();
            const startResult = startGame(result.room, result.room.ownerId!, gameId);
            if (startResult.ok) {
              rooms.set(client.roomId, startResult.room);
              const rng = createCryptoRng();
              const state = initGame(startResult.room, gameId, rng);
              const session = createGameSession(state);
              gameSessions.set(client.roomId, session);
              broadcast(client.roomId, { type: "state", state });
              // Send initial turn
              broadcast(client.roomId, {
                type: "turn",
                seat: state.activeSeat,
                deadline: Date.now() + 30000,
              });
            }
          }
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }

      case "roll": {
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        // Verify it's this player's turn
        const rollSeat = session.state.seats.find(
          (s) => s.playerId === client.playerId,
        );
        if (!rollSeat || rollSeat.index !== session.state.activeSeat) {
          client.send({ type: "error", message: "not-your-turn" });
          break;
        }
        const rollMsgs = handleRoll(session);
        for (const msg of rollMsgs) broadcast(client.roomId, msg);
        break;
      }

      case "move": {
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        const moveSeat = session.state.seats.find(
          (s) => s.playerId === client.playerId,
        );
        if (!moveSeat || moveSeat.index !== session.state.activeSeat) {
          client.send({ type: "error", message: "not-your-turn" });
          break;
        }
        const moveMsgs = handleMove(session, message.tokenId);
        for (const msg of moveMsgs) broadcast(client.roomId, msg);
        break;
      }

      case "rematch":
        // Rematch will be implemented when needed
        break;
    }
  }

  function broadcast(roomId: string, msg: ServerMessage): void {
    for (const client of clients) {
      if (client.roomId === roomId) {
        client.send(msg);
      }
    }
  }

  function addClient(client: WsClient): void {
    clients.add(client);
  }

  function removeClient(client: WsClient): void {
    clients.delete(client);
  }

  return { dispatch, broadcast, addClient, removeClient };
}
