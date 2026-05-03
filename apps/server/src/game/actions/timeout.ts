import type { Token } from "@ludo/shared";

export interface MissedTurnResult {
  consecutiveMisses: number;
  shouldKick: boolean;
}

export interface KickResult {
  tokens: Token[];
  removedTokenIds: string[];
}

/**
 * Deterministic auto-pick: select the token with the lowest ID
 * from the list of legal-move token IDs.
 */
export function autoPickToken(legalMoveTokenIds: string[]): string | null {
  if (legalMoveTokenIds.length === 0) return null;
  return legalMoveTokenIds.sort()[0]!;
}

/**
 * Handle a missed turn: increment the counter and check for kick.
 */
export function handleMissedTurn(currentMisses: number, kickThreshold: number): MissedTurnResult {
  const consecutiveMisses = currentMisses + 1;
  return {
    consecutiveMisses,
    shouldKick: consecutiveMisses >= kickThreshold,
  };
}

/**
 * Apply a kick: remove all tokens of the given color from the board.
 * Returns a new tokens array and the IDs of removed tokens.
 */
export function applyKick(tokens: Token[], color: string): KickResult {
  const removedTokenIds: string[] = [];
  const remaining: Token[] = [];

  for (const token of tokens) {
    if (token.color === color) {
      removedTokenIds.push(token.id);
    } else {
      remaining.push(token);
    }
  }

  return { tokens: remaining, removedTokenIds };
}
