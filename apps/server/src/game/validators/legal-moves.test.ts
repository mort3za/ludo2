import { describe, it, expect } from "vitest";
import { legalMoves, type LegalMove } from "./legal-moves.js";
import type { Token, PlayerColor } from "@ludo/shared";

// Helper: 4-seat game (S=4, trackLen=44)
const S = 4;

function makeToken(id: string, cell: string, color: PlayerColor = "blue"): Token {
  return { id, color, cell };
}

describe("legalMoves", () => {
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
      expect(moves[0]!.to).toBe("T/12"); // seat 2 start = T/12
    });
  });

  describe("track movement", () => {
    it("moves token forward by dice value on track", () => {
      const tokens = [makeToken("t1", "T/5")];
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves).toEqual([{ tokenId: "t1", from: "T/5", to: "T/8" }]);
    });

    it("wraps around track end", () => {
      const tokens = [makeToken("t1", "T/43")];
      // Seat 1 skips the entry square when turning home, so 3 steps lands on H/1/3.
      const moves = legalMoves(tokens, 3, 1, S, []);
      expect(moves[0]!.to).toBe("H/1/3");
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
      expect(moves).toEqual([]); // H/1/3 + 3 = H/1/6, overshoots L=4
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
      expect(moves.length).toBe(3); // t1 can move, t2 can deploy, t3 can move
    });

    it("skips tokens already at home end", () => {
      const tokens = [
        makeToken("t1", "H/1/4"), // finished
        makeToken("t2", "T/5"),
      ];
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
      // Roll 2: can't deploy (need 6), H/1/3+2=H/1/5 overshoots, H/1/4 finished
      const moves = legalMoves(tokens, 2, 1, S, []);
      expect(moves).toEqual([]);
    });
  });

  describe("cannot deploy to occupied start square by own token", () => {
    it("still allows deploy when own token is on start (stacking not blocked)", () => {
      // In standard Ludo, you CAN deploy even if your own token is on start
      const tokens = [
        makeToken("t1", "Y/1/1"),
        makeToken("t2", "T/1"), // already on start square
      ];
      const moves = legalMoves(tokens, 6, 1, S, []);
      // Both t1 (deploy) and t2 (move from T/1) should be legal
      expect(moves.length).toBe(2);
    });
  });

  describe("all tokens", () => {
    it("filters only tokens belonging to the active seat's tokens array", () => {
      // The function receives only the active seat's tokens
      const tokens = [makeToken("t1", "T/5", "blue")];
      const allTokens: Token[] = [makeToken("enemy", "T/8", "red")];
      const moves = legalMoves(tokens, 3, 1, S, allTokens);
      // Should only generate moves for the seat's tokens, not enemy
      expect(moves.length).toBe(1);
      expect(moves[0]!.tokenId).toBe("t1");
    });
  });

  describe("blocks", () => {
    it("cannot move through an opponent block", () => {
      const seatTokens = [makeToken("t1", "T/3", "blue")];
      // Red block at T/5
      const allTokens: Token[] = [makeToken("r1", "T/5", "red"), makeToken("r2", "T/5", "red")];
      // Moving 4 steps: T/4, T/5(blocked!), T/6, T/7
      const moves = legalMoves(seatTokens, 4, 1, S, allTokens);
      expect(moves).toEqual([]);
    });

    it("cannot land on an opponent block", () => {
      const seatTokens = [makeToken("t1", "T/3", "blue")];
      const allTokens: Token[] = [makeToken("r1", "T/5", "red"), makeToken("r2", "T/5", "red")];
      // Moving 2 steps: T/4, T/5(blocked!)
      const moves = legalMoves(seatTokens, 2, 1, S, allTokens);
      expect(moves).toEqual([]);
    });

    it("can move through own block (voluntary break)", () => {
      const seatTokens = [
        makeToken("t1", "T/3", "blue"),
        makeToken("t2", "T/5", "blue"),
        makeToken("t3", "T/5", "blue"),
      ];
      // Own block at T/5, moving through it is allowed
      const allTokens = [...seatTokens];
      const moves = legalMoves(seatTokens, 4, 1, S, allTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("T/7");
    });

    it("cannot deploy when opponent block is on start square", () => {
      const seatTokens = [makeToken("t1", "Y/1/1", "blue")];
      // Red block on T/1 (seat 1 start)
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
      // t1 can deploy (own block), t2 and t3 can move
      expect(moves.find((m) => m.tokenId === "t1")).toBeDefined();
    });
  });
});
