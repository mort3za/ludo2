import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleBotTurn } from "./driver.js";
import type { GameSession } from "../../rooms/game-session.js";
import { TIMINGS, type GameState, type ServerMessage, type Seat, type Token } from "@ludo/shared";
import { makeState as buildState, seat, tok } from "../../test/make-state.js";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return buildState({
    activeSeat: 2,
    seats: [seat(1, "blue"), seat(2, "red", { playerId: "bot:1", isBot: true })],
    tokens: [
      tok("1-1", "blue", "T/5"),
      tok("2-1", "red", "T/5"),
      tok("2-2", "red", "Y/2/2"),
      tok("2-3", "red", "Y/2/3"),
      tok("2-4", "red", "Y/2/4"),
    ],
    ...overrides,
  });
}

function makeSession(stateOverrides: Partial<GameState> = {}): GameSession {
  const state = makeState(stateOverrides);
  return {
    state,
    rng: { random: () => 0.5, rollDie: (_n: number) => 3 },
    colorToSeat: { blue: 1, red: 2 },
    seatMisses: new Map(),
    lastRollAt: null,
    turnDeadline: 0,
    history: [],
    forcedRolls: new Map(),
  };
}

const ROLL_HOLD_MS = TIMINGS.diceReveal + TIMINGS.diceShow;
const TURN_PASS_MS = TIMINGS.turnPass;

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
    vi.advanceTimersByTime(800); // bot rolls
    expect(
      broadcast.mock.calls.flatMap((c) => c[0] as ServerMessage[]).some((m) => m.type === "moved"),
    ).toBe(false);

    vi.advanceTimersByTime(ROLL_HOLD_MS); // dice reveal + show, then bot moves

    const allMsgs: ServerMessage[] = broadcast.mock.calls.flatMap((c) => c[0] as ServerMessage[]);
    expect(allMsgs.some((m) => m.type === "moved")).toBe(true);
  });

  it("waits for the roll hold before the next bot starts after an auto-pass", () => {
    const session = makeSession({
      activeSeat: 1,
      seats: [
        { index: 1, state: "active", color: "blue", playerId: "bot:1", isBot: true },
        { index: 2, state: "active", color: "red", playerId: "bot:2", isBot: true },
      ] as Seat[],
      tokens: [
        { id: "1-1", color: "blue", cell: "Y/1/1" },
        { id: "1-2", color: "blue", cell: "Y/1/2" },
        { id: "1-3", color: "blue", cell: "Y/1/3" },
        { id: "1-4", color: "blue", cell: "Y/1/4" },
        { id: "2-1", color: "red", cell: "Y/2/1" },
        { id: "2-2", color: "red", cell: "Y/2/2" },
        { id: "2-3", color: "red", cell: "Y/2/3" },
        { id: "2-4", color: "red", cell: "Y/2/4" },
      ] as Token[],
    });
    session.rng = { random: () => 0.5, rollDie: () => 3 };
    session.colorToSeat = { blue: 1, red: 2 };

    const broadcast = vi.fn();
    scheduleBotTurn(session, broadcast);

    vi.advanceTimersByTime(800);
    expect(broadcast).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ROLL_HOLD_MS + TURN_PASS_MS - 1);
    expect(
      broadcast.mock.calls
        .flatMap((c) => c[0] as ServerMessage[])
        .filter((m) => m.type === "rolled").length,
    ).toBe(1);

    vi.advanceTimersByTime(1);

    const rolledMsgs = broadcast.mock.calls
      .flatMap((c) => c[0] as ServerMessage[])
      .filter((msg) => msg.type === "rolled");
    expect(rolledMsgs).toHaveLength(2);
    expect(rolledMsgs[1]).toMatchObject({ type: "rolled", seat: 2 });
  });

  it("does not re-schedule after game is finished", () => {
    const session = makeSession({ activeSeat: 2, status: "finished" as const });
    const broadcast = vi.fn();
    scheduleBotTurn(session, broadcast);
    vi.runAllTimers();
    expect(broadcast).not.toHaveBeenCalled();
  });
});
