<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { DButton, DCard } from "@/shared/ui";
import { guestLogin, createRoom } from "@/shared/api/client";
import { useSessionStore } from "@/stores/session";

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const loading = ref(false);
const error = ref("");

const botCount = computed(() => {
  const raw = Number(route.query["bots"] ?? 0);
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
});

async function handleCreateRoom() {
  error.value = "";
  loading.value = true;
  try {
    const auth = await guestLogin();
    session.login(auth.token, auth.playerId);
    const { roomId } = await createRoom(botCount.value);
    router.push({ name: "room", params: { roomId } });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-canvas-white">
    <DCard class="p-8 w-full max-w-sm">
      <h1 class="text-heading-lg font-sans text-midnight-ink text-center mb-6">Ludo</h1>

      <form class="flex flex-col gap-4" @submit.prevent="handleCreateRoom">
        <DButton :disabled="loading" data-testid="create-room-btn">
          {{ loading ? "Creating…" : "Create Room" }}
        </DButton>
        <p v-if="error" class="text-caption text-red-500 font-sans text-center">{{ error }}</p>
      </form>
    </DCard>
  </main>
</template>
