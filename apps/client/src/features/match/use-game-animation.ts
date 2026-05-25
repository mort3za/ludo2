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
  lastRolledValue: Ref<number | null>;
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
  // Persists across turn changes — only replaced when next player rolls.
  const lastRolledValue = ref<number | null>(null);

  /** Timestamp of the last "rolled" message, used to keep dice visible briefly. */
  let lastRolledAt = 0;
  let pendingDiceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTurnTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingActionTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingStepTimers: ReturnType<typeof setTimeout>[] = [];
  let queuedMessages: ServerMessage[] = [];

  const DICE_REVEAL_MS = TIMINGS.diceReveal;
  const DICE_SHOW_MS = TIMINGS.diceShow;

  /** Delay between per-cell steps. Must roughly match the BoardView token CSS transition. */
  const STEP_INTERVAL_MS = 220;

  function getRemainingRollHoldMs(now = Date.now()) {
    if (lastRolledAt === 0) return 0;
    const holdMs = DICE_REVEAL_MS + DICE_SHOW_MS;
    return Math.max(0, holdMs - (now - lastRolledAt));
  }

  function emitAppliedMessage(msg: ServerMessage) {
    onAppliedMessage?.(msg);
  }

  function clearPendingActions() {
    if (pendingActionTimer) {
      clearTimeout(pendingActionTimer);
      pendingActionTimer = null;
    }
    queuedMessages = [];
  }

  function scheduleQueuedMessages() {
    const delayMs = getRemainingRollHoldMs();
    if (delayMs <= 0) {
      flushQueuedMessages();
      return;
    }

    if (pendingActionTimer) clearTimeout(pendingActionTimer);
    pendingActionTimer = setTimeout(() => {
      pendingActionTimer = null;
      flushQueuedMessages();
    }, delayMs);
  }

  function flushQueuedMessages() {
    if (queuedMessages.length === 0) return;

    const delayMs = getRemainingRollHoldMs();
    if (delayMs > 0) {
      scheduleQueuedMessages();
      return;
    }

    const pending = queuedMessages;
    queuedMessages = [];
    for (const queuedMsg of pending) {
      applyMessage(queuedMsg);
    }
  }

  function shouldDelayMessage(msg: ServerMessage) {
    return (
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

    if (path.length === 0) {
      token.cell = finalCell;
      return;
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
  }

  function applyTurn(msg: { seat: number }) {
    if (gameState.value) {
      gameState.value.activeSeat = msg.seat;
      gameState.value.diceValue = null;
      gameState.value.status = "rolling";
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
        if (pendingTurnTimer) {
          clearTimeout(pendingTurnTimer);
          pendingTurnTimer = null;
        }
        for (const t of pendingStepTimers) clearTimeout(t);
        pendingStepTimers = [];
        lastRolledAt = 0;
        gameState.value = msg.state;
        animating.value = null;
        lastRolledValue.value = msg.state.diceValue;
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
        animateAlongPath(token, msg.path, msg.to);
        emitAppliedMessage(msg);
        break;
      }

      case "captured": {
        if (!gameState.value) break;
        const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
        if (token) {
          animating.value = {
            tokenId: msg.tokenId,
            from: token.cell,
            to: msg.to,
            type: "capture",
          };
          token.cell = msg.to;
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
        if (pendingDiceTimer) clearTimeout(pendingDiceTimer);
        lastRolledValue.value = null;
        const rolledValue = msg.value;
        pendingDiceTimer = setTimeout(() => {
          lastRolledValue.value = rolledValue;
          pendingDiceTimer = null;
        }, DICE_REVEAL_MS);
        emitAppliedMessage(msg);
        break;
      }

      case "turn": {
        if (pendingTurnTimer) clearTimeout(pendingTurnTimer);
        applyTurn(msg);
        emitAppliedMessage(msg);
        break;
      }

      case "finished":
        if (gameState.value) {
          gameState.value.status = "finished";
          gameState.value.standings = msg.standings;
        }
        emitAppliedMessage(msg);
        break;

      case "kicked":
        // Seat kicked — next "state" or "turn" will update
        emitAppliedMessage(msg);
        break;

      case "error":
        // Errors handled by caller
        emitAppliedMessage(msg);
        break;

      case "lobby":
        emitAppliedMessage(msg);
        break;
    }
  }

  function handleMessage(msg: ServerMessage) {
    if (shouldDelayMessage(msg)) {
      const delayMs = getRemainingRollHoldMs();
      if (delayMs > 0) {
        queuedMessages.push(msg);
        scheduleQueuedMessages();
        return;
      }
    }

    applyMessage(msg);
  }

  return { gameState, animating, lastRolledValue, handleMessage };
}
