import { describe, it, expect } from "vitest";
import {
  createRoom,
  joinRoom,
  removeMember,
  setReady,
  canStart,
  startGame,
  endGame,
  requestRematch,
  isExpired,
  addBotMember,
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
  it("first player becomes owner and is named Player1", () => {
    const room = createRoom("room-1", S, 1000);
    const result = joinRoom(room, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p1");
    expect(result.room.members.size).toBe(1);
    expect(result.room.members.get("p1")?.name).toBe("Player1");
    expect(result.room.members.get("p1")?.ready).toBe(false);
  });

  it("auto-assigns Player1..PlayerN by join order", () => {
    let room = createRoom("room-1", S, 1000);
    for (let i = 1; i <= S; i++) {
      room = (joinRoom(room, `p${i}`) as { ok: true; room: Room }).room;
    }
    expect(room.members.get("p1")?.name).toBe("Player1");
    expect(room.members.get("p2")?.name).toBe("Player2");
    expect(room.members.get("p3")?.name).toBe("Player3");
    expect(room.members.get("p4")?.name).toBe("Player4");
  });

  it("reuses the lowest free slot after a member leaves", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p3") as { ok: true; room: Room }).room;
    room = (removeMember(room, "p2") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p4");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.get("p4")?.name).toBe("Player2");
    expect(result.room.members.get("p1")?.name).toBe("Player1");
    expect(result.room.members.get("p3")?.name).toBe("Player3");
  });

  it("subsequent players join without becoming owner", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p1");
    expect(result.room.members.size).toBe(2);
  });

  it("rejects when room is full", () => {
    let room = createRoom("room-1", S, 1000);
    for (let i = 1; i <= S; i++) {
      room = (joinRoom(room, `p${i}`) as { ok: true; room: Room }).room;
    }
    const result = joinRoom(room, "extra");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("room-full");
  });

  it("rejects duplicate player", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("already-joined");
  });

  it("rejects when room is not in lobby phase", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = { ...room, phase: "playing" as RoomPhase };
    const result = joinRoom(room, "p3");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-in-lobby");
  });
});

// Ownership is sticky: assigned to the first human to join, never reassigned.
describe("ownership stickiness", () => {
  it("keeps ownership with the original owner when a later player joins", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = joinRoom(room, "p2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("p1");
  });

  it("does not transfer ownership to a new joiner while the owner is absent from members", () => {
    // Mirrors the disconnect+join race: the owner is gone from the members map
    // (or yet to reconnect), yet ownerId must still point at them — a fresh
    // joiner must never seize the room.
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "owner") as { ok: true; room: Room }).room;
    room = { ...room, members: new Map() };
    const result = joinRoom(room, "late");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("owner");
    expect(result.room.members.has("late")).toBe(true);
  });

  it("re-grants ownership to the original owner on rejoin (stable playerId)", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "owner") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    // Owner drops out of members, p2 stays, then the owner reconnects.
    const membersWithoutOwner = new Map(room.members);
    membersWithoutOwner.delete("owner");
    room = { ...room, members: membersWithoutOwner };
    const result = joinRoom(room, "owner");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.ownerId).toBe("owner");
  });
});

describe("setReady", () => {
  it("marks a player as ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = setReady(room, "p1", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.get("p1")?.ready).toBe(true);
  });

  it("marks a player as not ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
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
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(true);
  });

  it("returns false when non-owner requests", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p2")).toBe(false);
  });

  it("returns false when not all players are ready", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", false) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(false);
  });

  it("returns false with fewer than 2 players", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    expect(canStart(room, "p1")).toBe(false);
  });

  it("returns false when not in lobby phase", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = { ...room, phase: "playing" as RoomPhase };
    expect(canStart(room, "p1")).toBe(false);
  });
});

describe("startGame", () => {
  it("transitions to playing phase with a gameId", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
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
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = startGame(room, "p1", "game-1");
    expect(result.ok).toBe(false);
  });
});

describe("endGame", () => {
  it("transitions to post-game phase with timestamp", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
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
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
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
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    const result = requestRematch(room, "p1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-in-post-game");
  });

  it("rejects if non-owner requests", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
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
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    expect(isExpired(room, 5000 + TIMINGS.postGameWindow + 1)).toBe(true);
  });

  it("post-game room not expired before postGameWindow", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    room = endGame(room, 5000);
    expect(isExpired(room, 5000 + TIMINGS.postGameWindow - 1)).toBe(false);
  });

  it("playing room never expires", () => {
    let room = createRoom("room-1", S, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (setReady(room, "p2", true) as { ok: true; room: Room }).room;
    room = (startGame(room, "p1", "game-1") as { ok: true; room: Room }).room;
    expect(isExpired(room, 99999999999)).toBe(false);
  });
});

describe("addBotMember", () => {
  it("adds a bot member with auto-assigned name", () => {
    const room = createRoom("room-1", 2, 1000);
    const result = addBotMember(room);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.members.size).toBe(1);
    const bot = [...result.room.members.values()][0]!;
    expect(bot.kind).toBe("bot");
    expect(bot.ready).toBe(true);
    expect(bot.name).toBe("Bot_1");
  });

  it("bot names are independent of the human PlayerN sequence", () => {
    let room = createRoom("room-1", 4, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room; // Player1
    const result = addBotMember(room);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const members = [...result.room.members.values()];
    const bot = members.find((m) => m.kind === "bot")!;
    expect(bot.name).toBe("Bot_1");
  });

  it("two bots get sequential names", () => {
    let room = createRoom("room-1", 4, 1000);
    room = (addBotMember(room) as { ok: true; room: Room }).room;
    room = (addBotMember(room) as { ok: true; room: Room }).room;
    const names = [...room.members.values()].map((m) => m.name);
    expect(names).toContain("Bot_1");
    expect(names).toContain("Bot_2");
  });

  it("returns error when room is full", () => {
    let room = createRoom("room-1", 1, 1000);
    room = (addBotMember(room) as { ok: true; room: Room }).room;
    const result = addBotMember(room);
    expect(result.ok).toBe(false);
  });

  it("canStart counts bot ready state", () => {
    let room = createRoom("room-1", 2, 1000);
    room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
    room = (setReady(room, "p1", true) as { ok: true; room: Room }).room;
    room = (addBotMember(room) as { ok: true; room: Room }).room;
    // Bot is auto-ready — owner can start
    expect(canStart(room, "p1")).toBe(true);
  });

  it("assigns a personality to each bot", () => {
    const room = createRoom("room-1", 2, 1000);
    const result = addBotMember(room);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bot = [...result.room.members.values()][0]!;
    expect(bot.personality).toBeDefined();
    expect(["aggressor", "defender", "sprinter"]).toContain(bot.personality);
  });

  it("uses injected personality selector for deterministic assignment", () => {
    const personalities = ["aggressor" as const, "defender" as const, "sprinter" as const];
    let room = createRoom("room-1", 4, 1000);

    for (const pers of personalities) {
      const picker = () => pers;
      const result = addBotMember(room, picker);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      room = result.room;
      const newBot = [...room.members.values()].find((m) => m.personality === pers)!;
      expect(newBot.personality).toBe(pers);
    }
  });
});
