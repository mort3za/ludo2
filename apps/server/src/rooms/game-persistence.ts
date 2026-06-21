import type { GameState } from "@ludo/shared";
import { createRoom, type Room, type RoomMember } from "./room.js";
import { createGameSession, startTurnDeadline, type GameSession } from "./game-session.js";

/**
 * Everything needed to reconstruct an in-progress game (room + session) after a
 * server restart. The full GameState already carries tokens, turn, dice, etc;
 * the rest restores the bits that live outside GameState.
 */
interface PersistedGame {
  state: GameState;
  /** Per-seat missed-turn counters — preserved so the kick rule stays correct. */
  seatMisses: [number, number][];
  /** Room roster so reconnecting players are recognised as existing members. */
  members: RoomMember[];
  ownerId: string | null;
  boardSize: number;
}

/** Serialize a live room + session into a JSON blob for the games table. */
export function serializeGame(room: Room, session: GameSession): string {
  const data: PersistedGame = {
    state: session.state,
    seatMisses: [...session.seatMisses.entries()],
    members: [...room.members.values()],
    ownerId: room.ownerId,
    boardSize: room.boardSize,
  };
  return JSON.stringify(data);
}

/**
 * Rebuild a room + session from a persisted blob. Returns null if the JSON is
 * malformed. The turn clock is started fresh — a resumed turn gets a full timer.
 */
export function deserializeGame(
  roomId: string,
  json: string,
  now: number,
): { room: Room; session: GameSession } | null {
  let data: PersistedGame;
  try {
    data = JSON.parse(json) as PersistedGame;
  } catch {
    return null;
  }
  if (!data || !data.state) return null;

  const room = createRoom(roomId, data.boardSize, now);
  room.phase = "playing";
  room.gameId = data.state.gameId;
  room.ownerId = data.ownerId;
  room.options = data.state.options;
  for (const member of data.members) {
    room.members.set(member.playerId, member);
  }

  const session = createGameSession(data.state);
  session.seatMisses = new Map(data.seatMisses);
  startTurnDeadline(session);

  return { room, session };
}
