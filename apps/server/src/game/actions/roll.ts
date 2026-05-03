import type { Rng } from "../rng/rng.js";

export interface RollRules {
  readonly extraTurnOnSix: boolean;
  readonly consecutiveSixLimit: number;
}

export interface RollOutcome {
  value: number;
  extraTurn: boolean;
  forfeit: boolean;
  newConsecutiveSixes: number;
}

/**
 * Roll the die and apply six-related rules.
 *
 * - Extra turn is granted on 6 (if rule enabled) unless it would
 *   exceed the consecutive-six limit.
 * - On reaching the limit, the turn is forfeited and consecutive
 *   counter resets.
 */
export function resolveRoll(rng: Rng, consecutiveSixes: number, rules: RollRules): RollOutcome {
  const value = rng.rollDie(6);

  if (value !== 6) {
    return {
      value,
      extraTurn: false,
      forfeit: false,
      newConsecutiveSixes: 0,
    };
  }

  // Rolled a 6
  const newCount = consecutiveSixes + 1;

  if (newCount >= rules.consecutiveSixLimit) {
    // Forfeit — too many consecutive sixes
    return {
      value,
      extraTurn: false,
      forfeit: true,
      newConsecutiveSixes: 0,
    };
  }

  return {
    value,
    extraTurn: rules.extraTurnOnSix,
    forfeit: false,
    newConsecutiveSixes: newCount,
  };
}
