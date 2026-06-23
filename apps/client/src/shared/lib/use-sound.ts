import { ref } from "vue";

/** Sound files served statically from apps/client/public/sounds. */
const SOUND_SRC = {
  diceRoll: "/sounds/dice-roll.ogg",
  noMoves: "/sounds/no-moves.ogg",
  tokenSelect: "/sounds/token-select.ogg",
  tokenStep: "/sounds/token-step.ogg",
  turnChange: "/sounds/turn-change.ogg",
  myTurn: "/sounds/my-turn.ogg",
  tokenCaptureWin: "/sounds/token-capture-win.ogg",
  tokenCaptureSad: "/sounds/token-capture-sad.ogg",
  gameStart: "/sounds/game-start.ogg",
  win: "/sounds/win.ogg",
  gameOver: "/sounds/game-over.ogg",
} as const;

export type SoundName = keyof typeof SOUND_SRC;

/** Per-sound volume; jingles are mastered louder than the UI blips. */
const VOLUME: Partial<Record<SoundName, number>> = {
  diceRoll: 0.7,
  myTurn: 0.5,
  tokenStep: 0.5,
  win: 0.5,
};
const DEFAULT_VOLUME = 0.6;

const STORAGE_KEY = "ludo:sound-muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Shared mute state — one source of truth for the toggle and every play call. */
const muted = ref(readMuted());

/** One preloaded element per sound, cloned on play so rapid hits can overlap. */
const templates = new Map<SoundName, HTMLAudioElement>();

function template(name: SoundName): HTMLAudioElement {
  let el = templates.get(name);
  if (!el) {
    el = new Audio(SOUND_SRC[name]);
    el.preload = "auto";
    el.volume = VOLUME[name] ?? DEFAULT_VOLUME;
    templates.set(name, el);
  }
  return el;
}

/** Play a sound effect unless muted. No-op (and silent) if playback is blocked. */
export function playSound(name: SoundName): void {
  if (muted.value) return;
  const base = template(name);
  const node = base.cloneNode() as HTMLAudioElement;
  node.volume = base.volume;
  // Autoplay may reject without a prior user gesture in this document — ignore.
  void node.play().catch(() => {});
}

export function useSound() {
  function toggleMuted(): void {
    muted.value = !muted.value;
    try {
      localStorage.setItem(STORAGE_KEY, muted.value ? "1" : "0");
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  }

  return { muted, toggleMuted, playSound };
}
