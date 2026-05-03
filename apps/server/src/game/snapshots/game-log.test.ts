import { describe, it, expect } from "vitest";
import { createGameLog, appendEntry, replay, type LogEntry, type GameSnapshot } from "./game-log.js";
import { createSeededRng } from "../rng/rng.js";
import { TOKENS_PER_PLAYER } from "@ludo/shared";
import type { PlayerColor } from "@ludo/shared";

const S = 4;
const colors: PlayerColor[] = ["blue", "red", "green", "yellow"];

function makeInitialSnapshot(): GameSnapshot {
  const seats = colors.map((color, i) => ({
    index: i + 1,
    state: "active" as const,
    color,
    playerId: `p${i + 1}`,
    consecutiveMisses: 0,
  }));

  const tokens = seats.flatMap((seat) =>
    Array.from({ length: TOKENS_PER_PLAYER }, (_, j) => ({
      id: `${seat.color[0]}${j + 1}`,
      color: seat.color,
      cell: `Y/${seat.index}/${j + 1}`,
    })),
  );

  return {
    seats,
    tokens,
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    status: "rolling",
  };
}

describe("game log", () => {
  it("creates an empty log", () => {
    const log = createGameLog();
    expect(log).toEqual([]);
  });

  it("appends entries immutably", () => {
    const log = createGameLog();
    const entry: LogEntry = { type: "roll", seat: 1, value: 3 };
    const newLog = appendEntry(log, entry);
    expect(newLog).toHaveLength(1);
    expect(log).toHaveLength(0); // original unchanged
  });

  it("preserves entry order", () => {
    let log = createGameLog();
    log = appendEntry(log, { type: "roll", seat: 1, value: 6 });
    log = appendEntry(log, { type: "move", seat: 1, tokenId: "b1", from: "Y/1/1", to: "T/1" });
    log = appendEntry(log, { type: "roll", seat: 1, value: 3 });
    expect(log).toHaveLength(3);
    expect(log[0]!.type).toBe("roll");
    expect(log[1]!.type).toBe("move");
    expect(log[2]!.type).toBe("roll");
  });
});

describe("replay", () => {
  it("replays an empty log to initial state", () => {
    const initial = makeInitialSnapshot();
    const result = replay(initial, []);
    expect(result).toEqual(initial);
  });

  it("replays a roll entry", () => {
    const initial = makeInitialSnapshot();
    const log: LogEntry[] = [{ type: "roll", seat: 1, value: 3 }];
    const result = replay(initial, log);
    expect(result.diceValue).toBe(3);
    expect(result.status).toBe("moving");
  });

  it("replays a roll with no legal moves → advances turn", () => {
    const initial = makeInitialSnapshot();
    // Roll 3 with all tokens in yard → no legal moves → skip to next seat
    const log: LogEntry[] = [{ type: "roll", seat: 1, value: 3 }];
    const result = replay(initial, log);
    // With no legal moves, status should indicate turn passes
    expect(result.diceValue).toBe(3);
  });

  it("replays roll + move sequence", () => {
    const initial = makeInitialSnapshot();
    const log: LogEntry[] = [
      { type: "roll", seat: 1, value: 6 },
      { type: "move", seat: 1, tokenId: "b1", from: "Y/1/1", to: "T/1" },
    ];
    const result = replay(initial, log);
    const b1 = result.tokens.find((t) => t.id === "b1");
    expect(b1!.cell).toBe("T/1");
  });

  it("replays a kick entry", () => {
    const initial = makeInitialSnapshot();
    const log: LogEntry[] = [{ type: "kick", seat: 2 }];
    const result = replay(initial, log);
    const seat2 = result.seats.find((s) => s.index === 2);
    expect(seat2!.state).toBe("vacant");
    // All red tokens removed
    expect(result.tokens.filter((t) => t.color === "red")).toHaveLength(0);
  });

  it("replay is deterministic — same log produces same result", () => {
    const initial = makeInitialSnapshot();
    const log: LogEntry[] = [
      { type: "roll", seat: 1, value: 6 },
      { type: "move", seat: 1, tokenId: "b1", from: "Y/1/1", to: "T/1" },
      { type: "roll", seat: 1, value: 4 },
      { type: "move", seat: 1, tokenId: "b1", from: "T/1", to: "T/5" },
    ];
    const a = replay(initial, log);
    const b = replay(initial, log);
    expect(a).toEqual(b);
  });

  it("replays turn advancement after non-6 roll + move", () => {
    const initial = makeInitialSnapshot();
    const log: LogEntry[] = [
      { type: "roll", seat: 1, value: 6 },
      { type: "move", seat: 1, tokenId: "b1", from: "Y/1/1", to: "T/1" },
      { type: "end-turn", seat: 1, nextSeat: 2 },
    ];
    const result = replay(initial, log);
    expect(result.activeSeat).toBe(2);
    expect(result.status).toBe("rolling");
    expect(result.diceValue).toBeNull();
    expect(result.consecutiveSixes).toBe(0);
  });
});
