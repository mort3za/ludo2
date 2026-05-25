import type { ClientMessage, ServerMessage } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";
import { setReady, canStart, startGame, leaveRoom, type Room } from "../rooms/room.js";
import { initGame } from "../rooms/init-game.js";
import { createCryptoRng } from "../game/rng/rng.js";
import {
  createGameSession,
  handleRoll,
  handleMove,
  handleTimeout,
  type GameSession,
} from "../rooms/game-session.js";
import { scheduleBotTurn } from "../game/ai/driver.js";

export interface WsClient {
  playerId: string;
  roomId: string;
  send: (msg: ServerMessage) => void;
}

export type RoomStore = Map<string, Room>;

export interface Router {
  dispatch: (client: WsClient, message: ClientMessage) => void;
  broadcast: (roomId: string, msg: ServerMessage) => void;
  broadcastLobby: (roomId: string, room: Room) => void;
  addClient: (client: WsClient) => void;
  removeClient: (client: WsClient) => void;
  handleClose: (client: WsClient) => void;
  getGameSession: (roomId: string) => GameSession | undefined;
}

export function createRouter(rooms: RoomStore): Router {
  const clients = new Set<WsClient>();
  const gameSessions = new Map<string, GameSession>();
  const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const isProduction = process.env["NODE_ENV"] === "production";

  function scheduleTurnTimeout(roomId: string) {
    if (!isProduction) return;
    clearTurnTimeout(roomId);
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
    const players = [...room.members.values()].map((m) => ({
      playerId: m.playerId,
      name: m.name,
      ready: m.ready,
      isBot: m.kind === "bot",
    }));
    broadcast(roomId, { type: "lobby", players, ownerId: room.ownerId ?? "" });
  }

  function dispatch(client: WsClient, message: ClientMessage): void {
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
            deadline: Date.now() + TIMINGS.turnTimeout,
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
          deadline: Date.now() + TIMINGS.turnTimeout,
        });
        scheduleTurnTimeout(client.roomId);
        scheduleBotIfNeeded(client.roomId, newSession);
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
  }

  function removeClient(client: WsClient): void {
    clients.delete(client);
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
