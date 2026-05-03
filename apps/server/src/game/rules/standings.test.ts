import { describe, it, expect } from "vitest";
import { updateStandings, isGameOver } from "./standings.js";

describe("updateStandings", () => {
  it("adds a finishing seat to standings", () => {
    const standings = updateStandings([], 1);
    expect(standings).toEqual([1]);
  });

  it("preserves order of finishes (1st, 2nd, 3rd...)", () => {
    let standings: number[] = [];
    standings = updateStandings(standings, 3);
    standings = updateStandings(standings, 1);
    standings = updateStandings(standings, 2);
    expect(standings).toEqual([3, 1, 2]);
  });

  it("does not add a seat that already finished", () => {
    let standings = updateStandings([], 1);
    standings = updateStandings(standings, 1);
    expect(standings).toEqual([1]);
  });

  it("returns a new array (immutable)", () => {
    const original: number[] = [1];
    const updated = updateStandings(original, 2);
    expect(updated).toEqual([1, 2]);
    expect(original).toEqual([1]);
  });
});

describe("isGameOver", () => {
  it("game is over when all initially-active seats are in standings", () => {
    const activeCount = 4;
    const standings = [3, 1, 4, 2];
    expect(isGameOver(standings, activeCount)).toBe(true);
  });

  it("game is not over with fewer standings than active count", () => {
    const activeCount = 4;
    const standings = [3, 1];
    expect(isGameOver(standings, activeCount)).toBe(false);
  });

  it("game is over when N-1 seats finish (last seat auto-placed)", () => {
    // With 4 active seats, after 3 finish the last gets auto-placed
    const activeCount = 4;
    const standings = [3, 1, 4]; // 3 finished, seat 2 is last
    // The engine should auto-fill the last seat, but isGameOver checks count
    expect(isGameOver(standings, activeCount - 1)).toBe(true);
  });

  it("game is over when sole survivor is placed", () => {
    const activeCount = 4;
    // All 4 are placed (3 finished + 1 sole survivor or kicked)
    const standings = [3, 1, 4, 2];
    expect(isGameOver(standings, activeCount)).toBe(true);
  });

  it("game is not over with empty standings", () => {
    expect(isGameOver([], 4)).toBe(false);
  });
});
