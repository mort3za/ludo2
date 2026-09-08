<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { DButton, DCard } from "@/shared/ui";
import { useSessionStore } from "@/stores/session";
import { ApiError, guestLogin, refreshToken } from "@/shared/api/client";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { usePlayerName } from "@/shared/lib/use-player-name";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import type { ServerMessage, LobbyPlayer, GameOptions } from "@ludo/shared";

const props = defineProps<{ roomId: string }>();
const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const { playerName } = usePlayerName();

const players = ref<LobbyPlayer[]>([]);
const ownerId = ref("");
const capacity = ref(0);
const options = ref<GameOptions>({
  wallEnabled: false,
  autoMoveEnabled: true,
  timerEnabled: false,
  startGuardEnabled: true,
  consecutiveSixLimitEnabled: false,
});
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
const showSettings = ref(false);

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

// Push a name edited from the lobby header to the server so the lobby list
// reflects it live. The initial name is already sent via the WS query string.
watch(playerName, (name) => {
  ws?.send({ type: "set_name", name });
});

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
  } catch (e) {
    // Only a token the server actively rejects (401) is a dead identity. Every
    // other failure — the server restarting during a deploy, a 5xx from the
    // tunnel, a flaky network — is transient, and throwing the identity away
    // there would rejoin a running match under a brand-new player id: the
    // player loses their seat and lands in their own game as a spectator.
    // The stored token stays valid for days, so keep it and let the WebSocket
    // handshake be the judge.
    if (e instanceof ApiError && e.status === 401) {
      session.logout();
      await joinAsGuest();
      return;
    }
  } finally {
    connecting.value = false;
  }
  connectWs();
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
  <main class="flex-1 flex items-center justify-center py-4">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <DCard v-if="connecting && !joined" class="p-8 w-full max-w-sm">
      <p class="text-body-sm text-text-muted font-sans text-center">{{ t("room.joining") }}</p>
    </DCard>

    <DCard v-else-if="!joined" class="p-8 w-full max-w-sm">
      <p
        v-if="joinError"
        class="text-caption text-danger font-sans text-center"
        data-testid="join-error"
      >
        {{ joinError }}
      </p>
    </DCard>

    <!-- Lobby view after joining -->
    <DCard v-else class="bg-frost rounded-lg p-8 w-full max-w-sm">
      <h2 class="text-heading font-sans text-text-primary text-center mb-6">
        {{ t("room.title") }}
      </h2>

      <div class="mb-6">
        <p class="text-body-sm text-text-muted font-sans mb-2">
          {{ t("room.sharePrompt") }}
        </p>
        <div class="flex items-center gap-2">
          <DButton class="w-full" variant="ghost" @click="copyLink">
            {{ copied ? t("common.copied") : t("common.copyLink") }}
          </DButton>
        </div>
      </div>

      <!-- Player list -->
      <ul class="mb-3 flex flex-col gap-2" data-testid="player-list">
        <li
          v-for="p in visiblePlayers"
          :key="p.playerId"
          class="flex items-center justify-between rounded-sm bg-surface-muted font-sans text-body-sm px-3 py-2"
        >
          <span class="text-text-primary flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="p.connected ? 'bg-success' : 'bg-text-muted'"
              :title="p.connected ? t('room.connected') : t('room.disconnected')"
            ></span>
            {{ p.name }}
            <span v-if="p.isBot" class="text-caption text-text-muted">{{ t("common.bot") }}</span>
          </span>
          <div class="flex items-center gap-2">
            <span :class="p.ready ? 'text-success' : 'text-text-muted'" class="text-caption">
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
        <span class="inline-flex items-center justify-center gap-2">
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M12 3v5" />
            <circle cx="12" cy="3" r="1" />
            <path d="M8 13h.01M16 13h.01" />
            <path d="M3 14H1m22 0h-2" />
          </svg>
          {{ t("room.addAi") }}
        </span>
      </DButton>

      <!-- Game options -->
      <div class="mb-6">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-sm bg-surface-muted px-3 py-2.5 font-sans text-body-sm text-text-primary transition-colors hover:bg-border"
          :aria-expanded="showSettings"
          data-testid="settings-toggle"
          @click="showSettings = !showSettings"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-4 h-4 text-text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
            <span class="font-medium">{{ t("room.settings") }}</span>
          </span>
          <svg
            class="w-4 h-4 text-text-muted transition-transform"
            :class="showSettings ? 'rotate-180' : ''"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        <div v-show="showSettings" class="mt-4 flex flex-col gap-4" data-testid="game-options">
          <label
            class="flex items-center justify-between gap-3"
            :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
          >
            <span class="font-sans">
              <span class="block text-body-sm text-text-primary">{{ t("room.wallFeature") }}</span>
              <span class="block text-caption text-text-muted">{{
                t("room.wallFeatureHint")
              }}</span>
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
              class="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-on-accent after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
            ></span>
          </label>

          <label
            class="flex items-center justify-between gap-3"
            :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
          >
            <span class="font-sans">
              <span class="block text-body-sm text-text-primary">{{ t("room.autoMove") }}</span>
              <span class="block text-caption text-text-muted">{{ t("room.autoMoveHint") }}</span>
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
              class="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-on-accent after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
            ></span>
          </label>

          <label
            class="flex items-center justify-between gap-3"
            :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
          >
            <span class="font-sans">
              <span class="block text-body-sm text-text-primary">{{ t("room.turnTimer") }}</span>
              <span class="block text-caption text-text-muted">{{ t("room.turnTimerHint") }}</span>
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
              class="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-on-accent after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
            ></span>
          </label>

          <label
            class="flex items-center justify-between gap-3"
            :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
          >
            <span class="font-sans">
              <span class="block text-body-sm text-text-primary">{{ t("room.startGuard") }}</span>
              <span class="block text-caption text-text-muted">{{ t("room.startGuardHint") }}</span>
            </span>
            <input
              type="checkbox"
              class="peer sr-only"
              :checked="options.startGuardEnabled"
              :disabled="!isOwner"
              data-testid="start-guard-toggle"
              @change="setOption('startGuardEnabled', ($event.target as HTMLInputElement).checked)"
            />
            <span
              class="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-on-accent after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
            ></span>
          </label>

          <label
            class="flex items-center justify-between gap-3"
            :class="isOwner ? 'cursor-pointer' : 'opacity-60'"
          >
            <span class="font-sans">
              <span class="block text-body-sm text-text-primary">{{
                t("room.consecutiveSixLimit")
              }}</span>
              <span class="block text-caption text-text-muted">{{
                t("room.consecutiveSixLimitHint")
              }}</span>
            </span>
            <input
              type="checkbox"
              class="peer sr-only"
              :checked="options.consecutiveSixLimitEnabled"
              :disabled="!isOwner"
              data-testid="consecutive-six-limit-toggle"
              @change="
                setOption('consecutiveSixLimitEnabled', ($event.target as HTMLInputElement).checked)
              "
            />
            <span
              class="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:inset-s-0.5 after:size-5 after:rounded-full after:bg-on-accent after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
            ></span>
          </label>
        </div>
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
              class="w-4 h-4 text-success"
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
