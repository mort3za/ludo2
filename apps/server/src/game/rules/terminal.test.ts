import { describe, it, expect } from "vitest";
import { checkTerminal } from "./terminal.js";
import type { Token, PlayerColor, SeatState } from "@ludo/shared";

function makeToken(id: string, cell: string, color: PlayerColor): Token {
  return { id, color, cell };
}

interface SeatInfo {
  index: number;
  state: SeatState;
  color: PlayerColor;
}

function makeSeat(index: number, color: PlayerColor, state: SeatState = "active"): SeatInfo {
  return { index, state, color };
}

describe("checkTerminal", () => {
  describe("win by all tokens home", () => {
    it("detects win when all 4 tokens fill the home cells (one per cell)", () => {
      const seats = [
        makeSeat(1, "blue"),
        makeSeat(2, "red"),
        makeSeat(3, "green"),
        makeSeat(4, "yellow"),
      ];
      const tokens = [
        makeToken("b1", "H/1/1", "blue"),
        makeToken("b2", "H/1/2", "blue"),
        makeToken("b3", "H/1/3", "blue"),
        makeToken("b4", "H/1/4", "blue"),
        makeToken("r1", "T/5", "red"),
        makeToken("r2", "T/10", "red"),
        makeToken("r3", "Y/2/1", "red"),
        makeToken("r4", "Y/2/2", "red"),
      ];
      const result = checkTerminal(tokens, seats, []);
      expect(result.seatFinished).toBe(1);
    });

    it("does not detect win if a token is still outside the home area", () => {
      const seats = [makeSeat(1, "blue"), makeSeat(2, "red")];
      const tokens = [
        makeToken("b1", "H/1/1", "blue"),
        makeToken("b2", "H/1/2", "blue"),
        makeToken("b3", "T/5", "blue"), // still on the track — not home
        makeToken("b4", "H/1/4", "blue"),
      ];
      const result = checkTerminal(tokens, seats, []);
      expect(result.seatFinished).toBeNull();
    });

    it("does not detect win if home tokens are stacked (malformed) leaving a cell empty", () => {
      const seats = [makeSeat(1, "blue"), makeSeat(2, "red")];
      const tokens = [
        makeToken("b1", "H/1/1", "blue"),
        makeToken("b2", "H/1/2", "blue"),
        makeToken("b3", "H/1/4", "blue"),
        makeToken("b4", "H/1/4", "blue"), // stacked — only 3 distinct cells filled
      ];
      const result = checkTerminal(tokens, seats, []);
      expect(result.seatFinished).toBeNull();
    });
  });

  describe("sole survivor", () => {
    it("detects sole-survivor win when only 1 active seat remains", () => {
      const seats = [
        makeSeat(1, "blue", "active"),
        makeSeat(2, "red", "vacant"),
        makeSeat(3, "green", "vacant"),
        makeSeat(4, "yellow", "vacant"),
      ];
      const tokens = [makeToken("b1", "T/5", "blue"), makeToken("b2", "Y/1/1", "blue")];
      const result = checkTerminal(tokens, seats, []);
      expect(result.soleSurvivor).toBe(1);
    });

    it("no sole survivor with multiple active seats", () => {
      const seats = [
        makeSeat(1, "blue", "active"),
        makeSeat(2, "red", "active"),
        makeSeat(3, "green", "vacant"),
        makeSeat(4, "yellow", "vacant"),
      ];
      const result = checkTerminal([], seats, []);
      expect(result.soleSurvivor).toBeNull();
    });
  });

  describe("zero active seats (abort)", () => {
    it("detects abort when no active seats remain", () => {
      const seats = [
        makeSeat(1, "blue", "vacant"),
        makeSeat(2, "red", "vacant"),
        makeSeat(3, "green", "vacant"),
        makeSeat(4, "yellow", "vacant"),
      ];
      const result = checkTerminal([], seats, []);
      expect(result.abort).toBe(true);
    });

    it("no abort with active seats", () => {
      const seats = [makeSeat(1, "blue", "active"), makeSeat(2, "red", "vacant")];
      const result = checkTerminal([], seats, []);
      expect(result.abort).toBe(false);
    });
  });

  describe("already finished seats", () => {
    it("ignores seats that are already in standings", () => {
      const seats = [
        makeSeat(1, "blue", "active"),
        makeSeat(2, "red", "active"),
        makeSeat(3, "green", "active"),
        makeSeat(4, "yellow", "active"),
      ];
      const tokens = [
        makeToken("b1", "H/1/1", "blue"),
        makeToken("b2", "H/1/2", "blue"),
        makeToken("b3", "H/1/3", "blue"),
        makeToken("b4", "H/1/4", "blue"),
      ];
      // Seat 1 already in standings — should not re-detect
      const result = checkTerminal(tokens, seats, [1]);
      expect(result.seatFinished).toBeNull();
    });
  });

  describe("game not over", () => {
    it("returns no terminal condition when game is still in progress", () => {
      const seats = [
        makeSeat(1, "blue", "active"),
        makeSeat(2, "red", "active"),
        makeSeat(3, "green", "active"),
        makeSeat(4, "yellow", "active"),
      ];
      const tokens = [makeToken("b1", "T/5", "blue"), makeToken("r1", "T/20", "red")];
      const result = checkTerminal(tokens, seats, []);
      expect(result.seatFinished).toBeNull();
      expect(result.soleSurvivor).toBeNull();
      expect(result.abort).toBe(false);
    });
  });
});
