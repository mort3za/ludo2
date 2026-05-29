<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { DButton } from "@/shared/ui";
import { guestLogin, createRoom } from "@/shared/api/client";
import { useSessionStore } from "@/stores/session";

const router = useRouter();
const session = useSessionStore();
const loading = ref(false);
const error = ref("");
const boardSize = ref(4);

async function play() {
  error.value = "";
  loading.value = true;
  try {
    const auth = await guestLogin();
    session.login(auth.token, auth.playerId);
    const { roomId } = await createRoom(boardSize.value);
    await router.push({ name: "room", params: { roomId } });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-4">
    <h1 class="text-display font-sans text-midnight-ink tracking-tight mb-6">Ludo</h1>

    <!-- Board size selector -->
    <div class="flex flex-col items-center gap-3">
      <p class="text-caption font-sans text-neutral-600">Board Size</p>
      <div class="flex gap-2">
        <button
          v-for="size in [4, 5, 6, 7, 8]"
          :key="size"
          :data-testid="`board-size-${size}`"
          :class="[
            'px-4 py-2 rounded-full text-body-sm font-sans font-medium transition-colors',
            boardSize === size
              ? 'bg-accent-primary text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
          ]"
          @click="boardSize = size"
        >
          {{ size }}
        </button>
      </div>
    </div>

    <DButton
      :disabled="loading"
      data-testid="play-btn"
      class="px-10 py-3 text-heading-sm min-w-40"
      @click="play"
    >
      {{ loading ? "Creating…" : "Play" }}
    </DButton>
    <p v-if="error" class="text-caption text-red-500 font-sans text-center">{{ error }}</p>
  </main>
</template>
