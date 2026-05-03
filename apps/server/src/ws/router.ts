import type { ClientMessage, ServerMessage } from "@ludo/shared";
import { setReady, type Room } from "../rooms/room.js";

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
