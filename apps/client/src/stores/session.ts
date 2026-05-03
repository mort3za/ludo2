import { defineStore } from "pinia";
import { ref, computed } from "vue";

const TOKEN_KEY = "ludo_token";
const PLAYER_KEY = "ludo_player";

export const useSessionStore = defineStore("session", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const playerId = ref<string | null>(localStorage.getItem(PLAYER_KEY));

  const isLoggedIn = computed(() => !!token.value);

  function login(newToken: string, newPlayerId: string) {
    token.value = newToken;
    playerId.value = newPlayerId;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(PLAYER_KEY, newPlayerId);
  }

  function logout() {
    token.value = null;
    playerId.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAYER_KEY);
  }

  return { token, playerId, isLoggedIn, login, logout };
});
