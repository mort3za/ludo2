import { describe, it, expect } from "vitest";
import { legalMoves } from "./legal-moves.js";
import type { LegalMove } from "./legal-moves.js";
import type { Token, PlayerColor } from "../index.js";

const S = 4;

function makeToken(id: string, cell: string, color: PlayerColor = "blue"): Token {
  return { id, color, cell };
}

describe("legalMoves (shared)", () => {
  describe("deploy from yard", () => {
    it("can deploy from yard on a 6", () => {
      const tokens = [makeToken("t1", "Y/1/1")];
      const moves = legalMoves(tokens, 6, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "Y/1/1", to: "T/1" }]);
    });

    it("cannot deploy from yard without a 6", () => {
      const tokens = [makeToken("t1", "Y/1/1")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves).toEqual([]);
    });

    it("deploys to start square of the seat", () => {
      const tokens = [makeToken("t1", "Y/2/1")];
      const moves = legalMoves(tokens, 6, 2, S, []);
      expect(moves[0]!.to).toBe("T/12");
    });
  });

  describe("track movement", () => {
    it("moves token forward by dice value on track", () => {
      const tokens = [makeToken("t1", "T/5")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "T/5", to: "T/8" }]);
    });

    it("wraps around track end into home column", () => {
      const tokens = [makeToken("t1", "T/43")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves[0]!.to).toBe("H/1/2");
    });
  });

  describe("home column", () => {
    it("moves within home column", () => {
      const tokens = [makeToken("t1", "H/1/1")];
      const moves = legalMoves(tokens, 2, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "H/1/1", to: "H/1/3" }]);
    });

    it("rejects overshoot past home column end (L=4)", () => {
      const tokens = [makeToken("t1", "H/1/3")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves).toEqual([]);
    });

    it("allows exact landing on home end", () => {
      const tokens = [makeToken("t1", "H/1/2")];
      const moves = legalMoves(tokens, 2, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "H/1/2", to: "H/1/4" }]);
    });

    it("allows landing exactly on H/si/4 (finished)", () => {
      const tokens = [makeToken("t1", "H/1/1")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "H/1/1", to: "H/1/4" }]);
    });
  });

  describe("multiple tokens", () => {
    it("returns moves for all movable tokens", () => {
      const tokens = [makeToken("t1", "T/5"), makeToken("t2", "Y/1/2"), makeToken("t3", "T/10")];
      const moves = legalMoves(tokens, 6, 1, S, []);
      expect(moves.length).toBe(3);
    });

    it("skips tokens already at home end", () => {
      const tokens = [makeToken("t1", "H/1/4"), makeToken("t2", "T/5")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves.length).toBe(1);
      expect(moves[0]!.tokenId).toBe("t2");
    });

    it("returns empty array when no moves are legal", () => {
      const tokens = [
        makeToken("t1", "Y/1/1"),
        makeToken("t2", "Y/1/2"),
        makeToken("t3", "H/1/3"),
        makeToken("t4", "H/1/4"),
      ];
      const moves = legalMoves(tokens, 2, 1, S, []);
      expect(moves).toEqual([]);
    });
  });

  describe("deploy stacking", () => {
    it("allows deploy when own token is on start square", () => {
      const tokens = [makeToken("t1", "Y/1/1"), makeToken("t2", "T/1")];
      const moves = legalMoves(tokens, 6, 1, S, []);
      expect(moves.length).toBe(2);
    });
  });

  describe("blocks", () => {
    it("cannot move through an opponent block", () => {
      const seatTokens = [makeToken("t1", "T/3", "blue")];
      const allTokens: Token[] = [makeToken("r1", "T/5", "red"), makeToken("r2", "T/5", "red")];
      const moves = legalMoves(seatTokens, 4, 1, S, allTokens);
      expect(moves).toEqual([]);
    });

    it("cannot land on an opponent block", () => {
      const seatTokens = [makeToken("t1", "T/3", "blue")];
      const allTokens: Token[] = [makeToken("r1", "T/5", "red"), makeToken("r2", "T/5", "red")];
      const moves = legalMoves(seatTokens, 2, 1, S, allTokens);
      expect(moves).toEqual([]);
    });

    it("can move through own block", () => {
      const seatTokens = [
        makeToken("t1", "T/3", "blue"),
        makeToken("t2", "T/5", "blue"),
        makeToken("t3", "T/5", "blue"),
      ];
      const allTokens = [...seatTokens];
      const moves = legalMoves(seatTokens, 4, 1, S, allTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("T/7");
    });

    it("cannot deploy when opponent block is on start square", () => {
      const seatTokens = [makeToken("t1", "Y/1/1", "blue")];
      const allTokens: Token[] = [makeToken("r1", "T/1", "red"), makeToken("r2", "T/1", "red")];
      const moves = legalMoves(seatTokens, 6, 1, S, allTokens);
      expect(moves).toEqual([]);
    });

    it("allows deploy when own block is on start square", () => {
      const seatTokens = [
        makeToken("t1", "Y/1/1", "blue"),
        makeToken("t2", "T/1", "blue"),
        makeToken("t3", "T/1", "blue"),
      ];
      const allTokens = [...seatTokens];
      const moves = legalMoves(seatTokens, 6, 1, S, allTokens);
      expect(moves.find((m) => m.tokenId === "t1")).toBeDefined();
    });
  });
});
