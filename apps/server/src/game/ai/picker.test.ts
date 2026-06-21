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

  describe("personality profiles", () => {
    it("aggressor prioritizes capture over escape", () => {
      const state = makeState(
        [
          t("b1", "blue", "T/5"), // can escape (safe from opponent)
          t("b2", "blue", "T/10"), // can capture
          t("r1", "red", "T/13"), // lone opponent at T/13
          t("r2", "red", "T/3"), // opponent 1–6 behind b1's T/5
        ],
        1,
        3,
      );
      const moves = [
        move("b1", "T/5", "T/8"), // escape danger
        move("b2", "T/10", "T/13"), // capture r1
      ];
      expect(pickMove(moves, state, 1, "aggressor").tokenId).toBe("b2");
    });

    it("defender prioritizes escape over capture", () => {
      const state = makeState(
        [
          t("b1", "blue", "T/5"), // can escape
          t("b2", "blue", "T/10"), // can capture
          t("r1", "red", "T/13"), // lone opponent
          t("r2", "red", "T/3"), // opponent 1–6 behind b1's T/5
        ],
        1,
        3,
      );
      const moves = [
        move("b1", "T/5", "T/8"), // escape danger
        move("b2", "T/10", "T/13"), // capture r1
      ];
      expect(pickMove(moves, state, 1, "defender").tokenId).toBe("b1");
    });

    it("sprinter prioritizes deploy and advance over capture", () => {
      const state = makeState(
        [
          t("b1", "blue", "Y/1/1"), // can deploy
          t("b2", "blue", "T/5"), // can capture
          t("r1", "red", "T/8"), // lone opponent at T/8
        ],
        1,
        6,
      );
      const moves = [
        move("b1", "Y/1/1", "T/1"), // deploy (6-roll)
        move("b2", "T/5", "T/8"), // capture
      ];
      expect(pickMove(moves, state, 1, "sprinter").tokenId).toBe("b1");
    });

    it.each(["aggressor", "defender", "sprinter"] as const)(
      "%s rescues a threatened near-home token instead of capturing",
      (personality) => {
        // trackLen = 22 (2 seats × 11), seat-1 start = T/1, home entry = T/22.
        // b1 at T/18 is near home (progress 17 ≥ 22−1−6) and threatened by r2 at T/13.
        const state = makeState(
          [
            t("b1", "blue", "T/18"), // near home, threatened — should be rescued
            t("b2", "blue", "T/5"), // can capture r1
            t("r1", "red", "T/8"), // lone opponent (capture target)
            t("r2", "red", "T/13"), // 5 steps behind b1 → threat
          ],
          1,
          3,
        );
        const moves = [
          move("b1", "T/18", "T/21"), // advance the endangered near-home token
          move("b2", "T/5", "T/8"), // capture r1
        ];
        expect(pickMove(moves, state, 1, personality).tokenId).toBe("b1");
      },
    );

    it("does not rescue over capture when the threatened token is far from home", () => {
      // Same threat geometry but on early track cells: capture should win for aggressor.
      const state = makeState(
        [
          t("b1", "blue", "T/5"), // threatened but far from home
          t("b2", "blue", "T/10"), // can capture r1
          t("r1", "red", "T/13"), // lone opponent
          t("r2", "red", "T/3"), // 2 steps behind b1 → threat
        ],
        1,
        3,
      );
      const moves = [
        move("b1", "T/5", "T/8"), // escape (not near home)
        move("b2", "T/10", "T/13"), // capture
      ];
      expect(pickMove(moves, state, 1, "aggressor").tokenId).toBe("b2");
    });

    it("sprinter picks furthest token advance when no capture/deploy/escape", () => {
      const state = makeState([t("b1", "blue", "T/3"), t("b2", "blue", "T/10")]);
      const moves = [
        move("b1", "T/3", "T/6"), // minimal advance
        move("b2", "T/10", "T/13"), // further advance (5x more weight with sprinter)
      ];
      expect(pickMove(moves, state, 1, "sprinter").tokenId).toBe("b2");
    });
  });
});
