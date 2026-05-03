<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from "vue";

const props = defineProps<{
  /** Unix timestamp (ms) when the turn expires. 0 or undefined = no timer. */
  deadline?: number;
  /** Warn when remaining time drops below this threshold (ms). Default 5000. */
  warnThreshold?: number;
}>();

const remaining = ref(0);
let timerId: ReturnType<typeof setInterval> | null = null;
const isDev = import.meta.env.DEV;

const threshold = computed(() => props.warnThreshold ?? 5000);
const isWarning = computed(() => remaining.value > 0 && remaining.value <= threshold.value);
const displaySeconds = computed(() => Math.max(0, Math.ceil(remaining.value / 1000)));

function tick() {
  if (!props.deadline) {
    remaining.value = 0;
    return;
  }
  remaining.value = Math.max(0, props.deadline - Date.now());
  if (remaining.value <= 0 && timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

watch(
  () => props.deadline,
  (d) => {
    if (timerId) clearInterval(timerId);
    if (d && d > Date.now()) {
      tick();
      timerId = setInterval(tick, 100);
    } else {
      remaining.value = 0;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});
</script>

<template>
  <div
    v-if="!isDev && deadline && remaining > 0"
    class="font-sans text-heading tabular-nums transition-colors"
    :class="isWarning ? 'text-red-500 animate-pulse' : 'text-subtle-gray'"
  >
    {{ displaySeconds }}s
  </div>
</template>
