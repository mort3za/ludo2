import { CELLS_PER_ARM } from "../constants/board.js";
import { parseCell, track, home } from "./cell.js";
import { entrySquare } from "./seats.js";

/**
 * Compute the path (cells visited, not including start) for a token
 * stepping `steps` positions forward from `from`.
 *
 * Handles clockwise track wraparound and home-column transition
 * for the given seat. Returns the raw path — overshoot validation
 * is handled separately.
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
    // Check if current position is the entry square — next step enters home
    if (pos === entryIdx) {
      // Remaining steps go into home column
      const remaining = steps - i;
      for (let h = 1; h <= remaining; h++) {
        path.push(home(seat, h));
      }
      return path;
    }

    // Normal track step with wraparound
    pos = (pos % trackLen) + 1;

    // If we just stepped onto the entry square and there are more steps, continue loop
    path.push(track(pos));
  }

  return path;
}
