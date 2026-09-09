/** Default lobby-configurable game options. */
export const DEFAULT_GAME_OPTIONS = {
  wallEnabled: false,
  autoMoveEnabled: true,
  timerEnabled: false,
  startGuardEnabled: true,
  consecutiveSixLimitEnabled: false,
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
  /**
   * Hold after the dice has already settled on its value. Pure dead time — no
   * animation is attached to it — and it gates the "moved" message, so every
   * extra millisecond here is a millisecond the token sits still after a roll.
   */
  diceShow: 300,
  turnPass: 500,
  /**
   * Time a token spends travelling one cell. Single source of truth: it is
   * both the delay between path steps and the CSS transition duration in
   * BoardView, so consecutive hops chain seamlessly into one glide. If the
   * transition were longer than the step delay, every hop would be cut off
   * mid-flight and the token would visibly trail its real cell.
   */
  tokenStep: 140,
  turnTimeout: 30_000,
  kickAfterMisses: 3,
  // How long a finished game's room stays alive so players can view the result
  // and rematch on the same link before it's reclaimed.
  postGameWindow: 15 * 60_000,
  idleRoomExpiry: 15 * 60_000,
  // Absolute lifetime of a match link, measured from room creation. Once it
  // elapses the room is soft-deleted and the link stops resolving, whatever
  // phase it was in — the backstop for rooms the windows above never reclaim
  // (a "playing" room is never idle-expired).
  matchLifetime: 24 * 60 * 60_000,
  gameRetention: 24 * 60 * 60_000,
} as const;
