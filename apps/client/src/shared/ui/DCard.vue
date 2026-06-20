<script setup lang="ts">
defineProps<{
  elevated?: boolean;
}>();
</script>

<template>
  <div :class="['rounded-card', elevated ? 'bg-canvas-white shadow-subtle' : 'bg-card-wash']">
    <slot />
  </div>
</template>
