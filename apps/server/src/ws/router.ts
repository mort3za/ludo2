import type { ClientMessage, ServerMessage } from "@ludo/shared";
import { setReady, canStart, startGame, type Room } from "../rooms/room.js";
import { initGame } from "../rooms/init-game.js";
import { createCryptoRng } from "../game/rng/rng.js";

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
              broadcast(client.roomId, { type: "state", state });
            }
          }
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }
      case "roll":
      case "move":
      case "rematch":
        // These will be dispatched to the game engine in later phases
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
