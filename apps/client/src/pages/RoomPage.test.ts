import { createApp, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const createWsConnection = vi.fn(() => ({ onMessage: vi.fn(), send: vi.fn(), close: vi.fn() }));
let resolveRefresh: (auth: { token: string }) => void = () => {};

vi.mock("@/shared/lib/ws", () => ({ createWsConnection }));
vi.mock("@/shared/api/client", () => ({
  ApiError: class ApiError extends Error {},
  guestLogin: vi.fn(),
  refreshToken: () => new Promise((resolve) => (resolveRefresh = resolve)),
}));
vi.mock("@/stores/session", () => ({
  useSessionStore: () => ({ token: "tok", playerId: "p1", login: vi.fn(), logout: vi.fn() }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/shared/lib/use-player-name", () => ({ usePlayerName: () => ({ playerName: ref("") }) }));
vi.mock("@/shared/ui", () => ({
  DButton: { render: () => h("button") },
  DCard: { render: () => h("div") },
}));
vi.mock("@/features/match/ReconnectBanner.vue", () => ({ default: { render: () => null } }));

const { default: RoomPage } = await import("./RoomPage.vue");

describe("RoomPage", () => {
  it("does not open a socket when the page is left before the token refresh ends", async () => {
    const app = createApp({ render: () => h(RoomPage, { roomId: "room-1" }) });
    app.mount(document.createElement("div"));

    // Leave the page while the (slow) token refresh is still in flight.
    app.unmount();
    resolveRefresh({ token: "tok2" });
    await new Promise((r) => setTimeout(r, 0));

    // Nothing would ever close a socket opened now.
    expect(createWsConnection).not.toHaveBeenCalled();
  });
});
