import { parseCell, startSquare, stepPath, isOvershoot, HOME_COLUMN_LENGTH } from "@ludo/shared";
import type { Token } from "@ludo/shared";
import { findBlocks, isBlockedByOpponent } from "../rules/blocks.js";

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
 */
export function legalMoves(
  seatTokens: Token[],
  diceValue: number,
  seat: number,
  S: number,
  allTokens: Token[],
): LegalMove[] {
  const moves: LegalMove[] = [];
  const blocks = findBlocks([...seatTokens, ...allTokens.filter((t) => !seatTokens.some((st) => st.id === t.id))]);

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

    // Check home-column capacity-1: no occupied home cells in path
    if (isHomePathBlocked(path, token.id, allTokens)) continue;

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
 * Check if any home-column cell in the path is already occupied
 * by another token (capacity-1 rule).
 */
function isHomePathBlocked(path: string[], movingTokenId: string, allTokens: Token[]): boolean {
  const occupiedHomeCells = new Set(
    allTokens
      .filter((t) => t.id !== movingTokenId && t.cell.startsWith("H/"))
      .filter((t) => {
        const p = parseCell(t.cell);
        return p.kind === "home" && p.index < HOME_COLUMN_LENGTH;
      })
      .map((t) => t.cell),
  );

  for (const cell of path) {
    if (cell.startsWith("H/") && occupiedHomeCells.has(cell)) {
      return true;
    }
  }
  return false;
}
