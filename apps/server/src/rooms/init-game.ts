import { drawPalette, yard, TOKENS_PER_PLAYER } from "@ludo/shared";
import type { GameState, Token, Seat } from "@ludo/shared";
import type { PlayerColor } from "@ludo/shared";
import type { Rng } from "../game/rng/rng.js";
import type { Room } from "../rooms/room.js";

/**
 * Create the initial GameState from a room's members.
 * Assigns seats, draws colors, creates tokens in yards.
 */
export function initGame(room: Room, gameId: string, rng: Rng): GameState {
  const S = room.boardSize;
  const colors = drawPalette(S, () => rng.random()) as PlayerColor[];

  const memberList = Array.from(room.members.entries());
  const seats: Seat[] = [];
  const tokens: Token[] = [];

  for (let i = 0; i < S; i++) {
    const member = memberList[i];
    const seatIndex = i + 1;
    const color = colors[i]!;

    seats.push({
      index: seatIndex,
      state: member ? "active" : "empty",
      color,
      playerId: member ? member[0] : null,
    });

    if (!member) continue;

    // Create tokens in yard
    for (let t = 1; t <= TOKENS_PER_PLAYER; t++) {
      tokens.push({
        id: `${seatIndex}-${t}`,
        color,
        cell: yard(seatIndex, t),
      });
    }
  }

  return {
    gameId,
    status: "rolling",
    seats,
    tokens,
    activeSeat: seats.find((s) => s.state === "active")?.index ?? 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
  };
}
