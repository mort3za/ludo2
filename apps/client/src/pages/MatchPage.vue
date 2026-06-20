<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { useGameAnimation } from "@/features/match/use-game-animation";
import { legalMoves, type PlayerColor } from "@ludo/shared";
import type { ServerMessage } from "@ludo/shared";
import BoardView from "@/entities/game/BoardView.vue";
import GameControls from "@/features/match/GameControls.vue";
import TurnTimer from "@/features/match/TurnTimer.vue";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import SpectatorBadge from "@/features/match/SpectatorBadge.vue";
import CaptureToast from "@/features/match/CaptureToast.vue";

const props = defineProps<{ roomId: string }>();
const { t } = useI18n();
const vueRouter = useRouter();
const session = useSessionStore();
const gameResultStore = useGameResultStore();
const capturedColor = ref<PlayerColor | undefined>(undefined);
const seatConnectionState = ref<Map<number, boolean>>(new Map());
const { gameState, animating, stackingTokenId, lastRolledValue, isActionLocked, handleMessage } =
  useGameAnimation((msg) => {
    if (msg.type === "turn") {
      deadline.value = msg.deadline;
    }

    if (msg.type === "presence") {
      seatConnectionState.value.set(msg.seat, msg.connected);
    }

    if (msg.type === "captured" && gameState.value) {
      const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
      if (token) {
        capturedColor.value = token.color;
      }
    }

    if (msg.type === "finished") {
      if (gameState.value) {
        gameResultStore.setResult(gameState.value);
      }
      vueRouter.push({ name: "post-game", params: { roomId: props.roomId } });
    }
  });

/**
 * Cell whose stack badge should be suppressed: the destination cell during a
 * capture handoff, including the brief window after the moving token arrives
 * but before the captured-token message lands.
 */
const hiddenStackBadgeCellId = computed<string | undefined>(() => {
  const anim = animating.value;
  if (!anim) return undefined;
  if (anim.type === "capture") return anim.from;
  if (anim.type === "move") {
    const mover = gameState.value?.tokens.find((t) => t.id === anim.tokenId);
    const occupant = gameState.value?.tokens.find(
      (t) => t.id !== anim.tokenId && t.cell === anim.to && t.color !== mover?.color,
    );
    if (occupant) return anim.to;
  }
  return undefined;
});

const deadline = ref<number>(0);
const pendingAction = ref(false);
let ws: WsConnection | null = null;

const canSendAction = computed(() => !pendingAction.value && !isActionLocked.value);

/** Find the local player's seat index, or null if spectator. */
const mySeat = computed(() => {
  if (!gameState.value) return null;
  const seat = gameState.value.seats.find((s) => s.playerId === session.playerId);
  return seat?.index ?? null;
});

const isSpectator = computed(() => mySeat.value === null);

/** Compute legal token IDs for the current player. */
const legalTokenIds = computed(() => {
  const state = gameState.value;
  if (!state || mySeat.value === null) return [];
  if (isActionLocked.value) return [];
  if (state.activeSeat !== mySeat.value) return [];
  if (state.status !== "moving" && state.status !== "rolling") return [];
  if (state.diceValue === null) return [];

  const seatTokens = state.tokens.filter((t) => {
    const seat = state.seats.find((s) => s.color === t.color);
    return seat?.index === mySeat.value;
  });

  const moves = legalMoves(
    seatTokens,
    state.diceValue,
    mySeat.value,
    state.seats.length,
    state.tokens,
  );
  return moves.map((m) => m.tokenId);
});

function onServerMessage(msg: ServerMessage) {
  console.log("[ws]", msg.type, msg);
  pendingAction.value = false;
  handleMessage(msg);

  // Server restarted: fresh lobby room means game session is gone — go back to room
  if (msg.type === "lobby") {
    vueRouter.push({ name: "room", params: { roomId: props.roomId } });
    return;
  }

  // Safety net: session missing (e.g. server restart race) — go back to room
  if (msg.type === "error" && msg.message === "no-game") {
    vueRouter.push({ name: "room", params: { roomId: props.roomId } });
    return;
  }
}

function onRoll() {
  if (!canSendAction.value) return;
  pendingAction.value = true;
  ws?.send({ type: "roll" });
}

function onMove(tokenId: string) {
  if (!canSendAction.value) return;
  pendingAction.value = true;
  ws?.send({ type: "move", tokenId });
}

// Dev-only: jump the live game to a named test scenario (see server debug-scenarios.ts).
const isDev = import.meta.env.DEV;
const debugScenarios = ["home-stretch", "home-jump"];
function onDebugScenario(scenario: string) {
  ws?.send({ type: "debug_set_state", scenario });
}

onMounted(() => {
  if (!session.token) {
    vueRouter.push({ name: "room", params: { roomId: props.roomId } });
    return;
  }
  ws = createWsConnection(props.roomId, session.token);
  ws.onMessage(onServerMessage);
});

onUnmounted(() => {
  ws?.close();
});
</script>

<template>
  <main class="min-h-screen flex flex-col items-center bg-canvas-white p-2 sm:p-4">
    <CaptureToast :color="capturedColor" />

    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <SpectatorBadge v-if="isSpectator && gameState" />

    <div v-if="gameState" class="w-full max-w-lg flex flex-col items-center gap-3 sm:gap-4">
      <GameControls
        v-if="mySeat !== null"
        :state="gameState"
        :my-seat="mySeat"
        :legal-token-ids="legalTokenIds"
        :last-rolled-value="lastRolledValue"
        :action-locked="isActionLocked"
        :seat-connected="seatConnectionState.get(gameState?.activeSeat ?? -1) ?? true"
        @roll="onRoll"
      />

      <BoardView
        class="w-full aspect-square max-w-xs sm:max-w-lg"
        :board-size="gameState.seats.length"
        :local-seat="mySeat ?? undefined"
        :tokens="gameState.tokens"
        :legal-token-ids="legalTokenIds"
        :animating-token-id="stackingTokenId ?? animating?.tokenId"
        :hidden-stack-badge-cell-id="hiddenStackBadgeCellId"
        :seats="gameState.seats"
        @move="onMove"
      />

      <TurnTimer :deadline="deadline" />

      <div v-if="isDev && mySeat !== null" class="mt-1 flex flex-wrap gap-2">
        <button
          v-for="scenario in debugScenarios"
          :key="scenario"
          type="button"
          class="rounded border border-subtle-gray px-2 py-1 text-body-sm font-sans text-subtle-gray"
          @click="onDebugScenario(scenario)"
        >
          🐛 {{ scenario }}
        </button>
      </div>
    </div>

    <p v-else class="text-body-sm text-subtle-gray font-sans">{{ t("match.loadingGame") }}</p>
  </main>
</template>
