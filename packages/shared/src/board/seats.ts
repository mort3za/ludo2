import { CELLS_PER_ARM } from "../constants/board.js";
import { track } from "./cell.js";

/**
 * Start square for seat `si` in an `S`-seat game.
 * Formula: T/((si−1)×K+1)
 */
export function startSquare(si: number, _S: number): string {
  return track((si - 1) * CELLS_PER_ARM + 1);
}

/**
 * Entry square for seat `si` in an `S`-seat game.
 * The last track square before turning into the home column.
 * Formula: T/((si−1)×K), with seat-1 wrapping to T/(S×K).
 */
export function entrySquare(si: number, S: number): string {
  const raw = (si - 1) * CELLS_PER_ARM;
  return track(raw === 0 ? S * CELLS_PER_ARM : raw);
}
