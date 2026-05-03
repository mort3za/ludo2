<script setup lang="ts">
defineProps<{
  variant?: "primary" | "ghost";
  disabled?: boolean;
}>();
</script>

<template>
  <button
    :class="[
      'inline-flex items-center justify-center font-sans transition-colors',
      variant === 'ghost'
        ? 'bg-transparent text-midnight-ink border border-midnight-ink rounded-pill px-5 py-1.5'
        : 'bg-onyx-button text-canvas-white rounded-pill px-3.5 py-2',
      disabled && 'opacity-50 cursor-not-allowed',
    ]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
