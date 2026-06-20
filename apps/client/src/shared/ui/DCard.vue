<script setup lang="ts">
defineProps<{
  elevated?: boolean;
}>();
</script>

<template>
  <div :class="['rounded-card', elevated ? 'bg-surface-card shadow-subtle' : 'bg-surface-muted']">
    <slot />
  </div>
</template>
