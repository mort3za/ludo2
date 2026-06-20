import { defineStore } from "pinia";
import { ref, computed } from "vue";

const TOKEN_KEY = "ludo_token";
const PLAYER_KEY = "ludo_player";

// Identity is stored per-tab (sessionStorage), not per-origin (localStorage),
// so two games opened in separate tabs/windows of the same browser stay isolated
// and never overwrite each other's guest identity. sessionStorage survives a tab
// reload (preserving reconnect) but is scoped to that single browsing context.
export const useSessionStore = defineStore("session", () => {
  const token = ref<string | null>(sessionStorage.getItem(TOKEN_KEY));
  const playerId = ref<string | null>(sessionStorage.getItem(PLAYER_KEY));

  const isLoggedIn = computed(() => !!token.value);

  function login(newToken: string, newPlayerId: string) {
    token.value = newToken;
    playerId.value = newPlayerId;
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(PLAYER_KEY, newPlayerId);
  }

  function logout() {
    token.value = null;
    playerId.value = null;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PLAYER_KEY);
  }

  return { token, playerId, isLoggedIn, login, logout };
});
