import { describe, it, expect } from "vitest";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  canStart,
  startGame,
  endGame,
  requestRematch,
  isExpired,
  type Room,
  type RoomPhase,
} from "./room.js";
import { TIMINGS } from "@ludo/shared";

const S = 4;

describe("createRoom", () => {
  it("creates a room in lobby phase", () => {
    const room = createRoom("room-1", S, 1000);
    expect(room.id).toBe("room-1");
    expect(room.phase).toBe("lobby");
    expect(room.boardSize).toBe(S);
    expect(room.members.size).toBe(0);
    expect(room.ownerId).toBeNull();
    expect(room.gameId).toBeNull();
    expect(room.createdAt).toBe(1000);
  });
});

describe("joinRoom", () => {
  it("first player becomes owner", () => {
    const room = createRoom("room-1", S, 1000);
    const result = joinRoom(room, "p1", "Alice");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p1");
    expect(result.room.members.size).toBe(1);
    expect(result.room.members.get("p1")?.name).toBe("Alice");
    expect(result.room.members.get("p1")?.ready).toBe(false);
  });

  it("subsequent players join without becoming owner", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p2", "Bob");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p1");
    expect(result.room.members.size).toBe(2);
  });

  it("rejects when room is full", () => {
    let room = createRoom("room-1", S, 1000);
    for (let i = 1; i <= S; i++) {
      room = (joinRoom(room, `p${i}`, `Player${i}`) as { ok: true; room: Room }).room;
    }
    const result = joinRoom(room, "extra", "ExtraPlayer");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("room-full");
  });

  it("rejects duplicate player", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p1", "Alice");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("already-joined");
  });

  it("rejects when room is not in lobby phase", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = { ...room, phase: "playing" as RoomPhase };
    const result = joinRoom(room, "p3", "Charlie");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-in-lobby");
  });
});

describe("leaveRoom", () => {
  it("removes a non-owner player", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    const result = leaveRoom(room, "p2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.size).toBe(1);
    expect(result.room.ownerId).toBe("p1");
  });

  it("transfers ownership when owner leaves", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    const result = leaveRoom(room, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p2");
    expect(result.room.members.has("p1")).toBe(false);
  });

  it("sets ownerId to null when last player leaves", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = leaveRoom(room, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBeNull();
    expect(result.room.members.size).toBe(0);
  });

  it("rejects if player not in room", () => {
    const room = createRoom("room-1", S, 1000);
    const result = leaveRoom(room, "ghost");
    expect(result.ok).toBe(false);
  });
});

describe("setReady", () => {
  it("marks a player as ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = setReady(room, "p1", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.get("p1")?.ready).toBe(true);
  });

  it("marks a player as not ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    const result = setReady(room, "p1", false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.get("p1")?.ready).toBe(false);
  });

  it("rejects if player not in room", () => {
    const room = createRoom("room-1", S, 1000);
    const result = setReady(room, "ghost", true);
    expect(result.ok).toBe(false);
  });
});

describe("canStart", () => {
  it("returns true when owner, all ready, ≥2 players", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(true);
  });

  it("returns false when non-owner requests", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p2")).toBe(false);
  });

  it("returns false when not all players are ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", false) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(false);
  });

  it("returns false with fewer than 2 players", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(false);
  });

  it("returns false when not in lobby phase", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = { ...room, phase: "playing" as RoomPhase };
    expect(canStart(room, "p1")).toBe(false);
  });
});

describe("startGame", () => {
  it("transitions to playing phase with a gameId", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    const result = startGame(room, "p1", "game-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.phase).toBe("playing");
    expect(result.room.gameId).toBe("game-1");
  });

  it("rejects if canStart is false", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = startGame(room, "p1", "game-1");
    expect(result.ok).toBe(false);
  });
});

describe("endGame", () => {
  it("transitions to post-game phase with timestamp", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    const result = endGame(room, 5000);
    expect(result.phase).toBe("post-game");
    expect(result.gameEndedAt).toBe(5000);
  });
});

describe("requestRematch", () => {
  it("transitions back to lobby with players unreadied", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    const result = requestRematch(room, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.phase).toBe("lobby");
    expect(result.room.gameId).toBeNull();
    expect(result.room.gameEndedAt).toBeNull();
    // All players should be unreadied
    for (const member of result.room.members.values()) {
      expect(member.ready).toBe(false);
    }
  });

  it("rejects if not in post-game phase", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    const result = requestRematch(room, "p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-in-post-game");
  });

  it("rejects if non-owner requests", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    const result = requestRematch(room, "p2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-owner");
  });
});

describe("isExpired", () => {
  it("lobby room expires after idle timeout", () => {
    const room = createRoom("room-1", S, 1000);
    expect(isExpired(room, 1000 + TIMINGS.idleRoomExpiry + 1)).toBe(true);
  });

  it("lobby room not expired before timeout", () => {
    const room = createRoom("room-1", S, 1000);
    expect(isExpired(room, 1000 + TIMINGS.idleRoomExpiry - 1)).toBe(false);
  });

  it("post-game room expires after postGameWindow", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    expect(isExpired(room, 5000 + TIMINGS.postGameWindow + 1)).toBe(true);
  });

  it("post-game room not expired before postGameWindow", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    expect(isExpired(room, 5000 + TIMINGS.postGameWindow - 1)).toBe(false);
  });

  it("playing room never expires", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1", "Alice") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2", "Bob") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    expect(isExpired(room, 99999999999)).toBe(false);
  });
});
