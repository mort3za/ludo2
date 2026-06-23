import { describe, it, expect } from "vitest";
import { legalMoves } from "../validators/legal-moves.js";
import type { Token, PlayerColor } from "@ludo/shared";

const S = 4;

function makeToken(id: string, cell: string, color: PlayerColor = "blue"): Token {
  return { id, color, cell };
}

describe("home-column rules", () => {
  describe("capacity-1 occupancy", () => {
    it("cannot move to a home cell already occupied by own token", () => {
      const seatTokens = [
        makeToken("t1", "H/1/1", "blue"),
        makeToken("t2", "H/1/3", "blue"), // occupies H/1/3
      ];
      // t1 wants to move 2 steps → H/1/3 (occupied)
      const moves = legalMoves(seatTokens, 2, 1, S, seatTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeUndefined();
    });

    it("can jump over an occupied home cell to land on an empty one", () => {
      const seatTokens = [
        makeToken("t1", "H/1/1", "blue"),
        makeToken("t2", "H/1/2", "blue"), // occupies H/1/2
      ];
      // t1 moves 3 steps → passes over H/1/2(occupied), lands on H/1/4(empty)
      const moves = legalMoves(seatTokens, 3, 1, S, seatTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("H/1/4");
    });

    it("allows move to empty home cell", () => {
      const seatTokens = [makeToken("t1", "H/1/1", "blue")];
      const moves = legalMoves(seatTokens, 2, 1, S, seatTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("H/1/3");
    });

    it("allows move when path has no occupied home cells", () => {
      const seatTokens = [
        makeToken("t1", "H/1/1", "blue"),
        makeToken("t2", "H/1/4", "blue"), // occupies the final cell, but not on t1's path
      ];
      const moves = legalMoves(seatTokens, 2, 1, S, seatTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("H/1/3");
    });

    it("cannot move onto an occupied final home cell (no stacking in the home area)", () => {
      const seatTokens = [
        makeToken("t1", "H/1/3", "blue"),
        makeToken("t2", "H/1/4", "blue"), // final cell occupied
      ];
      // t1 wants to move 1 step → H/1/4 (occupied) — must be blocked, no stacking.
      const moves = legalMoves(seatTokens, 1, 1, S, seatTokens);
      expect(moves.find((m) => m.tokenId === "t1")).toBeUndefined();
    });
  });

  describe("entry from track to home", () => {
    it("enters home column when passing through entry square", () => {
      // Seat 1 walks onto its entry square T/44, so 3 steps lands on H/1/2.
      const seatTokens = [makeToken("t1", "T/43", "blue")];
      const moves = legalMoves(seatTokens, 3, 1, S, seatTokens);
      expect(moves[0]!.to).toBe("H/1/2");
    });

    it("can enter home jumping over an occupied first home cell", () => {
      const seatTokens = [
        makeToken("t1", "T/43", "blue"),
        makeToken("t2", "H/1/1", "blue"), // occupies H/1/1
      ];
      // From T/43, step 3: T/44(entry), passes over H/1/1(occupied), lands on H/1/2(empty)
      const moves = legalMoves(seatTokens, 3, 1, S, seatTokens);
      const t1Move = moves.find((m) => m.tokenId === "t1");
      expect(t1Move).toBeDefined();
      expect(t1Move!.to).toBe("H/1/2");
    });
  });

  describe("exact roll to finish", () => {
    it("requires exact roll to reach H/si/4", () => {
      const seatTokens = [makeToken("t1", "H/1/2", "blue")];
      // Need exactly 2 to reach H/1/4
      const moves = legalMoves(seatTokens, 2, 1, S, seatTokens);
      expect(moves[0]!.to).toBe("H/1/4");
    });

    it("rejects overshoot past H/si/4", () => {
      const seatTokens = [makeToken("t1", "H/1/2", "blue")];
      // 3 would go to H/1/5 (overshoot)
      const moves = legalMoves(seatTokens, 3, 1, S, seatTokens);
      expect(moves).toEqual([]);
    });
  });

  describe("no captures inside home", () => {
    it("does not attempt capture in home column", () => {
      // This is already handled by move.ts, but verify via legalMoves
      // that landing in home is always safe
      const seatTokens = [makeToken("t1", "H/1/1", "blue")];
      const moves = legalMoves(seatTokens, 1, 1, S, seatTokens);
      expect(moves).toEqual([{ tokenId: "t1", from: "H/1/1", to: "H/1/2" }]);
    });
  });
});
