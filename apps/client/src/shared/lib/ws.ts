import { ref, type Ref } from "vue";
import { apiConfig } from "@/shared/config/api";
import type { ClientMessage, ServerMessage } from "@ludo/shared";

export type WsStatus = "connecting" | "connected" | "disconnected";

export interface WsConnection {
  status: Ref<WsStatus>;
  send: (msg: ClientMessage) => void;
  onMessage: (handler: (msg: ServerMessage) => void) => void;
  close: () => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

export function createWsConnection(roomId: string, token: string): WsConnection {
  const status = ref<WsStatus>("connecting");
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let intentionalClose = false;
  let messageHandler: ((msg: ServerMessage) => void) | null = null;

  function connect() {
    const base = apiConfig.baseUrl || globalThis.location.origin;
    const wsBase = base.replace(/^http/, "ws");
    ws = new WebSocket(`${wsBase}/ws/${roomId}?token=${encodeURIComponent(token)}`);
    status.value = "connecting";

    ws.onopen = () => {
      status.value = "connected";
      reconnectAttempt = 0;
    };

    ws.onmessage = (event) => {
      if (!messageHandler) return;
      const msg = JSON.parse(event.data as string) as ServerMessage;
      messageHandler(msg);
    };

    ws.onclose = () => {
      status.value = "disconnected";
      if (!intentionalClose && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAYS[reconnectAttempt]!;
        reconnectAttempt++;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
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
      ws?.close();
    },
  };
}
