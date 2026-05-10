<script setup lang="ts">
defineProps<{
  variant?: "primary" | "ghost";
  disabled?: boolean;
}>();
</script>

<template>
  <button
    :class="[
      'd-btn',
      variant === 'ghost' ? 'd-btn--ghost' : 'd-btn--primary',
      disabled && 'd-btn--disabled',
    ]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
