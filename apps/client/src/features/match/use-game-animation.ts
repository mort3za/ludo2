import { ref, type Ref } from "vue";
import type { ServerMessage, GameState, Token, Cell } from "@ludo/shared";

export interface AnimatingToken {
  tokenId: string;
  from: Cell;
  to: Cell;
  type: "move" | "capture" | "deploy";
}

export interface GameAnimationState {
  gameState: Ref<GameState | null>;
  animating: Ref<AnimatingToken | null>;
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

  /** Timestamp of the last "rolled" message, used to keep dice visible briefly. */
  let lastRolledAt = 0;
  let pendingTurnTimer: ReturnType<typeof setTimeout> | null = null;

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
        break;

      case "moved": {
        if (!gameState.value) break;
        // Find the token and record animation
        const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
        if (token) {
          animating.value = {
            tokenId: msg.tokenId,
            from: token.cell,
            to: msg.to,
            type: "move",
          };
          // Update token position immediately (CSS transition handles visual)
          token.cell = msg.to;
        }
        break;
      }

      case "captured": {
        if (!gameState.value) break;
        const token = gameState.value.tokens.find((t) => t.id === msg.tokenId);
        if (token) {
          animating.value = {
            tokenId: msg.tokenId,
            from: token.cell,
            to: token.cell, // Will be updated by the next "state" message
            type: "capture",
          };
        }
        break;
      }

      case "rolled":
        if (gameState.value) {
          gameState.value.diceValue = msg.value;
        }
        lastRolledAt = Date.now();
        break;

      case "turn": {
        if (pendingTurnTimer) clearTimeout(pendingTurnTimer);
        const elapsed = Date.now() - lastRolledAt;
        const MIN_DICE_DISPLAY_MS = 1000;
        if (elapsed < MIN_DICE_DISPLAY_MS && lastRolledAt > 0) {
          const turnMsg = msg;
          pendingTurnTimer = setTimeout(() => {
            applyTurn(turnMsg);
            pendingTurnTimer = null;
          }, MIN_DICE_DISPLAY_MS - elapsed);
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

  return { gameState, animating, handleMessage };
}
