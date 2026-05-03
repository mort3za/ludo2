export type PlayerColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "purple"
  | "teal"
  | "pink";

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
}
