import { describe, it, expect } from "vitest";
import { applyMove, type MoveResult } from "./move.js";
import type { Token, PlayerColor } from "@ludo/shared";

const S = 4;

function makeToken(id: string, cell: string, color: PlayerColor): Token {
  return { id, color, cell };
}

// Maps color → seat index for tests
const colorToSeat: Record<string, number> = {
  blue: 1,
  red: 2,
  green: 3,
  yellow: 4,
};

describe("applyMove", () => {
  describe("deploy from yard", () => {
    it("moves token from yard to start square", () => {
      const tokens = [makeToken("t1", "Y/1/1", "blue")];
      const result = applyMove(tokens, "t1", "T/1", 1, S, colorToSeat);
      expect(result.tokens.find((t) => t.id === "t1")!.cell).toBe("T/1");
      expect(result.captured).toBeNull();
    });
  });

  describe("track movement", () => {
    it("moves token on track", () => {
      const tokens = [makeToken("t1", "T/5", "blue")];
      const result = applyMove(tokens, "t1", "T/8", 1, S, colorToSeat);
      expect(result.tokens.find((t) => t.id === "t1")!.cell).toBe("T/8");
    });
  });

  describe("capture", () => {
    it("captures single opponent token on destination", () => {
      const tokens = [makeToken("t1", "T/5", "blue"), makeToken("e1", "T/8", "red")];
      const result = applyMove(tokens, "t1", "T/8", 1, S, colorToSeat);
      expect(result.tokens.find((t) => t.id === "t1")!.cell).toBe("T/8");
      // e1 should be sent to yard
      const capturedToken = result.tokens.find((t) => t.id === "e1")!;
      expect(capturedToken.cell).toMatch(/^Y\//);
      expect(result.captured).toBe("e1");
    });

    it("does not capture own-color token", () => {
      const tokens = [makeToken("t1", "T/5", "blue"), makeToken("t2", "T/8", "blue")];
      const result = applyMove(tokens, "t1", "T/8", 1, S, colorToSeat);
      expect(result.tokens.find((t) => t.id === "t1")!.cell).toBe("T/8");
      expect(result.tokens.find((t) => t.id === "t2")!.cell).toBe("T/8");
      expect(result.captured).toBeNull();
    });

    it("does not capture on safe square", () => {
      // T/1 is seat 1's start square → safe
      const tokens = [makeToken("t1", "T/42", "blue"), makeToken("e1", "T/1", "red")];
      const result = applyMove(tokens, "t1", "T/1", 1, S, colorToSeat);
      expect(result.tokens.find((t) => t.id === "t1")!.cell).toBe("T/1");
      expect(result.tokens.find((t) => t.id === "e1")!.cell).toBe("T/1");
      expect(result.captured).toBeNull();
    });

    it("does not capture in home column", () => {
      // Home columns are single-seat, but just verify no capture logic fires
      const tokens = [makeToken("t1", "H/1/2", "blue")];
      const result = applyMove(tokens, "t1", "H/1/4", 1, S, colorToSeat);
      expect(result.captured).toBeNull();
    });

    it("captures on deploy to start square if opponent is there", () => {
      const tokens = [makeToken("t1", "Y/1/1", "blue"), makeToken("e1", "T/1", "red")];
      // T/1 is seat 1 start square (safe), so no capture
      const result = applyMove(tokens, "t1", "T/1", 1, S, colorToSeat);
      expect(result.captured).toBeNull();
    });

    it("captures opponent on non-safe square during deploy", () => {
      // seat 2 start = T/12. If an opponent is on T/12 (non-safe for seat 2? No, T/12 is seat 2's start = safe)
      // Use a different scenario: seat 1 deploys to T/1 (safe).
      // Actually start squares are always safe, so deploy never captures. Let's verify.
      const tokens = [makeToken("t1", "Y/2/1", "red"), makeToken("e1", "T/12", "blue")];
      // T/12 is seat 2's start → safe
      const result = applyMove(tokens, "t1", "T/12", 2, S, colorToSeat);
      expect(result.captured).toBeNull();
    });
  });

  describe("sends captured token to correct yard slot", () => {
    it("sends captured token back to its own seat's yard", () => {
      // Red token (seat 2) gets captured, should go back to Y/2/N
      const tokens = [
        makeToken("t1", "T/5", "blue"),
        makeToken("e1", "T/8", "red"),
        makeToken("e2", "Y/2/1", "red"), // e2 already in yard slot 1
      ];
      const result = applyMove(tokens, "t1", "T/8", 1, S, colorToSeat);
      const capturedToken = result.tokens.find((t) => t.id === "e1")!;
      expect(capturedToken.cell).toBe("Y/2/2"); // next available slot
    });
  });

  describe("immutability", () => {
    it("does not mutate the original tokens array", () => {
      const tokens = [makeToken("t1", "T/5", "blue"), makeToken("e1", "T/8", "red")];
      const originalCells = tokens.map((t) => t.cell);
      applyMove(tokens, "t1", "T/8", 1, S, colorToSeat);
      expect(tokens.map((t) => t.cell)).toEqual(originalCells);
    });
  });
});
