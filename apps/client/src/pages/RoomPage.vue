<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { DButton, DCard, DInput } from "@/shared/ui";
import { useSessionStore } from "@/stores/session";
import { guestLogin } from "@/shared/api/client";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import type { ServerMessage, LobbyPlayer } from "@ludo/shared";

const props = defineProps<{ roomId: string }>();
const router = useRouter();
const session = useSessionStore();

const players = ref<LobbyPlayer[]>([]);
const ownerId = ref("");
const gameStarted = ref(false);
const joined = ref(false);
const joinName = ref("");
const joinLoading = ref(false);
const joinError = ref("");

const myReady = computed(
  () => players.value.find((p) => p.playerId === session.playerId)?.ready ?? false,
);
const isOwner = computed(() => session.playerId === ownerId.value);
const canStart = computed(
  () => isOwner.value && players.value.length >= 2 && players.value.every((p) => p.ready),
);

const shareLink = computed(() => `${globalThis.location.origin}/room/${props.roomId}`);

let ws: WsConnection | null = null;

function handleMessage(msg: ServerMessage) {
  if (msg.type === "lobby") {
    players.value = msg.players;
    ownerId.value = msg.ownerId;
  } else if (msg.type === "state") {
    gameStarted.value = true;
    router.push({ name: "match", params: { roomId: props.roomId } });
  }
}

function connectWs() {
  ws = createWsConnection(props.roomId, session.token!);
  ws.onMessage(handleMessage);
  joined.value = true;
}

onMounted(() => {
  if (session.token) {
    connectWs();
  }
});

onUnmounted(() => {
  ws?.close();
});

async function handleJoin() {
  joinError.value = "";
  const trimmed = joinName.value.trim();
  if (!trimmed) {
    joinError.value = "Enter your name";
    return;
  }
  joinLoading.value = true;
  try {
    const auth = await guestLogin(trimmed);
    session.login(auth.token, auth.playerId);
    connectWs();
  } catch (e) {
    joinError.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    joinLoading.value = false;
  }
}

function toggleReady() {
  ws?.send({ type: "ready" });
}

function startGame() {
  ws?.send({ type: "start" });
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-canvas-white">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <!-- Join form for users without a session -->
    <DCard v-if="!joined" class="p-8 w-full max-w-sm">
      <h2 class="text-heading font-sans text-midnight-ink text-center mb-6">Join Room</h2>
      <form class="flex flex-col gap-4" @submit.prevent="handleJoin">
        <DInput v-model="joinName" placeholder="Your name" data-testid="join-name-input" />
        <DButton :disabled="joinLoading" data-testid="join-btn">
          {{ joinLoading ? "Joining…" : "Join" }}
        </DButton>
        <p v-if="joinError" class="text-caption text-red-500 font-sans text-center">
          {{ joinError }}
        </p>
      </form>
    </DCard>

    <!-- Lobby view after joining -->
    <DCard v-else class="p-8 w-full max-w-sm">
      <h2 class="text-heading font-sans text-midnight-ink text-center mb-2">Room Lobby</h2>
      <p class="text-body-sm text-subtle-gray text-center mb-6 font-sans" data-testid="room-id">
        {{ roomId }}
      </p>

      <div class="mb-6">
        <p class="text-caption text-subtle-gray font-sans mb-2">
          Share this link to invite players:
        </p>
        <code
          class="block p-2 bg-near-white rounded-sm text-body-sm font-sans break-all"
          data-testid="share-link"
        >
          {{ shareLink }}
        </code>
      </div>

      <!-- Player list -->
      <ul class="mb-6 flex flex-col gap-2" data-testid="player-list">
        <li
          v-for="p in players"
          :key="p.playerId"
          class="flex items-center justify-between p-2 rounded-sm bg-near-white font-sans text-body-sm"
        >
          <span class="text-midnight-ink">
            {{ p.name }}
            <span v-if="p.playerId === ownerId" class="text-caption text-subtle-gray">(host)</span>
          </span>
          <span :class="p.ready ? 'text-green-600' : 'text-subtle-gray'" class="text-caption">
            {{ p.ready ? "Ready" : "Not ready" }}
          </span>
        </li>
      </ul>

      <div class="flex flex-col gap-3">
        <DButton
          :variant="myReady ? 'ghost' : 'primary'"
          data-testid="ready-btn"
          @click="toggleReady"
        >
          {{ myReady ? "Not Ready" : "Ready" }}
        </DButton>

        <DButton
          v-if="isOwner"
          variant="primary"
          :disabled="!canStart"
          data-testid="start-btn"
          @click="startGame"
        >
          Start Game
        </DButton>
      </div>
    </DCard>
  </main>
</template>
