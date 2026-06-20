import { drawPalette, yard, TOKENS_PER_PLAYER, MIN_SEATS, MAX_SEATS } from "@ludo/shared";
import type { GameState, Token, Seat } from "@ludo/shared";
import type { PlayerColor } from "@ludo/shared";
import type { Rng } from "../game/rng/rng.js";
import type { Room } from "../rooms/room.js";

/**
 * Create the initial GameState from a room's members.
 * Assigns seats, draws colors, creates tokens in yards.
 */
export function initGame(room: Room, gameId: string, rng: Rng): GameState {
  // Board size is derived from the actual players: one corner per player, clamped
  // to [MIN_SEATS, MAX_SEATS]. Fewer than MIN_SEATS players still use the full layout.
  const S = Math.min(Math.max(room.members.size, MIN_SEATS), MAX_SEATS);
  const colors = drawPalette(S, () => rng.random()) as PlayerColor[];

  // Sort so human members always precede bots — ensures human gets seat 1.
  const memberList = Array.from(room.members.entries()).sort(([, a], [, b]) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "human" ? -1 : 1;
  });
  const playerCount = memberList.length;
  const seats: Seat[] = [];
  const tokens: Token[] = [];

  // For 2-player games, place players at opposite seats (1 & 3)
  const occupiedSeats =
    playerCount === 2 && S === 4 ? [1, 3] : Array.from({ length: playerCount }, (_, i) => i + 1);

  for (let i = 0; i < S; i++) {
    const seatIndex = i + 1;
    const playerIdx = occupiedSeats.indexOf(seatIndex);
    const member = playerIdx !== -1 ? memberList[playerIdx] : undefined;
    const color = colors[i]!;

    seats.push({
      index: seatIndex,
      state: member ? "active" : "empty",
      color,
      playerId: member ? member[0] : null,
      isBot: member ? member[1].kind === "bot" : false,
      personality: member && member[1].kind === "bot" ? member[1].personality : undefined,
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
    options: { ...room.options },
  };
}
