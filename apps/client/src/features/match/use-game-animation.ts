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
        break;

      case "turn":
        if (gameState.value) {
          gameState.value.activeSeat = msg.seat;
          gameState.value.diceValue = null;
          gameState.value.status = "rolling";
        }
        break;

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
