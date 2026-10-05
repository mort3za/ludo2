import { createApp, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@ludo/shared";

const status = ref<"connecting" | "connected" | "disconnected">("connecting");
const send = vi.fn();
let onMessage: (msg: ServerMessage) => void = () => {};
const push = vi.fn();

vi.mock("@/shared/lib/ws", () => ({
  createWsConnection: () => ({
    status,
    send,
    close: vi.fn(),
    onMessage: (handler: (msg: ServerMessage) => void) => (onMessage = handler),
  }),
}));
vi.mock("@/shared/api/client", () => ({ getGameResult: vi.fn() }));
vi.mock("@/stores/session", () => ({ useSessionStore: () => ({ token: "tok", playerId: "p2" }) }));
vi.mock("@/stores/game-result", () => ({
  // A result is already in memory, so the page connects straight away.
  useGameResultStore: () => ({ state: { seats: [] }, endedAt: 1, clear: vi.fn() }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/shared/ui", () => ({
  DButton: {
    props: ["disabled"],
    emits: ["click"],
    setup(
      props: { disabled?: boolean },
      { slots, emit }: { slots: { default?: () => unknown }; emit: (e: "click") => void },
    ) {
      return () =>
        h(
          "button",
          { disabled: props.disabled, onClick: () => emit("click") },
          slots.default?.() as never,
        );
    },
  },
}));
vi.mock("@/features/match/PostGameStandings.vue", () => ({ default: { render: () => null } }));

const { default: PostGamePage } = await import("./PostGamePage.vue");

describe("PostGamePage", () => {
  it("sends the room back to the lobby only once its socket is connected", async () => {
    const host = document.createElement("div");
    const app = createApp({ render: () => h(PostGamePage, { roomId: "room-1" }) });
    app.mount(host);
    await nextTick();
    const button = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "postgame.backToLobby",
    )!;

    // While connecting, a click could not reach the server — so it can't be made.
    expect(button.disabled).toBe(true);

    status.value = "connected";
    await nextTick();
    expect(button.disabled).toBe(false);
    button.click();
    expect(send).toHaveBeenCalledWith({ type: "back_to_lobby" });
    expect(push).toHaveBeenCalledWith({ name: "room", params: { roomId: "room-1" } });

    app.unmount();
  });

  it("follows the room when another player moves it back to the lobby", async () => {
    push.mockClear();
    status.value = "connected";
    const app = createApp({ render: () => h(PostGamePage, { roomId: "room-1" }) });
    app.mount(document.createElement("div"));
    await nextTick();

    onMessage({ type: "lobby", players: [], ownerId: "p1", capacity: 4, options: {} as never });

    expect(push).toHaveBeenCalledWith({ name: "room", params: { roomId: "room-1" } });
    app.unmount();
  });
});
