import { describe, expect, it } from "vitest";
import { isSafeSquare, isOvershoot } from "./rules.js";

describe("isSafeSquare", () => {
  it("S=4 start squares are safe", () => {
    expect(isSafeSquare("T/1", 4)).toBe(true); // seat 1
    expect(isSafeSquare("T/14", 4)).toBe(true); // seat 2
    expect(isSafeSquare("T/27", 4)).toBe(true); // seat 3
    expect(isSafeSquare("T/40", 4)).toBe(true); // seat 4
  });

  it("non-start track squares are not safe", () => {
    expect(isSafeSquare("T/2", 4)).toBe(false);
    expect(isSafeSquare("T/13", 4)).toBe(false);
    expect(isSafeSquare("T/52", 4)).toBe(false);
  });

  it("yard cells are not safe", () => {
    expect(isSafeSquare("Y/1/1", 4)).toBe(false);
  });

  it("home cells are not safe", () => {
    expect(isSafeSquare("H/1/1", 4)).toBe(false);
  });

  it("S=6 has exactly 6 safe squares", () => {
    expect(isSafeSquare("T/1", 6)).toBe(true); // seat 1
    expect(isSafeSquare("T/14", 6)).toBe(true); // seat 2
    expect(isSafeSquare("T/27", 6)).toBe(true); // seat 3
    expect(isSafeSquare("T/40", 6)).toBe(true); // seat 4
    expect(isSafeSquare("T/53", 6)).toBe(true); // seat 5
    expect(isSafeSquare("T/66", 6)).toBe(true); // seat 6
    // not safe
    expect(isSafeSquare("T/78", 6)).toBe(false);
  });

  it("S=8 has exactly 8 safe squares", () => {
    expect(isSafeSquare("T/1", 8)).toBe(true);
    expect(isSafeSquare("T/14", 8)).toBe(true);
    expect(isSafeSquare("T/27", 8)).toBe(true);
    expect(isSafeSquare("T/40", 8)).toBe(true);
    expect(isSafeSquare("T/53", 8)).toBe(true);
    expect(isSafeSquare("T/66", 8)).toBe(true);
    expect(isSafeSquare("T/79", 8)).toBe(true);
    expect(isSafeSquare("T/92", 8)).toBe(true);
  });
});

describe("isOvershoot", () => {
  it("path within home column is not overshoot", () => {
    // Stepping from H/1/1 to H/1/4 (3 steps, within bounds)
    expect(isOvershoot(["H/1/2", "H/1/3", "H/1/4"])).toBe(false);
  });

  it("path landing exactly on H/si/4 is not overshoot", () => {
    expect(isOvershoot(["H/2/4"])).toBe(false);
  });

  it("path overshooting past H/si/4 is overshoot", () => {
    // H/1/5 doesn't exist (L=4), so this overshoots
    expect(isOvershoot(["H/1/2", "H/1/3", "H/1/4", "H/1/5"])).toBe(true);
  });

  it("pure track path is never overshoot", () => {
    expect(isOvershoot(["T/1", "T/2", "T/3"])).toBe(false);
  });

  it("mixed track-to-home within bounds is not overshoot", () => {
    expect(isOvershoot(["T/13", "H/2/1"])).toBe(false);
  });

  it("mixed track-to-home overshooting is overshoot", () => {
    expect(isOvershoot(["T/52", "H/1/1", "H/1/2", "H/1/3", "H/1/4", "H/1/5"])).toBe(true);
  });

  it("empty path is not overshoot", () => {
    expect(isOvershoot([])).toBe(false);
  });
});
