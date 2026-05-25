import { drawPalette, parseCell, yard, TOKENS_PER_PLAYER, MIN_SEATS } from "@ludo/shared";
import type { GameState, Token, Seat } from "@ludo/shared";
import type { PlayerColor } from "@ludo/shared";
import type { Rng } from "../game/rng/rng.js";
import type { Room } from "../rooms/room.js";
import type { DebugStartState } from "../config/debug-start-state.js";

/**
 * Create the initial GameState from a room's members.
 * Assigns seats, draws colors, creates tokens in yards.
 */
export function initGame(
  room: Room,
  gameId: string,
  rng: Rng,
  debugStartState?: DebugStartState,
): GameState {
  // Board always has MIN_SEATS corners; rooms with fewer players still use the full board layout.
  const S = Math.max(room.boardSize, MIN_SEATS);
  const colors = drawPalette(S, () => rng.random()) as PlayerColor[];

  // Sort so human members always precede bots — ensures human gets seat 1.
  const memberList = Array.from(room.members.entries()).sort(([, a], [, b]) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "human" ? -1 : 1;
  });
  const playerCount = memberList.length;
  const seats: Seat[] = [];
  const tokens: Token[] = [];

  // For 2-player games, place players at opposite seats (1 & 3)
  const occupiedSeats =
    playerCount === 2 && S === 4 ? [1, 3] : Array.from({ length: playerCount }, (_, i) => i + 1);

  for (let i = 0; i < S; i++) {
    const seatIndex = i + 1;
    const playerIdx = occupiedSeats.indexOf(seatIndex);
    const member = playerIdx !== -1 ? memberList[playerIdx] : undefined;
    const color = colors[i]!;

    seats.push({
      index: seatIndex,
      state: member ? "active" : "empty",
      color,
      playerId: member ? member[0] : null,
      isBot: member ? member[1].kind === "bot" : false,
    });

    if (!member) continue;

    // Create tokens in yard
    for (let t = 1; t <= TOKENS_PER_PLAYER; t++) {
      tokens.push({
        id: `${seatIndex}-${t}`,
        color,
        cell: yard(seatIndex, t),
      });
    }
  }

  const state: GameState = {
    gameId,
    status: "rolling",
    seats,
    tokens,
    activeSeat: seats.find((s) => s.state === "active")?.index ?? 1,
    diceValue: null,
    consecutiveSixes: 0,
    standings: [],
  };

  if (debugStartState) {
    applyDebugStartState(state, debugStartState);
  }

  return state;
}

function applyDebugStartState(state: GameState, debugStartState: DebugStartState): void {
  if (debugStartState.status !== undefined) {
    state.status = debugStartState.status;
  }

  if (debugStartState.activeSeat !== undefined) {
    const seat = state.seats.find((entry) => entry.index === debugStartState.activeSeat);
    if (!seat || seat.state !== "active") {
      throw new Error(`Invalid debug active seat: ${debugStartState.activeSeat}`);
    }
    state.activeSeat = debugStartState.activeSeat;
  }

  if (debugStartState.diceValue !== undefined) {
    const { diceValue } = debugStartState;
    if (diceValue !== null && (!Number.isInteger(diceValue) || diceValue < 1 || diceValue > 6)) {
      throw new Error(`Invalid debug dice value: ${diceValue}`);
    }
    state.diceValue = diceValue;
  }

  if (debugStartState.consecutiveSixes !== undefined) {
    if (
      !Number.isInteger(debugStartState.consecutiveSixes) ||
      debugStartState.consecutiveSixes < 0
    ) {
      throw new Error(`Invalid debug consecutiveSixes: ${debugStartState.consecutiveSixes}`);
    }
    state.consecutiveSixes = debugStartState.consecutiveSixes;
  }

  if (debugStartState.standings !== undefined) {
    validateStandings(state, debugStartState.standings);
    state.standings = [...debugStartState.standings];
  }

  if (debugStartState.tokens !== undefined) {
    applyDebugTokenOverrides(state, debugStartState.tokens);
  }
}

function validateStandings(state: GameState, standings: number[]): void {
  const seen = new Set<number>();
  for (const seatIndex of standings) {
    if (!Number.isInteger(seatIndex)) {
      throw new Error(`Invalid debug standings seat: ${seatIndex}`);
    }
    const seat = state.seats.find((entry) => entry.index === seatIndex);
    if (!seat || seat.state !== "active") {
      throw new Error(`Debug standings references inactive seat: ${seatIndex}`);
    }
    if (seen.has(seatIndex)) {
      throw new Error(`Duplicate debug standings seat: ${seatIndex}`);
    }
    seen.add(seatIndex);
  }
}

function applyDebugTokenOverrides(
  state: GameState,
  tokenOverrides: NonNullable<DebugStartState["tokens"]>,
): void {
  const seen = new Set<string>();

  for (const override of tokenOverrides) {
    if (seen.has(override.id)) {
      throw new Error(`Duplicate debug token override: ${override.id}`);
    }
    seen.add(override.id);

    const token = state.tokens.find((entry) => entry.id === override.id);
    if (!token) {
      throw new Error(`Unknown debug token: ${override.id}`);
    }

    validateDebugTokenCell(state, token, override.cell);
    token.cell = override.cell;
  }
}

function validateDebugTokenCell(state: GameState, token: Token, cell: string): void {
  const parsed = parseCell(cell);

  if (parsed.kind === "yard") {
    const tokenSeat = Number(token.id.split("-")[0]);
    if (parsed.seat !== tokenSeat) {
      throw new Error(`Debug yard cell seat mismatch for token ${token.id}`);
    }
    return;
  }

  if (parsed.kind === "home") {
    const seat = state.seats.find((entry) => entry.color === token.color);
    if (!seat || parsed.seat !== seat.index) {
      throw new Error(`Debug home cell seat mismatch for token ${token.id}`);
    }
  }
}
