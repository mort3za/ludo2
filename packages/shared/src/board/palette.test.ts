import { describe, it, expect } from "vitest";
import { drawPalette } from "./palette.js";
import { COLOR_PALETTE, COLOR_PRIORITY, MIN_SEATS, MAX_SEATS } from "../constants/board.js";

describe("drawPalette", () => {
  it("returns exactly S colors for each valid seat count", () => {
    for (let S = MIN_SEATS; S <= MAX_SEATS; S++) {
      const colors = drawPalette(S, () => 0.5);
      expect(colors).toHaveLength(S);
    }
  });

  it("all returned colors are from COLOR_PALETTE", () => {
    const colors = drawPalette(6, () => 0.3);
    for (const c of colors) {
      expect(COLOR_PALETTE).toContain(c);
    }
  });

  it("returns unique colors (no duplicates)", () => {
    for (let S = MIN_SEATS; S <= MAX_SEATS; S++) {
      const colors = drawPalette(S, Math.random);
      expect(new Set(colors).size).toBe(S);
    }
  });

  it("is deterministic given the same RNG sequence", () => {
    const makeRng = () => {
      let i = 0;
      const values = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4];
      return () => values[i++ % values.length]!;
    };

    const a = drawPalette(4, makeRng());
    const b = drawPalette(4, makeRng());
    expect(a).toEqual(b);
  });

  it("rng() returning 0 always picks first remaining element (priority order)", () => {
    // With rng() = 0, backward Fisher-Yates rotates: first element ends up last
    const colors = drawPalette(4, () => 0);
    expect(colors).toEqual(["blue", "green", "yellow", "red"]);
  });

  it("with S=8, returns all palette colors (shuffled)", () => {
    const colors = drawPalette(8, () => 0);
    expect(colors).toHaveLength(8);
    expect(new Set(colors)).toEqual(new Set(COLOR_PRIORITY));
  });

  it("throws for S < MIN_SEATS", () => {
    expect(() => drawPalette(3, () => 0)).toThrow();
  });

  it("throws for S > MAX_SEATS", () => {
    expect(() => drawPalette(9, () => 0)).toThrow();
  });

  it("different RNG seeds produce different orderings", () => {
    const a = drawPalette(4, () => 0);
    const b = drawPalette(4, () => 0.999);
    // Not strictly guaranteed to differ, but with these extreme values they should
    expect(a).not.toEqual(b);
  });
});
