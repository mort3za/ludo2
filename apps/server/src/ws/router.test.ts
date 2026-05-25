import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter, type WsClient, type RoomStore } from "./router.js";
import type { ServerMessage, ClientMessage } from "@ludo/shared";
import { createRoom, joinRoom, setReady, type Room } from "../rooms/room.js";
import type { DebugStartState } from "../config/debug-start-state.js";

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
    room = (joinRoom(room, pid) as { ok: true; room: Room }).room;
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
      let room = makeLobbyRoom(["p1", "p2"]);
      // Ensure p1 starts unready so the toggle sets it to true
      room = (setReady(room, "p1", false) as { ok: true; room: Room }).room;
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

  describe("getGameSession", () => {
    it("returns undefined when no game is active", () => {
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      expect(router.getGameSession("room-1")).toBeUndefined();
    });

    it("returns the game session after start", () => {
      // Create a room with 4 players all ready
      let room = makeLobbyRoom(["p1", "p2", "p3", "p4"]);
      for (const pid of ["p1", "p2", "p3", "p4"]) {
        room = (setReady(room, pid, true) as { ok: true; room: Room }).room;
      }
      rooms.set("room-1", room);

      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      router.addClient(c1);

      router.dispatch(c1, { type: "start" });

      const session = router.getGameSession("room-1");
      expect(session).toBeDefined();
      expect(session!.state.status).toBe("rolling");
    });

    it("applies the configured debug start state when a game starts", () => {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      rooms.set("room-1", room);

      const debugStartState: DebugStartState = {
        status: "moving",
        activeSeat: 1,
        diceValue: 6,
        consecutiveSixes: 1,
        tokens: [{ id: "1-1", cell: "H/1/3" }],
      };

      const router = createRouter(rooms, { debugStartState });
      const c1 = makeMockClient("p1");
      router.addClient(c1);

      router.dispatch(c1, { type: "start" });

      const session = router.getGameSession("room-1");
      expect(session).toBeDefined();
      expect(session!.state.status).toBe("moving");
      expect(session!.state.diceValue).toBe(6);
      expect(session!.state.tokens.find((token) => token.id === "1-1")?.cell).toBe("H/1/3");
    });
  });

  describe("rematch", () => {
    function setupFinishedGame() {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      router.addClient(c1);
      router.addClient(c2);
      router.dispatch(c1, { type: "start" });
      const session = router.getGameSession("room-1")!;
      session.state.status = "finished";
      (c1.send as ReturnType<typeof vi.fn>).mockClear();
      (c2.send as ReturnType<typeof vi.fn>).mockClear();
      return { router, c1, c2, session };
    }

    it("returns error when sender is not owner", () => {
      const { router, c2 } = setupFinishedGame();
      router.dispatch(c2, { type: "rematch" });
      expect(c2.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", message: "not-owner" }),
      );
    });

    it("returns error when game is not finished", () => {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      router.addClient(c1);
      router.dispatch(c1, { type: "start" });
      (c1.send as ReturnType<typeof vi.fn>).mockClear();

      router.dispatch(c1, { type: "rematch" });

      expect(c1.send).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });

    it("broadcasts new state with same playerIds and empty standings", () => {
      const { router, c1, c2, session } = setupFinishedGame();
      const origPlayerIds = new Set(
        session.state.seats.filter((s) => s.playerId !== null).map((s) => s.playerId),
      );

      router.dispatch(c1, { type: "rematch" });

      const stateCall = (c1.send as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0]?.type === "state",
      );
      expect(stateCall).toBeDefined();
      const newState = stateCall![0].state;
      expect(newState.standings).toEqual([]);
      const newPlayerIds = new Set(
        newState.seats
          .filter((s: { playerId: string | null }) => s.playerId !== null)
          .map((s: { playerId: string }) => s.playerId),
      );
      expect(newPlayerIds).toEqual(origPlayerIds);
      expect(c2.send).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }));
    });

    it("broadcasts a new turn message after rematch", () => {
      const { router, c1 } = setupFinishedGame();
      router.dispatch(c1, { type: "rematch" });
      expect(c1.send).toHaveBeenCalledWith(expect.objectContaining({ type: "turn" }));
    });
  });
});
