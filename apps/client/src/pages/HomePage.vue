<script setup lang="ts">
import { DButton } from "@/shared/ui";
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center">
    <h1 class="text-display font-sans text-midnight-ink tracking-tight mb-10">Ludo</h1>
    <RouterLink :to="{ name: 'create-room' }">
      <DButton data-testid="play-btn" class="px-10 py-3 text-heading-sm"> Play </DButton>
    </RouterLink>
  </main>
</template>
