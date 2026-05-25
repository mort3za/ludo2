import { ref, type Ref } from "vue";
import { TIMINGS, type ServerMessage, type GameState, type Token, type Cell } from "@ludo/shared";

export interface AnimatingToken {
  tokenId: string;
  from: Cell;
  to: Cell;
  type: "move" | "capture" | "deploy";
}

export interface GameAnimationState {
  gameState: Ref<GameState | null>;
  animating: Ref<AnimatingToken | null>;
  stackingTokenId: Ref<string | null>;
  lastRolledValue: Ref<number | null>;
  isActionLocked: Ref<boolean>;
  handleMessage: (msg: ServerMessage) => void;
}

/**
 * Composable that processes server messages and updates game state.
 * Animations are driven entirely by server events — no client-side simulation.
 *
 * Flow:
 * - "state" message: replace entire game state (reconnect/initial sync)
 * - "moved" message: set animating token, then update position on animation end
 * - "captured" message: animate capture (token returns to yard)
 * - "rolled" / "turn" / "finished" / "kicked": update state directly
 */
export function useGameAnimation(
  onAppliedMessage?: (msg: ServerMessage) => void,
): GameAnimationState {
  const gameState = ref<GameState | null>(null);
  const animating = ref<AnimatingToken | null>(null);
  const stackingTokenId = ref<string | null>(null);
  // Persists across turn changes — only replaced when next player rolls.
  const lastRolledValue = ref<number | null>(null);
  const isActionLocked = ref(false);

  /** Timestamp of the last "rolled" message, used to keep dice visible briefly. */
  let lastRolledAt = 0;
  let movementEndsAt = 0;
  let turnPassEndsAt = 0;
  let pendingDiceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingActionTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingStackResetTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingStepTimers: ReturnType<typeof setTimeout>[] = [];
  let queuedMessages: ServerMessage[] = [];

  const DICE_REVEAL_MS = TIMINGS.diceReveal;
  const DICE_SHOW_MS = TIMINGS.diceShow;
  const TURN_PASS_MS = TIMINGS.turnPass;

  /** Delay between per-cell steps. Must roughly match the BoardView token CSS transition. */
  const STEP_INTERVAL_MS = 220;
  const TOKEN_TRANSITION_MS = 300;

  function getRemainingRollHoldMs(now = Date.now()) {
    if (lastRolledAt === 0) return 0;
    const holdMs = DICE_REVEAL_MS + DICE_SHOW_MS;
    return Math.max(0, holdMs - (now - lastRolledAt));
  }

  function getRemainingMoveHoldMs(now = Date.now()) {
    if (movementEndsAt === 0) return 0;
    return Math.max(0, movementEndsAt - now);
  }

  function getRemainingTurnPassMs(now = Date.now()) {
    if (turnPassEndsAt === 0) return 0;
    return Math.max(0, turnPassEndsAt - now);
  }

  function getRemainingActionLockMs(now = Date.now()) {
    return Math.max(
      getRemainingRollHoldMs(now),
      getRemainingMoveHoldMs(now),
      getRemainingTurnPassMs(now),
    );
  }

  function emitAppliedMessage(msg: ServerMessage) {
    onAppliedMessage?.(msg);
  }

  function clearStackingPriority() {
    if (pendingStackResetTimer) {
      clearTimeout(pendingStackResetTimer);
      pendingStackResetTimer = null;
    }
    stackingTokenId.value = null;
  }

  function clearPendingActions() {
    if (pendingActionTimer) {
      clearTimeout(pendingActionTimer);
      pendingActionTimer = null;
    }
    queuedMessages = [];
    movementEndsAt = 0;
    turnPassEndsAt = 0;
    isActionLocked.value = false;
    clearStackingPriority();
  }

  function schedulePendingWork() {
    const delayMs = getRemainingActionLockMs();
    if (delayMs <= 0) {
      isActionLocked.value = false;
      flushQueuedMessages();
      return;
    }

    isActionLocked.value = true;
    if (pendingActionTimer) clearTimeout(pendingActionTimer);
    pendingActionTimer = setTimeout(() => {
      pendingActionTimer = null;
      isActionLocked.value = false;
      flushQueuedMessages();
    }, delayMs);
  }

  function flushQueuedMessages() {
    if (queuedMessages.length === 0) return;

    const pending = queuedMessages;
    queuedMessages = [];
    for (let index = 0; index < pending.length; index += 1) {
      const queuedMsg = pending[index];
      if (!queuedMsg) continue;
      const delayMs = shouldDelayMessage(queuedMsg) ? getRemainingActionLockMs() : 0;
      if (delayMs > 0) {
        queuedMessages = pending.slice(index);
        schedulePendingWork();
        return;
      }
      applyMessage(queuedMsg);
    }
  }

  function shouldDelayMessage(msg: ServerMessage) {
    return (
      msg.type === "rolled" ||
      msg.type === "moved" ||
      msg.type === "captured" ||
      msg.type === "turn" ||
      msg.type === "finished" ||
      msg.type === "kicked"
    );
  }

  function animateAlongPath(token: Token, path: Cell[], finalCell: Cell) {
    for (const t of pendingStepTimers) clearTimeout(t);
    pendingStepTimers = [];
    animating.value = null;

    if (path.length === 0) {
      token.cell = finalCell;
      return 0;
    }

    path.forEach((cell, i) => {
      if (i === 0) {
        token.cell = cell;
        return;
      }
      const timer = setTimeout(() => {
        token.cell = cell;
      }, i * STEP_INTERVAL_MS);
      pendingStepTimers.push(timer);
    });

    const totalMs = (path.length - 1) * STEP_INTERVAL_MS + TOKEN_TRANSITION_MS;
    const cleanupTimer = setTimeout(() => {
      animating.value = null;
    }, totalMs);
    pendingStepTimers.push(cleanupTimer);

    return totalMs;
  }

  function applyTurn(msg: { seat: number }) {
    clearStackingPriority();
    if (gameState.value) {
      gameState.value.activeSeat = msg.seat;
      gameState.value.diceValue = null;
      gameState.value.status = "rolling";
      turnPassEndsAt = Date.now() + TURN_PASS_MS;
      schedulePendingWork();
    }
  }

  function applyMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "state":
        // Full state replacement — reconnect or initial sync
        clearPendingActions();
        if (pendingDiceTimer) {
          clearTimeout(pendingDiceTimer);
          pendingDiceTimer = null;
        }
        for (const t of pendingStepTimers) clearTimeout(t);
        pendingStepTimers = [];
        lastRolledAt = 0;
        movementEndsAt = 0;
        turnPassEndsAt = 0;
        clearStackingPriority();
        gameState.value = msg.state;
        animating.value = null;
        lastRolledValue.value = msg.state.diceValue;
        isActionLocked.value = false;
        emitAppliedMessage(msg);
        break;

      case "moved": {
        if (!gameState.value) break;
        const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
        if (!token) break;
        animating.value = {
          tokenId: msg.tokenId,
          from: token.cell,
          to: msg.to,
          type: "move",
        };
        stackingTokenId.value = msg.tokenId;
        movementEndsAt = Date.now() + animateAlongPath(token, msg.path, msg.to);
        schedulePendingWork();
        emitAppliedMessage(msg);
        break;
      }

      case "captured": {
        if (!gameState.value) break;
        const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
        if (token) {
          const capturedFrom = token.cell;
          const occupyingToken = gameState.value.tokens.find(
            (candidate) => candidate.id !== token.id && candidate.cell === capturedFrom,
          );
          animating.value = {
            tokenId: msg.tokenId,
            from: capturedFrom,
            to: msg.to,
            type: "capture",
          };
          stackingTokenId.value = occupyingToken?.id ?? stackingTokenId.value;
          token.cell = msg.to;
          if (pendingStackResetTimer) clearTimeout(pendingStackResetTimer);
          pendingStackResetTimer = setTimeout(() => {
            pendingStackResetTimer = null;
            animating.value = null;
            stackingTokenId.value = null;
          }, TOKEN_TRANSITION_MS);
        }
        emitAppliedMessage(msg);
        break;
      }

      case "rolled": {
        if (gameState.value) {
          gameState.value.diceValue = msg.value;
          gameState.value.status = "moving";
        }
        lastRolledAt = Date.now();
        isActionLocked.value = true;
        if (pendingDiceTimer) clearTimeout(pendingDiceTimer);
        lastRolledValue.value = null;
        const rolledValue = msg.value;
        pendingDiceTimer = setTimeout(() => {
          lastRolledValue.value = rolledValue;
          pendingDiceTimer = null;
        }, DICE_REVEAL_MS);
        schedulePendingWork();
        emitAppliedMessage(msg);
        break;
      }

      case "turn": {
        applyTurn(msg);
        emitAppliedMessage(msg);
        break;
      }

      case "finished":
        clearStackingPriority();
        if (gameState.value) {
          gameState.value.status = "finished";
          gameState.value.standings = msg.standings;
        }
        emitAppliedMessage(msg);
        break;

      case "kicked":
        // Seat kicked — next "state" or "turn" will update
        clearStackingPriority();
        emitAppliedMessage(msg);
        break;

      case "error":
        // Errors handled by caller
        clearStackingPriority();
        emitAppliedMessage(msg);
        break;

      case "lobby":
        clearStackingPriority();
        emitAppliedMessage(msg);
        break;
    }
  }

  function handleMessage(msg: ServerMessage) {
    if (shouldDelayMessage(msg)) {
      const delayMs = getRemainingActionLockMs();
      if (delayMs > 0) {
        queuedMessages.push(msg);
        schedulePendingWork();
        return;
      }
    }

    applyMessage(msg);
  }

  return { gameState, animating, stackingTokenId, lastRolledValue, isActionLocked, handleMessage };
}
