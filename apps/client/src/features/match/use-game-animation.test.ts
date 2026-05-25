import { describe, it, expect, vi, afterEach } from "vitest";
import type { GameState, Token } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";
import { useGameAnimation } from "./use-game-animation";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "test-game",
    status: "rolling",
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
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
    const { gameState, lastRolledValue, handleMessage } = useGameAnimation(applied);

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

    vi.advanceTimersByTime(1);

    expect(gameState.value?.tokens.find((t) => t.id === "b1")?.cell).toBe("T/6");
    expect(gameState.value?.activeSeat).toBe(2);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "moved", "turn"]);
  });

  it("holds finished until the roll result has been shown", () => {
    vi.useFakeTimers();
    const applied = vi.fn();
    const { gameState, handleMessage } = useGameAnimation(applied);

    handleMessage({ type: "state", state: makeState() });
    applied.mockClear();

    handleMessage({ type: "rolled", seat: 1, value: 6 });
    handleMessage({ type: "finished", standings: [1, 2] });

    expect(gameState.value?.status).toBe("rolling");
    expect(applied).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TIMINGS.diceReveal + TIMINGS.diceShow);

    expect(gameState.value?.status).toBe("finished");
    expect(gameState.value?.standings).toEqual([1, 2]);
    expect(applied.mock.calls.map(([msg]) => msg.type)).toEqual(["rolled", "finished"]);
  });
});
