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
  diceRoll: 0.5,
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

/**
 * Playback reuses a small pool of `<audio>` elements per sound.
 *
 * Two constraints shape this. Cloning a fresh element per hit retains it
 * forever — a match accumulated hundreds of live media elements, each a
 * platform-backed media session, which is what made iPhones crawl after a few
 * rounds. But the obvious alternative, Web Audio, is routed through iOS's
 * ambient audio category and so is silenced by the ringer switch, whereas
 * media-element playback is not. So: keep media elements, bound their number.
 */
const POOL_LIMIT = 3;

interface Pool {
  els: HTMLAudioElement[];
  /** Round-robin cursor, used only once the pool has reached its cap. */
  next: number;
}

const pools = new Map<SoundName, Pool>();

function createElement(name: SoundName): HTMLAudioElement {
  const el = new Audio(SOUND_SRC[name]);
  el.preload = "auto";
  el.volume = VOLUME[name] ?? DEFAULT_VOLUME;
  return el;
}

/**
 * An element to play `name` on. The pool grows only while hits genuinely
 * overlap, so most sounds never own more than one element; rapid repeats like
 * the per-cell step blip get up to `POOL_LIMIT` so they can still layer.
 */
function take(name: SoundName): HTMLAudioElement {
  let pool = pools.get(name);
  if (!pool) pools.set(name, (pool = { els: [], next: 0 }));

  const idle = pool.els.find((el) => el.paused);
  if (idle) return idle;

  if (pool.els.length < POOL_LIMIT) {
    const el = createElement(name);
    pool.els.push(el);
    return el;
  }

  // All of them are still playing — restart the least recently taken.
  const el = pool.els[pool.next]!;
  pool.next = (pool.next + 1) % pool.els.length;
  return el;
}

/** Play a sound effect unless muted. No-op (and silent) if playback is blocked. */
export function playSound(name: SoundName): void {
  if (muted.value) return;
  const el = take(name);
  try {
    el.currentTime = 0;
  } catch {
    /* not seekable until metadata arrives — it starts from 0 on its own */
  }
  // Autoplay may reject without a prior user gesture in this document — ignore.
  void el.play().catch(() => {});
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
