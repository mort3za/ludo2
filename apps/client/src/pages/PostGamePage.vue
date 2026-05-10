<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { DButton } from "@/shared/ui";
import PostGameStandings from "@/features/match/PostGameStandings.vue";

const props = defineProps<{ roomId: string }>();
const router = useRouter();
const session = useSessionStore();
const gameResult = useGameResultStore();

const isOwner = computed(() => {
  if (!gameResult.state) return false;
  const seat = gameResult.state.seats.find((s) => s.index === 1);
  return seat?.playerId === session.playerId;
});

let ws: WsConnection | null = null;

function goToLobby() {
  gameResult.clear();
  router.push({ name: "room", params: { roomId: props.roomId } });
}

function sendRematch() {
  ws?.send({ type: "rematch" });
}

onMounted(() => {
  if (!session.token) return;
  ws = createWsConnection(props.roomId, session.token);
  ws.onMessage((msg) => {
    if (msg.type === "state") {
      router.push({ name: "match", params: { roomId: props.roomId } });
    }
  });
});

onUnmounted(() => {
  ws?.close();
});
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center bg-canvas-white p-4">
    <PostGameStandings
      v-if="gameResult.state"
      :state="gameResult.state"
      :is-owner="isOwner"
      :game-ended-at="gameResult.endedAt"
    />

    <p v-else class="text-body-sm text-subtle-gray font-sans">No game data available.</p>

    <DButton v-if="isOwner" class="mt-4" @click="sendRematch">Rematch</DButton>
    <DButton variant="ghost" class="mt-4" @click="goToLobby">Back to Lobby</DButton>
  </main>
</template>
