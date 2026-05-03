/** Default rule flags */
export const DEFAULT_RULES = {
  extraTurnOnSix: true,
  captureSendsHome: true,
  mustRollSixToStart: true,
} as const;

/** Timing defaults (milliseconds) */
export const TIMINGS = {
  turnTimeout: 30_000,
  kickAfterMisses: 3,
  postGameWindow: 60_000,
  idleRoomExpiry: 15 * 60_000,
  gameRetention: 24 * 60 * 60_000,
} as const;
