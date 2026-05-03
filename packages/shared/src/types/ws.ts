/** Messages sent from client to server */
export type ClientMessage =
  | { type: "roll" }
  | { type: "move"; pieceId: string }
  | { type: "ready" }
  | { type: "rematch" };

/** Messages sent from server to client */
export type ServerMessage =
  | { type: "state"; payload: unknown }
  | { type: "rolled"; seat: number; value: number }
  | { type: "moved"; pieceId: string; to: string }
  | { type: "captured"; pieceId: string }
  | { type: "turn"; seat: number; deadline: number }
  | { type: "finished"; standings: number[] }
  | { type: "error"; message: string };
