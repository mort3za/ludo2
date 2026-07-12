import { describe, it, expect } from "vitest";
import { handleReconnect, type GameSession } from "./reconnect.js";
import { createGameLog, appendEntry, type GameSnapshot } from "../game/snapshots/game-log.js";
import type { PlayerColor } from "@ludo/shared";

function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    seats: [
      {
        index: 1,
        state: "active",
        color: "blue" as PlayerColor,
        playerId: "p1",
        consecutiveMisses: 0,
      },
      {
        index: 2,
        state: "active",
        color: "red" as PlayerColor,
        playerId: "p2",
        consecutiveMisses: 0,
      },
    ],
    tokens: [
      { id: "b1", color: "blue" as PlayerColor, cell: "Y/1/1" },
      { id: "r1", color: "red" as PlayerColor, cell: "Y/2/1" },
    ],
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    status: "rolling",
    ...overrides,
  };
}

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    gameId: "game-1",
    initialSnapshot: makeSnapshot(),
    log: createGameLog(),
    seatMisses: new Map([
      [1, 0],
      [2, 0],
    ]),
    ...overrides,
  };
}

describe("handleReconnect", () => {
  it("returns current state from replay for reconnecting player", () => {
    const log = appendEntry(createGameLog(), { type: "roll", seat: 1, value: 3 });
    const session = makeSession({ log });

    const result = handleReconnect(session, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.diceValue).toBe(3);
    expect(result.snapshot.status).toBe("moving");
  });

  it("returns full state after multiple log entries", () => {
    let log = createGameLog();
    log = appendEntry(log, { type: "roll", seat: 1, value: 6 });
    log = appendEntry(log, { type: "move", seat: 1, tokenId: "b1", from: "Y/1/1", to: "T/1" });
    log = appendEntry(log, { type: "end-turn", seat: 1, nextSeat: 2 });
    const session = makeSession({ log });

    const result = handleReconnect(session, "p2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.activeSeat).toBe(2);
    expect(result.snapshot.diceValue).toBeNull();
    const b1 = result.snapshot.tokens.find((t) => t.id === "b1");
    expect(b1?.cell).toBe("T/1");
  });

  it("does not reset missed-turn counter on reconnect", () => {
    const session = makeSession({
      seatMisses: new Map([
        [1, 2],
        [2, 0],
      ]),
    });

    const result = handleReconnect(session, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Missed-turn counter should remain unchanged
    expect(session.seatMisses.get(1)).toBe(2);
  });

  it("rejects reconnect for unknown player", () => {
    const session = makeSession();
    const result = handleReconnect(session, "ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not-in-game");
  });

  it("returns empty-log snapshot when no entries exist", () => {
    const session = makeSession();
    const result = handleReconnect(session, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.activeSeat).toBe(1);
    expect(result.snapshot.diceValue).toBeNull();
  });
});
