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
import type { GameState, PlayerColor, Token } from "@ludo/shared";

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

/**
 * MOR-202 repro: the requester's token walks (forced roll of 6) over a stretch
 * of opponents arranged to cover every case the stack-count badge touches:
 *
 *   +2  one opponent (single)            — behind the stack, on the path
 *   +4  two opponents, different colors  — a genuine "2" stack the mover walks
 *                                          over (different colors so it is NOT
 *                                          a block, which would stop the mover)
 *   +5  one opponent (single)            — after the stack, on the path
 *   +6  empty                            — where the mover lands
 *   +7  two opponents                    — a second "2" stack just OFF the
 *                                          path, near the cluster: a control
 *                                          that must stay "2" untouched
 *
 * As the mover hops across, the badge must reflect only the settled, resting
 * cells: the single cells must never flash a "2", the +4 cell must stay "2"
 * (never "3") while the mover sits on it, and the off-path +7 stack must hold
 * a steady "2" throughout.
 */
const moveOverOpponents: DebugScenario = (state, requesterSeat) => {
  const seat = state.seats.find((s) => s.index === requesterSeat);
  if (!seat) return state;

  const S = state.seats.length;
  const trackLen = S * CELLS_PER_ARM;
  const entryParsed = parseCell(entrySquare(requesterSeat, S));
  const entryIdx = entryParsed.kind === "track" ? entryParsed.index : 0;
  const at = (offset: number) => track(((entryIdx + offset - 1 + trackLen) % trackLen) + 1);

  // Mover on the entry square; the rest parked in the yard, out of the way.
  const myTokens: Token[] = [
    { id: `${requesterSeat}-1`, color: seat.color, cell: at(0) },
    { id: `${requesterSeat}-2`, color: seat.color, cell: yard(requesterSeat, 2) },
    { id: `${requesterSeat}-3`, color: seat.color, cell: yard(requesterSeat, 3) },
    { id: `${requesterSeat}-4`, color: seat.color, cell: yard(requesterSeat, 4) },
  ];

  // Rebuild every opponent seat's tokens: place the few we want on the path,
  // park the rest in their yards. `positions[i]` overrides token i's cell.
  const opponentSeats = state.seats.filter((s) => s.index !== requesterSeat);
  const placeSeat = (seatIndex: number, color: PlayerColor, positions: string[]): Token[] =>
    state.tokens
      .filter((t) => t.color === color)
      .map((t, i) => ({ ...t, cell: positions[i] ?? yard(seatIndex, i + 1) }));

  const seatA = opponentSeats[0];
  const seatB = opponentSeats[1];

  let oppTokens: Token[] = [];
  if (seatA && seatB) {
    // Two opponent colors available. seatA covers the leading single (+2), one
    // half of the on-path +4 stack, and the off-path +7 pair (two same-color
    // tokens — a block, but harmless since the mover never reaches it). seatB
    // covers the other half of the +4 stack and the trailing single (+5).
    oppTokens = [
      ...placeSeat(seatA.index, seatA.color, [at(2), at(4), at(7), at(7)]),
      ...placeSeat(seatB.index, seatB.color, [at(4), at(5)]),
      ...opponentSeats.slice(2).flatMap((s) => placeSeat(s.index, s.color, [])),
    ];
  } else if (seatA) {
    // Only one opponent color (e.g. 2-player): the on-path mixed stack isn't
    // reachable, so just the leading/after singles plus the off-path +7 pair.
    oppTokens = placeSeat(seatA.index, seatA.color, [at(2), at(5), at(7), at(7)]);
  }

  // Any token belonging to neither the requester nor a repositioned opponent
  // seat is left untouched (normally none — every seat is one or the other).
  const untouched = state.tokens.filter(
    (t) => t.color !== seat.color && opponentSeats.every((s) => s.color !== t.color),
  );

  return {
    ...state,
    tokens: [...untouched, ...oppTokens, ...myTokens],
    activeSeat: requesterSeat,
    status: "moving",
    diceValue: 6,
    consecutiveSixes: 0,
  };
};

/** Registry of available dev scenarios, keyed by the name sent from the client. */
export const DEBUG_SCENARIOS: Record<string, DebugScenario> = {
  "home-stretch": homeStretch,
  "home-jump": homeJump,
  "move-over-opponents": moveOverOpponents,
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
