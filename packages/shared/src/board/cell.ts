import { HOME_COLUMN_LENGTH, TOKENS_PER_PLAYER } from "../constants/board.js";

export type ParsedYard = { kind: "yard"; seat: number; slot: number };
export type ParsedTrack = { kind: "track"; index: number };
export type ParsedHome = { kind: "home"; seat: number; index: number };
export type ParsedCell = ParsedYard | ParsedTrack | ParsedHome;

function positiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Expected positive integer, got "${value}"`);
  }
  return n;
}

export function parseCell(cellId: string): ParsedCell {
  if (!cellId) throw new Error("Empty cell ID");

  const parts = cellId.split("/");
  const prefix = parts[0];

  switch (prefix) {
    case "Y": {
      if (parts.length !== 3) throw new Error(`Invalid yard cell: "${cellId}"`);
      const seat = positiveInt(parts[1]!);
      const slot = positiveInt(parts[2]!);
      if (slot > TOKENS_PER_PLAYER) {
        throw new Error(`Yard slot ${slot} exceeds M=${TOKENS_PER_PLAYER}`);
      }
      return { kind: "yard", seat, slot };
    }
    case "T": {
      if (parts.length !== 2) throw new Error(`Invalid track cell: "${cellId}"`);
      const index = positiveInt(parts[1]!);
      return { kind: "track", index };
    }
    case "H": {
      if (parts.length !== 3) throw new Error(`Invalid home cell: "${cellId}"`);
      const seat = positiveInt(parts[1]!);
      const index = positiveInt(parts[2]!);
      if (index > HOME_COLUMN_LENGTH) {
        throw new Error(`Home index ${index} exceeds L=${HOME_COLUMN_LENGTH}`);
      }
      return { kind: "home", seat, index };
    }
    default:
      throw new Error(`Unknown cell prefix: "${prefix}"`);
  }
}

export function yard(seat: number, slot: number): string {
  return `Y/${seat}/${slot}`;
}

export function track(index: number): string {
  return `T/${index}`;
}

export function home(seat: number, index: number): string {
  return `H/${seat}/${index}`;
}
