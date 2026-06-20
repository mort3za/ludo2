import { describe, it, expect, vi, afterEach } from "vitest";
import type { GameState, Token } from "@ludo/shared";
import { TIMINGS, DEFAULT_GAME_OPTIONS } from "@ludo/shared";
import { useGameAnimation } from "./use-game-animation";

const FIRST_STEP_DELAY_MS = 16;
const STEP_INTERVAL_MS = 220;
const TOKEN_TRANSITION_MS = 300;
const TURN_PASS_MS = TIMINGS.turnPass;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "test-game",
    status: "rolling",
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    options: { ...DEFAULT_GAME_OPTIONS },
    seats: [
      { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
      { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
    ],
    tokens: [
      { id: "b1", color: "blue", cell: "T/5" },
      { id: "r1", color: "red", cell: "T/14" },
    ] as Token[],
    ...overrides,
  };
}

describe("useGameAnimation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds move and turn messages until the roll has been revealed and shown", () => {
    vi.useFakeTimers();
    const applied = vi.fn();
    const { gameState, lastRolledValue, isActionLocked, handleMessage } = useGameAnimation(applied);

    handleMessage({ type: "state", state: makeState() });
    applied.mockClear();

    handleMessage({ type: "rolled", seat: 1, value: 3 });
    handleMessage({
      type: "moved",
      tokenId: "b1",
      to: "T/8",
      path: ["T/6", "T/7", "T/8"],
    });
    handleMessage({ type: "turn", seat: 2, deadline: 12345 });

    expect(lastRolledValue.value).toBeNull();
    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/5");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(applied).toHaveBeenCalledTimes(1);
    expect(applied).toHaveBeenLastCalledWith({ type: "rolled", seat: 1, value: 3 });

    vi.advanceTimersByTime(TIMINGS.diceReveal);

    expect(lastRolledValue.value).toBe(3);
    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/5");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(applied).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TIMINGS.diceShow - 1);

    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/5");
    expect(gameState.value?.activeSeat).toBe(1);

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/5");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved"]);

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/6");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved"]);

    vi.advanceTimersByTime(STEP_INTERVAL_MS);

    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/7");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(isActionLocked.value).toBe(true);

    vi.advanceTimersByTime(STEP_INTERVAL_MS + TOKEN_TRANSITION_MS - FIRST_STEP_DELAY_MS);

    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/8");
    expect(gameState.value?.activeSeat).toBe(1);
    expect(isActionLocked.value).toBe(true);

    vi.advanceTimersByTime(1);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.activeSeat).toBe(2);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved", "turn"]);

    vi.advanceTimersByTime(TURN_PASS_MS - 1);

    expect(isActionLocked.value).toBe(true);

    vi.advanceTimersByTime(1);

    expect(isActionLocked.value).toBe(false);
  });

  it("holds finished until the roll result has been shown", () => {
    vi.useFakeTimers();
    const applied = vi.fn();
    const { gameState, isActionLocked, handleMessage } = useGameAnimation(applied);

    handleMessage({ type: "state", state: makeState() });
    applied.mockClear();

    handleMessage({ type: "rolled", seat: 1, value: 6 });
    handleMessage({ type: "finished", standings: [1, 2] });

    expect(gameState.value?.status).toBe("moving");
    expect(isActionLocked.value).toBe(true);
    expect(applied).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TIMINGS.diceReveal + TIMINGS.diceShow);

    expect(isActionLocked.value).toBe(false);
    expect(gameState.value?.status).toBe("finished");
    expect(gameState.value?.standings).toEqual([1, 2]);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "finished"]);
  });

  it("queues the next turn roll until the previous turn handoff and move animation finish", () => {
    vi.useFakeTimers();
    const applied = vi.fn();
    const { gameState, lastRolledValue, isActionLocked, handleMessage } = useGameAnimation(applied);

    handleMessage({ type: "state", state: makeState() });
    applied.mockClear();

    handleMessage({ type: "rolled", seat: 1, value: 6 });
    handleMessage({
      type: "moved",
      tokenId: "b1",
      to: "T/11",
      path: ["T/6", "T/7", "T/8", "T/9", "T/10", "T/11"],
    });
    handleMessage({ type: "turn", seat: 2, deadline: 12345 });
    handleMessage({ type: "rolled", seat: 2, value: 4 });

    vi.advanceTimersByTime(TIMINGS.diceReveal + TIMINGS.diceShow);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.activeSeat).toBe(1);
    expect(gameState.value?.diceValue).toBe(6);
    expect(lastRolledValue.value).toBe(6);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved"]);

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS + 5 * STEP_INTERVAL_MS + TOKEN_TRANSITION_MS);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.activeSeat).toBe(2);
    expect(gameState.value?.diceValue).toBeNull();
    expect(lastRolledValue.value).toBe(6);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved", "turn"]);

    vi.advanceTimersByTime(TURN_PASS_MS);

    expect(isActionLocked.value).toBe(true);
    expect(gameState.value?.diceValue).toBe(4);
    expect(lastRolledValue.value).toBeNull();
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual([
      "rolled",
      "moved",
      "turn",
      "rolled",
    ]);

    vi.advanceTimersByTime(TIMINGS.diceReveal);

    expect(lastRolledValue.value).toBe(4);
  });

  it("keeps the moved token on top while a captured token animates back to yard", () => {
    vi.useFakeTimers();
    const applied = vi.fn();
    const { gameState, animating, stackingTokenId, handleMessage } = useGameAnimation(applied);

    handleMessage({
      type: "state",
      state: makeState({
        status: "moving",
        diceValue: 3,
        tokens: [
          { id: "b1", color: "blue", cell: "T/5" },
          { id: "r1", color: "red", cell: "T/8" },
        ],
      }),
    });
    applied.mockClear();

    handleMessage({
      type: "moved",
      tokenId: "b1",
      to: "T/8",
      path: ["T/6", "T/7", "T/8"],
    });
    handleMessage({ type: "captured", tokenId: "r1", to: "Y/2/0" });

    expect(stackingTokenId.value).toBe("b1");

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS + 2 * STEP_INTERVAL_MS + TOKEN_TRANSITION_MS);

    expect(gameState.value?.tokens.find((token) => token.id === "r1")?.cell).toBe("Y/2/0");
    expect(animating.value?.tokenId).toBe("r1");
    expect(stackingTokenId.value).toBe("b1");

    vi.advanceTimersByTime(TOKEN_TRANSITION_MS - 1);

    expect(stackingTokenId.value).toBe("b1");
    expect(animating.value?.tokenId).toBe("r1");

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS);

    expect(animating.value).toBeNull();
    expect(stackingTokenId.value).toBeNull();
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["moved", "captured"]);
  });

  it("keeps the token at its current cell until the first movement timer fires", () => {
    vi.useFakeTimers();
    const { gameState, handleMessage } = useGameAnimation();

    handleMessage({
      type: "state",
      state: makeState({
        status: "moving",
        diceValue: 3,
      }),
    });

    handleMessage({
      type: "moved",
      tokenId: "b1",
      to: "T/8",
      path: ["T/6", "T/7", "T/8"],
    });

    expect(gameState.value?.tokens.find((token) => token.id === "b1")?.cell).toBe("T/5");

    vi.advanceTimersByTime(FIRST_STEP_DELAY_MS - 1);

    expect(gameState.value?.tokens.find((token) => token.id === "b1")?.cell).toBe("T/5");

    vi.advanceTimersByTime(1);

    expect(gameState.value?.tokens.find((token) => token.id === "b1")?.cell).toBe("T/6");
  });
});
