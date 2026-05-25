import { describe, it, expect } from "vitest";
import { initGame } from "./init-game.js";
import { createRoom, joinRoom } from "./room.js";
import { createSeededRng } from "../game/rng/rng.js";
import { TOKENS_PER_PLAYER } from "@ludo/shared";
import type { DebugStartState } from "../config/debug-start-state.js";

function makeRoom(playerCount: number, boardSize: number) {
  let room = createRoom("room-1", boardSize, Date.now());
  for (let i = 1; i <= playerCount; i++) {
    const result = joinRoom(room, `p${i}`);
    if (!result.ok) throw new Error(result.error);
    room = result.room;
  }
  return room;
}

describe("initGame", () => {
  it("2-player S=4 assigns seats 1 and 3", () => {
    const room = makeRoom(2, 4);
    const state = initGame(room, "g1", createSeededRng(1));

    const active = state.seats.filter((s) => s.state === "active");
    const empty = state.seats.filter((s) => s.state === "empty");

    expect(active.map((s) => s.index)).toEqual([1, 3]);
    expect(empty.map((s) => s.index)).toEqual([2, 4]);

    expect(active[0]!.playerId).toBe("p1");
    expect(active[1]!.playerId).toBe("p2");
  });

  it("2-player S=4 creates tokens only for seats 1 and 3", () => {
    const room = makeRoom(2, 4);
    const state = initGame(room, "g1", createSeededRng(1));

    const seatIndices = [...new Set(state.tokens.map((t) => Number(t.id.split("-")[0])))].sort();
    expect(seatIndices).toEqual([1, 3]);
    expect(state.tokens).toHaveLength(2 * TOKENS_PER_PLAYER);
  });

  it("2-player S=4 activeSeat is 1", () => {
    const room = makeRoom(2, 4);
    const state = initGame(room, "g1", createSeededRng(1));

    expect(state.activeSeat).toBe(1);
  });

  it("4-player S=4 assigns seats sequentially", () => {
    const room = makeRoom(4, 4);
    const state = initGame(room, "g1", createSeededRng(1));

    const active = state.seats.filter((s) => s.state === "active");
    expect(active.map((s) => s.index)).toEqual([1, 2, 3, 4]);
    expect(active.map((s) => s.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("3-player S=4 assigns seats 1, 2, 3 sequentially", () => {
    const room = makeRoom(3, 4);
    const state = initGame(room, "g1", createSeededRng(1));

    const active = state.seats.filter((s) => s.state === "active");
    expect(active.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(state.seats[3]!.state).toBe("empty");
  });

  it("applies validated debug token overrides on top of the room-derived base state", () => {
    const room = makeRoom(2, 4);
    const debugState: DebugStartState = {
      status: "moving",
      activeSeat: 1,
      diceValue: 6,
      consecutiveSixes: 1,
      standings: [],
      tokens: [
        { id: "1-1", cell: "H/1/3" },
        { id: "3-4", cell: "T/24" },
      ],
    };

    const state = initGame(room, "g1", createSeededRng(1), debugState);

    expect(state.status).toBe("moving");
    expect(state.activeSeat).toBe(1);
    expect(state.diceValue).toBe(6);
    expect(state.consecutiveSixes).toBe(1);
    expect(state.tokens.find((token) => token.id === "1-1")?.cell).toBe("H/1/3");
    expect(state.tokens.find((token) => token.id === "3-4")?.cell).toBe("T/24");
    expect(state.seats.map((seat) => seat.playerId)).toEqual(["p1", null, "p2", null]);
  });
});
