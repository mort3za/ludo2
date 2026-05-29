import type { GameState, PlayerColor, Seat, Token } from "@ludo/shared";

/** Token shorthand: `tok("b1", "blue", "T/5")`. */
export function tok(id: string, color: PlayerColor, cell: string): Token {
  return { id, color, cell };
}

/** Seat shorthand. Defaults to an active human seat; override anything via `over`. */
export function seat(index: number, color: PlayerColor, over: Partial<Seat> = {}): Seat {
  return {
    index,
    state: "active",
    color,
    playerId: `p${index}`,
    isBot: false,
    ...over,
  };
}

/**
 * Build a `GameState` for tests. Defaults to a 2-seat game
 * (seat 1 blue, seat 2 red — both active humans), `rolling` status,
 * no dice, no tokens. Every field is overridable, so any scenario can be injected.
 */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "test",
    status: "rolling",
    seats: [seat(1, "blue"), seat(2, "red")],
    tokens: [],
    activeSeat: 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
    ...overrides,
  };
}
