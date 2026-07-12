import type { Token, PlayerColor, SeatState, GameStatus } from "@ludo/shared";

export interface SnapshotSeat {
  index: number;
  state: SeatState;
  color: PlayerColor;
  playerId: string | null;
  consecutiveMisses: number;
}

export interface GameSnapshot {
  seats: SnapshotSeat[];
  tokens: Token[];
  activeSeat: number;
  diceValue: number | null;
  consecutiveSixes: number;
  standings: number[];
  status: GameStatus;
}

export type LogEntry =
  | { type: "roll"; seat: number; value: number }
  | { type: "move"; seat: number; tokenId: string; from: string; to: string }
  | { type: "capture"; tokenId: string; returnTo: string }
  | { type: "kick"; seat: number }
  | { type: "end-turn"; seat: number; nextSeat: number }
  | { type: "finish"; seat: number }
  | { type: "forfeit"; seat: number };

/**
 * Create an empty game log.
 */
export function createGameLog(): LogEntry[] {
  return [];
}

/**
 * Append an entry to the log (immutable).
 */
export function appendEntry(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return [...log, entry];
}

/**
 * Replay a log against an initial snapshot to reconstruct game state.
 * Each entry is applied sequentially and deterministically.
 */
export function replay(initial: GameSnapshot, log: LogEntry[]): GameSnapshot {
  let state = cloneSnapshot(initial);

  for (const entry of log) {
    state = applyEntry(state, entry);
  }

  return state;
}

function cloneSnapshot(snap: GameSnapshot): GameSnapshot {
  return {
    seats: snap.seats.map((s) => ({ ...s })),
    tokens: snap.tokens.map((t) => ({ ...t })),
    activeSeat: snap.activeSeat,
    diceValue: snap.diceValue,
    consecutiveSixes: snap.consecutiveSixes,
    standings: [...snap.standings],
    status: snap.status,
  };
}

function applyEntry(state: GameSnapshot, entry: LogEntry): GameSnapshot {
  switch (entry.type) {
    case "roll": {
      state.diceValue = entry.value;
      state.status = "moving";
      return state;
    }

    case "move": {
      const token = state.tokens.find((t) => t.id === entry.tokenId);
      if (token) {
        token.cell = entry.to;
      }
      return state;
    }

    case "capture": {
      const token = state.tokens.find((t) => t.id === entry.tokenId);
      if (token) {
        token.cell = entry.returnTo;
      }
      return state;
    }

    case "kick": {
      const seat = state.seats.find((s) => s.index === entry.seat);
      if (seat) {
        seat.state = "vacant";
        // Remove all tokens of this seat's color
        state.tokens = state.tokens.filter((t) => t.color !== seat.color);
      }
      return state;
    }

    case "end-turn": {
      state.activeSeat = entry.nextSeat;
      state.diceValue = null;
      state.consecutiveSixes = 0;
      state.status = "rolling";
      return state;
    }

    case "finish": {
      if (!state.standings.includes(entry.seat)) {
        state.standings.push(entry.seat);
      }
      return state;
    }

    case "forfeit": {
      state.diceValue = null;
      state.consecutiveSixes = 0;
      return state;
    }

    default:
      return state;
  }
}
