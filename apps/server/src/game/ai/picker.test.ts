import { describe, it, expect } from "vitest";
import { pickMove } from "./picker.js";
import type { GameState, LegalMove, Token } from "@ludo/shared";
import { makeState as buildState, tok as t } from "../../test/make-state.js";

function makeState(tokens: Token[], activeSeat = 1, diceValue = 3): GameState {
  return buildState({ tokens, activeSeat, diceValue, status: "moving" });
}

function move(tokenId: string, from: string, to: string): LegalMove {
  return { tokenId, from, to };
}

describe("pickMove", () => {
  it("returns the sole move without throwing", () => {
    const state = makeState([t("b1", "blue", "T/5")]);
    const moves = [move("b1", "T/5", "T/8")];
    expect(() => pickMove(moves, state, 1)).not.toThrow();
    expect(pickMove(moves, state, 1)).toEqual(moves[0]);
  });

  it("throws when legalMoves is empty", () => {
    const state = makeState([]);
    expect(() => pickMove([], state, 1)).toThrow();
  });

  describe("priority 1: capture", () => {
    it("prefers capture over deploy", () => {
      const state = makeState(
        [
          t("b1", "blue", "Y/1/1"), // can deploy
          t("b2", "blue", "T/5"), // can capture
          t("r1", "red", "T/8"), // lone opponent
        ],
        1,
        6,
      );
      const moves = [
        move("b1", "Y/1/1", "T/1"), // deploy
        move("b2", "T/5", "T/8"), // capture r1
      ];
      expect(pickMove(moves, state, 1).tokenId).toBe("b2");
    });

    it("prefers capture over advance", () => {
      const state = makeState([
        t("b1", "blue", "T/3"),
        t("b2", "blue", "T/5"),
        t("r1", "red", "T/8"), // lone opponent at destination of b2
      ]);
      const moves = [
        move("b1", "T/3", "T/6"), // advance
        move("b2", "T/5", "T/8"), // capture
      ];
      expect(pickMove(moves, state, 1).tokenId).toBe("b2");
    });

    it("does not score as capture when destination has two opponents (block)", () => {
      const state = makeState([
        t("b1", "blue", "T/5"),
        t("r1", "red", "T/8"),
        t("r2", "red", "T/8"), // block — not capturable
      ]);
      const moves = [
        move("b1", "T/5", "T/8"), // not a capture (block)
      ];
      // No capture possible; should return the only move without error
      expect(pickMove(moves, state, 1).tokenId).toBe("b1");
    });
  });

  describe("priority 2: deploy on 6", () => {
    it("prefers deploy over plain advance", () => {
      const state = makeState([t("b1", "blue", "Y/1/1"), t("b2", "blue", "T/3")], 1, 6);
      const moves = [
        move("b1", "Y/1/1", "T/1"), // deploy
        move("b2", "T/3", "T/9"), // advance
      ];
      expect(pickMove(moves, state, 1).tokenId).toBe("b1");
    });
  });

  describe("priority 4: advance furthest token", () => {
    it("picks the more advanced token when no capture or deploy", () => {
      const state = makeState([
        t("b1", "blue", "T/3"), // less advanced from seat-1 start T/1
        t("b2", "blue", "T/10"), // more advanced
      ]);
      const moves = [move("b1", "T/3", "T/6"), move("b2", "T/10", "T/13")];
      // b2 is further along — its destination should win
      expect(pickMove(moves, state, 1).tokenId).toBe("b2");
    });

    it("prefers home-column token over track token", () => {
      const state = makeState([t("b1", "blue", "T/20"), t("b2", "blue", "H/1/2")]);
      const moves = [move("b1", "T/20", "T/23"), move("b2", "H/1/2", "H/1/4")];
      expect(pickMove(moves, state, 1).tokenId).toBe("b2");
    });
  });
});
