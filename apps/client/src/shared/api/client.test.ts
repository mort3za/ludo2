import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ApiError, refreshToken } from "./client";

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it("reports the status of a rejected request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(401, { error: "expired-token" })));

    const error = await refreshToken("stale").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("expired-token");
  });

  // A restarting server (deploy) answers 502/503 through the tunnel. Callers key
  // off the status to keep the player's identity instead of re-registering them
  // as a new guest, which would cost them their seat in a running match.
  it("reports the status of a server that is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(503, {})));

    const error = await refreshToken("valid").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  it("propagates a network failure as-is, not as a rejection by the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await refreshToken("valid").catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ApiError);
  });
});
