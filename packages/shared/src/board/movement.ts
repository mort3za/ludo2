import { CELLS_PER_ARM } from "../constants/board.js";
import { parseCell, track, home } from "./cell.js";
import { entrySquare } from "./seats.js";

/**
 * Compute the path (cells visited, not including start) for a token
 * stepping `steps` positions forward from `from`.
 *
 * Handles clockwise track wraparound and home-column transition
 * for the given seat. The owner's entry track square (the last cell
 * before its start square) is walkable; once a token sits on it, the
 * next step turns into the home column.
 * Returns the raw path — overshoot validation is handled separately.
 */
export function stepPath(from: string, steps: number, seat: number, S: number): string[] {
  const parsed = parseCell(from);
  const trackLen = S * CELLS_PER_ARM;
  const path: string[] = [];

  if (parsed.kind === "yard") {
    throw new Error("Cannot step from yard");
  }

  if (parsed.kind === "home") {
    let pos = parsed.index;
    for (let i = 0; i < steps; i++) {
      pos++;
      path.push(home(seat, pos));
    }
    return path;
  }

  // Track stepping
  const entryCellId = entrySquare(seat, S);
  const entryParsed = parseCell(entryCellId);
  const entryIdx = entryParsed.kind === "track" ? entryParsed.index : 0;

  let pos = parsed.index;

  for (let i = 0; i < steps; i++) {
    // The entry square is the owner's last track cell before home: once a
    // token sits on it, the remaining steps turn into the home column.
    if (pos === entryIdx) {
      const remaining = steps - i;
      for (let h = 1; h <= remaining; h++) {
        path.push(home(seat, h));
      }
      return path;
    }

    // Normal track step with wraparound
    pos = (pos % trackLen) + 1;

    path.push(track(pos));
  }

  return path;
}
