import { describe, it, expect } from "vitest";
import { home, legalMoves } from "@ludo/shared";
import { makeState, seat, tok } from "../test/make-state.js";
import { applyDebugScenario } from "./debug-scenarios.js";

describe("applyDebugScenario", () => {
  it("returns null for an unknown scenario", () => {
    expect(applyDebugScenario(makeState(), "nope", 1)).toBeNull();
  });

  describe("home-stretch", () => {
    const base = makeState({
      seats: [seat(1, "blue"), seat(2, "red")],
      tokens: [tok("2-1", "red", "T/5")],
      activeSeat: 2,
      status: "rolling",
      diceValue: null,
    });

    it("stacks tokens on the final home squares, pulls one onto the track, and forces a 1", () => {
      const next = applyDebugScenario(base, "home-stretch", 1)!;
      const blue = next.tokens.filter((t) => t.color === "blue");

      // Three tokens stay stacked on the upper home squares; one is pulled
      // 6 cells back onto the main track (entry square T/22 − 6 = T/16).
      expect(blue.map((t) => t.cell).sort()).toEqual([home(1, 2), home(1, 3), home(1, 4), "T/16"]);
      expect(next.activeSeat).toBe(1);
      expect(next.status).toBe("moving");
      expect(next.diceValue).toBe(1);
    });

    it("leaves at least one requester token selectable with the forced roll", () => {
      const next = applyDebugScenario(base, "home-stretch", 1)!;
      const blue = next.tokens.filter((t) => t.color === "blue");
      const moves = legalMoves(blue, next.diceValue!, 1, next.seats.length, next.tokens);

      expect(moves).toHaveLength(1);
      expect(moves[0]!.from).toBe("T/16");
      expect(moves[0]!.to).toBe("T/17");
    });

    it("leaves other seats' tokens untouched", () => {
      const next = applyDebugScenario(base, "home-stretch", 1)!;
      expect(next.tokens.filter((t) => t.color === "red")).toEqual([tok("2-1", "red", "T/5")]);
    });

    it("does not mutate the input state", () => {
      applyDebugScenario(base, "home-stretch", 1);
      expect(base.tokens).toEqual([tok("2-1", "red", "T/5")]);
      expect(base.diceValue).toBeNull();
    });
  });
});
