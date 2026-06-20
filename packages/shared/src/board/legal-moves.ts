import { parseCell } from "./cell.js";
import { startSquare } from "./seats.js";
import { stepPath } from "./movement.js";
import { isOvershoot } from "./rules.js";
import { HOME_COLUMN_LENGTH } from "../constants/board.js";
import type { Token } from "../types/game.js";
import { findBlocks, isBlockedByOpponent } from "./blocks.js";

export interface LegalMove {
  tokenId: string;
  from: string;
  to: string;
}

/**
 * Generate all legal moves for a seat's tokens given a dice value.
 *
 * @param seatTokens - tokens belonging to the active seat
 * @param diceValue - the rolled die value (1-6)
 * @param seat - the seat index (1-based)
 * @param S - total number of seats in the game
 * @param allTokens - all tokens on the board (for block checks)
 * @param wallEnabled - when false, the wall (block) rule is ignored entirely
 */
export function legalMoves(
  seatTokens: Token[],
  diceValue: number,
  seat: number,
  S: number,
  allTokens: Token[],
  wallEnabled = true,
): LegalMove[] {
  const moves: LegalMove[] = [];
  const blocks = wallEnabled
    ? findBlocks([
        ...seatTokens,
        ...allTokens.filter((t) => !seatTokens.some((st) => st.id === t.id)),
      ])
    : new Map<string, string>();

  for (const token of seatTokens) {
    const parsed = parseCell(token.cell);

    // Skip tokens already at home end
    if (parsed.kind === "home" && parsed.index >= HOME_COLUMN_LENGTH) {
      continue;
    }

    if (parsed.kind === "yard") {
      // Deploy requires a 6
      if (diceValue === 6) {
        const dest = startSquare(seat, S);
        // Check if opponent block is on start square
        const blockColor = blocks.get(dest);
        if (blockColor !== undefined && blockColor !== token.color) {
          continue;
        }
        moves.push({
          tokenId: token.id,
          from: token.cell,
          to: dest,
        });
      }
      continue;
    }

    // Track or home — compute step path
    const path = stepPath(token.cell, diceValue, seat, S);
    if (path.length === 0) continue;

    // Check overshoot
    if (isOvershoot(path)) continue;

    // Check if path is blocked by opponent block
    if (isBlockedByOpponent(path, token.color, blocks)) continue;

    // Check home-column capacity-1: destination home cell must be empty
    if (isHomeDestinationBlocked(path, token.id, allTokens)) continue;

    const destination = path[path.length - 1]!;
    moves.push({
      tokenId: token.id,
      from: token.cell,
      to: destination,
    });
  }

  return moves;
}

/**
 * Check if the move's destination home cell is already occupied
 * by another token (capacity-1 rule).
 *
 * Every home cell — including the final one (H/si/L) — holds at most one token.
 * A seat wins by filling all L home cells one-each, so there is no "goal" cell
 * that allows stacking. See terminal.ts and .claude/planning.md.
 *
 * Only the landing cell matters: a token may pass over an occupied home cell as
 * long as it lands on an empty one (home cells are never opponent blocks).
 */
function isHomeDestinationBlocked(path: string[], movingTokenId: string, allTokens: Token[]): boolean {
  const destination = path[path.length - 1];
  if (destination === undefined || !destination.startsWith("H/")) return false;

  return allTokens.some(
    (t) =>
      t.id !== movingTokenId &&
      t.cell === destination &&
      parseCell(t.cell).kind === "home",
  );
}
