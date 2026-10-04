import { createApp, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { DEFAULT_GAME_OPTIONS, type GameState } from "@ludo/shared";
import en from "@/shared/i18n/locales/en.json";
import PostGameStandings from "./PostGameStandings.vue";

// The real UI barrel pulls in modules that read localStorage at import time.
vi.mock("@/shared/ui", () => ({
  DCard: {
    setup:
      (_: unknown, { slots }: { slots: { default?: () => unknown } }) =>
      () =>
        h("div", slots.default?.() as never),
  },
}));

afterEach(() => {
  document.body.innerHTML = "";
});

function render(state: GameState): string[] {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(PostGameStandings, { state }) });
  app.use(createI18n({ legacy: false, locale: "en", messages: { en } }));
  app.mount(host);
  const rows = [...host.querySelectorAll("li")].map((li) => li.textContent!.trim());
  app.unmount();
  return rows;
}

describe("PostGameStandings", () => {
  it("ranks an unplaced (kicked) player right after the placed ones", () => {
    // 2-player game on a 4-seat board: seat 3 was kicked, seat 1 won.
    const state: GameState = {
      gameId: "g",
      status: "finished",
      seats: [
        { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false, name: "Ann" },
        { index: 2, state: "empty", color: "red", playerId: null, isBot: false },
        { index: 3, state: "vacant", color: "green", playerId: "p3", isBot: false, name: "Bob" },
        { index: 4, state: "empty", color: "yellow", playerId: null, isBot: false },
      ],
      tokens: [],
      activeSeat: 1,
      diceValue: null,
      consecutiveSixes: 0,
      standings: [1],
      options: { ...DEFAULT_GAME_OPTIONS },
    };

    expect(render(state)).toEqual(["1stAnn", "2ndBob"]);
  });
});
