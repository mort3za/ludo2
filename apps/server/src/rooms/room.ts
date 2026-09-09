import {
  TIMINGS,
  DEFAULT_GAME_OPTIONS,
  type BotPersonality,
  type GameOptions,
  BOT_PERSONALITIES,
} from "@ludo/shared";

export type RoomPhase = "lobby" | "playing" | "post-game";

export interface RoomMember {
  playerId: string;
  name: string;
  ready: boolean;
  kind: "human" | "bot";
  personality?: BotPersonality;
}

export interface Room {
  id: string;
  ownerId: string | null;
  members: Map<string, RoomMember>;
  spectators: Set<string>;
  phase: RoomPhase;
  boardSize: number;
  options: GameOptions;
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

function cloneSpectators(spectators: Set<string>): Set<string> {
  return new Set(spectators);
}

export function createRoom(id: string, boardSize: number, now: number): Room {
  return {
    id,
    ownerId: null,
    members: new Map(),
    spectators: new Set(),
    phase: "lobby",
    boardSize,
    options: { ...DEFAULT_GAME_OPTIONS },
    createdAt: now,
    gameId: null,
    gameEndedAt: null,
  };
}

/** Max length for a human-chosen display name; longer input is clamped. */
const MAX_PLAYER_NAME_LEN = 20;

/**
 * Normalize a client-supplied name into a safe display string, or null if it
 * is not a usable name. Strips control characters, trims, and clamps length —
 * the server is authoritative and never trusts the raw client value.
 */
export function sanitizePlayerName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = [...raw]
    .filter((ch) => ch >= " " && ch !== "\u007f")
    .join("")
    .trim();
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, MAX_PLAYER_NAME_LEN);
}

export function joinRoom(
  room: Room,
  playerId: string,
  requestedName?: string,
): Result<{ room: Room }> {
  if (room.phase !== "lobby") {
    return { ok: false, error: "not-in-lobby" };
  }
  if (room.members.has(playerId)) {
    return { ok: false, error: "already-joined" };
  }
  if (room.spectators.has(playerId)) {
    return { ok: false, error: "already-joined" };
  }
  if (room.members.size >= room.boardSize) {
    return { ok: false, error: "room-full" };
  }

  const members = cloneMembers(room.members);
  const name = sanitizePlayerName(requestedName) ?? nextPlayerName(members, room.boardSize);
  members.set(playerId, { playerId, name, ready: false, kind: "human" });

  // Ownership is sticky: the first human to join owns the room permanently.
  // It is never reassigned — not when the owner disconnects, and not to a
  // later joiner — so a new player can never seize a disconnected owner's room.
  const ownerId = room.ownerId ?? playerId;

  return {
    ok: true,
    room: {
      ...room,
      members,
      ownerId,
    },
  };
}

/**
 * Allow a player to join an in-progress game as a spectator.
 * Spectators watch read-only and cannot affect game state.
 */
export function joinAsSpectator(room: Room, playerId: string): Result<{ room: Room }> {
  if (room.spectators.has(playerId)) {
    return { ok: false, error: "already-joined" };
  }
  if (room.members.has(playerId)) {
    return { ok: false, error: "already-joined" };
  }

  const spectators = cloneSpectators(room.spectators);
  spectators.add(playerId);

  return {
    ok: true,
    room: {
      ...room,
      spectators,
    },
  };
}

/**
 * Add a bot member to a room with a randomly-assigned personality.
 * @param pickPersonality - Optional selector for personality (for testing). Defaults to random.
 */
export function addBotMember(
  room: Room,
  pickPersonality?: () => BotPersonality,
): Result<{ room: Room }> {
  if (room.phase !== "lobby") return { ok: false, error: "not-in-lobby" };
  if (room.members.size >= room.boardSize) return { ok: false, error: "room-full" };

  const members = cloneMembers(room.members);
  let n = 1;
  while (members.has(`bot:${n}`)) n++;
  const botId = `bot:${n}`;
  // Bots use their own `Bot_N` namespace (N = bot slot), independent of the
  // human `PlayerN` sequence, so they read clearly as AI in the lobby.
  const name = `Bot_${n}`;

  // Assign a random personality: default uses crypto.getRandomValues for uniform selection.
  const personality: BotPersonality =
    pickPersonality?.() ?? BOT_PERSONALITIES[randomIndex(BOT_PERSONALITIES.length)]!;

  members.set(botId, { playerId: botId, name, ready: true, kind: "bot", personality });

  return { ok: true, room: { ...room, members } };
}

/** Uniform random index in [0, n). */
function randomIndex(n: number): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]! % n;
}

export function removeMember(room: Room, playerId: string): Result<{ room: Room }> {
  if (room.phase !== "lobby") return { ok: false, error: "not-in-lobby" };
  const existing = room.members.get(playerId);
  if (!existing) return { ok: false, error: "not-in-room" };
  if (room.ownerId === playerId) return { ok: false, error: "cannot-remove-owner" };

  const members = cloneMembers(room.members);
  members.delete(playerId);
  return { ok: true, room: { ...room, members, spectators: cloneSpectators(room.spectators) } };
}

function nextPlayerName(members: Map<string, RoomMember>, boardSize: number): string {
  const used = new Set<string>();
  for (const m of members.values()) used.add(m.name);
  for (let i = 1; i <= boardSize; i++) {
    const candidate = `Player${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Player${members.size + 1}`;
}

export function setReady(room: Room, playerId: string, ready: boolean): Result<{ room: Room }> {
  const existing = room.members.get(playerId);
  if (!existing) {
    return { ok: false, error: "not-in-room" };
  }

  const members = cloneMembers(room.members);
  members.set(playerId, { ...existing, ready });

  return { ok: true, room: { ...room, members, spectators: cloneSpectators(room.spectators) } };
}

/** Change a member's own display name. Rejects names that fail sanitization. */
export function renameMember(
  room: Room,
  playerId: string,
  requestedName: string,
): Result<{ room: Room }> {
  const existing = room.members.get(playerId);
  if (!existing) return { ok: false, error: "not-in-room" };

  const name = sanitizePlayerName(requestedName);
  if (!name) return { ok: false, error: "invalid-name" };

  const members = cloneMembers(room.members);
  members.set(playerId, { ...existing, name });
  return { ok: true, room: { ...room, members, spectators: cloneSpectators(room.spectators) } };
}

export function setOptions(
  room: Room,
  requesterId: string,
  options: GameOptions,
): Result<{ room: Room }> {
  if (room.phase !== "lobby") return { ok: false, error: "not-in-lobby" };
  if (room.ownerId !== requesterId) return { ok: false, error: "not-owner" };

  return {
    ok: true,
    room: {
      ...room,
      options: {
        wallEnabled: options.wallEnabled,
        autoMoveEnabled: options.autoMoveEnabled,
        timerEnabled: options.timerEnabled,
        startGuardEnabled: options.startGuardEnabled,
        consecutiveSixLimitEnabled: options.consecutiveSixLimitEnabled,
      },
      members: cloneMembers(room.members),
      spectators: cloneSpectators(room.spectators),
    },
  };
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
      spectators: cloneSpectators(room.spectators),
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

/**
 * Whether a match link has outlived TIMINGS.matchLifetime. Unlike `isExpired`
 * this ignores phase and connections: it is an absolute cap on how long a link
 * stays shareable, and the only thing that reclaims a room abandoned mid-game.
 */
export function isPastMatchLifetime(createdAt: number, now: number): boolean {
  return now > createdAt + TIMINGS.matchLifetime;
}
