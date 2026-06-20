import {
  home,
  track,
  parseCell,
  entrySquare,
  CELLS_PER_ARM,
  HOME_COLUMN_LENGTH,
  TOKENS_PER_PLAYER,
} from "@ludo/shared";
import type { GameState, Token } from "@ludo/shared";

/**
 * A dev-only scenario builder. Takes the live game state plus the seat of the
 * player who requested the scenario and returns a replacement `GameState`.
 * Scenarios keep the existing seats/colors so the session's `colorToSeat`
 * mapping stays valid — they only reposition tokens and tweak turn/dice fields.
 */
export type DebugScenario = (state: GameState, requesterSeat: number) => GameState;

/**
 * MOR-200 repro: stack the requester's tokens across the four final home
 * squares and force a roll of 1, so the home-stretch selection bug surfaces
 * (pieces blink as selectable but cannot legally move).
 */
const homeStretch: DebugScenario = (state, requesterSeat) => {
  const seat = state.seats.find((s) => s.index === requesterSeat);
  if (!seat) return state;

  // Replace this seat's tokens; leave every other token where it is.
  const others = state.tokens.filter((t) => t.color !== seat.color);
  const homeTokens: Token[] = Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({
    id: `${requesterSeat}-${i + 1}`,
    color: seat.color,
    cell: home(requesterSeat, Math.min(i + 1, HOME_COLUMN_LENGTH)),
  }));

  // Pull one token 6 cells back onto the main track so it has a legal forward
  // move with the forced roll of 1, confirming selectable tokens still render
  // while the remaining stacked home tokens stay stuck.
  const S = state.seats.length;
  const trackLen = S * CELLS_PER_ARM;
  const entryParsed = parseCell(entrySquare(requesterSeat, S));
  const entryIdx = entryParsed.kind === "track" ? entryParsed.index : 0;
  const backIdx = ((entryIdx - 6 - 1 + trackLen) % trackLen) + 1;
  homeTokens[0]!.cell = track(backIdx);

  return {
    ...state,
    tokens: [...others, ...homeTokens],
    activeSeat: requesterSeat,
    status: "moving",
    diceValue: 1,
    consecutiveSixes: 0,
  };
};

/** Registry of available dev scenarios, keyed by the name sent from the client. */
export const DEBUG_SCENARIOS: Record<string, DebugScenario> = {
  "home-stretch": homeStretch,
};

/** Apply a named scenario, or return `null` if the name is unknown. */
export function applyDebugScenario(
  state: GameState,
  scenario: string,
  requesterSeat: number,
): GameState | null {
  const fn = DEBUG_SCENARIOS[scenario];
  return fn ? fn(state, requesterSeat) : null;
}
