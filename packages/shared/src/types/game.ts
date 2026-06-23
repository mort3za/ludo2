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
  /** Display name, snapshotted from the lobby member when the game starts. */
  name?: string;
}

/** Per-game options chosen in the lobby before the game starts. */
export interface GameOptions {
  /**
   * When true, two same-color tokens on a track cell form a wall: opponents
   * can neither pass over it nor capture those tokens. Default off.
   */
  wallEnabled: boolean;
  /**
   * When true, a human's turn is resolved automatically when only one legal
   * move exists. Default on. Bots always auto-resolve regardless.
   */
  autoMoveEnabled: boolean;
  /**
   * When true, each turn is capped by the 30s turn timer; when false, players
   * have unlimited time and missed-turn kicks are disabled. Default on.
   */
  timerEnabled: boolean;
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
  options: GameOptions;
}
