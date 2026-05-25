<script setup lang="ts">
import { DButton } from "@/shared/ui";
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-4">
    <h1 class="text-display font-sans text-midnight-ink tracking-tight mb-6">Ludo</h1>
    <RouterLink :to="{ name: 'create-room' }">
      <DButton data-testid="play-btn" class="px-10 py-3 text-heading-sm"> Play </DButton>
    </RouterLink>
    <RouterLink :to="{ name: 'create-room', query: { bots: 1 } }">
      <DButton data-testid="play-vs-ai-btn" variant="ghost" class="px-10 py-3 text-heading-sm">
        Play vs AI
      </DButton>
    </RouterLink>
  </main>
</template>
