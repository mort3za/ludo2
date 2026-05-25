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
export function useGameAnimation(): GameAnimationState {
  const gameState = ref<GameState | null>(null);
  const animating = ref<AnimatingToken | null>(null);
  // Persists across turn changes — only replaced when next player rolls.
  const lastRolledValue = ref<number | null>(null);

  /** Timestamp of the last "rolled" message, used to keep dice visible briefly. */
  let lastRolledAt = 0;
  let pendingDiceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTurnTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingStepTimers: ReturnType<typeof setTimeout>[] = [];

  const DICE_REVEAL_MS = TIMINGS.diceReveal;
  const DICE_SHOW_MS = TIMINGS.diceShow;

  /** Delay between per-cell steps. Must roughly match the BoardView token CSS transition. */
  const STEP_INTERVAL_MS = 220;

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

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "state":
        // Full state replacement — reconnect or initial sync
        gameState.value = msg.state;
        animating.value = null;
        lastRolledValue.value = msg.state.diceValue;
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
        break;
      }

      case "rolled": {
        if (gameState.value) {
          gameState.value.diceValue = msg.value;
        }
        lastRolledAt = Date.now();
        if (pendingDiceTimer) clearTimeout(pendingDiceTimer);
        lastRolledValue.value = null;
        const rolledValue = msg.value;
        pendingDiceTimer = setTimeout(() => {
          lastRolledValue.value = rolledValue;
          pendingDiceTimer = null;
        }, DICE_REVEAL_MS);
        break;
      }

      case "turn": {
        if (pendingTurnTimer) clearTimeout(pendingTurnTimer);
        const elapsed = Date.now() - lastRolledAt;
        const holdMs = DICE_REVEAL_MS + DICE_SHOW_MS;
        if (lastRolledAt > 0 && elapsed < holdMs) {
          const turnMsg = msg;
          pendingTurnTimer = setTimeout(() => {
            applyTurn(turnMsg);
            pendingTurnTimer = null;
          }, holdMs - elapsed);
        } else {
          applyTurn(msg);
        }
        break;
      }

      case "finished":
        if (gameState.value) {
          gameState.value.status = "finished";
          gameState.value.standings = msg.standings;
        }
        break;

      case "kicked":
        // Seat kicked — next "state" or "turn" will update
        break;

      case "error":
        // Errors handled by caller
        break;
    }
  }

  return { gameState, animating, lastRolledValue, handleMessage };
}
