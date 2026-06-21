import { parseCell, CELLS_PER_ARM, type BotPersonality } from "@ludo/shared";
import type { LegalMove, GameState } from "@ludo/shared";

interface Weights {
  capture: number;
  deploy: number;
  escape: number;
  progress: number;
}

const PROFILES: Record<BotPersonality, Weights> = {
  // Captures dominate; low regard for safety. Legacy behavior baseline.
  aggressor: { capture: 1000, deploy: 500, escape: 300, progress: 1 },
  // Safety-first, but kicking stays a strong priority (just below escaping).
  defender: { capture: 800, deploy: 250, escape: 900, progress: 1 },
  // Advancement + eager deploy lead, but kicking is now a strong priority too.
  sprinter: { capture: 700, deploy: 800, escape: 200, progress: 5 },
};

const DEFAULT_PERSONALITY: BotPersonality = "aggressor";

/**
 * A track token is "near home" when it sits within one die roll of its home
 * entry square — i.e. close to finishing. Such a token has the most to lose
 * if kicked back to the yard, so saving it can outrank a capture.
 */
const NEAR_HOME_WINDOW = 6;

/**
 * Pick the best legal move for a bot seat using heuristics weighted by personality.
 *
 * Uses a weighted scoring system where moves are evaluated on four dimensions:
 * - Capture: landing on a lone opponent token
 * - Deploy: moving a token from yard (roll of 6)
 * - Escape: moving from a cell threatened by opponent within 1–6 rolls
 * - Progress: advancement toward home
 *
 * The personality (aggressor/defender/sprinter) sets the weights; randomness is only
 * in personality assignment, not move selection (deterministic given a personality).
 */
export function pickMove(
  legalMoves: LegalMove[],
  state: GameState,
  mySeat: number,
  personality?: BotPersonality,
): LegalMove {
  if (legalMoves.length === 0) throw new Error("pickMove called with empty legalMoves");
  if (legalMoves.length === 1) return legalMoves[0]!;

  // Use the active seat's personality, or default to aggressor.
  const activeSeatPersonality =
    personality ?? state.seats.find((s) => s.index === mySeat)?.personality ?? DEFAULT_PERSONALITY;

  const weights = PROFILES[activeSeatPersonality];
  const myColor = state.seats.find((s) => s.index === mySeat)?.color;
  const trackLen = state.seats.length * CELLS_PER_ARM;
  const startIdx = (mySeat - 1) * CELLS_PER_ARM + 1;

  let best = legalMoves[0]!;
  let bestScore = score(best, state, myColor, mySeat, trackLen, startIdx, weights);

  for (let i = 1; i < legalMoves.length; i++) {
    const s = score(legalMoves[i]!, state, myColor, mySeat, trackLen, startIdx, weights);
    if (s > bestScore) {
      bestScore = s;
      best = legalMoves[i]!;
    }
  }

  return best;
}

function score(
  move: LegalMove,
  state: GameState,
  myColor: string | undefined,
  mySeat: number,
  trackLen: number,
  startIdx: number,
  weights: Weights,
): number {
  const progress = tokenProgress(move.to, trackLen, startIdx);
  const fromParsed = parseCell(move.from);
  const inDanger = isInDanger(move.from, state, myColor, trackLen);

  // Highest priority: rescue a threatened token that is near home. Losing a
  // nearly-finished token costs the most progress, so for every personality
  // this beats a plain capture (capture + escape weights combined).
  if (inDanger && isNearHome(move.from, trackLen, startIdx)) {
    return weights.capture + weights.escape + progress;
  }

  if (isCapture(move.to, state, myColor)) return weights.capture + progress;

  if (fromParsed.kind === "yard") return weights.deploy;

  if (inDanger) return weights.escape + progress;

  return weights.progress * progress;
}

/** True when a track cell is within one die roll of its seat's home entry. */
function isNearHome(fromCell: string, trackLen: number, startIdx: number): boolean {
  const parsed = parseCell(fromCell);
  if (parsed.kind !== "track") return false;
  const progress = tokenProgress(fromCell, trackLen, startIdx);
  // Max track progress (the entry square) is trackLen - 1.
  return progress >= trackLen - 1 - NEAR_HOME_WINDOW;
}

/** True when destination is a track cell with exactly one opponent token. */
function isCapture(to: string, state: GameState, myColor: string | undefined): boolean {
  const parsed = parseCell(to);
  if (parsed.kind !== "track") return false;
  const opponents = state.tokens.filter((t) => t.cell === to && t.color !== myColor);
  return opponents.length === 1;
}

/** True when an opponent token is 1–6 clockwise steps behind `fromCell` on the track. */
function isInDanger(
  fromCell: string,
  state: GameState,
  myColor: string | undefined,
  trackLen: number,
): boolean {
  const parsed = parseCell(fromCell);
  if (parsed.kind !== "track") return false;

  for (const token of state.tokens) {
    if (token.color === myColor) continue;
    const tp = parseCell(token.cell);
    if (tp.kind !== "track") continue;
    const dist = (parsed.index - tp.index + trackLen) % trackLen;
    if (dist >= 1 && dist <= 6) return true;
  }
  return false;
}

/** How far this cell is from seat's start square (higher = more advanced). */
function tokenProgress(cell: string, trackLen: number, startIdx: number): number {
  const parsed = parseCell(cell);
  if (parsed.kind === "yard") return 0;
  if (parsed.kind === "home") return trackLen + parsed.index;
  return (parsed.index - startIdx + trackLen) % trackLen;
}
