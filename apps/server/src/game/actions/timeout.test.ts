import { describe, it, expect } from "vitest";
import {
  autoPickToken,
  handleMissedTurn,
  applyKick,
  type MissedTurnResult,
  type KickResult,
} from "./timeout.js";
import type { Token, PlayerColor } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";

function makeToken(id: string, cell: string, color: PlayerColor): Token {
  return { id, color, cell };
}

const S = 4;

describe("autoPickToken", () => {
  it("picks the lowest-numbered legal token by ID", () => {
    const legalMoveTokenIds = ["t3", "t1", "t2"];
    expect(autoPickToken(legalMoveTokenIds)).toBe("t1");
  });

  it("returns null when no legal moves", () => {
    expect(autoPickToken([])).toBeNull();
  });

  it("picks the only available token", () => {
    expect(autoPickToken(["t4"])).toBe("t4");
  });
});

describe("handleMissedTurn", () => {
  it("increments consecutive misses", () => {
    const result = handleMissedTurn(0, TIMINGS.kickAfterMisses);
    expect(result.consecutiveMisses).toBe(1);
    expect(result.shouldKick).toBe(false);
  });

  it("kicks after reaching kickAfterMisses threshold", () => {
    const result = handleMissedTurn(2, TIMINGS.kickAfterMisses); // 2+1 = 3 = kickAfterMisses
    expect(result.consecutiveMisses).toBe(3);
    expect(result.shouldKick).toBe(true);
  });

  it("does not kick below threshold", () => {
    const result = handleMissedTurn(1, TIMINGS.kickAfterMisses);
    expect(result.consecutiveMisses).toBe(2);
    expect(result.shouldKick).toBe(false);
  });

  it("kicks on first miss if threshold is 1", () => {
    const result = handleMissedTurn(0, 1);
    expect(result.shouldKick).toBe(true);
  });
});

describe("applyKick", () => {
  it("removes all tokens of the kicked seat's color", () => {
    const tokens = [
      makeToken("b1", "T/5", "blue"),
      makeToken("b2", "T/10", "blue"),
      makeToken("r1", "T/20", "red"),
    ];
    const result = applyKick(tokens, "blue");
    expect(result.tokens.filter((t) => t.color === "blue")).toHaveLength(0);
    expect(result.tokens.filter((t) => t.color === "red")).toHaveLength(1);
    expect(result.removedTokenIds).toEqual(["b1", "b2"]);
  });

  it("returns immutable result", () => {
    const tokens = [makeToken("b1", "T/5", "blue"), makeToken("r1", "T/20", "red")];
    const original = [...tokens];
    applyKick(tokens, "blue");
    expect(tokens).toEqual(original);
  });

  it("handles kicking when no tokens of that color exist", () => {
    const tokens = [makeToken("r1", "T/20", "red")];
    const result = applyKick(tokens, "blue");
    expect(result.tokens).toEqual(tokens);
    expect(result.removedTokenIds).toEqual([]);
  });
});
