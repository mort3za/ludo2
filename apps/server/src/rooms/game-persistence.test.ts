import { describe, it, expect } from "vitest";
import { createRoom, joinRoom, type Room } from "./room.js";
import { initGame } from "./init-game.js";
import { createGameSession } from "./game-session.js";
import { serializeGame, deserializeGame } from "./game-persistence.js";
import type { Rng } from "../game/rng/rng.js";

const mockRng: Rng = { random: () => 0.5, rollDie: () => 3 };

function setup(): { room: Room; gameId: string } {
  let room = createRoom("room-1", 4, 1000);
  room.options = { ...room.options, timerEnabled: true };
  room = (joinRoom(room, "p1") as { ok: true; room: Room }).room;
  room = (joinRoom(room, "p2") as { ok: true; room: Room }).room;
  return { room, gameId: "game-1" };
}

describe("game persistence round-trip", () => {
  it("restores the full game state, roster, and metadata", () => {
    const { room, gameId } = setup();
    const session = createGameSession(initGame(room, gameId, mockRng));
    // Mid-game mutations that must survive the round-trip.
    session.state.diceValue = 5;
    session.state.consecutiveSixes = 2;
    session.state.activeSeat = 2;
    session.seatMisses.set(1, 2);

    const restored = deserializeGame("room-1", serializeGame(room, session), 9999);
    expect(restored).not.toBeNull();
    if (!restored) return;

    // GameState is byte-for-byte equivalent.
    expect(restored.session.state).toEqual(session.state);
    // Missed-turn counters preserved (kick rule stays correct).
    expect([...restored.session.seatMisses.entries()]).toEqual([[1, 2]]);
    // Room is resumed in the playing phase with the same roster + owner.
    expect(restored.room.phase).toBe("playing");
    expect(restored.room.gameId).toBe(gameId);
    expect(restored.room.ownerId).toBe(room.ownerId);
    expect([...restored.room.members.keys()].sort()).toEqual(["p1", "p2"]);
    expect(restored.room.options).toEqual(session.state.options);
  });

  it("starts a fresh turn clock when the timer is enabled", () => {
    const { room, gameId } = setup();
    const session = createGameSession(initGame(room, gameId, mockRng));

    const restored = deserializeGame("room-1", serializeGame(room, session), 9999)!;
    // colorToSeat is recomputed from seats, deadline is reset (not 0) for a timed game.
    expect(restored.session.turnDeadline).toBeGreaterThan(0);
    expect(restored.session.colorToSeat).toEqual(session.colorToSeat);
  });

  it("returns null for malformed JSON", () => {
    expect(deserializeGame("room-1", "not json", 1)).toBeNull();
  });
});
