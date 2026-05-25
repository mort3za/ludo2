import { CELLS_PER_ARM } from "../constants/board.js";
import { parseCell, track, home } from "./cell.js";
import { entrySquare } from "./seats.js";

/**
 * Compute the path (cells visited, not including start) for a token
 * stepping `steps` positions forward from `from`.
 *
 * Handles clockwise track wraparound and home-column transition
 * for the given seat. The owner's entry track square is skipped,
 * so the last turn into home is a direct 90-degree move.
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
    const nextTrackPos = (pos % trackLen) + 1;

    // The owner's entry square is not walkable; turn directly into home.
    if (pos === entryIdx || nextTrackPos === entryIdx) {
      // Remaining steps go into home column
      const remaining = steps - i;
      for (let h = 1; h <= remaining; h++) {
        path.push(home(seat, h));
      }
      return path;
    }

    // Normal track step with wraparound
    pos = nextTrackPos;

    path.push(track(pos));
  }

  return path;
}
