import { describe, it, expect } from "vitest";
import { pickMove } from "./picker.js";
import type { GameState, LegalMove, Token } from "@ludo/shared";
import { makeState as buildState, tok as t, botDecisionState } from "../../test/make-state.js";

function makeState(tokens: Token[], activeSeat = 1, diceValue = 3): GameState {
  return buildState({ tokens, activeSeat, diceValue, status: "moving" });
}

function move(tokenId: string, from: string, to: string): LegalMove {
  return { tokenId, from, to };
}

describe("AI Personalities", () => {
  describe("Aggressor", () => {
    it("prioritizes capture over safety", () => {
      // Aggressor should take the capture move even if it's risky
      const state = makeState(
        [
          t("b1", "blue", "T/2"),
          t("b2", "blue", "T/5"),
          t("r1", "red", "T/1"), // threatens b1
          t("r2", "red", "T/8"), // alone, can be captured
        ],
        1,
        3,
      );
      const moves = [
        move("b1", "T/2", "T/5"), // escape danger
        move("b2", "T/5", "T/8"), // capture r2
      ];
      const chosen = pickMove(moves, state, 1, "aggressor");
      expect(chosen.tokenId).toBe("b2"); // capture preferred
    });
  });

  describe("Defender", () => {
    it("prioritizes escaping danger", () => {
      // Defender should escape a threatened position
      const state = makeState(
        [
          t("b1", "blue", "T/2"),
          t("b2", "blue", "T/20"), // far away, not in danger
          t("r1", "red", "T/1"), // close threat to b1 only
        ],
        1,
        3,
      );
      const moves = [
        move("b1", "T/2", "T/5"), // escape danger: score = 900 + 4 = 904
        move("b2", "T/20", "T/23"), // no danger: score = 1 * 3 = 3
      ];
      const chosen = pickMove(moves, state, 1, "defender");
      expect(chosen.tokenId).toBe("b1"); // escape heavily preferred
    });
  });

  describe("Sprinter", () => {
    it("prioritizes advancement and deployment", () => {
      // Sprinter should eagerly deploy new tokens and advance
      const state = makeState([t("b1", "blue", "Y/1/1"), t("b2", "blue", "T/3")], 1, 6);
      const moves = [
        move("b1", "Y/1/1", "T/1"), // deploy
        move("b2", "T/3", "T/9"), // advance far
      ];
      const chosen = pickMove(moves, state, 1, "sprinter");
      expect(chosen.tokenId).toBe("b1"); // deployment is favored
    });
  });

  describe("Personality consistency", () => {
    it("same state + same personality yields same move", () => {
      const tokens = [t("b1", "blue", "T/5"), t("r1", "red", "T/8"), t("r2", "red", "T/10")];
      const state1 = makeState(tokens, 1, 3);
      const state2 = makeState(tokens, 1, 3);

      const moves = [
        move("b1", "T/5", "T/8"), // capture
        move("b1", "T/5", "T/10"), // advance
      ];

      const move1 = pickMove(moves, state1, 1, "aggressor");
      const move2 = pickMove(moves, state2, 1, "aggressor");
      expect(move1).toEqual(move2);
    });

    it("different personalities choose differently in mixed scenario", () => {
      // Create a state where capture is possible but risky (opponent nearby)
      const tokens = [
        t("b1", "blue", "T/2"), // in danger
        t("b2", "blue", "T/5"),
        t("r1", "red", "T/1"), // threatens b1
        t("r2", "red", "T/8"), // alone, capturable
      ];
      const state = makeState(tokens, 1, 3);

      const moves = [
        move("b1", "T/2", "T/5"), // escape
        move("b2", "T/5", "T/8"), // capture
      ];

      const aggressorMove = pickMove(moves, state, 1, "aggressor");
      const defenderMove = pickMove(moves, state, 1, "defender");

      // Aggressor should capture, defender should escape
      expect(aggressorMove.tokenId).toBe("b2");
      expect(defenderMove.tokenId).toBe("b1");
      expect(aggressorMove).not.toEqual(defenderMove);
    });
  });
});
