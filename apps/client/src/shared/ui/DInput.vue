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
    class="w-full bg-input-fill text-medium-gray placeholder-medium-gray border border-medium-gray rounded-sm px-2.5 py-2.5 font-sans text-body outline-none focus:border-midnight-ink transition-colors"
    :value="modelValue"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
