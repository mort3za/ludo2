import { defineStore } from "pinia";
import { ref } from "vue";
import type { GameState } from "@ludo/shared";

export const useGameResultStore = defineStore("gameResult", () => {
  const state = ref<GameState | null>(null);
  const endedAt = ref<number>(0);

  function setResult(gameState: GameState, endedAtMs: number = Date.now()) {
    state.value = gameState;
    endedAt.value = endedAtMs;
  }

  function clear() {
    state.value = null;
    endedAt.value = 0;
  }

  return { state, endedAt, setResult, clear };
});
