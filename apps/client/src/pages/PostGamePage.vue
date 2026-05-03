<script setup lang="ts">
defineProps<{ roomId: string }>();
</script>

<template>
  <main>
    <h1>Post Game</h1>
    <p>Room: {{ roomId }}</p>
  </main>
</template>
