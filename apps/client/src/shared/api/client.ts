import { apiConfig } from "@/shared/config/api";
import { useSessionStore } from "@/stores/session";
import type { GameState } from "@ludo/shared";

/**
 * A response the API refused. `status` lets callers separate a request the
 * server actively rejected (4xx) from one it never answered properly (5xx,
 * restarts), which need very different handling.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`);
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
    body: JSON.stringify({
      ...(bots > 0 && { bots }),
    }),
  });
}

export function getGameHistory(gameId: string) {
  return request<{ entries: unknown[] }>(`/games/${encodeURIComponent(gameId)}/history`);
}

/** Fetch a finished game's final state (available for the post-game window). */
export function getGameResult(roomId: string) {
  return request<{ state: GameState; endedAt: number }>(
    `/rooms/${encodeURIComponent(roomId)}/result`,
  );
}
