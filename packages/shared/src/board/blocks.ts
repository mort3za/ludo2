import { parseCell } from "./cell.js";
import type { Token } from "../types/game.js";

/**
 * Find all blocks on the board. A block is ≥2 tokens of the same color
 * on the same track cell.
 *
 * Returns a Map<cellId, color> of blocked cells.
 */
export function findBlocks(tokens: Token[]): Map<string, string> {
  const cellGroups = new Map<string, string[]>();

  for (const token of tokens) {
    const parsed = parseCell(token.cell);
    if (parsed.kind !== "track") continue;

    const colors = cellGroups.get(token.cell);
    if (colors) {
      colors.push(token.color);
    } else {
      cellGroups.set(token.cell, [token.color]);
    }
  }

  const blocks = new Map<string, string>();

  for (const [cell, colors] of cellGroups) {
    if (colors.length < 2) continue;
    const first = colors[0]!;
    if (colors.every((c) => c === first)) {
      blocks.set(cell, first);
    }
  }

  return blocks;
}

/**
 * Check if a movement path is blocked by an opponent's block.
 * Returns true if any cell in the path (including destination)
 * has a block of a different color than the moving token.
 */
export function isBlockedByOpponent(
  path: string[],
  movingColor: string,
  blocks: Map<string, string>,
): boolean {
  for (const cell of path) {
    const blockColor = blocks.get(cell);
    if (blockColor !== undefined && blockColor !== movingColor) {
      return true;
    }
  }
  return false;
}
