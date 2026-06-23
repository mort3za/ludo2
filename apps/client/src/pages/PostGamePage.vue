<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { DButton } from "@/shared/ui";
import { TIMINGS } from "@ludo/shared";
import PostGameStandings from "@/features/match/PostGameStandings.vue";

const props = defineProps<{ roomId: string }>();
const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const gameResult = useGameResultStore();

const isOwner = computed(() => {
  if (!gameResult.state) return false;
  const seat = gameResult.state.seats.find((s) => s.index === 1);
  return seat?.playerId === session.playerId;
});

const rematchAvailable = computed(() => {
  if (!isOwner.value || !gameResult.endedAt) return false;
  return Date.now() < gameResult.endedAt + TIMINGS.postGameWindow;
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
  <main class="min-h-screen flex flex-col items-center justify-center p-4">
    <PostGameStandings
      v-if="gameResult.state"
      :state="gameResult.state"
      :player-id="session.playerId"
    />

    <p v-else class="text-body-sm text-text-muted font-sans">{{ t("postgame.noData") }}</p>

    <div class="mt-4 flex flex-col items-center gap-2 w-full max-w-sm">
      <DButton v-if="rematchAvailable" class="w-full" @click="sendRematch">
        {{ t("postgame.rematch") }}
      </DButton>
      <p v-else-if="isOwner" class="text-caption text-text-muted text-center font-sans">
        {{ t("postgame.rematchExpired") }}
      </p>
      <DButton variant="ghost" class="w-full" @click="goToLobby">
        {{ t("postgame.backToLobby") }}
      </DButton>
    </div>
  </main>
</template>
