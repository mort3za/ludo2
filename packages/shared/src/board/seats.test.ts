import { describe, expect, it } from "vitest";
import { startSquare, entrySquare } from "./seats.js";

describe("startSquare", () => {
  it("seat 1 always starts at T/1", () => {
    expect(startSquare(1, 4)).toBe("T/1");
    expect(startSquare(1, 6)).toBe("T/1");
    expect(startSquare(1, 8)).toBe("T/1");
  });

  it("S=4 start squares", () => {
    expect(startSquare(1, 4)).toBe("T/1");
    expect(startSquare(2, 4)).toBe("T/14");
    expect(startSquare(3, 4)).toBe("T/27");
    expect(startSquare(4, 4)).toBe("T/40");
  });

  it("S=6 start squares for seats 5-6", () => {
    expect(startSquare(5, 6)).toBe("T/53");
    expect(startSquare(6, 6)).toBe("T/66");
  });

  it("S=8 start squares for seats 5-8", () => {
    expect(startSquare(5, 8)).toBe("T/53");
    expect(startSquare(6, 8)).toBe("T/66");
    expect(startSquare(7, 8)).toBe("T/79");
    expect(startSquare(8, 8)).toBe("T/92");
  });
});

describe("entrySquare", () => {
  it("seat 1 entry wraps to T/(S×K)", () => {
    expect(entrySquare(1, 4)).toBe("T/52");
    expect(entrySquare(1, 6)).toBe("T/78");
    expect(entrySquare(1, 8)).toBe("T/104");
  });

  it("S=4 entry squares", () => {
    expect(entrySquare(1, 4)).toBe("T/52");
    expect(entrySquare(2, 4)).toBe("T/13");
    expect(entrySquare(3, 4)).toBe("T/26");
    expect(entrySquare(4, 4)).toBe("T/39");
  });

  it("S=6 entry squares for seats 5-6", () => {
    expect(entrySquare(5, 6)).toBe("T/52");
    expect(entrySquare(6, 6)).toBe("T/65");
  });

  it("S=8 entry squares for seats 5-8", () => {
    expect(entrySquare(5, 8)).toBe("T/52");
    expect(entrySquare(6, 8)).toBe("T/65");
    expect(entrySquare(7, 8)).toBe("T/78");
    expect(entrySquare(8, 8)).toBe("T/91");
  });

  it("entry is always one before start (cyclically)", () => {
    for (const S of [4, 5, 6, 7, 8]) {
      for (let si = 1; si <= S; si++) {
        const start = startSquare(si, S);
        const entry = entrySquare(si, S);
        const startIdx = Number(start.split("/")[1]);
        const entryIdx = Number(entry.split("/")[1]);
        const trackLen = S * 13;
        // entry + 1 (mod trackLen) should equal start index
        const nextAfterEntry = (entryIdx % trackLen) + 1;
        expect(nextAfterEntry).toBe(startIdx);
      }
    }
  });
});
