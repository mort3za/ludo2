/** Minimum and maximum number of seats (players) */
export const MIN_SEATS = 4;
export const MAX_SEATS = 8;

/** Cells per arm on the track */
export const CELLS_PER_ARM = 11;

/** Home column length */
export const HOME_COLUMN_LENGTH = 4;

/** Tokens per player */
export const TOKENS_PER_PLAYER = 4;

/** All 8 available colors in seat order */
export const COLOR_PALETTE = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "orange",
  "cyan",
  "pink",
] as const;

/**
 * Priority-ordered colors: classic red/blue/green/yellow first,
 * then the rest. `drawPalette` picks from this order so that
 * 2-4 player games always use the classic four.
 */
export const COLOR_PRIORITY = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "cyan",
  "pink",
] as const;
