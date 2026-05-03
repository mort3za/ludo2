import type { Rng } from "../rng/rng.js";

export interface TiebreakerRoll {
  seat: number;
  value: number;
}

export interface TiebreakerRound {
  rolls: TiebreakerRoll[];
}

export interface TiebreakerResult {
  winner: number;
  rounds: TiebreakerRound[];
}

/**
 * Resolve which seat goes first via highest die roll.
 * Only `activeSeatIndices` participate. If there's a tie among
 * the top rollers, only they re-roll until one winner emerges.
 *
 * Returns the winning seat index and the full roll history.
 */
export function resolveTiebreaker(activeSeatIndices: number[], rng: Rng): TiebreakerResult {
  if (activeSeatIndices.length === 0) {
    throw new Error("No active seats for tiebreaker");
  }

  if (activeSeatIndices.length === 1) {
    return { winner: activeSeatIndices[0]!, rounds: [] };
  }

  const rounds: TiebreakerRound[] = [];
  let candidates = [...activeSeatIndices];

  for (let attempt = 0; attempt < 100; attempt++) {
    const rolls: TiebreakerRoll[] = candidates.map((seat) => ({
      seat,
      value: rng.rollDie(6),
    }));

    rounds.push({ rolls });

    const maxValue = Math.max(...rolls.map((r) => r.value));
    const winners = rolls.filter((r) => r.value === maxValue);

    if (winners.length === 1) {
      return { winner: winners[0]!.seat, rounds };
    }

    // Tie — only top rollers continue
    candidates = winners.map((r) => r.seat);
  }

  // Safety fallback (should never reach here with a real RNG)
  return { winner: candidates[0]!, rounds };
}
