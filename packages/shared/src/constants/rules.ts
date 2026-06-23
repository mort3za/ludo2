/** Default lobby-configurable game options. */
export const DEFAULT_GAME_OPTIONS = {
  wallEnabled: false,
  autoMoveEnabled: true,
  timerEnabled: false,
  startGuardEnabled: true,
} as const;

/** Default rule flags */
export const DEFAULT_RULES = {
  extraTurnOnSix: true,
  captureSendsHome: true,
  mustRollSixToStart: true,
  consecutiveSixLimit: 3,
} as const;

/** Timing defaults (milliseconds unless noted) */
export const TIMINGS = {
  diceReveal: 800,
  diceShow: 800,
  turnPass: 500,
  turnTimeout: 30_000,
  kickAfterMisses: 3,
  // How long a finished game's room stays alive so players can view the result
  // and rematch on the same link before it's reclaimed.
  postGameWindow: 15 * 60_000,
  idleRoomExpiry: 15 * 60_000,
  gameRetention: 24 * 60 * 60_000,
} as const;
