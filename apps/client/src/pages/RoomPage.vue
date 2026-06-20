<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { DButton, DCard } from "@/shared/ui";
import { useSessionStore } from "@/stores/session";
import { guestLogin, refreshToken } from "@/shared/api/client";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import type { ServerMessage, LobbyPlayer, GameOptions } from "@ludo/shared";

const props = defineProps<{ roomId: string }>();
const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();

const players = ref<LobbyPlayer[]>([]);
const ownerId = ref("");
const capacity = ref(0);
const options = ref<GameOptions>({ wallEnabled: false, autoMoveEnabled: true, timerEnabled: true });
const gameStarted = ref(false);
const joined = ref(false);
const joinError = ref("");
const connecting = ref(false);

const myReady = computed(
  () => players.value.find((p) => p.playerId === session.playerId)?.ready ?? false,
);
const isOwner = computed(() => session.playerId === ownerId.value);
const canStart = computed(
  () => isOwner.value && players.value.length >= 2 && players.value.every((p) => p.ready),
);

const visiblePlayers = computed(() => {
  return players.value.filter((p) => p.playerId !== ownerId.value);
});

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
    capacity.value = msg.capacity;
    options.value = msg.options;
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
    joinError.value = e instanceof Error ? e.message : t("home.error");
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
  ws?.send({ type: "add_bot" });
}

function setOption(key: keyof GameOptions, value: boolean) {
  // Optimistic local update; server echoes the authoritative state via lobby.
  options.value = { ...options.value, [key]: value };
  ws?.send({ type: "set_options", options: options.value });
}

function removePlayer(playerId: string) {
  ws?.send({ type: "remove_player", playerId });
}

const canAddBot = computed(
  () => isOwner.value && capacity.value > 0 && players.value.length < capacity.value,
);
</script>

<template>
  <main class="flex items-center justify-center bg-canvas-white">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <DCard v-if="connecting && !joined" class="p-8 w-full max-w-sm">
      <p class="text-body-sm text-subtle-gray font-sans text-center">{{ t("room.joining") }}</p>
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
    <DCard v-else class="bg-frost rounded-lg p-8 w-full max-w-sm">
      <h2 class="text-heading font-sans text-midnight-ink text-center mb-6">
        {{ t("room.title") }}
      </h2>

      <div class="mb-6">
        <p class="text-body-sm text-subtle-gray font-sans mb-2">
          {{ t("room.sharePrompt") }}
        </p>
        <div class="flex items-center gap-2">
          <DButton class="w-full" variant="ghost" @click="copyLink">
            {{ copied ? t("common.copied") : t("common.copyLink") }}
          </DButton>
        </div>
        <p class="text-caption text-subtle-gray font-sans mt-4 mb-1">
          {{ t("room.roomId") }}
          <code
            class="text-body-xs text-subtle-gray text-center mb-6 font-sans"
            dir="ltr"
            data-testid="room-id"
          >
            {{ roomId }}
          </code>
        </p>
      </div>

      <!-- Player list -->
      <ul class="mb-3 flex flex-col gap-2" data-testid="player-list">
        <li
          v-for="p in visiblePlayers"
          :key="p.playerId"
          class="flex items-center justify-between rounded-sm bg-near-white font-sans text-body-sm px-3 py-2"
        >
          <span class="text-midnight-ink flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="p.connected ? 'bg-green-500' : 'bg-neutral-400'"
              :title="p.connected ? t('room.connected') : t('room.disconnected')"
            ></span>
            {{ p.name }}
            <span v-if="p.isBot" class="text-caption text-subtle-gray">{{ t("common.ai") }}</span>
          </span>
          <div class="flex items-center gap-2">
            <span :class="p.ready ? 'text-green-600' : 'text-subtle-gray'" class="text-caption">
              {{ p.ready ? t("common.ready") : t("common.notReady") }}
            </span>
            <button
              v-if="isOwner"
              type="button"
              class="d-btn d-btn--tertiary d-btn--circle"
              :data-testid="`remove-player-${p.playerId}`"
              :aria-label="p.isBot ? t('room.removeAi') : t('room.removePlayer')"
              @click="removePlayer(p.playerId)"
            >
              ×
            </button>
          </div>
        </li>
      </ul>

      <DButton
        v-if="canAddBot"
        variant="ghost"
        class="mb-6 w-full"
        data-testid="add-bot-btn"
        @click="addBot"
      >
        {{ t("room.addAi") }}
      </DButton>

      <!-- Game options -->
      <div class="mb-6 flex flex-col gap-4" data-testid="game-options">
        <label
          class="flex items-center justify-between gap-3"
          :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
        >
          <span class="font-sans">
            <span class="block text-body-sm text-midnight-ink">{{ t("room.wallFeature") }}</span>
            <span class="block text-caption text-subtle-gray">{{ t("room.wallFeatureHint") }}</span>
          </span>
          <input
            type="checkbox"
            class="peer sr-only"
            :checked="options.wallEnabled"
            :disabled="!isOwner"
            data-testid="wall-toggle"
            @change="setOption('wallEnabled', ($event.target as HTMLInputElement).checked)"
          />
          <span
            class="relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-500 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
          ></span>
        </label>

        <label
          class="flex items-center justify-between gap-3"
          :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
        >
          <span class="font-sans">
            <span class="block text-body-sm text-midnight-ink">{{ t("room.autoMove") }}</span>
            <span class="block text-caption text-subtle-gray">{{ t("room.autoMoveHint") }}</span>
          </span>
          <input
            type="checkbox"
            class="peer sr-only"
            :checked="options.autoMoveEnabled"
            :disabled="!isOwner"
            data-testid="auto-move-toggle"
            @change="setOption('autoMoveEnabled', ($event.target as HTMLInputElement).checked)"
          />
          <span
            class="relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-500 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
          ></span>
        </label>

        <label
          class="flex items-center justify-between gap-3"
          :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
        >
          <span class="font-sans">
            <span class="block text-body-sm text-midnight-ink">{{ t("room.turnTimer") }}</span>
            <span class="block text-caption text-subtle-gray">{{ t("room.turnTimerHint") }}</span>
          </span>
          <input
            type="checkbox"
            class="peer sr-only"
            :checked="options.timerEnabled"
            :disabled="!isOwner"
            data-testid="timer-toggle"
            @change="setOption('timerEnabled', ($event.target as HTMLInputElement).checked)"
          />
          <span
            class="relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-500 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
          ></span>
        </label>
      </div>

      <div class="flex flex-col gap-3">
        <DButton
          :variant="myReady ? 'ghost' : 'primary'"
          data-testid="ready-btn"
          @click="toggleReady"
        >
          <span class="inline-flex items-center justify-center gap-2">
            <svg
              v-if="myReady"
              class="w-4 h-4 text-green-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            {{ myReady ? t("room.youreReady") : t("room.imReady") }}
          </span>
        </DButton>

        <DButton
          v-if="isOwner"
          variant="primary"
          :disabled="!canStart"
          data-testid="start-btn"
          @click="startGame"
        >
          {{ t("room.startGame") }}
        </DButton>
      </div>
    </DCard>
  </main>
</template>
