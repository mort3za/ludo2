import { HOME_COLUMN_LENGTH } from "../constants/board.js";
import { parseCell } from "./cell.js";
import { startSquare } from "./seats.js";

/**
 * Returns true if `cellId` is a safe square in an S-seat game.
 * Safe squares are exactly the S start squares (one per seat).
 */
export function isSafeSquare(cellId: string, S: number): boolean {
  const parsed = parseCell(cellId);
  if (parsed.kind !== "track") return false;

  for (let si = 1; si <= S; si++) {
    if (cellId === startSquare(si, S)) return true;
  }
  return false;
}

/**
 * Returns true if a step path overshoots the home column (past L=4).
 * Checks raw cell IDs since overshoot cells (e.g. H/1/5) are
 * intentionally invalid and would fail parseCell validation.
 */
export function isOvershoot(path: string[]): boolean {
  for (const cellId of path) {
    if (!cellId.startsWith("H/")) continue;
    const parts = cellId.split("/");
    const homeIdx = Number(parts[2]);
    if (homeIdx > HOME_COLUMN_LENGTH) return true;
  }
  return false;
}
