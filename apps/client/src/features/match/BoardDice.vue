<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

const props = defineProps<{
  /** Settled dice value (1–6), or null while no roll has resolved yet / rolling. */
  value: number | null;
  /** Whether the local player may roll right now. */
  canRoll: boolean;
  /** Accent color used for the "ready" glow (active seat color). */
  color?: string;
}>();

const emit = defineEmits<{
  roll: [];
}>();

/** Standard pip layout per face, in a 0–100 SVG grid. */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [30, 30],
    [50, 50],
    [70, 70],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [30, 30],
    [70, 30],
    [50, 50],
    [30, 70],
    [70, 70],
  ],
  6: [
    [30, 30],
    [70, 30],
    [30, 50],
    [70, 50],
    [30, 70],
    [70, 70],
  ],
};

/** Currently displayed face (changes rapidly while rolling). */
const face = ref(props.value ?? 5);
const rolling = ref(false);
const landed = ref(false);

let tickTimer: ReturnType<typeof setTimeout> | null = null;
let landedTimer: ReturnType<typeof setTimeout> | null = null;

/** Pick a random face different from the current one, for visible tumbling. */
function nextRandomFace() {
  let n: number;
  do {
    n = 1 + Math.floor(Math.random() * 6);
  } while (n === face.value);
  face.value = n;
}

/**
 * Spin random faces ~every 75ms. Driven by `value` going null (the server's
 * reveal window, ~800ms), so this naturally tumbles ~10 faces before the real
 * value lands and stops it.
 */
function startSpin() {
  if (rolling.value) return;
  rolling.value = true;
  landed.value = false;
  const tick = () => {
    nextRandomFace();
    tickTimer = setTimeout(tick, 75);
  };
  tick();
}

/** Stop tumbling and snap to the rolled face with a brief "thunk" pop. */
function settle(final: number) {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
  rolling.value = false;
  face.value = final;
  landed.value = true;
  if (landedTimer) clearTimeout(landedTimer);
  landedTimer = setTimeout(() => {
    landed.value = false;
    landedTimer = null;
  }, 320);
}

watch(
  () => props.value,
  (val) => {
    if (val === null) startSpin();
    else settle(val);
  },
);

/**
 * Start tumbling immediately on click. The value-driven watch can't be relied
 * on for this: on the very first roll `value` is already null, so the server's
 * `value → null` reset is a no-op and the spin would never start. Spinning on
 * click also makes the dice feel responsive ahead of the server round-trip.
 */
function onClick() {
  if (!props.canRoll) return;
  startSpin();
  emit("roll");
}

onUnmounted(() => {
  if (tickTimer) clearTimeout(tickTimer);
  if (landedTimer) clearTimeout(landedTimer);
});
</script>

<template>
  <button
    type="button"
    :disabled="!canRoll"
    :aria-label="canRoll ? 'Roll the dice' : 'Dice'"
    class="dice"
    :class="{
      'dice--ready': canRoll && !rolling,
      'dice--rolling': rolling,
      'dice--landed': landed,
    }"
    :style="{ '--dice-glow': color ?? '#3b82f6' }"
    @click="onClick"
  >
    <svg viewBox="0 0 100 100" class="dice__svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dice-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#e7e4dd" />
        </linearGradient>
      </defs>
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="20"
        fill="url(#dice-face)"
        stroke="#cfccc4"
        stroke-width="2"
      />
      <!-- top highlight for a subtle 3D feel -->
      <rect x="14" y="13" width="72" height="20" rx="10" fill="#ffffff" opacity="0.55" />
      <circle v-for="([cx, cy], i) in PIPS[face]" :key="i" :cx="cx" :cy="cy" r="9" fill="#1a1816" />
    </svg>
  </button>
</template>

<style scoped>
.dice {
  display: block;
  padding: 0;
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
}

.dice__svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.25));
  transition: transform 0.15s ease;
  transform-origin: center;
}

/* Ready to roll: invite the tap with a soft breathing glow + float. */
.dice--ready {
  cursor: pointer;
}
.dice--ready .dice__svg {
  animation: dice-breathe 1.6s ease-in-out infinite;
}
.dice--ready:hover .dice__svg {
  transform: scale(1.06);
}
.dice--ready:active .dice__svg {
  transform: scale(0.94);
}

/* Rolling: rapid wobble + shake while faces tumble. */
.dice--rolling .dice__svg {
  animation: dice-shake 0.28s linear infinite;
}

/* Landed: quick overshoot pop. */
.dice--landed .dice__svg {
  animation: dice-pop 0.32s ease-out;
}

@keyframes dice-breathe {
  0%,
  100% {
    transform: translateY(0);
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.25)) drop-shadow(0 0 0 var(--dice-glow));
  }
  50% {
    transform: translateY(-6%);
    filter: drop-shadow(0 6px 7px rgba(0, 0, 0, 0.22)) drop-shadow(0 0 9px var(--dice-glow));
  }
}

@keyframes dice-shake {
  0% {
    transform: rotate(-9deg) scale(1.04);
  }
  25% {
    transform: rotate(7deg) scale(1.08);
  }
  50% {
    transform: rotate(-5deg) scale(1.05);
  }
  75% {
    transform: rotate(8deg) scale(1.09);
  }
  100% {
    transform: rotate(-9deg) scale(1.04);
  }
}

@keyframes dice-pop {
  0% {
    transform: scale(1.18);
  }
  60% {
    transform: scale(0.92);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dice--ready .dice__svg,
  .dice--rolling .dice__svg,
  .dice--landed .dice__svg {
    animation: none;
  }
}
</style>
