import { parseCell, CELLS_PER_ARM } from "@ludo/shared";
import type { LegalMove, GameState } from "@ludo/shared";

/**
 * Pick the best legal move for a bot seat using heuristics.
 *
 * Priority (highest first):
 *   1. Capture a lone opponent token on a track cell
 *   2. Deploy a token from yard (only possible on roll of 6)
 *   3. Escape a cell reachable by an opponent within 1–6 rolls
 *   4. Advance the most-progressed token toward home
 */
export function pickMove(legalMoves: LegalMove[], state: GameState, mySeat: number): LegalMove {
  if (legalMoves.length === 0) throw new Error("pickMove called with empty legalMoves");
  if (legalMoves.length === 1) return legalMoves[0]!;

  const myColor = state.seats.find((s) => s.index === mySeat)?.color;
  const trackLen = state.seats.length * CELLS_PER_ARM;
  const startIdx = (mySeat - 1) * CELLS_PER_ARM + 1;

  let best = legalMoves[0]!;
  let bestScore = score(best, state, myColor, mySeat, trackLen, startIdx);

  for (let i = 1; i < legalMoves.length; i++) {
    const s = score(legalMoves[i]!, state, myColor, mySeat, trackLen, startIdx);
    if (s > bestScore) {
      bestScore = s;
      best = legalMoves[i]!;
    }
  }

  return best;
}

function score(
  move: LegalMove,
  state: GameState,
  myColor: string | undefined,
  mySeat: number,
  trackLen: number,
  startIdx: number,
): number {
  const progress = tokenProgress(move.to, trackLen, startIdx);

  if (isCapture(move.to, state, myColor)) return 1000 + progress;

  const fromParsed = parseCell(move.from);
  if (fromParsed.kind === "yard") return 500;

  if (isInDanger(move.from, state, myColor, trackLen)) return 300 + progress;

  return progress;
}

/** True when destination is a track cell with exactly one opponent token. */
function isCapture(to: string, state: GameState, myColor: string | undefined): boolean {
  const parsed = parseCell(to);
  if (parsed.kind !== "track") return false;
  const opponents = state.tokens.filter((t) => t.cell === to && t.color !== myColor);
  return opponents.length === 1;
}

/** True when an opponent token is 1–6 clockwise steps behind `fromCell` on the track. */
function isInDanger(
  fromCell: string,
  state: GameState,
  myColor: string | undefined,
  trackLen: number,
): boolean {
  const parsed = parseCell(fromCell);
  if (parsed.kind !== "track") return false;

  for (const token of state.tokens) {
    if (token.color === myColor) continue;
    const tp = parseCell(token.cell);
    if (tp.kind !== "track") continue;
    const dist = (parsed.index - tp.index + trackLen) % trackLen;
    if (dist >= 1 && dist <= 6) return true;
  }
  return false;
}

/** How far this cell is from seat's start square (higher = more advanced). */
function tokenProgress(cell: string, trackLen: number, startIdx: number): number {
  const parsed = parseCell(cell);
  if (parsed.kind === "yard") return 0;
  if (parsed.kind === "home") return trackLen + parsed.index;
  return (parsed.index - startIdx + trackLen) % trackLen;
}
