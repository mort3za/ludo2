import type { PlayerColor, SeatState } from "./player.js";
import type { BotPersonality } from "./ai.js";

/** Cell ID — slash-delimited string: Y/<seat>/<slot>, T/<index>, H/<seat>/<i> */
export type Cell = string;

export type GameStatus = "waiting" | "tiebreaker" | "rolling" | "moving" | "finished";

export interface Token {
  id: string;
  color: PlayerColor;
  cell: Cell;
}

export interface Seat {
  index: number;
  state: SeatState;
  color: PlayerColor;
  playerId: string | null;
  isBot: boolean;
  personality?: BotPersonality;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  seats: Seat[];
  tokens: Token[];
  activeSeat: number;
  diceValue: number | null;
  consecutiveSixes: number;
  standings: number[];
}
