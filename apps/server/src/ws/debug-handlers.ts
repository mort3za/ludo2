import type { ServerMessage } from "@ludo/shared";
import { logger } from "../lib/logger.js";
import {
  startTurnDeadline,
  pushHistory,
  undoLast,
  type GameSession,
} from "../rooms/game-session.js";
import { applyDebugScenario } from "./debug-scenarios.js";
import type { WsClient } from "./router.js";

/** State and callbacks the dev-only debug handlers need from the router. */
export interface DebugContext {
  isProduction: boolean;
  gameSessions: Map<string, GameSession>;
  broadcast: (roomId: string, msg: ServerMessage) => void;
  clearTurnTimeout: (roomId: string) => void;
  scheduleTurnTimeout: (roomId: string) => void;
  scheduleBotIfNeeded: (roomId: string, session: GameSession) => void;
}

/** Guard a debug action: dev-only, and there must be a live game. */
function requireDevSession(ctx: DebugContext, client: WsClient): GameSession | null {
  if (ctx.isProduction) {
    client.send({ type: "error", message: "debug-disabled" });
    return null;
  }
  const session = ctx.gameSessions.get(client.roomId);
  if (!session) {
    client.send({ type: "error", message: "no-game" });
    return null;
  }
  return session;
}

export function handleDebugSetState(ctx: DebugContext, client: WsClient, scenario: string): void {
  const session = requireDevSession(ctx, client);
  if (!session) return;
  const seat = session.state.seats.find((s) => s.playerId === client.playerId);
  if (!seat) {
    client.send({ type: "error", message: "not-a-player" });
    return;
  }
  const next = applyDebugScenario(session.state, scenario, seat.index);
  if (!next) {
    client.send({ type: "error", message: "unknown-scenario" });
    return;
  }
  pushHistory(session);
  session.state = next;
  logger.info("WS debug_set_state applied", {
    roomId: client.roomId,
    scenario,
    seat: seat.index,
  });
  // Broadcast state only — a "turn" message would reset diceValue/status
  // on the client and wipe the scenario's mid-turn setup.
  ctx.broadcast(client.roomId, { type: "state", state: next });
}

export function handleDebugUndo(ctx: DebugContext, client: WsClient): void {
  const session = requireDevSession(ctx, client);
  if (!session) return;
  const restored = undoLast(session);
  if (!restored) {
    client.send({ type: "error", message: "nothing-to-undo" });
    return;
  }
  logger.info("WS debug_undo applied", { roomId: client.roomId });
  // Cancel the pending turn timer; any in-flight bot timer is neutralised by
  // the state-identity guard in the bot driver (undoLast swaps session.state).
  ctx.clearTurnTimeout(client.roomId);
  ctx.broadcast(client.roomId, { type: "state", state: restored });
  // Snapshots are taken at turn boundaries, so a restored state is "rolling"
  // unless it's a timed-out mid-move. Re-issue the turn (like resync) and
  // re-drive the bot only when awaiting a roll — handleRoll needs "rolling".
  if (restored.status === "rolling") {
    ctx.broadcast(client.roomId, {
      type: "turn",
      seat: restored.activeSeat,
      deadline: startTurnDeadline(session),
    });
    ctx.scheduleTurnTimeout(client.roomId);
    ctx.scheduleBotIfNeeded(client.roomId, session);
  }
}

export function handleDebugSetDice(
  ctx: DebugContext,
  client: WsClient,
  seat: number,
  value: number,
): void {
  if (ctx.isProduction) {
    client.send({ type: "error", message: "debug-disabled" });
    return;
  }
  const session = ctx.gameSessions.get(client.roomId);
  if (!session) {
    client.send({ type: "error", message: "no-game" });
    return;
  }
  if (!session.state.seats.some((s) => s.index === seat)) {
    client.send({ type: "error", message: "unknown-seat" });
    return;
  }
  session.forcedRolls.set(seat, value);
  logger.info("WS debug_set_dice queued", { roomId: client.roomId, seat, value });
}
