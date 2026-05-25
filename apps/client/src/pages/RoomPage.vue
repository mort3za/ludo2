<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { DButton, DCard } from "@/shared/ui";
import { useSessionStore } from "@/stores/session";
import { guestLogin, refreshToken } from "@/shared/api/client";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import type { ServerMessage, LobbyPlayer } from "@ludo/shared";

const props = defineProps<{ roomId: string }>();
const router = useRouter();
const session = useSessionStore();

const players = ref<LobbyPlayer[]>([]);
const ownerId = ref("");
const maxPlayers = ref(0);
const gameStarted = ref(false);
const joined = ref(false);
const joinError = ref("");
const connecting = ref(false);

const botCount = computed(() => players.value.filter((p) => p.isBot).length);
const canAddBot = computed(() => players.value.length < maxPlayers.value);
const canRemoveBot = computed(() => botCount.value > 0);

const myReady = computed(
  () => players.value.find((p) => p.playerId === session.playerId)?.ready ?? false,
);
const isOwner = computed(() => session.playerId === ownerId.value);
const canStart = computed(
  () => isOwner.value && players.value.length >= 2 && players.value.every((p) => p.ready),
);

const shareLink = computed(() => `${globalThis.location.origin}/room/${props.roomId}`);
const copied = ref(false);

function copyLink() {
  navigator.clipboard.writeText(shareLink.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

let ws: WsConnection | null = null;

function handleMessage(msg: ServerMessage) {
  if (msg.type === "lobby") {
    players.value = msg.players;
    ownerId.value = msg.ownerId;
    maxPlayers.value = msg.maxPlayers;
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

async function joinAsGuest() {
  connecting.value = true;
  joinError.value = "";
  try {
    const auth = await guestLogin();
    session.login(auth.token, auth.playerId);
    connectWs();
  } catch (e) {
    joinError.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    connecting.value = false;
  }
}

async function restoreSession() {
  if (!session.token || !session.playerId) {
    await joinAsGuest();
    return;
  }

  connecting.value = true;
  try {
    const auth = await refreshToken(session.token);
    session.login(auth.token, session.playerId);
    connectWs();
  } catch {
    session.logout();
    await joinAsGuest();
  } finally {
    connecting.value = false;
  }
}

onMounted(() => {
  void restoreSession();
});

onUnmounted(() => {
  ws?.close();
});

function toggleReady() {
  ws?.send({ type: "ready" });
}

function startGame() {
  ws?.send({ type: "start" });
}

function addBot() {
  ws?.send({ type: "add-bot" });
}

function removeBot() {
  ws?.send({ type: "remove-bot" });
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-canvas-white">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <DCard v-if="connecting && !joined" class="p-8 w-full max-w-sm">
      <p class="text-body-sm text-subtle-gray font-sans text-center">Joining room…</p>
    </DCard>

    <DCard v-else-if="!joined" class="p-8 w-full max-w-sm">
      <p
        v-if="joinError"
        class="text-caption text-red-500 font-sans text-center"
        data-testid="join-error"
      >
        {{ joinError }}
      </p>
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
        <div class="flex items-center gap-2">
          <code
            class="flex-1 p-2 bg-near-white rounded-sm text-body-sm font-sans text-midnight-ink break-all"
            data-testid="share-link w-2/3"
          >
            {{ shareLink }}
          </code>
          <DButton class="w-1/3" variant="ghost" @click="copyLink">
            {{ copied ? "Copied!" : "Copy" }}
          </DButton>
        </div>
      </div>

      <!-- Bot counter (owner only) -->
      <div
        v-if="isOwner"
        class="mb-6 flex items-center justify-between p-2 rounded-sm bg-near-white"
        data-testid="bot-counter"
      >
        <span class="text-body-sm font-sans text-midnight-ink">Bot Players</span>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-white text-midnight-ink text-body-sm font-sans border border-subtle-gray hover:bg-near-white disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canRemoveBot"
            data-testid="bot-minus"
            @click="removeBot"
          >
            −
          </button>
          <span
            class="min-w-6 text-center text-body-sm font-sans text-midnight-ink"
            data-testid="bot-count"
          >
            {{ botCount }}
          </span>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-white text-midnight-ink text-body-sm font-sans border border-subtle-gray hover:bg-near-white disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canAddBot"
            data-testid="bot-plus"
            @click="addBot"
          >
            +
          </button>
        </div>
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
            <span v-if="p.isBot" class="text-caption text-subtle-gray">(AI)</span>
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
