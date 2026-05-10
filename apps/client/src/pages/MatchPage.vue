<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { useGameAnimation } from "@/features/match/use-game-animation";
import { legalMoves } from "@ludo/shared";
import type { ServerMessage } from "@ludo/shared";
import BoardView from "@/entities/game/BoardView.vue";
import GameControls from "@/features/match/GameControls.vue";
import TurnTimer from "@/features/match/TurnTimer.vue";
import ReconnectBanner from "@/features/match/ReconnectBanner.vue";
import SpectatorBadge from "@/features/match/SpectatorBadge.vue";

const props = defineProps<{ roomId: string }>();
const vueRouter = useRouter();
const session = useSessionStore();
const gameResultStore = useGameResultStore();
const { gameState, animating, handleMessage } = useGameAnimation();

const deadline = ref<number>(0);
let ws: WsConnection | null = null;

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
  handleMessage(msg);

  if (msg.type === "turn") {
    deadline.value = msg.deadline;
  }

  if (msg.type === "finished") {
    if (gameState.value) {
      gameResultStore.setResult(gameState.value);
    }
    vueRouter.push({ name: "post-game", params: { roomId: props.roomId } });
  }
}

function onRoll() {
  ws?.send({ type: "roll" });
}

function onMove(tokenId: string) {
  console.log(
    "[onMove]",
    tokenId,
    "status:",
    gameState.value?.status,
    "dice:",
    gameState.value?.diceValue,
  );
  ws?.send({ type: "move", tokenId });
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
  <main class="min-h-screen flex flex-col items-center bg-canvas-white p-4">
    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <SpectatorBadge v-if="isSpectator && gameState" />

    <div v-if="gameState" class="w-full max-w-lg flex flex-col items-center gap-4">
      <GameControls
        v-if="mySeat !== null"
        :state="gameState"
        :my-seat="mySeat"
        :legal-token-ids="legalTokenIds"
        @roll="onRoll"
        @move="onMove"
      />

      <BoardView
        class="h-[50vh]"
        :board-size="gameState.seats.length"
        :local-seat="mySeat ?? undefined"
        :tokens="gameState.tokens"
        :legal-token-ids="legalTokenIds"
        :seats="gameState.seats"
        @move="onMove"
      />

      <TurnTimer :deadline="deadline" />
    </div>

    <p v-else class="text-body-sm text-subtle-gray font-sans">Loading game…</p>
  </main>
</template>
