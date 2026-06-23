import {
  home,
  track,
  yard,
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

/**
 * Home jump-over repro: a resident token sits mid home-column while another
 * token stands on the home-entry square. With the forced roll of 3 the
 * approach token turns into the home column and must jump *over* the resident
 * to land on an empty home cell — the move that was wrongly rejected before.
 *
 * The red seat's tokens are pushed one cell past the approach token (and into
 * the yard) so red can neither capture nor be captured by the jump this turn.
 */
const homeJump: DebugScenario = (state, requesterSeat) => {
  const seat = state.seats.find((s) => s.index === requesterSeat);
  if (!seat) return state;

  const S = state.seats.length;
  const trackLen = S * CELLS_PER_ARM;
  const entryParsed = parseCell(entrySquare(requesterSeat, S));
  const entryIdx = entryParsed.kind === "track" ? entryParsed.index : 0;
  // On the home-entry square: a roll of 3 turns into home and lands on
  // H/<seat>/3, passing over the resident parked at H/<seat>/2.
  const approachIdx = entryIdx;

  const myTokens: Token[] = [
    { id: `${requesterSeat}-1`, color: seat.color, cell: home(requesterSeat, 2) },
    { id: `${requesterSeat}-2`, color: seat.color, cell: track(approachIdx) },
    { id: `${requesterSeat}-3`, color: seat.color, cell: yard(requesterSeat, 3) },
    { id: `${requesterSeat}-4`, color: seat.color, cell: yard(requesterSeat, 4) },
  ];

  // Park the red seat ahead of the approach token (one cell on, rest in yard).
  const redSeat = state.seats.find((s) => s.color === "red" && s.index !== requesterSeat);
  const others = state.tokens.filter(
    (t) => t.color !== seat.color && (!redSeat || t.color !== redSeat.color),
  );
  const aheadIdx = (approachIdx % trackLen) + 1;
  const redTokens: Token[] = redSeat
    ? state.tokens
        .filter((t) => t.color === redSeat.color)
        .map((t, i) =>
          i === 0 ? { ...t, cell: track(aheadIdx) } : { ...t, cell: yard(redSeat.index, i + 1) },
        )
    : [];

  return {
    ...state,
    tokens: [...others, ...redTokens, ...myTokens],
    activeSeat: requesterSeat,
    status: "moving",
    diceValue: 3,
    consecutiveSixes: 0,
  };
};

/** Registry of available dev scenarios, keyed by the name sent from the client. */
export const DEBUG_SCENARIOS: Record<string, DebugScenario> = {
  "home-stretch": homeStretch,
  "home-jump": homeJump,
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
