import type { ClientMessage, ServerMessage, GameOptions } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";
import { logger } from "../lib/logger.js";
import {
  setReady,
  setOptions,
  canStart,
  startGame,
  leaveRoom,
  addBotMember,
  removeMember,
  type Room,
} from "../rooms/room.js";
import { initGame } from "../rooms/init-game.js";
import { createCryptoRng } from "../game/rng/rng.js";
import {
  createGameSession,
  handleRoll,
  handleMove,
  handleTimeout,
  startTurnDeadline,
  pushHistory,
  undoLast,
  type GameSession,
} from "../rooms/game-session.js";
import { scheduleBotTurn } from "../game/ai/driver.js";
import { applyDebugScenario } from "./debug-scenarios.js";

export interface WsClient {
  playerId: string;
  roomId: string;
  send: (msg: ServerMessage) => void;
}

export type RoomStore = Map<string, Room>;

export interface RouterDeps {
  /** Persist a room's options so they survive across server restarts. */
  persistOptions?: (roomId: string, options: GameOptions) => void;
}

export interface Router {
  dispatch: (client: WsClient, message: ClientMessage) => void;
  broadcast: (roomId: string, msg: ServerMessage) => void;
  broadcastLobby: (roomId: string, room: Room) => void;
  addClient: (client: WsClient) => void;
  removeClient: (client: WsClient) => void;
  handleClose: (client: WsClient) => void;
  getGameSession: (roomId: string) => GameSession | undefined;
}

export function createRouter(rooms: RoomStore, deps: RouterDeps = {}): Router {
  const clients = new Set<WsClient>();
  const gameSessions = new Map<string, GameSession>();
  const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Track connected players per room: roomId -> Set of playerId
  const connectedPlayers = new Map<string, Set<string>>();

  const isProduction = process.env["NODE_ENV"] === "production";

  function scheduleTurnTimeout(roomId: string) {
    if (!isProduction) return;
    clearTurnTimeout(roomId);
    const current = gameSessions.get(roomId);
    if (current && !current.state.options.timerEnabled) return;
    turnTimers.set(
      roomId,
      setTimeout(() => {
        const session = gameSessions.get(roomId);
        if (!session || (session.state.status as string) === "finished") return;
        const msgs = handleTimeout(session);
        for (const msg of msgs) broadcast(roomId, msg);
        // If the game isn't finished, a new turn was emitted which schedules next timeout
        if ((session.state.status as string) !== "finished") {
          scheduleTurnTimeout(roomId);
        }
      }, TIMINGS.turnTimeout),
    );
  }

  function clearTurnTimeout(roomId: string) {
    const existing = turnTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      turnTimers.delete(roomId);
    }
  }

  function scheduleBotIfNeeded(roomId: string, session: GameSession): void {
    scheduleBotTurn(session, (msgs) => {
      for (const msg of msgs) broadcast(roomId, msg);
    });
  }

  function broadcastLobby(roomId: string, room: Room): void {
    const connected = connectedPlayers.get(roomId) ?? new Set();
    const players = [...room.members.values()].map((m) => ({
      playerId: m.playerId,
      name: m.name,
      ready: m.ready,
      isBot: m.kind === "bot",
      connected: connected.has(m.playerId) || m.kind === "bot",
    }));
    broadcast(roomId, {
      type: "lobby",
      players,
      ownerId: room.ownerId ?? "",
      capacity: room.boardSize,
      options: room.options,
    });
  }

  function dispatch(client: WsClient, message: ClientMessage): void {
    logger.info("WS message dispatch", {
      playerId: client.playerId,
      roomId: client.roomId,
      type: message.type,
    });

    const room = rooms.get(client.roomId);
    if (!room) {
      client.send({ type: "error", message: "room-not-found" });
      return;
    }

    if (!room.members.has(client.playerId)) {
      client.send({ type: "error", message: "not-in-room" });
      return;
    }

    switch (message.type) {
      case "ready": {
        if (room.phase !== "lobby") {
          client.send({ type: "error", message: "not-in-lobby" });
          break;
        }
        const current = room.members.get(client.playerId);
        const result = setReady(room, client.playerId, !(current?.ready ?? false));
        if (result.ok) {
          rooms.set(client.roomId, result.room);
          broadcastLobby(client.roomId, result.room);
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }

      case "set_options": {
        const result = setOptions(room, client.playerId, message.options);
        if (result.ok) {
          rooms.set(client.roomId, result.room);
          deps.persistOptions?.(client.roomId, result.room.options);
          broadcastLobby(client.roomId, result.room);
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }

      case "start": {
        if (!canStart(room, client.playerId)) {
          client.send({ type: "error", message: "cannot-start" });
          break;
        }
        const gameId = crypto.randomUUID();
        const startResult = startGame(room, client.playerId, gameId);
        if (startResult.ok) {
          rooms.set(client.roomId, startResult.room);
          const rng = createCryptoRng();
          const state = initGame(startResult.room, gameId, rng);
          const session = createGameSession(state);
          gameSessions.set(client.roomId, session);
          broadcast(client.roomId, { type: "state", state });
          broadcast(client.roomId, {
            type: "turn",
            seat: state.activeSeat,
            deadline: startTurnDeadline(session),
          });
          scheduleTurnTimeout(client.roomId);
          scheduleBotIfNeeded(client.roomId, session);
        } else {
          client.send({ type: "error", message: startResult.error });
        }
        break;
      }

      case "roll": {
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        // Check if spectator
        const currentRoom = rooms.get(client.roomId);
        if (currentRoom?.spectators.has(client.playerId)) {
          client.send({ type: "error", message: "not-a-player" });
          break;
        }
        // Verify it's this player's turn
        const rollSeat = session.state.seats.find((s) => s.playerId === client.playerId);
        if (!rollSeat || rollSeat.index !== session.state.activeSeat) {
          client.send({ type: "error", message: "not-your-turn" });
          break;
        }
        const rollMsgs = handleRoll(session);
        for (const msg of rollMsgs) broadcast(client.roomId, msg);
        if (session.state.status !== "finished") {
          scheduleTurnTimeout(client.roomId);
          scheduleBotIfNeeded(client.roomId, session);
        } else {
          clearTurnTimeout(client.roomId);
        }
        break;
      }

      case "move": {
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        // Check if spectator
        const currentRoom = rooms.get(client.roomId);
        if (currentRoom?.spectators.has(client.playerId)) {
          client.send({ type: "error", message: "not-a-player" });
          break;
        }
        const moveSeat = session.state.seats.find((s) => s.playerId === client.playerId);
        if (!moveSeat || moveSeat.index !== session.state.activeSeat) {
          client.send({ type: "error", message: "not-your-turn" });
          break;
        }
        const moveMsgs = handleMove(session, message.tokenId);
        for (const msg of moveMsgs) broadcast(client.roomId, msg);
        if (session.state.status !== "finished") {
          scheduleTurnTimeout(client.roomId);
          scheduleBotIfNeeded(client.roomId, session);
        } else {
          clearTurnTimeout(client.roomId);
        }
        break;
      }

      case "resync": {
        // Client detected a desync (e.g. a dropped turn message, or timers
        // throttled while its tab was backgrounded) and asked for the truth.
        // Re-send the authoritative state to the requester only.
        const session = gameSessions.get(client.roomId);
        if (!session || session.state.status === "finished") break;
        client.send({ type: "state", state: session.state });
        // Mirror the reconnect path: a turn message is only safe while awaiting a
        // roll — sending one mid-move would force the client back to "rolling".
        if (session.state.status === "rolling") {
          client.send({
            type: "turn",
            seat: session.state.activeSeat,
            deadline: session.state.options.timerEnabled ? Date.now() + TIMINGS.turnTimeout : 0,
          });
        }
        break;
      }

      case "add_bot": {
        if (room.phase !== "lobby") {
          client.send({ type: "error", message: "not-in-lobby" });
          break;
        }
        if (room.ownerId !== client.playerId) {
          client.send({ type: "error", message: "not-owner" });
          break;
        }
        const result = addBotMember(room);
        if (result.ok) {
          rooms.set(client.roomId, result.room);
          broadcastLobby(client.roomId, result.room);
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }

      case "remove_player": {
        if (room.phase !== "lobby") {
          client.send({ type: "error", message: "not-in-lobby" });
          break;
        }
        if (room.ownerId !== client.playerId) {
          client.send({ type: "error", message: "not-owner" });
          break;
        }
        const result = removeMember(room, message.playerId);
        if (result.ok) {
          rooms.set(client.roomId, result.room);
          broadcastLobby(client.roomId, result.room);
        } else {
          client.send({ type: "error", message: result.error });
        }
        break;
      }

      case "rematch": {
        if (room.ownerId !== client.playerId) {
          client.send({ type: "error", message: "not-owner" });
          break;
        }
        const existingSession = gameSessions.get(client.roomId);
        if (!existingSession || existingSession.state.status !== "finished") {
          client.send({ type: "error", message: "game-not-finished" });
          break;
        }
        clearTurnTimeout(client.roomId);
        const newGameId = crypto.randomUUID();
        const rematchRoom: Room = { ...room, phase: "playing", gameId: newGameId };
        rooms.set(client.roomId, rematchRoom);
        const rng = createCryptoRng();
        const newState = initGame(rematchRoom, newGameId, rng);
        const newSession = createGameSession(newState);
        gameSessions.set(client.roomId, newSession);
        broadcast(client.roomId, { type: "state", state: newState });
        broadcast(client.roomId, {
          type: "turn",
          seat: newState.activeSeat,
          deadline: startTurnDeadline(newSession),
        });
        scheduleTurnTimeout(client.roomId);
        scheduleBotIfNeeded(client.roomId, newSession);
        break;
      }

      case "debug_set_state": {
        if (isProduction) {
          client.send({ type: "error", message: "debug-disabled" });
          break;
        }
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        const seat = session.state.seats.find((s) => s.playerId === client.playerId);
        if (!seat) {
          client.send({ type: "error", message: "not-a-player" });
          break;
        }
        const next = applyDebugScenario(session.state, message.scenario, seat.index);
        if (!next) {
          client.send({ type: "error", message: "unknown-scenario" });
          break;
        }
        pushHistory(session);
        session.state = next;
        logger.info("WS debug_set_state applied", {
          roomId: client.roomId,
          scenario: message.scenario,
          seat: seat.index,
        });
        // Broadcast state only — a "turn" message would reset diceValue/status
        // on the client and wipe the scenario's mid-turn setup.
        broadcast(client.roomId, { type: "state", state: next });
        break;
      }

      case "debug_undo": {
        if (isProduction) {
          client.send({ type: "error", message: "debug-disabled" });
          break;
        }
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        const restored = undoLast(session);
        if (!restored) {
          client.send({ type: "error", message: "nothing-to-undo" });
          break;
        }
        logger.info("WS debug_undo applied", { roomId: client.roomId });
        // Cancel the pending turn timer; any in-flight bot timer is neutralised by
        // the state-identity guard in the bot driver (undoLast swaps session.state).
        clearTurnTimeout(client.roomId);
        broadcast(client.roomId, { type: "state", state: restored });
        // Snapshots are taken at turn boundaries, so a restored state is "rolling"
        // unless it's a timed-out mid-move. Re-issue the turn (like resync) and
        // re-drive the bot only when awaiting a roll — handleRoll needs "rolling".
        if (restored.status === "rolling") {
          broadcast(client.roomId, {
            type: "turn",
            seat: restored.activeSeat,
            deadline: startTurnDeadline(session),
          });
          scheduleTurnTimeout(client.roomId);
          scheduleBotIfNeeded(client.roomId, session);
        }
        break;
      }

      case "debug_set_dice": {
        if (isProduction) {
          client.send({ type: "error", message: "debug-disabled" });
          break;
        }
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        if (!session.state.seats.some((s) => s.index === message.seat)) {
          client.send({ type: "error", message: "unknown-seat" });
          break;
        }
        session.forcedRolls.set(message.seat, message.value);
        logger.info("WS debug_set_dice queued", {
          roomId: client.roomId,
          seat: message.seat,
          value: message.value,
        });
        break;
      }
    }
  }

  function broadcast(roomId: string, msg: ServerMessage): void {
    for (const client of clients) {
      if (client.roomId === roomId) {
        client.send(msg);
      }
    }
  }

  function addClient(client: WsClient): void {
    clients.add(client);
    // Track as connected
    const connected = connectedPlayers.get(client.roomId) ?? new Set();
    connected.add(client.playerId);
    connectedPlayers.set(client.roomId, connected);
  }

  function removeClient(client: WsClient): void {
    clients.delete(client);
    // Mark as disconnected
    const connected = connectedPlayers.get(client.roomId);
    if (connected) {
      connected.delete(client.playerId);
    }
  }

  function handleClose(client: WsClient): void {
    removeClient(client);
    const room = rooms.get(client.roomId);
    if (!room) return;

    if (room.phase === "lobby") {
      const result = leaveRoom(room, client.playerId);
      if (result.ok) {
        rooms.set(client.roomId, result.room);
        broadcastLobby(client.roomId, result.room);
      }
    } else if (room.phase === "playing") {
      // In-game disconnect: broadcast presence update
      const seat =
        room.members.get(client.playerId)?.kind === "bot"
          ? undefined
          : gameSessions.get(client.roomId)?.state.seats.find((s) => s.playerId === client.playerId)
              ?.index;
      if (seat !== undefined) {
        broadcast(client.roomId, { type: "presence", seat, connected: false });
      }
    }
  }

  return {
    dispatch,
    broadcast,
    broadcastLobby,
    addClient,
    removeClient,
    handleClose,
    getGameSession,
  };

  function getGameSession(roomId: string): GameSession | undefined {
    return gameSessions.get(roomId);
  }
}
