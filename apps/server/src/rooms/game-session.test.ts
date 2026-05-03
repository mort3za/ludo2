import { describe, it, expect } from "vitest";
import { createGameSession, handleRoll, handleMove, handleTimeout } from "./game-session.js";
import type { GameState, Seat, Token } from "@ludo/shared";
import { HOME_COLUMN_LENGTH, TOKENS_PER_PLAYER, TIMINGS } from "@ludo/shared";

function makeState(overrides: Partial<GameState> = {}): GameState {
  const seats: Seat[] = [
    { index: 1, state: "active", color: "blue", playerId: "p1" },
    { index: 2, state: "active", color: "red", playerId: "p2" },
  ];
  return {
    gameId: "test-game",
    status: "rolling",
    seats,
    tokens: [],
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    ...overrides,
  };
}

/** Create a token already at home end (finished). */
function finishedToken(seat: number, slot: number, color: "blue" | "red"): Token {
  return { id: `${seat}-${slot}`, color, cell: `H/${seat}/${HOME_COLUMN_LENGTH}` };
}

describe("handleMove — standings and finished", () => {
  it("updates standings when a seat finishes all tokens", () => {
    // Seat 1 has 3 tokens home, 1 token at H/1/3 about to finish with dice=1
    const tokens: Token[] = [
      finishedToken(1, 1, "blue"),
      finishedToken(1, 2, "blue"),
      finishedToken(1, 3, "blue"),
      { id: "1-4", color: "blue", cell: `H/1/${HOME_COLUMN_LENGTH - 1}` },
      // Seat 2 tokens in yard
      { id: "2-1", color: "red", cell: "Y/2/1" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({
      tokens,
      activeSeat: 1,
      status: "moving",
      diceValue: 1,
    });

    const session = createGameSession(state);
    const msgs = handleMove(session, "1-4");

    // Seat 1 should be in standings
    expect(session.state.standings).toContain(1);
  });

  it("emits finished when only one active seat remains (2-seat game)", () => {
    // Seat 1 finishes all tokens → seat 2 is sole survivor → game over
    const tokens: Token[] = [
      finishedToken(1, 1, "blue"),
      finishedToken(1, 2, "blue"),
      finishedToken(1, 3, "blue"),
      { id: "1-4", color: "blue", cell: `H/1/${HOME_COLUMN_LENGTH - 1}` },
      { id: "2-1", color: "red", cell: "Y/2/1" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({
      tokens,
      activeSeat: 1,
      status: "moving",
      diceValue: 1,
    });

    const session = createGameSession(state);
    const msgs = handleMove(session, "1-4");

    // standings should be [1, 2] — seat 1 finished, seat 2 auto-placed as sole survivor
    expect(session.state.standings).toEqual([1, 2]);
    expect(session.state.status).toBe("finished");

    const finishedMsg = msgs.find((m) => m.type === "finished");
    expect(finishedMsg).toBeDefined();
    expect(finishedMsg).toEqual({ type: "finished", standings: [1, 2] });
  });

  it("does not emit finished if other seats still playing", () => {
    // 3-seat game: seat 1 finishes, seats 2 & 3 still active
    const seats: Seat[] = [
      { index: 1, state: "active", color: "blue", playerId: "p1" },
      { index: 2, state: "active", color: "red", playerId: "p2" },
      { index: 3, state: "active", color: "green", playerId: "p3" },
    ];
    const tokens: Token[] = [
      finishedToken(1, 1, "blue"),
      finishedToken(1, 2, "blue"),
      finishedToken(1, 3, "blue"),
      { id: "1-4", color: "blue", cell: `H/1/${HOME_COLUMN_LENGTH - 1}` },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
      { id: "3-1", color: "green", cell: "T/27" },
      { id: "3-2", color: "green", cell: "Y/3/2" },
      { id: "3-3", color: "green", cell: "Y/3/3" },
      { id: "3-4", color: "green", cell: "Y/3/4" },
    ];

    const state = makeState({
      seats,
      tokens,
      activeSeat: 1,
      status: "moving",
      diceValue: 1,
    });

    const session = createGameSession(state);
    const msgs = handleMove(session, "1-4");

    // Seat 1 is in standings, but game continues
    expect(session.state.standings).toEqual([1]);
    expect(session.state.status).not.toBe("finished");

    const finishedMsg = msgs.find((m) => m.type === "finished");
    expect(finishedMsg).toBeUndefined();

    // Turn should advance (skip seat 1 since it finished)
    const turnMsg = msgs.find((m) => m.type === "turn");
    expect(turnMsg).toBeDefined();
  });

  it("skips finished seats in turn advancement", () => {
    // 3-seat game, seat 1 already finished, seat 2 moves
    const seats: Seat[] = [
      { index: 1, state: "active", color: "blue", playerId: "p1" },
      { index: 2, state: "active", color: "red", playerId: "p2" },
      { index: 3, state: "active", color: "green", playerId: "p3" },
    ];
    const tokens: Token[] = [
      finishedToken(1, 1, "blue"),
      finishedToken(1, 2, "blue"),
      finishedToken(1, 3, "blue"),
      finishedToken(1, 4, "blue"),
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
      { id: "3-1", color: "green", cell: "T/27" },
      { id: "3-2", color: "green", cell: "Y/3/2" },
      { id: "3-3", color: "green", cell: "Y/3/3" },
      { id: "3-4", color: "green", cell: "Y/3/4" },
    ];

    const state = makeState({
      seats,
      tokens,
      activeSeat: 2,
      status: "moving",
      diceValue: 3,
      standings: [1],
    });

    const session = createGameSession(state);
    const msgs = handleMove(session, "2-1");

    // Turn should go to seat 3 (skipping finished seat 1)
    const turnMsg = msgs.find((m) => m.type === "turn");
    expect(turnMsg).toBeDefined();
    if (turnMsg && turnMsg.type === "turn") {
      expect(turnMsg.seat).toBe(3);
    }
  });
});

describe("handleTimeout", () => {
  it("advances turn on timeout", () => {
    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "T/1" },
      { id: "1-2", color: "blue", cell: "Y/1/2" },
      { id: "1-3", color: "blue", cell: "Y/1/3" },
      { id: "1-4", color: "blue", cell: "Y/1/4" },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({ tokens, activeSeat: 1, status: "rolling" });
    const session = createGameSession(state);

    const msgs = handleTimeout(session);
    const turnMsg = msgs.find((m) => m.type === "turn");
    expect(turnMsg).toBeDefined();
    if (turnMsg && turnMsg.type === "turn") {
      expect(turnMsg.seat).toBe(2);
    }
  });

  it("increments miss counter each timeout", () => {
    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "T/1" },
      { id: "1-2", color: "blue", cell: "Y/1/2" },
      { id: "1-3", color: "blue", cell: "Y/1/3" },
      { id: "1-4", color: "blue", cell: "Y/1/4" },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({ tokens, activeSeat: 1, status: "rolling" });
    const session = createGameSession(state);

    handleTimeout(session);
    expect(session.seatMisses.get(1)).toBe(1);
  });

  it("kicks after 3 consecutive timeouts (2-seat game → finished)", () => {
    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "T/1" },
      { id: "1-2", color: "blue", cell: "Y/1/2" },
      { id: "1-3", color: "blue", cell: "Y/1/3" },
      { id: "1-4", color: "blue", cell: "Y/1/4" },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({ tokens, activeSeat: 1, status: "rolling" });
    const session = createGameSession(state);

    // Set miss counter to 2 (one more to kick)
    session.seatMisses.set(1, 2);

    const msgs = handleTimeout(session);

    const kickedMsg = msgs.find((m) => m.type === "kicked");
    expect(kickedMsg).toBeDefined();
    if (kickedMsg && kickedMsg.type === "kicked") {
      expect(kickedMsg.seat).toBe(1);
    }

    // With only 2 seats, kicking seat 1 → seat 2 sole survivor → finished
    expect(session.state.status).toBe("finished");
    const finishedMsg = msgs.find((m) => m.type === "finished");
    expect(finishedMsg).toBeDefined();
  });

  it("kick in 3-seat game advances turn to next active seat", () => {
    const seats: Seat[] = [
      { index: 1, state: "active", color: "blue", playerId: "p1" },
      { index: 2, state: "active", color: "red", playerId: "p2" },
      { index: 3, state: "active", color: "green", playerId: "p3" },
    ];
    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "T/1" },
      { id: "1-2", color: "blue", cell: "Y/1/2" },
      { id: "1-3", color: "blue", cell: "Y/1/3" },
      { id: "1-4", color: "blue", cell: "Y/1/4" },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
      { id: "3-1", color: "green", cell: "T/27" },
      { id: "3-2", color: "green", cell: "Y/3/2" },
      { id: "3-3", color: "green", cell: "Y/3/3" },
      { id: "3-4", color: "green", cell: "Y/3/4" },
    ];

    const state = makeState({ seats, tokens, activeSeat: 1, status: "rolling" });
    const session = createGameSession(state);
    session.seatMisses.set(1, 2);

    const msgs = handleTimeout(session);

    const kickedMsg = msgs.find((m) => m.type === "kicked");
    expect(kickedMsg).toBeDefined();

    // Game continues — turn advances to seat 2
    expect(session.state.status).not.toBe("finished");
    const turnMsg = msgs.find((m) => m.type === "turn");
    expect(turnMsg).toBeDefined();
    if (turnMsg && turnMsg.type === "turn") {
      expect(turnMsg.seat).toBe(2);
    }
  });
});
