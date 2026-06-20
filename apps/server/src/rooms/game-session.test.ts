import { describe, it, expect, vi } from "vitest";
import { createGameSession, handleRoll, handleMove, handleTimeout } from "./game-session.js";
import type { GameState, Seat, Token } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";
import { makeState as buildState } from "../test/make-state.js";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return buildState({ gameId: "test-game", ...overrides });
}

/** A token resting on a distinct home cell (no stacking — one token per cell). */
function homeToken(seat: number, index: number, color: "blue" | "red"): Token {
  return { id: `${seat}-h${index}`, color, cell: `H/${seat}/${index}` };
}

/**
 * Track cell one step before seat 1's home entry, so a roll of 1 lands exactly
 * on the last empty home cell H/1/1 (deepest cells fill first). Derived per
 * board size: entry = T/(S*11), so this is T/(S*11 - 1).
 */
function entryApproach(S: number): string {
  return `T/${S * 11 - 1}`;
}

describe("handleMove — standings and finished", () => {
  it("updates standings when a seat finishes all tokens", () => {
    // Seat 1 (2-seat game) has the 3 deepest home cells filled; the last token
    // approaches from the track and a roll of 1 lands on the final empty cell H/1/1.
    const tokens: Token[] = [
      homeToken(1, 2, "blue"),
      homeToken(1, 3, "blue"),
      homeToken(1, 4, "blue"),
      { id: "1-4", color: "blue", cell: entryApproach(2) },
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
      homeToken(1, 2, "blue"),
      homeToken(1, 3, "blue"),
      homeToken(1, 4, "blue"),
      { id: "1-4", color: "blue", cell: entryApproach(2) },
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
      { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
      { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
      { index: 3, state: "active", color: "green", playerId: "p3", isBot: false },
    ];
    const tokens: Token[] = [
      homeToken(1, 2, "blue"),
      homeToken(1, 3, "blue"),
      homeToken(1, 4, "blue"),
      { id: "1-4", color: "blue", cell: entryApproach(3) },
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
      { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
      { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
      { index: 3, state: "active", color: "green", playerId: "p3", isBot: false },
    ];
    const tokens: Token[] = [
      homeToken(1, 1, "blue"),
      homeToken(1, 2, "blue"),
      homeToken(1, 3, "blue"),
      homeToken(1, 4, "blue"),
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

describe("handleMove — capture", () => {
  it("emits captured message with the new yard cell", () => {
    // Blue on T/5, red on T/8 — blue rolls 3 and captures red
    const tokens: Token[] = [
      { id: "b1", color: "blue", cell: "T/5" },
      { id: "r1", color: "red", cell: "T/8" },
      { id: "r2", color: "red", cell: "Y/2/1" },
      { id: "r3", color: "red", cell: "Y/2/2" },
      { id: "r4", color: "red", cell: "Y/2/3" },
    ];
    const state = makeState({ tokens, activeSeat: 1, status: "moving", diceValue: 3 });
    const session = createGameSession(state);
    const msgs = handleMove(session, "b1");

    const capturedMsg = msgs.find((m) => m.type === "captured");
    expect(capturedMsg).toBeDefined();
    if (capturedMsg && capturedMsg.type === "captured") {
      expect(capturedMsg.tokenId).toBe("r1");
      expect(capturedMsg.to).toMatch(/^Y\/2\//);
    }
  });

  it("captures a token standing on a start square", () => {
    const tokens: Token[] = [
      { id: "b1", color: "blue", cell: "Y/1/1" },
      { id: "r1", color: "red", cell: "T/1" },
      { id: "r2", color: "red", cell: "Y/2/1" },
      { id: "r3", color: "red", cell: "Y/2/2" },
      { id: "r4", color: "red", cell: "Y/2/3" },
    ];
    const state = makeState({ tokens, activeSeat: 1, status: "moving", diceValue: 6 });
    const session = createGameSession(state);
    const msgs = handleMove(session, "b1");

    const capturedMsg = msgs.find((m) => m.type === "captured");
    expect(capturedMsg).toBeDefined();
    if (capturedMsg && capturedMsg.type === "captured") {
      expect(capturedMsg.tokenId).toBe("r1");
      expect(capturedMsg.to).toMatch(/^Y\/2\//);
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
      { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
      { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
      { index: 3, state: "active", color: "green", playerId: "p3", isBot: false },
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

describe("auto-move option (single legal move)", () => {
  // One blue token on the track, the rest in the yard; with a roll of 3 only the
  // track token can move, so there is exactly one legal move.
  const singleMoveTokens: Token[] = [
    { id: "1-1", color: "blue", cell: "T/5" },
    { id: "1-2", color: "blue", cell: "Y/1/2" },
    { id: "1-3", color: "blue", cell: "Y/1/3" },
    { id: "1-4", color: "blue", cell: "Y/1/4" },
    { id: "2-1", color: "red", cell: "T/14" },
    { id: "2-2", color: "red", cell: "Y/2/2" },
    { id: "2-3", color: "red", cell: "Y/2/3" },
    { id: "2-4", color: "red", cell: "Y/2/4" },
  ];

  it("auto-picks the only move for a human when auto-move is on (default)", () => {
    const state = makeState({ tokens: singleMoveTokens, activeSeat: 1, status: "rolling" });
    const session = createGameSession(state);
    session.rng = { random: () => 0.5, rollDie: () => 3 };

    const msgs = handleRoll(session);

    expect(msgs.some((m) => m.type === "moved")).toBe(true);
    expect(session.state.status).not.toBe("moving");
  });

  it("waits for a human pick when auto-move is off", () => {
    const state = makeState({
      tokens: singleMoveTokens,
      activeSeat: 1,
      status: "rolling",
      options: { wallEnabled: false, autoMoveEnabled: false },
    });
    const session = createGameSession(state);
    session.rng = { random: () => 0.5, rollDie: () => 3 };

    const msgs = handleRoll(session);

    expect(msgs.some((m) => m.type === "moved")).toBe(false);
    expect(session.state.status).toBe("moving");
  });

  it("still auto-picks for a bot even when auto-move is off", () => {
    const state = makeState({
      seats: [
        { index: 1, state: "active", color: "blue", playerId: "p1", isBot: true },
        { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
      ],
      tokens: singleMoveTokens,
      activeSeat: 1,
      status: "rolling",
      options: { wallEnabled: false, autoMoveEnabled: false },
    });
    const session = createGameSession(state);
    session.rng = { random: () => 0.5, rollDie: () => 3 };

    const msgs = handleRoll(session);

    expect(msgs.some((m) => m.type === "moved")).toBe(true);
    expect(session.state.status).not.toBe("moving");
  });
});

describe("turn timing", () => {
  it("extends the next turn deadline while a no-move roll is still visible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:01.000Z"));

    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "Y/1/1" },
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
    session.rng = { random: () => 0.5, rollDie: () => 3 };

    const msgs = handleRoll(session);
    const turnMsg = msgs.find((msg) => msg.type === "turn");

    expect(turnMsg).toBeDefined();
    if (turnMsg && turnMsg.type === "turn") {
      expect(turnMsg.deadline).toBe(
        Date.now() + TIMINGS.turnTimeout + TIMINGS.diceReveal + TIMINGS.diceShow + TIMINGS.turnPass,
      );
    }

    vi.useRealTimers();
  });

  it("preserves only the remaining dice hold when a move ends the turn quickly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:01.000Z"));

    const tokens: Token[] = [
      { id: "1-1", color: "blue", cell: "T/5" },
      { id: "1-2", color: "blue", cell: "Y/1/2" },
      { id: "1-3", color: "blue", cell: "Y/1/3" },
      { id: "1-4", color: "blue", cell: "Y/1/4" },
      { id: "2-1", color: "red", cell: "T/14" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ];

    const state = makeState({ tokens, activeSeat: 1, status: "moving", diceValue: 3 });
    const session = createGameSession(state);
    session.lastRollAt = Date.now();

    vi.setSystemTime(new Date("2026-05-25T00:00:01.400Z"));

    const msgs = handleMove(session, "1-1");
    const turnMsg = msgs.find((msg) => msg.type === "turn");

    expect(turnMsg).toBeDefined();
    if (turnMsg && turnMsg.type === "turn") {
      expect(turnMsg.deadline).toBe(Date.now() + TIMINGS.turnTimeout + 1200 + TIMINGS.turnPass);
    }

    vi.useRealTimers();
  });
});
