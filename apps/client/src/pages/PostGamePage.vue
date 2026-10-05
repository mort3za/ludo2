<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { getGameResult } from "@/shared/api/client";
import { DButton } from "@/shared/ui";
import { TIMINGS } from "@ludo/shared";
import PostGameStandings from "@/features/match/PostGameStandings.vue";

const props = defineProps<{ roomId: string }>();
const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const gameResult = useGameResultStore();

// True while we hydrate the result from the server (a refresh or shared link
// lands here with the in-memory store empty).
const loading = ref(false);

const isOwner = computed(() => {
  if (!gameResult.state) return false;
  const seat = gameResult.state.seats.find((s) => s.index === 1);
  return seat?.playerId === session.playerId;
});

const rematchAvailable = computed(() => {
  if (!isOwner.value || !gameResult.endedAt) return false;
  return Date.now() < gameResult.endedAt + TIMINGS.postGameWindow;
});

const ws = shallowRef<WsConnection | null>(null);
let unmounted = false;

// Sending back_to_lobby needs an open socket (ws.send drops it otherwise), and
// a lost click would land the player in a lobby the server still keeps closed.
const canReturnToLobby = computed(() => ws.value?.status.value === "connected");

function openLobby() {
  gameResult.clear();
  router.push({ name: "room", params: { roomId: props.roomId } });
}

/** Move the room back to its lobby for everyone, then go there. */
function goToLobby() {
  if (!canReturnToLobby.value) return;
  ws.value?.send({ type: "back_to_lobby" });
  openLobby();
}

function sendRematch() {
  ws.value?.send({ type: "rematch" });
}

onMounted(async () => {
  if (!session.token) return;

  // Fresh load (refresh / shared link): the in-memory store is empty, so pull
  // the finished result from the server, which retains it for the post-game
  // window.
  if (!gameResult.state) {
    loading.value = true;
    try {
      const { state, endedAt } = await getGameResult(props.roomId);
      gameResult.setResult(state, endedAt);
    } catch {
      // No result available (expired or never existed) — the template falls
      // back to the "no data" message.
    } finally {
      loading.value = false;
    }
  }

  // Guard against a fast unmount during the await above so we don't open a
  // WebSocket that would never be closed.
  if (unmounted) return;

  ws.value = createWsConnection(props.roomId, session.token);
  ws.value.onMessage((msg) => {
    if (msg.type === "state" && msg.state.status !== "finished") {
      router.push({ name: "match", params: { roomId: props.roomId } });
    }
    // Someone moved the room back to its lobby: follow it there.
    if (msg.type === "lobby") openLobby();
  });
});

onUnmounted(() => {
  unmounted = true;
  ws.value?.close();
});
</script>

<template>
  <main class="flex-1 flex flex-col items-center justify-center p-4">
    <PostGameStandings
      v-if="gameResult.state"
      :state="gameResult.state"
      :player-id="session.playerId"
    />

    <p v-else-if="loading" class="text-body-sm text-text-muted font-sans">
      {{ t("postgame.loading") }}
    </p>

    <p v-else class="text-body-sm text-text-muted font-sans">{{ t("postgame.noData") }}</p>

    <div class="mt-4 flex flex-col items-center gap-2 w-full max-w-sm">
      <DButton v-if="rematchAvailable" class="w-full" @click="sendRematch">
        {{ t("postgame.rematch") }}
      </DButton>
      <p v-else-if="isOwner" class="text-caption text-text-muted text-center font-sans">
        {{ t("postgame.rematchExpired") }}
      </p>
      <DButton variant="ghost" class="w-full" :disabled="!canReturnToLobby" @click="goToLobby">
        {{ t("postgame.backToLobby") }}
      </DButton>
    </div>
  </main>
</template>
