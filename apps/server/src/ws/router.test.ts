import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter, type WsClient, type RoomStore } from "./router.js";
import type { ServerMessage, ClientMessage } from "@ludo/shared";
import { createRoom, joinRoom, setReady, type Room } from "../rooms/room.js";

function makeMockClient(playerId: string): WsClient {
  return {
    playerId,
    roomId: "room-1",
    send: vi.fn(),
  };
}

function makeLobbyRoom(players: string[]): Room {
  let room = createRoom("room-1", 4, 1000);
  for (const pid of players) {
    room = (joinRoom(room, pid, `Name-${pid}`) as { ok: true; room: Room }).room;
  }
  return room;
}

describe("WS router", () => {
  let rooms: RoomStore;

  beforeEach(() => {
    rooms = new Map();
  });

  describe("dispatch", () => {
    it("dispatches ready message to room", () => {
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const client = makeMockClient("p1");
      const router = createRouter(rooms);

      router.dispatch(client, { type: "ready" });

      const updated = rooms.get("room-1")!;
      expect(updated.members.get("p1")?.ready).toBe(true);
    });

    it("sends error for unknown room", () => {
      const client = makeMockClient("p1");
      client.roomId = "nonexistent";
      const router = createRouter(rooms);

      router.dispatch(client, { type: "ready" });

      expect(client.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", message: "room-not-found" }),
      );
    });

    it("sends error for player not in room", () => {
      const room = makeLobbyRoom(["p1"]);
      rooms.set("room-1", room);
      const client = makeMockClient("ghost");
      const router = createRouter(rooms);

      router.dispatch(client, { type: "ready" });

      expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });
  });

  describe("broadcast", () => {
    it("broadcasts to all clients in a room", () => {
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);

      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      router.addClient(c1);
      router.addClient(c2);

      const msg: ServerMessage = { type: "error", message: "test" };
      router.broadcast("room-1", msg);

      expect(c1.send).toHaveBeenCalledWith(msg);
      expect(c2.send).toHaveBeenCalledWith(msg);
    });

    it("does not broadcast to clients in other rooms", () => {
      const room = makeLobbyRoom(["p1"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);

      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      c2.roomId = "other-room";
      router.addClient(c1);
      router.addClient(c2);

      const msg: ServerMessage = { type: "error", message: "test" };
      router.broadcast("room-1", msg);

      expect(c1.send).toHaveBeenCalledWith(msg);
      expect(c2.send).not.toHaveBeenCalled();
    });

    it("removeClient stops receiving broadcasts", () => {
      const room = makeLobbyRoom(["p1"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);

      const c1 = makeMockClient("p1");
      router.addClient(c1);
      router.removeClient(c1);

      const msg: ServerMessage = { type: "error", message: "test" };
      router.broadcast("room-1", msg);

      expect(c1.send).not.toHaveBeenCalled();
    });
  });
});
