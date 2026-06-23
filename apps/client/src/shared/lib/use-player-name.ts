import { ref } from "vue";

/** localStorage key for the persisted player display name. */
const STORAGE_KEY = "ludo:player-name";

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 20;

const HASH_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `player_` + 5 random chars from [a-z0-9], e.g. `player_a3k9z`. */
function generateDefaultName(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let hash = "";
  for (const b of bytes) hash += HASH_ALPHABET[b % HASH_ALPHABET.length];
  return `player_${hash}`;
}

/** Basic validation: trimmed length within [MIN, MAX]. i18n-friendly (any chars). */
export function isValidPlayerName(raw: string): boolean {
  const len = raw.trim().length;
  return len >= PLAYER_NAME_MIN && len <= PLAYER_NAME_MAX;
}

function readStored(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidPlayerName(stored)) return stored;
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
  const generated = generateDefaultName();
  try {
    localStorage.setItem(STORAGE_KEY, generated);
  } catch {
    /* ignore */
  }
  return generated;
}

/** Shared, persisted display name — one source of truth across the app. */
const playerName = ref(readStored());

/** Plain getter for non-component modules (e.g. the WS connector). */
export function getPlayerName(): string {
  return playerName.value;
}

export function usePlayerName() {
  /** Persist a new name; returns false (and changes nothing) if invalid. */
  function setName(raw: string): boolean {
    const trimmed = raw.trim();
    if (!isValidPlayerName(trimmed)) return false;
    playerName.value = trimmed;
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    return true;
  }

  return { playerName, setName };
}
