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
  type GameSession,
} from "../rooms/game-session.js";
import { scheduleBotTurn } from "../game/ai/driver.js";
import {
  handleDebugSetState,
  handleDebugUndo,
  handleDebugSetDice,
  type DebugContext,
} from "./debug-handlers.js";

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

  /** Init a fresh game, register the session, and broadcast the opening state/turn. */
  function startGameSession(roomId: string, room: Room, gameId: string): void {
    const rng = createCryptoRng();
    const state = initGame(room, gameId, rng);
    const session = createGameSession(state);
    gameSessions.set(roomId, session);
    broadcast(roomId, { type: "state", state });
    broadcast(roomId, {
      type: "turn",
      seat: state.activeSeat,
      deadline: startTurnDeadline(session),
    });
    scheduleTurnTimeout(roomId);
    scheduleBotIfNeeded(roomId, session);
  }

  /** After a roll/move: keep the clock running unless the game just ended. */
  function scheduleOrClear(roomId: string, session: GameSession): void {
    if (session.state.status !== "finished") {
      scheduleTurnTimeout(roomId);
      scheduleBotIfNeeded(roomId, session);
    } else {
      clearTurnTimeout(roomId);
    }
  }

  /** Guard a roll/move: the sender must be a seated player whose turn it is. */
  function requireActivePlayer(client: WsClient, session: GameSession): boolean {
    if (rooms.get(client.roomId)?.spectators.has(client.playerId)) {
      client.send({ type: "error", message: "not-a-player" });
      return false;
    }
    const seat = session.state.seats.find((s) => s.playerId === client.playerId);
    if (!seat || seat.index !== session.state.activeSeat) {
      client.send({ type: "error", message: "not-your-turn" });
      return false;
    }
    return true;
  }

  /** Guard an owner-only lobby action. */
  function requireLobbyOwner(client: WsClient, room: Room): boolean {
    if (room.phase !== "lobby") {
      client.send({ type: "error", message: "not-in-lobby" });
      return false;
    }
    if (room.ownerId !== client.playerId) {
      client.send({ type: "error", message: "not-owner" });
      return false;
    }
    return true;
  }

  const debugCtx: DebugContext = {
    isProduction,
    gameSessions,
    broadcast,
    clearTurnTimeout,
    scheduleTurnTimeout,
    scheduleBotIfNeeded,
  };

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
          startGameSession(client.roomId, startResult.room, gameId);
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
        if (!requireActivePlayer(client, session)) break;
        const rollMsgs = handleRoll(session);
        for (const msg of rollMsgs) broadcast(client.roomId, msg);
        scheduleOrClear(client.roomId, session);
        break;
      }

      case "move": {
        const session = gameSessions.get(client.roomId);
        if (!session) {
          client.send({ type: "error", message: "no-game" });
          break;
        }
        if (!requireActivePlayer(client, session)) break;
        const moveMsgs = handleMove(session, message.tokenId);
        for (const msg of moveMsgs) broadcast(client.roomId, msg);
        scheduleOrClear(client.roomId, session);
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
            // Replay the live turn's deadline (not a fresh one) so a resync never
            // extends the clock past the still-running server timer.
            deadline: session.turnDeadline,
          });
        }
        break;
      }

      case "add_bot": {
        if (!requireLobbyOwner(client, room)) break;
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
        if (!requireLobbyOwner(client, room)) break;
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
        startGameSession(client.roomId, rematchRoom, newGameId);
        break;
      }

      case "debug_set_state":
        handleDebugSetState(debugCtx, client, message.scenario);
        break;

      case "debug_undo":
        handleDebugUndo(debugCtx, client);
        break;

      case "debug_set_dice":
        handleDebugSetDice(debugCtx, client, message.seat, message.value);
        break;
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
