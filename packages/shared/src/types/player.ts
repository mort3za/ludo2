export type PlayerColor =
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "purple"
  | "orange"
  | "cyan"
  | "pink";

export type SeatState = "active" | "vacant" | "empty";

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
}
