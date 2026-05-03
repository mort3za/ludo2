import { describe, it, expect } from "vitest";
import { resolveTiebreaker } from "./tiebreaker.js";
import { createSeededRng } from "../rng/rng.js";

describe("resolveTiebreaker", () => {
  it("returns the seat index with the highest roll", () => {
    // Seed 42: with 4 active seats, should deterministically pick a winner
    const rng = createSeededRng(42);
    const activeSeatIndices = [1, 2, 3, 4];
    const result = resolveTiebreaker(activeSeatIndices, rng);
    expect(activeSeatIndices).toContain(result.winner);
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
  });

  it("first round includes all active seats", () => {
    const rng = createSeededRng(1);
    const activeSeatIndices = [1, 2, 3, 4];
    const result = resolveTiebreaker(activeSeatIndices, rng);
    const firstRound = result.rounds[0]!;
    expect(firstRound.rolls.map((r) => r.seat)).toEqual(activeSeatIndices);
  });

  it("each roll is between 1 and 6", () => {
    const rng = createSeededRng(77);
    const result = resolveTiebreaker([1, 2, 3, 4, 5], rng);
    for (const round of result.rounds) {
      for (const roll of round.rolls) {
        expect(roll.value).toBeGreaterThanOrEqual(1);
        expect(roll.value).toBeLessThanOrEqual(6);
      }
    }
  });

  it("re-rolls when top rollers tie", () => {
    // Construct an RNG that forces a tie in round 1:
    // seats 1,2,3,4 → all roll same, then resolve in round 2
    let callIdx = 0;
    const forcedValues = [
      // Round 1: all roll 4 (tie among all 4)
      4, 4, 4, 4,
      // Round 2: seat 1=3, seat 2=6, seat 3=1, seat 4=5 → seat 2 wins
      3, 6, 1, 5,
    ];
    const fakeRng = {
      random: () => 0,
      rollDie: (_sides: number) => forcedValues[callIdx++]!,
    };

    const result = resolveTiebreaker([1, 2, 3, 4], fakeRng);
    expect(result.rounds.length).toBe(2);
    expect(result.winner).toBe(2);
  });

  it("only tied seats participate in re-roll", () => {
    let callIdx = 0;
    const forcedValues = [
      // Round 1: seats [1,2,3,4] → rolls 3,6,6,2 → seats 2,3 tie
      3, 6, 6, 2,
      // Round 2: seats [2,3] → rolls 5,2 → seat 2 wins
      5, 2,
    ];
    const fakeRng = {
      random: () => 0,
      rollDie: (_sides: number) => forcedValues[callIdx++]!,
    };

    const result = resolveTiebreaker([1, 2, 3, 4], fakeRng);
    expect(result.rounds.length).toBe(2);
    expect(result.rounds[1]!.rolls.map((r) => r.seat)).toEqual([2, 3]);
    expect(result.winner).toBe(2);
  });

  it("works with only 2 active seats", () => {
    const rng = createSeededRng(33);
    const result = resolveTiebreaker([1, 3], rng);
    expect([1, 3]).toContain(result.winner);
  });

  it("handles single active seat (auto-win)", () => {
    const rng = createSeededRng(1);
    const result = resolveTiebreaker([5], rng);
    expect(result.winner).toBe(5);
    expect(result.rounds).toHaveLength(0);
  });

  it("skips vacant/empty seats (only given active seats)", () => {
    // If only seats 1,3,5 are active in an 8-seat game
    const rng = createSeededRng(10);
    const result = resolveTiebreaker([1, 3, 5], rng);
    expect([1, 3, 5]).toContain(result.winner);
    for (const round of result.rounds) {
      for (const roll of round.rolls) {
        expect([1, 3, 5]).toContain(roll.seat);
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const a = resolveTiebreaker([1, 2, 3, 4], createSeededRng(99));
    const b = resolveTiebreaker([1, 2, 3, 4], createSeededRng(99));
    expect(a).toEqual(b);
  });

  it("terminates even with many ties (max iterations safety)", () => {
    // With a real seeded RNG, ties won't last forever
    const rng = createSeededRng(12345);
    const result = resolveTiebreaker([1, 2, 3, 4, 5, 6, 7, 8], rng);
    expect(result.rounds.length).toBeLessThan(100);
    expect(result.winner).toBeGreaterThanOrEqual(1);
  });
});
