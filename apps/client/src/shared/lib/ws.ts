import { ref, type Ref } from "vue";
import { apiConfig } from "@/shared/config/api";
import { getPlayerName } from "@/shared/lib/use-player-name";
import type { ClientMessage, ServerMessage } from "@ludo/shared";

export type WsStatus = "connecting" | "connected" | "disconnected";

export interface WsConnection {
  status: Ref<WsStatus>;
  send: (msg: ClientMessage) => void;
  onMessage: (handler: (msg: ServerMessage) => void) => void;
  close: () => void;
}

// Escalating backoff that caps at 15s; the last value repeats for later attempts.
// ~20 attempts keeps trying for several minutes so players rejoin after a server
// restart/redeploy instead of being dropped from an in-progress game.
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const MAX_RECONNECT_ATTEMPTS = 20;

export function createWsConnection(roomId: string, token: string): WsConnection {
  const status = ref<WsStatus>("connecting");
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let intentionalClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let messageHandler: ((msg: ServerMessage) => void) | null = null;

  function connect() {
    const base = apiConfig.baseUrl || globalThis.location.origin;
    const wsBase = base.replace(/^http/, "ws");
    const name = getPlayerName();
    const socket = new WebSocket(
      `${wsBase}/ws/${roomId}?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`,
    );
    ws = socket;
    status.value = "connecting";

    socket.onopen = () => {
      if (ws !== socket) return;
      status.value = "connected";
      reconnectAttempt = 0;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      if (ws !== socket) return;
      if (!messageHandler) return;
      const msg = JSON.parse(event.data as string) as ServerMessage;
      messageHandler(msg);
    };

    socket.onclose = () => {
      if (ws !== socket) return;
      status.value = "disconnected";
      if (!intentionalClose && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]!;
        reconnectAttempt++;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (ws === socket) {
            connect();
          }
        }, delay);
      }
    };

    socket.onerror = () => {
      if (ws !== socket) return;
      // onclose will fire after onerror
    };
  }

  connect();

  return {
    status,
    send(msg: ClientMessage) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    onMessage(handler: (msg: ServerMessage) => void) {
      messageHandler = handler;
    },
    close() {
      intentionalClose = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close();
    },
  };
}
