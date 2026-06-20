import { TIMINGS, type ServerMessage, legalMoves } from "@ludo/shared";
import {
  getPendingRollHoldMs,
  handleRoll,
  handleMove,
  type GameSession,
} from "../../rooms/game-session.js";
import { pickMove } from "./picker.js";

const ROLL_DELAY_MS = 800;
const MOVE_DELAY_MS = 600;

/**
 * Schedule the bot's turn for the current activeSeat.
 * No-ops if the active seat is not a bot or the game is finished.
 *
 * The broadcast callback receives each batch of ServerMessages to send
 * to all connected clients.
 */
export function scheduleBotTurn(
  session: GameSession,
  broadcast: (msgs: ServerMessage[]) => void,
): void {
  const { state } = session;
  if (state.status === "finished") return;

  const activeSeat = state.seats.find((s) => s.index === state.activeSeat);
  if (!activeSeat?.isBot) return;

  const rollDelayMs = Math.max(ROLL_DELAY_MS, getPendingRollHoldMs(session) + TIMINGS.turnPass);
  setTimeout(() => {
    if (state.status === "finished") return;

    const rollMsgs = handleRoll(session);
    broadcast(rollMsgs);

    const hasFinished = rollMsgs.some((m) => m.type === "finished");
    if (hasFinished) return;

    if (session.state.status === "moving") {
      // Multiple legal moves — bot must pick one
      const moveDelayMs = Math.max(MOVE_DELAY_MS, getPendingRollHoldMs(session));
      setTimeout(() => {
        if (session.state.status === "finished") return;

        const seatTokens = session.state.tokens.filter(
          (t) => session.colorToSeat[t.color] === session.state.activeSeat,
        );
        const moves = legalMoves(
          seatTokens,
          session.state.diceValue ?? 0,
          session.state.activeSeat,
          session.state.seats.length,
          session.state.tokens,
          session.state.options.wallEnabled,
        );

        if (moves.length === 0) return;

        const currentActiveSeat = session.state.seats.find(
          (s) => s.index === session.state.activeSeat,
        );
        const chosen = pickMove(
          moves,
          session.state,
          session.state.activeSeat,
          currentActiveSeat?.personality,
        );
        const moveMsgs = handleMove(session, chosen.tokenId);
        broadcast(moveMsgs);

        // Extra turn or turn advanced — reschedule if bot is still active
        maybeRescheduleSelf(session, broadcast);
      }, moveDelayMs);
    } else {
      // Turn was auto-handled (no-legal-moves pass, single forced move, or forfeit)
      maybeRescheduleSelf(session, broadcast);
    }
  }, rollDelayMs);
}

function maybeRescheduleSelf(
  session: GameSession,
  broadcast: (msgs: ServerMessage[]) => void,
): void {
  if (session.state.status === "finished") return;
  const next = session.state.seats.find((s) => s.index === session.state.activeSeat);
  if (next?.isBot) scheduleBotTurn(session, broadcast);
}
