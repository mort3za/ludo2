import type { Cell, GameState } from "./game.js";

/** Messages sent from client to server */
export type ClientMessage =
  | { type: "ready" }
  | { type: "roll" }
  | { type: "move"; tokenId: string }
  | { type: "rematch" };

/** Messages sent from server to client */
export type ServerMessage =
  | { type: "error"; message: string }
  | { type: "state"; state: GameState }
  | { type: "rolled"; seat: number; value: number }
  | { type: "moved"; tokenId: string; to: Cell }
  | { type: "captured"; tokenId: string }
  | { type: "turn"; seat: number; deadline: number }
  | { type: "finished"; standings: number[] }
  | { type: "kicked"; seat: number };
