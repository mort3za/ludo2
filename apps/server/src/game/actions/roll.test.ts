import { describe, it, expect } from "vitest";
import { resolveRoll } from "./roll.js";
import { createSeededRng } from "../rng/rng.js";
import { DEFAULT_RULES } from "@ludo/shared";

describe("resolveRoll", () => {
  it("returns a die value between 1 and 6", () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 50; i++) {
      const result = resolveRoll(rng, 0, DEFAULT_RULES);
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(6);
    }
  });

  it("grants extra turn on 6 when extraTurnOnSix is true", () => {
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    const result = resolveRoll(fakeRng, 0, DEFAULT_RULES);
    expect(result.value).toBe(6);
    expect(result.extraTurn).toBe(true);
    expect(result.forfeit).toBe(false);
  });

  it("does not grant extra turn on non-6", () => {
    const fakeRng = { random: () => 0, rollDie: () => 3 };
    const result = resolveRoll(fakeRng, 0, DEFAULT_RULES);
    expect(result.value).toBe(3);
    expect(result.extraTurn).toBe(false);
    expect(result.forfeit).toBe(false);
  });

  it("does not grant extra turn on 6 when extraTurnOnSix is false", () => {
    const rules = { ...DEFAULT_RULES, extraTurnOnSix: false };
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    const result = resolveRoll(fakeRng, 0, rules);
    expect(result.value).toBe(6);
    expect(result.extraTurn).toBe(false);
    expect(result.forfeit).toBe(false);
  });

  it("forfeits turn on 3 consecutive sixes (limit=3)", () => {
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    // consecutiveSixes=2 means this is the 3rd consecutive 6
    const result = resolveRoll(fakeRng, 2, DEFAULT_RULES);
    expect(result.value).toBe(6);
    expect(result.forfeit).toBe(true);
    expect(result.extraTurn).toBe(false);
  });

  it("does not forfeit when consecutive sixes below limit", () => {
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    // consecutiveSixes=1 means this is the 2nd consecutive 6
    const result = resolveRoll(fakeRng, 1, DEFAULT_RULES);
    expect(result.value).toBe(6);
    expect(result.extraTurn).toBe(true);
    expect(result.forfeit).toBe(false);
  });

  it("resets consecutive tracking on non-6 roll", () => {
    const fakeRng = { random: () => 0, rollDie: () => 4 };
    // Even with high consecutive count, non-6 never forfeits
    const result = resolveRoll(fakeRng, 5, DEFAULT_RULES);
    expect(result.forfeit).toBe(false);
    expect(result.newConsecutiveSixes).toBe(0);
  });

  it("tracks newConsecutiveSixes correctly on 6", () => {
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    const result = resolveRoll(fakeRng, 1, DEFAULT_RULES);
    expect(result.newConsecutiveSixes).toBe(2);
  });

  it("resets newConsecutiveSixes to 0 on forfeit", () => {
    const fakeRng = { random: () => 0, rollDie: () => 6 };
    const result = resolveRoll(fakeRng, 2, DEFAULT_RULES);
    expect(result.forfeit).toBe(true);
    expect(result.newConsecutiveSixes).toBe(0);
  });

  it("is deterministic for the same seed", () => {
    const a = resolveRoll(createSeededRng(99), 0, DEFAULT_RULES);
    const b = resolveRoll(createSeededRng(99), 0, DEFAULT_RULES);
    expect(a).toEqual(b);
  });
});
