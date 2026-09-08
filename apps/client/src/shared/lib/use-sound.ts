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

/*
 * Playback goes through the Web Audio API, not one `<audio>` element per hit.
 * A media element is an expensive, platform-backed object: iOS Safari keeps
 * every one alive in its media-session registry, so cloning one per sound
 * leaked hundreds of them over a match and slowed the whole page to a crawl.
 * Here each file is decoded once into an `AudioBuffer` and each hit is a
 * throwaway source node, which overlaps natively and frees itself when done.
 */

let context: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
const pending = new Map<SoundName, Promise<AudioBuffer | null>>();
/** One reusable output node per sound, so a hit allocates only its source. */
const gains = new Map<SoundName, GainNode>();

/**
 * Lazily create the shared context. iOS starts it suspended unless it was
 * created inside a user gesture, so the first real gesture resumes it — until
 * then source nodes play into a suspended graph and are simply inaudible.
 */
function getContext(): AudioContext | null {
  if (context) return context;
  if (typeof AudioContext === "undefined") return null;

  context = new AudioContext();
  const unlock = () => {
    void context?.resume();
    for (const type of ["pointerdown", "touchend", "keydown"]) {
      globalThis.removeEventListener(type, unlock);
    }
  };
  for (const type of ["pointerdown", "touchend", "keydown"]) {
    globalThis.addEventListener(type, unlock);
  }
  return context;
}

/** Fetch + decode one sound, once. Resolves to null if it can't be decoded. */
function load(ctx: AudioContext, name: SoundName): Promise<AudioBuffer | null> {
  let task = pending.get(name);
  if (!task) {
    task = fetch(SOUND_SRC[name])
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(name, buffer);
        return buffer;
      })
      // A format this browser can't decode (Vorbis needs iOS 17+) — stay silent
      // rather than retrying the fetch on every subsequent play.
      .catch(() => null);
    pending.set(name, task);
  }
  return task;
}

function gainFor(ctx: AudioContext, name: SoundName): GainNode {
  let gain = gains.get(name);
  if (!gain) {
    gain = ctx.createGain();
    gain.gain.value = VOLUME[name] ?? DEFAULT_VOLUME;
    gain.connect(ctx.destination);
    gains.set(name, gain);
  }
  return gain;
}

/**
 * One hit. The source node is deliberately left without an `ended` listener:
 * the browser releases it once playback finishes and nothing references it, so
 * adding a handler just to disconnect would keep every hit (and its listener)
 * alive — the very thing this rewrite removes.
 */
function emit(ctx: AudioContext, buffer: AudioBuffer, name: SoundName): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gainFor(ctx, name));
  source.start();
}

/** Play a sound effect unless muted. No-op (and silent) if playback is blocked. */
export function playSound(name: SoundName): void {
  if (muted.value) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const buffer = buffers.get(name);
  if (buffer) {
    emit(ctx, buffer, name);
    return;
  }
  // First hit for this sound: decode, then play. Later hits are instant.
  void load(ctx, name).then((decoded) => {
    if (decoded && !muted.value) emit(ctx, decoded, name);
  });
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
