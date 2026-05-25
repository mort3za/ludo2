import { apiConfig } from "@/shared/config/api";
import { useSessionStore } from "@/stores/session";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = useSessionStore();
  const headers = new Headers(options.headers);
  if (session.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${apiConfig.baseUrl}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function guestLogin() {
  return request<{ token: string; playerId: string }>("/auth/guest", {
    method: "POST",
  });
}

export function refreshToken(token: string) {
  return request<{ token: string }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function createRoom(bots = 0) {
  return request<{ roomId: string }>("/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bots > 0 ? { bots } : {}),
  });
}

export function getGameHistory(gameId: string) {
  return request<{ entries: unknown[] }>(`/games/${encodeURIComponent(gameId)}/history`);
}
