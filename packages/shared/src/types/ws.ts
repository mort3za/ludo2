import type { Cell, GameState, GameOptions } from "./game.js";

/** Messages sent from client to server */
export type ClientMessage =
  | { type: "ready" }
  | { type: "start" }
  | { type: "roll" }
  | { type: "move"; tokenId: string }
  /** Request a fresh authoritative state — recovers the client from any desync. */
  | { type: "resync" }
  | { type: "rematch" }
  | { type: "add_bot" }
  | { type: "remove_player"; playerId: string }
  /** Lobby-only, owner-only: set the game options for the upcoming game. */
  | { type: "set_options"; options: GameOptions }
  /** Lobby-only: change the sender's own display name. */
  | { type: "set_name"; name: string }
  /** Dev-only: replace the live game state with a named test scenario. Ignored in production. */
  | { type: "debug_set_state"; scenario: string }
  /** Dev-only: undo the last roll/move/timeout, restoring the prior state. Ignored in production. */
  | { type: "debug_undo" }
  /** Dev-only: force the given seat's next roll to a fixed value (1-6). Ignored in production. */
  | { type: "debug_set_dice"; seat: number; value: number };

export interface LobbyPlayer {
  playerId: string;
  name: string;
  ready: boolean;
  isBot: boolean;
  connected: boolean;
}

/** Messages sent from server to client */
export type ServerMessage =
  | { type: "error"; message: string }
  | {
      type: "lobby";
      players: LobbyPlayer[];
      ownerId: string;
      capacity: number;
      options: GameOptions;
    }
  | { type: "state"; state: GameState }
  | { type: "rolled"; seat: number; value: number }
  | { type: "moved"; tokenId: string; to: Cell; path: Cell[] }
  | { type: "captured"; tokenId: string; to: Cell }
  | { type: "presence"; seat: number; connected: boolean }
  | { type: "turn"; seat: number; deadline: number }
  | { type: "finished"; standings: number[] }
  | { type: "kicked"; seat: number };
