import { DEFAULT_GAME_OPTIONS } from "@ludo/shared";
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
    options: { ...DEFAULT_GAME_OPTIONS },
    ...overrides,
  };
}

/**
 * Create a state where a bot must decide which token to move.
 * Useful for testing bot move-selection logic.
 *
 * Example: `botDecisionState(1, 4)` — seat 1 (blue) must move with dice=4.
 */
export function botDecisionState(botSeat: number, diceValue: number): GameState {
  const colors: PlayerColor[] = ["blue", "red", "yellow", "green"];
  const numSeats = 2;
  const seats = Array.from({ length: numSeats }, (_, i) =>
    seat(i, colors[i]!, { isBot: i === botSeat }),
  );

  // Create 4 tokens per player, all in home (before "S/0")
  const tokens: Token[] = [];
  for (let i = 0; i < numSeats; i++) {
    for (let j = 0; j < 4; j++) {
      tokens.push(tok(`${colors[i]![0]}${j}`, colors[i]!, "H"));
    }
  }

  return makeState({
    seats,
    tokens,
    activeSeat: botSeat,
    status: "moving",
    diceValue,
  });
}

/**
 * Create a state for testing bot opening (rolling from home).
 * Bot is in lobby, ready to start.
 */
export function botLobbyState(botSeat: number = 0): GameState {
  return makeState({
    seats: [seat(0, "blue", { isBot: botSeat === 0 }), seat(1, "red", { isBot: botSeat === 1 })],
    status: "rolling",
    activeSeat: botSeat,
  });
}
