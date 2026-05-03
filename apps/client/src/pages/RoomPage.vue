<script setup lang="ts">
defineProps<{ roomId: string }>();
</script>

<template>
  <main>
    <h1>Room Lobby</h1>
    <p>Room: {{ roomId }}</p>
  </main>
</template>
