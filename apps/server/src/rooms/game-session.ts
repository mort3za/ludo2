import type { GameState, ServerMessage, Token } from "@ludo/shared";
import { DEFAULT_RULES, TIMINGS } from "@ludo/shared";
import { resolveRoll } from "../game/actions/roll.js";
import { applyMove } from "../game/actions/move.js";
import { legalMoves, type LegalMove } from "../game/validators/legal-moves.js";
import { createCryptoRng, type Rng } from "../game/rng/rng.js";
import { checkTerminal } from "../game/rules/terminal.js";
import { updateStandings, isGameOver } from "../game/rules/standings.js";
import { handleMissedTurn, applyKick } from "../game/actions/timeout.js";

export interface GameSession {
  state: GameState;
  rng: Rng;
  colorToSeat: Record<string, number>;
  seatMisses: Map<number, number>;
}

export function createGameSession(state: GameState): GameSession {
  const rng = createCryptoRng();
  const colorToSeat: Record<string, number> = {};
  for (const seat of state.seats) {
    colorToSeat[seat.color] = seat.index;
  }
  return { state, rng, colorToSeat, seatMisses: new Map() };
}

export function handleRoll(session: GameSession): ServerMessage[] {
  const { state, rng } = session;
  if (state.status !== "rolling") return [{ type: "error", message: "not-rolling" }];

  // Player acted — reset their miss counter
  session.seatMisses.set(state.activeSeat, 0);

  const outcome = resolveRoll(rng, state.consecutiveSixes, DEFAULT_RULES);
  state.diceValue = outcome.value;
  state.consecutiveSixes = outcome.newConsecutiveSixes;

  const messages: ServerMessage[] = [];
  messages.push({ type: "rolled", seat: state.activeSeat, value: outcome.value });

  if (outcome.forfeit) {
    // Three consecutive sixes — forfeit turn
    state.consecutiveSixes = 0;
    advanceTurn(session, messages);
    return messages;
  }

  // Check legal moves
  const seatTokens = state.tokens.filter((t) => session.colorToSeat[t.color] === state.activeSeat);
  const moves = legalMoves(
    seatTokens,
    outcome.value,
    state.activeSeat,
    state.seats.length,
    state.tokens,
  );

  if (moves.length === 0) {
    // No legal moves — auto-pass
    if (!outcome.extraTurn) {
      advanceTurn(session, messages);
    } else {
      state.status = "rolling";
      messages.push({ type: "turn", seat: state.activeSeat, deadline: Date.now() + 30000 });
    }
    return messages;
  }

  if (moves.length === 1) {
    // Forced move — auto-pick
    return [...messages, ...handleMove(session, moves[0]!.tokenId)];
  }

  // Multiple legal moves — wait for player pick
  state.status = "moving";
  return messages;
}

export function handleMove(session: GameSession, tokenId: string): ServerMessage[] {
  const { state } = session;
  const messages: ServerMessage[] = [];

  if (state.status !== "moving" && state.status !== "rolling") {
    return [{ type: "error", message: "not-moving" }];
  }

  const seatTokens = state.tokens.filter((t) => session.colorToSeat[t.color] === state.activeSeat);
  const moves = legalMoves(
    seatTokens,
    state.diceValue ?? 0,
    state.activeSeat,
    state.seats.length,
    state.tokens,
  );
  const move = moves.find((m) => m.tokenId === tokenId);
  if (!move) {
    return [{ type: "error", message: "illegal-move" }];
  }

  const result = applyMove(
    state.tokens,
    tokenId,
    move.to,
    state.activeSeat,
    state.seats.length,
    session.colorToSeat,
  );
  state.tokens = result.tokens;

  messages.push({ type: "moved", tokenId, to: move.to });

  if (result.captured) {
    messages.push({ type: "captured", tokenId: result.captured });
  }

  // Check terminal conditions (seat finished / sole survivor)
  const terminal = checkTerminal(state.tokens, state.seats, state.standings);
  if (terminal.seatFinished !== null) {
    state.standings = updateStandings(state.standings, terminal.seatFinished);
  }

  // Check sole survivor after updating standings
  const activeCount = state.seats.filter((s) => s.state === "active").length;
  const remainingActive = state.seats.filter(
    (s) => s.state === "active" && !state.standings.includes(s.index),
  );
  if (remainingActive.length === 1 && state.standings.length < activeCount) {
    state.standings = updateStandings(state.standings, remainingActive[0]!.index);
  }

  if (isGameOver(state.standings, activeCount)) {
    state.status = "finished";
    messages.push({ type: "finished", standings: state.standings });
    return messages;
  }

  // Check for extra turn (rolled a 6 and no forfeit)
  const hadExtraTurn = state.diceValue === 6 && state.consecutiveSixes > 0;
  if (hadExtraTurn) {
    state.status = "rolling";
    state.diceValue = null;
    messages.push({ type: "turn", seat: state.activeSeat, deadline: Date.now() + 30000 });
  } else {
    advanceTurn(session, messages);
  }

  return messages;
}

function advanceTurn(session: GameSession, messages: ServerMessage[]) {
  const { state } = session;
  const S = state.seats.length;
  let next = state.activeSeat;

  // Find next active seat (skip finished seats in standings)
  for (let i = 0; i < S; i++) {
    next = (next % S) + 1;
    const seat = state.seats.find((s) => s.index === next);
    if (seat?.state === "active" && !state.standings.includes(next)) break;
  }

  state.activeSeat = next;
  state.status = "rolling";
  state.diceValue = null;
  state.consecutiveSixes = 0;
  messages.push({ type: "turn", seat: next, deadline: Date.now() + TIMINGS.turnTimeout });
}

/**
 * Handle a turn timeout: increment misses, possibly kick, then advance turn.
 */
export function handleTimeout(session: GameSession): ServerMessage[] {
  const { state } = session;
  const messages: ServerMessage[] = [];

  if (state.status === "finished") return [];

  const currentMisses = session.seatMisses.get(state.activeSeat) ?? 0;
  const missResult = handleMissedTurn(currentMisses, TIMINGS.kickAfterMisses);
  session.seatMisses.set(state.activeSeat, missResult.consecutiveMisses);

  if (missResult.shouldKick) {
    // Kick the player
    const seat = state.seats.find((s) => s.index === state.activeSeat);
    if (seat) {
      const kickResult = applyKick(state.tokens, seat.color);
      state.tokens = kickResult.tokens;
      seat.state = "vacant";
      messages.push({ type: "kicked", seat: state.activeSeat });

      // Check terminal after kick
      const activeCount = state.seats.filter((s) => s.state === "active").length;
      const remainingActive = state.seats.filter(
        (s) => s.state === "active" && !state.standings.includes(s.index),
      );

      if (remainingActive.length === 1) {
        state.standings = updateStandings(state.standings, remainingActive[0]!.index);
      }
      if (remainingActive.length <= 1) {
        state.status = "finished";
        messages.push({ type: "finished", standings: state.standings });
        return messages;
      }
    }
  }

  advanceTurn(session, messages);
  return messages;
}
