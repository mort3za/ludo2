import { replay, type GameSnapshot, type LogEntry } from "../game/snapshots/game-log.js";

export interface GameSession {
  gameId: string;
  initialSnapshot: GameSnapshot;
  log: LogEntry[];
  /** Per-seat missed-turn counters — NOT reset on reconnect */
  seatMisses: Map<number, number>;
}

type Ok = { ok: true; snapshot: GameSnapshot };
type Err = { ok: false; error: string };
type ReconnectResult = Ok | Err;
export type { ReconnectResult };

/**
 * Handle a player reconnecting to an in-progress game.
 * Replays the log from the initial snapshot to produce the current state.
 * Does NOT reset the missed-turn counter — reconnect is passive resync only.
 */
export function handleReconnect(session: GameSession, playerId: string): ReconnectResult {
  const seat = session.initialSnapshot.seats.find((s) => s.playerId === playerId);
  if (!seat) {
    return { ok: false, error: "not-in-game" };
  }

  const snapshot = replay(session.initialSnapshot, session.log);
  return { ok: true, snapshot };
}
