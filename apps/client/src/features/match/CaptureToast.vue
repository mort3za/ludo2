<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PlayerColor } from "@ludo/shared";

const props = defineProps<{
  color?: PlayerColor;
}>();

const { t } = useI18n();

const isVisible = ref(false);
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const displayName = computed(() => (props.color ? t(`colors.${props.color}`) : ""));

watch(
  () => props.color,
  (newColor) => {
    if (dismissTimer) clearTimeout(dismissTimer);

    if (newColor) {
      isVisible.value = true;
      dismissTimer = setTimeout(() => {
        isVisible.value = false;
        dismissTimer = null;
      }, 3000);
    } else {
      isVisible.value = false;
    }
  },
);
</script>

<template>
  <div class="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none">
    <Transition name="slide-down">
      <div
        v-if="isVisible"
        class="bg-neutral-900 text-white px-6 py-3 mt-4 rounded-lg text-body-sm font-sans font-medium shadow-lg"
      >
        {{ t("match.captureSentHome", { color: displayName }) }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.35s ease-out,
    opacity 0.35s ease-out;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-150%);
  opacity: 0;
}
</style>
