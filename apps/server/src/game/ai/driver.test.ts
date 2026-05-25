import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleBotTurn } from "./driver.js";
import type { GameSession } from "../../rooms/game-session.js";
import type { GameState, ServerMessage, Seat, Token } from "@ludo/shared";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "test",
    status: "rolling",
    activeSeat: 2,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    seats: [
      { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
      { index: 2, state: "active", color: "red", playerId: "bot:1", isBot: true },
    ] as Seat[],
    tokens: [
      { id: "1-1", color: "blue", cell: "T/5" },
      { id: "2-1", color: "red", cell: "T/5" },
      { id: "2-2", color: "red", cell: "Y/2/2" },
      { id: "2-3", color: "red", cell: "Y/2/3" },
      { id: "2-4", color: "red", cell: "Y/2/4" },
    ] as Token[],
    ...overrides,
  };
}

function makeSession(stateOverrides: Partial<GameState> = {}): GameSession {
  const state = makeState(stateOverrides);
  return {
    state,
    rng: { random: () => 0.5, rollDie: (_n: number) => 3 },
    colorToSeat: { blue: 1, red: 2 },
    seatMisses: new Map(),
  };
}

describe("scheduleBotTurn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when activeSeat is not a bot", () => {
    const session = makeSession({ activeSeat: 1 }); // seat 1 is human
    const broadcast = vi.fn();
    scheduleBotTurn(session, broadcast);
    vi.runAllTimers();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("bot rolls after ~800ms delay", () => {
    const session = makeSession({ activeSeat: 2 }); // seat 2 is bot
    const broadcast = vi.fn();
    scheduleBotTurn(session, broadcast);

    expect(broadcast).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(broadcast).toHaveBeenCalled();

    const allMsgs: ServerMessage[] = broadcast.mock.calls.flatMap((c) => c[0] as ServerMessage[]);
    expect(allMsgs.some((m) => m.type === "rolled")).toBe(true);
  });

  it("bot picks a move after roll delay when multiple moves available", () => {
    // Give bot a token on the track so there are multiple legal moves (roll=3)
    const session = makeSession({
      activeSeat: 2,
      tokens: [
        { id: "1-1", color: "blue", cell: "T/5" },
        { id: "2-1", color: "red", cell: "T/5" },
        { id: "2-2", color: "red", cell: "T/10" },
        { id: "2-3", color: "red", cell: "Y/2/3" },
        { id: "2-4", color: "red", cell: "Y/2/4" },
      ] as Token[],
    });
    const broadcast = vi.fn();
    // Override rng to roll 3 (not 6, no deploy) so we get multiple track moves
    session.rng = { random: () => 0.5, rollDie: () => 3 };

    scheduleBotTurn(session, broadcast);
    vi.advanceTimersByTime(800);  // bot rolls
    vi.advanceTimersByTime(600);  // bot moves

    const allMsgs: ServerMessage[] = broadcast.mock.calls.flatMap((c) => c[0] as ServerMessage[]);
    expect(allMsgs.some((m) => m.type === "moved")).toBe(true);
  });

  it("does not re-schedule after game is finished", () => {
    const session = makeSession({ activeSeat: 2, status: "finished" as const });
    const broadcast = vi.fn();
    scheduleBotTurn(session, broadcast);
    vi.runAllTimers();
    expect(broadcast).not.toHaveBeenCalled();
  });
});
