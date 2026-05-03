import { describe, it, expect } from "vitest";
import { findBlocks, isBlockedByOpponent } from "./blocks.js";
import type { Token, PlayerColor } from "@ludo/shared";

function makeToken(id: string, cell: string, color: PlayerColor): Token {
  return { id, color, cell };
}

describe("findBlocks", () => {
  it("detects a block of 2 same-color tokens on the same cell", () => {
    const tokens = [
      makeToken("t1", "T/5", "blue"),
      makeToken("t2", "T/5", "blue"),
      makeToken("t3", "T/10", "red"),
    ];
    const blocks = findBlocks(tokens);
    expect(blocks.has("T/5")).toBe(true);
    expect(blocks.get("T/5")).toBe("blue");
  });

  it("does not detect a block with different colors on same cell", () => {
    const tokens = [
      makeToken("t1", "T/5", "blue"),
      makeToken("t2", "T/5", "red"),
    ];
    const blocks = findBlocks(tokens);
    expect(blocks.has("T/5")).toBe(false);
  });

  it("detects multiple blocks", () => {
    const tokens = [
      makeToken("t1", "T/5", "blue"),
      makeToken("t2", "T/5", "blue"),
      makeToken("t3", "T/20", "red"),
      makeToken("t4", "T/20", "red"),
    ];
    const blocks = findBlocks(tokens);
    expect(blocks.get("T/5")).toBe("blue");
    expect(blocks.get("T/20")).toBe("red");
  });

  it("ignores yard and home cells", () => {
    const tokens = [
      makeToken("t1", "Y/1/1", "blue"),
      makeToken("t2", "Y/1/2", "blue"),
      makeToken("t3", "H/1/3", "blue"),
      makeToken("t4", "H/1/3", "blue"),
    ];
    const blocks = findBlocks(tokens);
    expect(blocks.size).toBe(0);
  });

  it("detects block of 3+ tokens", () => {
    const tokens = [
      makeToken("t1", "T/5", "blue"),
      makeToken("t2", "T/5", "blue"),
      makeToken("t3", "T/5", "blue"),
    ];
    const blocks = findBlocks(tokens);
    expect(blocks.has("T/5")).toBe(true);
  });
});

describe("isBlockedByOpponent", () => {
  const S = 4;

  it("returns true when path passes through an opponent block", () => {
    // Moving blue from T/3, path includes T/4, T/5, T/6. Block at T/5 (red).
    const path = ["T/4", "T/5", "T/6"];
    const blocks = new Map([["T/5", "red"]]);
    expect(isBlockedByOpponent(path, "blue", blocks)).toBe(true);
  });

  it("returns true when landing on an opponent block", () => {
    const path = ["T/4", "T/5"];
    const blocks = new Map([["T/5", "red"]]);
    expect(isBlockedByOpponent(path, "blue", blocks)).toBe(true);
  });

  it("returns false when path has no opponent blocks", () => {
    const path = ["T/4", "T/5", "T/6"];
    const blocks = new Map([["T/10", "red"]]);
    expect(isBlockedByOpponent(path, "blue", blocks)).toBe(false);
  });

  it("returns false when passing through own block (voluntary break)", () => {
    const path = ["T/4", "T/5", "T/6"];
    const blocks = new Map([["T/5", "blue"]]);
    expect(isBlockedByOpponent(path, "blue", blocks)).toBe(false);
  });

  it("returns false for empty path", () => {
    const blocks = new Map([["T/5", "red"]]);
    expect(isBlockedByOpponent([], "blue", blocks)).toBe(false);
  });
});
