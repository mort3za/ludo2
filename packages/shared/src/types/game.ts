import type { PlayerColor } from "./player.js";

export type GameStatus = "waiting" | "rolling" | "moving" | "finished";

export interface Piece {
  id: string;
  color: PlayerColor;
  position: Cell;
}

export type Cell = string; // e.g. "Y/1/1", "T/5", "H/2/3"

export interface GameState {
  status: GameStatus;
  pieces: Piece[];
  activeSeat: number;
  diceValue: number | null;
}
