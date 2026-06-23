<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "@/stores/session";
import { useGameResultStore } from "@/stores/game-result";
import { createWsConnection, type WsConnection } from "@/shared/lib/ws";
import { useGameAnimation } from "@/features/match/use-game-animation";
import { playSound } from "@/shared/lib/use-sound";
import { legalMoves, TIMINGS, type PlayerColor } from "@ludo/shared";
import type { ServerMessage } from "@ludo/shared";
import { playerColorHex } from "@/entities/game/board-geometry";
import BoardView from "@/entities/game/BoardView.vue";
import BoardDice from "@/features/match/BoardDice.vue";
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
const {
  gameState,
  animating,
  stackingTokenId,
  lastRolledValue,
  rollNonce,
  isActionLocked,
  handleMessage,
} = useGameAnimation(
  (msg) => {
    if (msg.type === "rolled") {
      playSound("diceRoll");
      // The roller has nothing to do with this dice — cue it once the dice
      // has settled so it reads as a follow-up to the roll, not a clash.
      if (activeSeatHasNoMoves(msg.value)) {
        if (noMovesTimer !== null) clearTimeout(noMovesTimer);
        noMovesTimer = setTimeout(() => {
          noMovesTimer = null;
          playSound("noMoves");
        }, TIMINGS.diceReveal);
      }
    }

    if (msg.type === "turn") {
      deadline.value = msg.deadline;
      // A distinct soft cue when it becomes our turn, so it's recognizable
      // without watching the board; everyone else hears the generic change.
      playSound(msg.seat === mySeat.value ? "myTurn" : "turnChange");
    }

    // Fresh game (every token still in its yard) — announce the start.
    if (
      msg.type === "state" &&
      msg.state.status !== "finished" &&
      msg.state.diceValue === null &&
      msg.state.tokens.every((t) => t.cell.startsWith("Y/"))
    ) {
      playSound("gameStart");
    }

    if (msg.type === "presence") {
      seatConnectionState.value.set(msg.seat, msg.connected);
    }

    if (msg.type === "captured" && gameState.value) {
      const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
      if (token) {
        capturedColor.value = token.color;
        // The attacker is the active player; they hear a victory cue, while
        // the captured player and everyone else hear the sad one.
        const isAttacker = mySeat.value !== null && mySeat.value === gameState.value.activeSeat;
        playSound(isAttacker ? "tokenCaptureWin" : "tokenCaptureSad");
      }
    }

    if (msg.type === "finished") {
      playSound(msg.standings[0] === mySeat.value ? "win" : "gameOver");
      if (gameState.value) {
        gameResultStore.setResult(gameState.value);
      }
      vueRouter.push({ name: "post-game", params: { roomId: props.roomId } });
    }
  },
  () => playSound("tokenStep"),
);

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
let noMovesTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Whether the seat that just rolled has zero legal moves for `diceValue`. The
 * server auto-passes such turns, so this is the cue to play the "no moves"
 * sound for whoever is watching, regardless of which seat rolled.
 */
function activeSeatHasNoMoves(diceValue: number): boolean {
  const state = gameState.value;
  if (!state) return false;
  const activeColor = state.seats.find((s) => s.index === state.activeSeat)?.color;
  const seatTokens = state.tokens.filter((t) => t.color === activeColor);
  const moves = legalMoves(
    seatTokens,
    diceValue,
    state.activeSeat,
    state.seats.length,
    state.tokens,
    state.options.wallEnabled,
    state.options.startGuardEnabled,
  );
  return moves.length === 0;
}

const canSendAction = computed(() => !pendingAction.value && !isActionLocked.value);

/** Find the local player's seat index, or null if spectator. */
const mySeat = computed(() => {
  if (!gameState.value) return null;
  const seat = gameState.value.seats.find((s) => s.playerId === session.playerId);
  return seat?.index ?? null;
});

const isSpectator = computed(() => mySeat.value === null);

/** Whether the local player may roll right now (drives the center dice button). */
const canRoll = computed(() => {
  const state = gameState.value;
  if (!state || mySeat.value === null) return false;
  if (state.activeSeat !== mySeat.value) return false;
  if (state.status !== "rolling") return false;
  return canSendAction.value;
});

/** Active seat's color, used to tint the dice "ready" glow. */
const activeSeatColor = computed(() => {
  const seat = gameState.value?.seats.find((s) => s.index === gameState.value?.activeSeat);
  return seat ? playerColorHex(seat.color) : undefined;
});

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
    state.options.wallEnabled,
    state.options.startGuardEnabled,
  );
  return moves.map((m) => m.tokenId);
});

/**
 * Provably-impossible state: it's our turn to move, the dice is rolled, we're
 * not mid-animation, yet there are no legal moves. The server never sits here —
 * it auto-passes turns with no legal moves and sends a "turn" message — so if we
 * land in it, our local state has drifted from the server's (a dropped/late
 * message, or setTimeout-driven timers throttled while the tab was backgrounded).
 * Left alone this deadlocks the game, so we recover by requesting a resync.
 */
const isDeadlocked = computed(() => {
  const state = gameState.value;
  return (
    state !== null &&
    mySeat.value !== null &&
    state.activeSeat === mySeat.value &&
    state.status === "moving" &&
    !isActionLocked.value &&
    state.diceValue !== null &&
    legalTokenIds.value.length === 0
  );
});

// Grace period so a legitimately-late "turn" message (slow network) can still
// arrive and resolve the state before we ask the server to re-send everything.
const RESYNC_GRACE_MS = 1500;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
watch(isDeadlocked, (stuck) => {
  if (resyncTimer !== null) {
    clearTimeout(resyncTimer);
    resyncTimer = null;
  }
  if (!stuck) return;
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    if (isDeadlocked.value) ws?.send({ type: "resync" });
  }, RESYNC_GRACE_MS);
});

function onServerMessage(msg: ServerMessage) {
  if (import.meta.env.DEV) console.log("[ws]", msg.type, msg);
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
  playSound("tokenSelect");
  pendingAction.value = true;
  ws?.send({ type: "move", tokenId });
}

// Dev-only: jump the live game to a named test scenario (see server debug-scenarios.ts).
const isDev = import.meta.env.DEV;
const debugScenarios = ["home-stretch", "home-jump", "move-over-opponents"];
function onDebugScenario(scenario: string) {
  ws?.send({ type: "debug_set_state", scenario });
}
function onDebugUndo() {
  ws?.send({ type: "debug_undo" });
}
// Dev-only: force a seat's next roll to a chosen value. Defaults to my own seat.
const debugDiceSeatOverride = ref<number | null>(null);
const debugDiceSeat = computed<number | null>({
  get: () => debugDiceSeatOverride.value ?? mySeat.value,
  set: (v) => {
    debugDiceSeatOverride.value = v;
  },
});
const debugDiceValue = ref(6);
function onDebugSetDice() {
  const seat = debugDiceSeat.value;
  if (seat === null) return;
  ws?.send({ type: "debug_set_dice", seat, value: debugDiceValue.value });
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
  if (resyncTimer !== null) clearTimeout(resyncTimer);
  if (noMovesTimer !== null) clearTimeout(noMovesTimer);
  ws?.close();
});
</script>

<template>
  <main class="min-h-screen flex flex-col items-center p-2 sm:p-4">
    <CaptureToast :color="capturedColor" />

    <ReconnectBanner v-if="ws" :status="ws.status.value" />

    <SpectatorBadge v-if="isSpectator && gameState" />

    <div
      v-if="gameState"
      class="w-full max-w-(--board-width) flex flex-col items-center gap-3 sm:gap-4"
    >
      <GameControls
        v-if="mySeat !== null"
        :state="gameState"
        :my-seat="mySeat"
        :legal-token-ids="legalTokenIds"
        :action-locked="isActionLocked"
        :seat-connected="seatConnectionState.get(gameState?.activeSeat ?? -1) ?? true"
      />

      <div class="relative w-full aspect-square max-w-(--board-width)">
        <BoardView
          class="w-full h-full"
          :board-size="gameState.seats.length"
          :local-seat="mySeat ?? undefined"
          :tokens="gameState.tokens"
          :legal-token-ids="legalTokenIds"
          :animating-token-id="stackingTokenId ?? animating?.tokenId"
          :hidden-stack-badge-cell-id="hiddenStackBadgeCellId"
          :seats="gameState.seats"
          @move="onMove"
        />
        <div
          class="absolute left-1/2 top-1/2 w-[7%] aspect-square -translate-x-1/2 -translate-y-1/2"
        >
          <BoardDice
            :value="lastRolledValue"
            :roll-nonce="rollNonce"
            :can-roll="canRoll"
            :color="activeSeatColor"
            @roll="onRoll"
          />
        </div>
      </div>

      <TurnTimer :deadline="deadline" />
    </div>

    <p v-else class="text-body-sm text-text-muted font-sans">{{ t("match.loadingGame") }}</p>

    <details
      v-if="isDev && mySeat !== null"
      dir="ltr"
      class="fixed bottom-4 left-4 z-50 font-sans text-body-sm"
    >
      <summary
        class="cursor-pointer list-none rounded border border-border bg-surface-card px-3 py-1.5 text-text-muted shadow-sm select-none hover:bg-surface-muted"
      >
        🐛 Debug
      </summary>
      <div
        class="absolute bottom-full left-0 mb-1 flex w-max flex-col gap-1 rounded border border-border bg-surface-card p-1 shadow-sm"
      >
        <button
          v-for="scenario in debugScenarios"
          :key="scenario"
          type="button"
          class="cursor-pointer rounded px-3 py-1.5 text-left text-text-muted hover:bg-surface-muted"
          @click="onDebugScenario(scenario)"
        >
          {{ scenario }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded px-3 py-1.5 text-left text-text-muted hover:bg-surface-muted"
          @click="onDebugUndo"
        >
          ↩ undo
        </button>
        <div v-if="gameState" class="flex items-center gap-1 px-1 pt-1">
          <select
            v-model.number="debugDiceSeat"
            class="cursor-pointer rounded border border-border bg-surface-card px-1 py-1 text-text-muted"
          >
            <option v-for="seat in gameState.seats" :key="seat.index" :value="seat.index">
              {{ seat.color }}{{ seat.index === mySeat ? " (me)" : "" }}
            </option>
          </select>
          <select
            v-model.number="debugDiceValue"
            class="cursor-pointer rounded border border-border bg-surface-card px-1 py-1 text-text-muted"
          >
            <option v-for="n in 6" :key="n" :value="n">{{ n }}</option>
          </select>
          <button
            type="button"
            class="cursor-pointer rounded px-2 py-1 text-text-muted hover:bg-surface-muted"
            @click="onDebugSetDice"
          >
            🎲 set
          </button>
        </div>
      </div>
    </details>
  </main>
</template>
