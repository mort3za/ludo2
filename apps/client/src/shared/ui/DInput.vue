<script setup lang="ts">
defineProps<{
  modelValue?: string;
  placeholder?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <input
    type="text"
    class="w-full bg-surface-card text-text-primary placeholder-text-muted border border-border rounded-sm px-2.5 py-2.5 font-sans text-body outline-none focus:border-focus transition-colors"
    :value="modelValue"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
