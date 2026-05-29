<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { PlayerColor } from "@ludo/shared";

const props = defineProps<{
  color?: PlayerColor;
}>();

const isVisible = ref(false);
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const displayName = computed(() => {
  const colors: Record<PlayerColor, string> = {
    blue: "Blue",
    red: "Red",
    green: "Green",
    yellow: "Yellow",
  };
  return props.color ? colors[props.color] : "";
});

watch(
  () => props.color,
  (newColor) => {
    if (dismissTimer) clearTimeout(dismissTimer);

    if (newColor) {
      isVisible.value = true;
      dismissTimer = setTimeout(() => {
        isVisible.value = false;
        dismissTimer = null;
      }, 2500);
    } else {
      isVisible.value = false;
    }
  },
);
</script>

<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 flex items-center justify-center pointer-events-none"
  >
    <div
      class="bg-neutral-900 text-white px-6 py-3 rounded-lg text-body-sm font-sans font-medium shadow-lg animate-fade-in"
    >
      {{ displayName }}'s token sent home
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
