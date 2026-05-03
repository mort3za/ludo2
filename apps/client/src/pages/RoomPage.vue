<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { DButton, DCard } from "@/shared/ui";
import { useSessionStore } from "@/stores/session";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import type { ServerMessage } from "@ludo/shared";

const props = defineProps<{ roomId: string }>();
const router = useRouter();
const session = useSessionStore();

const players = ref<{ playerId: string; name: string; ready: boolean }[]>([]);
const myReady = ref(false);
const gameStarted = ref(false);

const shareLink = computed(
  () => `${globalThis.location.origin}/room/${props.roomId}`,
);

let ws: WsConnection | null = null;

function handleMessage(msg: ServerMessage) {
  if (msg.type === "state") {
    // Game started — navigate to match
    gameStarted.value = true;
    router.push({ name: "match", params: { roomId: props.roomId } });
  }
}

onMounted(() => {
  if (!session.token) {
    router.push({ name: "home" });
    return;
  }
  ws = createWsConnection(props.roomId, session.token);
  ws.onMessage(handleMessage);
});

onUnmounted(() => {
  ws?.close();
});

function toggleReady() {
  myReady.value = !myReady.value;
  ws?.send({ type: "ready" });
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-canvas-white">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <DCard class="p-8 w-full max-w-sm">
      <h2 class="text-heading font-sans text-midnight-ink text-center mb-2">Room Lobby</h2>
      <p class="text-body-sm text-subtle-gray text-center mb-6 font-sans" data-testid="room-id">
        {{ roomId }}
      </p>

      <div class="mb-6">
        <p class="text-caption text-subtle-gray font-sans mb-2">Share this link to invite players:</p>
        <code class="block p-2 bg-near-white rounded-sm text-body-sm font-sans break-all" data-testid="share-link">
          {{ shareLink }}
        </code>
      </div>

      <div class="flex flex-col gap-3">
        <DButton
          :variant="myReady ? 'ghost' : 'primary'"
          data-testid="ready-btn"
          @click="toggleReady"
        >
          {{ myReady ? "Not Ready" : "Ready" }}
        </DButton>
      </div>
    </DCard>
  </main>
</template>
