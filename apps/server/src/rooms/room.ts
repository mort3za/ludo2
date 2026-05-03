import { TIMINGS } from "@ludo/shared";

export type RoomPhase = "lobby" | "playing" | "post-game";

export interface RoomMember {
  playerId: string;
  name: string;
  ready: boolean;
}

export interface Room {
  id: string;
  ownerId: string | null;
  members: Map<string, RoomMember>;
  phase: RoomPhase;
  boardSize: number;
  createdAt: number;
  gameId: string | null;
  gameEndedAt: number | null;
}

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

function cloneMembers(members: Map<string, RoomMember>): Map<string, RoomMember> {
  const copy = new Map<string, RoomMember>();
  for (const [k, v] of members) {
    copy.set(k, { ...v });
  }
  return copy;
}

export function createRoom(id: string, boardSize: number, now: number): Room {
  return {
    id,
    ownerId: null,
    members: new Map(),
    phase: "lobby",
    boardSize,
    createdAt: now,
    gameId: null,
    gameEndedAt: null,
  };
}

export function joinRoom(room: Room, playerId: string, name: string): Result<{ room: Room }> {
  if (room.phase !== "lobby") {
    return { ok: false, error: "not-in-lobby" };
  }
  if (room.members.has(playerId)) {
    return { ok: false, error: "already-joined" };
  }
  if (room.members.size >= room.boardSize) {
    return { ok: false, error: "room-full" };
  }

  const members = cloneMembers(room.members);
  members.set(playerId, { playerId, name, ready: false });

  return {
    ok: true,
    room: {
      ...room,
      members,
      ownerId: room.ownerId ?? playerId,
    },
  };
}

export function leaveRoom(room: Room, playerId: string): Result<{ room: Room }> {
  if (!room.members.has(playerId)) {
    return { ok: false, error: "not-in-room" };
  }

  const members = cloneMembers(room.members);
  members.delete(playerId);

  let ownerId = room.ownerId;
  if (ownerId === playerId) {
    const firstRemaining = members.keys().next();
    ownerId = firstRemaining.done ? null : firstRemaining.value;
  }

  return {
    ok: true,
    room: { ...room, members, ownerId },
  };
}

export function setReady(room: Room, playerId: string, ready: boolean): Result<{ room: Room }> {
  const existing = room.members.get(playerId);
  if (!existing) {
    return { ok: false, error: "not-in-room" };
  }

  const members = cloneMembers(room.members);
  members.set(playerId, { ...existing, ready });

  return { ok: true, room: { ...room, members } };
}

export function canStart(room: Room, requesterId: string): boolean {
  if (room.phase !== "lobby") return false;
  if (room.ownerId !== requesterId) return false;
  if (room.members.size < 2) return false;

  for (const member of room.members.values()) {
    if (!member.ready) return false;
  }

  return true;
}

export function startGame(room: Room, requesterId: string, gameId: string): Result<{ room: Room }> {
  if (!canStart(room, requesterId)) {
    return { ok: false, error: "cannot-start" };
  }

  return {
    ok: true,
    room: { ...room, phase: "playing", gameId },
  };
}

export function endGame(room: Room, now: number): Room {
  return { ...room, phase: "post-game", gameEndedAt: now };
}

export function requestRematch(room: Room, requesterId: string): Result<{ room: Room }> {
  if (room.phase !== "post-game") {
    return { ok: false, error: "not-in-post-game" };
  }
  if (room.ownerId !== requesterId) {
    return { ok: false, error: "not-owner" };
  }

  const members = cloneMembers(room.members);
  for (const member of members.values()) {
    member.ready = false;
  }

  return {
    ok: true,
    room: {
      ...room,
      members,
      phase: "lobby",
      gameId: null,
      gameEndedAt: null,
    },
  };
}

export function isExpired(room: Room, now: number): boolean {
  switch (room.phase) {
    case "lobby":
      return now > room.createdAt + TIMINGS.idleRoomExpiry;
    case "post-game":
      return room.gameEndedAt !== null && now > room.gameEndedAt + TIMINGS.postGameWindow;
    case "playing":
      return false;
  }
}
