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
    expect(startSquare(2, 4)).toBe("T/12");
    expect(startSquare(3, 4)).toBe("T/23");
    expect(startSquare(4, 4)).toBe("T/34");
  });

  it("S=6 start squares for seats 5-6", () => {
    expect(startSquare(5, 6)).toBe("T/45");
    expect(startSquare(6, 6)).toBe("T/56");
  });

  it("S=8 start squares for seats 5-8", () => {
    expect(startSquare(5, 8)).toBe("T/45");
    expect(startSquare(6, 8)).toBe("T/56");
    expect(startSquare(7, 8)).toBe("T/67");
    expect(startSquare(8, 8)).toBe("T/78");
  });
});

describe("entrySquare", () => {
  it("seat 1 entry wraps to T/(S×K)", () => {
    expect(entrySquare(1, 4)).toBe("T/44");
    expect(entrySquare(1, 6)).toBe("T/66");
    expect(entrySquare(1, 8)).toBe("T/88");
  });

  it("S=4 entry squares", () => {
    expect(entrySquare(1, 4)).toBe("T/44");
    expect(entrySquare(2, 4)).toBe("T/11");
    expect(entrySquare(3, 4)).toBe("T/22");
    expect(entrySquare(4, 4)).toBe("T/33");
  });

  it("S=6 entry squares for seats 5-6", () => {
    expect(entrySquare(5, 6)).toBe("T/44");
    expect(entrySquare(6, 6)).toBe("T/55");
  });

  it("S=8 entry squares for seats 5-8", () => {
    expect(entrySquare(5, 8)).toBe("T/44");
    expect(entrySquare(6, 8)).toBe("T/55");
    expect(entrySquare(7, 8)).toBe("T/66");
    expect(entrySquare(8, 8)).toBe("T/77");
  });

  it("entry is always one before start (cyclically)", () => {
    for (const S of [4, 5, 6, 7, 8]) {
      for (let si = 1; si <= S; si++) {
        const start = startSquare(si, S);
        const entry = entrySquare(si, S);
        const startIdx = Number(start.split("/")[1]);
        const entryIdx = Number(entry.split("/")[1]);
        const trackLen = S * 11;
        // entry + 1 (mod trackLen) should equal start index
        const nextAfterEntry = (entryIdx % trackLen) + 1;
        expect(nextAfterEntry).toBe(startIdx);
      }
    }
  });
});
