import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter, type WsClient, type RoomStore } from "./router.js";
import type { ServerMessage, ClientMessage } from "@ludo/shared";
import { createRoom, joinRoom, setReady, type Room } from "../rooms/room.js";
import { initGame } from "../rooms/init-game.js";
import { createGameSession } from "../rooms/game-session.js";

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

  describe("lobby disconnect retains members", () => {
    it("keeps a disconnected member in the room and never transfers ownership", () => {
      const room = makeLobbyRoom(["p1", "p2"]); // p1 is owner
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      router.addClient(c1);
      router.addClient(c2);

      router.handleClose(c1); // owner disconnects

      const after = rooms.get("room-1")!;
      expect(after.members.has("p1")).toBe(true); // retained, not removed
      expect(after.ownerId).toBe("p1"); // ownership never moves
      expect(router.hasConnectedPlayers("room-1")).toBe(true); // p2 still here
    });

    it("broadcasts the disconnected member as not-connected", () => {
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      router.addClient(c1);
      router.addClient(c2);

      router.handleClose(c1);

      const lobbyMsg = (c2.send as ReturnType<typeof vi.fn>).mock.calls
        .map((call) => call[0] as ServerMessage)
        .reverse()
        .find((m): m is Extract<ServerMessage, { type: "lobby" }> => m.type === "lobby");
      expect(lobbyMsg).toBeDefined();
      const p1Entry = lobbyMsg!.players.find((p) => p.playerId === "p1");
      expect(p1Entry?.connected).toBe(false);
      expect(lobbyMsg!.ownerId).toBe("p1");
    });

    it("reports no connected players once everyone has disconnected", () => {
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      const c2 = makeMockClient("p2");
      router.addClient(c1);
      router.addClient(c2);

      router.handleClose(c1);
      router.handleClose(c2);

      expect(router.hasConnectedPlayers("room-1")).toBe(false);
      // Room and its members survive in memory until the expiry sweep reclaims it.
      expect(rooms.get("room-1")!.members.size).toBe(2);
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
  });

  describe("resync", () => {
    function setupRunningGame() {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      router.addClient(c1);
      router.dispatch(c1, { type: "start" });
      const session = router.getGameSession("room-1")!;
      (c1.send as ReturnType<typeof vi.fn>).mockClear();
      return { router, c1, session };
    }

    it("re-sends authoritative state to the requesting client", () => {
      const { router, c1 } = setupRunningGame();
      router.dispatch(c1, { type: "resync" });
      expect(c1.send).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }));
    });

    it("includes a turn message while awaiting a roll", () => {
      const { router, c1, session } = setupRunningGame();
      session.state.status = "rolling";
      router.dispatch(c1, { type: "resync" });
      expect(c1.send).toHaveBeenCalledWith(expect.objectContaining({ type: "turn" }));
    });

    it("omits the turn message mid-move so the client stays in moving", () => {
      const { router, c1, session } = setupRunningGame();
      session.state.status = "moving";
      session.state.diceValue = 3;
      router.dispatch(c1, { type: "resync" });
      const calls = (c1.send as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some((call) => call[0]?.type === "state")).toBe(true);
      expect(calls.some((call) => call[0]?.type === "turn")).toBe(false);
    });

    it("does nothing when the game has finished", () => {
      const { router, c1, session } = setupRunningGame();
      session.state.status = "finished";
      router.dispatch(c1, { type: "resync" });
      expect(c1.send).not.toHaveBeenCalled();
    });
  });

  // MOR-203: reconnect/resync must not mutate game state or reset the clock.
  describe("resync preserves state", () => {
    function setupTimedGame() {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      room.options = { ...room.options, timerEnabled: true };
      rooms.set("room-1", room);
      const router = createRouter(rooms);
      const c1 = makeMockClient("p1");
      router.addClient(c1);
      router.dispatch(c1, { type: "start" });
      const session = router.getGameSession("room-1")!;
      return { router, c1, session };
    }

    function sentMessages(c: WsClient): ServerMessage[] {
      return (c.send as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    }

    it("replays the live turn deadline instead of recomputing a fresh one", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-06-21T00:00:00Z"));
        const { router, c1, session } = setupTimedGame();
        const originalDeadline = session.turnDeadline;
        expect(originalDeadline).toBeGreaterThan(0);
        (c1.send as ReturnType<typeof vi.fn>).mockClear();

        // Player is disconnected for a while, then resyncs. The deadline must
        // be the turn's original deadline, not Date.now() + turnTimeout.
        vi.advanceTimersByTime(10_000);
        router.dispatch(c1, { type: "resync" });

        const turnMsg = sentMessages(c1).find((m) => m.type === "turn");
        expect(turnMsg).toMatchObject({ type: "turn", deadline: originalDeadline });
      } finally {
        vi.useRealTimers();
      }
    });

    it("re-sends an unchanged authoritative state across all fields", () => {
      const { router, c1, session } = setupTimedGame();
      // Put the session in a representative mid-game state.
      session.state.diceValue = 4;
      session.state.consecutiveSixes = 1;
      const before = structuredClone(session.state);
      (c1.send as ReturnType<typeof vi.fn>).mockClear();

      router.dispatch(c1, { type: "resync" });

      const stateMsg = sentMessages(c1).find((m) => m.type === "state");
      // Turn / active player, dice + phase, tokens, standings, sixes — all intact.
      expect(stateMsg).toMatchObject({ type: "state", state: before });
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

  // Server-restart resilience: in-progress games are persisted and restored.
  describe("game persistence", () => {
    function setupWithDeps() {
      let room = makeLobbyRoom(["p1", "p2"]);
      room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
      room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
      rooms.set("room-1", room);
      const persistGame = vi.fn();
      const completeGame = vi.fn();
      const router = createRouter(rooms, { persistGame, completeGame });
      const c1 = makeMockClient("p1");
      router.addClient(c1);
      return { router, c1, persistGame, completeGame };
    }

    it("persists the game when it starts", () => {
      const { router, c1, persistGame } = setupWithDeps();
      router.dispatch(c1, { type: "start" });
      const gameId = router.getGameSession("room-1")!.state.gameId;
      expect(persistGame).toHaveBeenCalledWith("room-1", gameId, expect.any(String));
    });

    it("flags the persisted game completed and enters post-game once it finishes", () => {
      const { router, c1, completeGame } = setupWithDeps();
      router.dispatch(c1, { type: "start" });
      const session = router.getGameSession("room-1")!;
      const gameId = session.state.gameId;
      // Force a finished game; a state-changing dispatch by the active player
      // routes through scheduleOrClear, which triggers cleanup.
      session.state.activeSeat = session.state.seats.find((s) => s.playerId === "p1")!.index;
      session.state.status = "finished";
      router.dispatch(c1, { type: "roll" });
      expect(completeGame).toHaveBeenCalledWith(gameId);
      // The room is kept alive in its post-game window, not destroyed, so the
      // result stays viewable and the same link can host a rematch.
      const room = rooms.get("room-1")!;
      expect(room.phase).toBe("post-game");
      expect(room.gameEndedAt).not.toBeNull();
    });

    it("restoreSession re-registers a game so it can be played", () => {
      const mockRng = { random: () => 0.5, rollDie: () => 3 };
      const room = makeLobbyRoom(["p1", "p2"]);
      rooms.set("room-1", room);
      const session = createGameSession(initGame(room, "game-1", mockRng));
      const router = createRouter(rooms);
      router.restoreSession("room-1", session);
      expect(router.getGameSession("room-1")).toBe(session);
    });
  });
});
