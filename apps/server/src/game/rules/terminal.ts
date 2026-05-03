import { parseCell, HOME_COLUMN_LENGTH, TOKENS_PER_PLAYER } from "@ludo/shared";
import type { Token, SeatState, PlayerColor } from "@ludo/shared";

export interface SeatInfo {
  index: number;
  state: SeatState;
  color: PlayerColor;
}

export interface TerminalResult {
  /** Seat index that just finished (all tokens at H/si/4), or null */
  seatFinished: number | null;
  /** Seat index that wins by being the only active seat, or null */
  soleSurvivor: number | null;
  /** True if zero active seats remain (game should abort) */
  abort: boolean;
}

/**
 * Check for terminal conditions after a move or kick.
 *
 * - Win: all TOKENS_PER_PLAYER tokens of a color are at H/si/HOME_COLUMN_LENGTH
 * - Sole survivor: only 1 active seat remains
 * - Abort: 0 active seats remain
 */
export function checkTerminal(tokens: Token[], seats: SeatInfo[], standings: number[]): TerminalResult {
  const result: TerminalResult = {
    seatFinished: null,
    soleSurvivor: null,
    abort: false,
  };

  // Check for seat that just finished (all tokens home)
  const standingsSet = new Set(standings);
  for (const seat of seats) {
    if (seat.state !== "active") continue;
    if (standingsSet.has(seat.index)) continue;

    const seatTokens = tokens.filter((t) => t.color === seat.color);
    const allHome = seatTokens.length >= TOKENS_PER_PLAYER &&
      seatTokens.every((t) => {
        const p = parseCell(t.cell);
        return p.kind === "home" && p.index >= HOME_COLUMN_LENGTH;
      });

    if (allHome) {
      result.seatFinished = seat.index;
      break; // Only one seat can finish per check
    }
  }

  // Count active seats (excluding those already in standings)
  const activeSeats = seats.filter((s) => s.state === "active" && !standingsSet.has(s.index));

  if (activeSeats.length === 0) {
    result.abort = true;
  } else if (activeSeats.length === 1 && result.seatFinished === null) {
    result.soleSurvivor = activeSeats[0]!.index;
  }

  return result;
}
