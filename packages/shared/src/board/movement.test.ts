import { describe, expect, it } from "vitest";
import { stepPath } from "./movement.js";

describe("stepPath — track stepping", () => {
  it("steps forward on track", () => {
    // From T/1, 3 steps in S=4 game
    expect(stepPath("T/1", 3, 1, 4)).toEqual(["T/2", "T/3", "T/4"]);
  });

  it("wraps around the track", () => {
    // S=4: track length 52. T/51 + 3 steps = T/52, T/1, T/2
    expect(stepPath("T/51", 3, 2, 4)).toEqual(["T/52", "T/1", "T/2"]);
  });

  it("wraps from last square", () => {
    // S=4: T/52 + 1 = T/1
    expect(stepPath("T/52", 1, 2, 4)).toEqual(["T/1"]);
  });

  it("single step", () => {
    expect(stepPath("T/10", 1, 1, 4)).toEqual(["T/11"]);
  });

  it("six steps from start", () => {
    expect(stepPath("T/1", 6, 1, 4)).toEqual(["T/2", "T/3", "T/4", "T/5", "T/6", "T/7"]);
  });
});

describe("stepPath — entry to home transition", () => {
  it("seat 2 (S=4): one step past entry T/13 → H/2/1", () => {
    // From T/12, 2 steps: T/13 (entry), H/2/1
    expect(stepPath("T/12", 2, 2, 4)).toEqual(["T/13", "H/2/1"]);
  });

  it("seat 2 (S=4): from entry T/13, 1 step → H/2/1", () => {
    expect(stepPath("T/13", 1, 2, 4)).toEqual(["H/2/1"]);
  });

  it("seat 2 (S=4): from entry T/13, 4 steps → fills home", () => {
    expect(stepPath("T/13", 4, 2, 4)).toEqual(["H/2/1", "H/2/2", "H/2/3", "H/2/4"]);
  });

  it("seat 1 (S=4): entry is T/52 (wrap), step to home", () => {
    // From T/51, 2 steps: T/52 (entry), H/1/1
    expect(stepPath("T/51", 2, 1, 4)).toEqual(["T/52", "H/1/1"]);
  });

  it("seat 1 (S=4): from entry T/52, 1 step → H/1/1", () => {
    expect(stepPath("T/52", 1, 1, 4)).toEqual(["H/1/1"]);
  });

  it("seat 3 (S=4): entry T/26, 3 steps from T/25 → T/26, H/3/1, H/3/2", () => {
    expect(stepPath("T/25", 3, 3, 4)).toEqual(["T/26", "H/3/1", "H/3/2"]);
  });

  it("seat 4 (S=4): entry T/39, from T/39 2 steps → H/4/1, H/4/2", () => {
    expect(stepPath("T/39", 2, 4, 4)).toEqual(["H/4/1", "H/4/2"]);
  });
});

describe("stepPath — within home column", () => {
  it("steps forward in home column", () => {
    expect(stepPath("H/1/1", 2, 1, 4)).toEqual(["H/1/2", "H/1/3"]);
  });

  it("single step in home", () => {
    expect(stepPath("H/2/3", 1, 2, 4)).toEqual(["H/2/4"]);
  });
});

describe("stepPath — S=6 entry transitions", () => {
  it("seat 1 (S=6): entry T/78, step from T/77 → T/78, H/1/1", () => {
    expect(stepPath("T/77", 2, 1, 6)).toEqual(["T/78", "H/1/1"]);
  });

  it("seat 5 (S=6): entry T/52, step from T/52 → H/5/1", () => {
    expect(stepPath("T/52", 1, 5, 6)).toEqual(["H/5/1"]);
  });
});

describe("stepPath — S=8 entry transitions", () => {
  it("seat 1 (S=8): entry T/104, from T/103 2 steps → T/104, H/1/1", () => {
    expect(stepPath("T/103", 2, 1, 8)).toEqual(["T/104", "H/1/1"]);
  });

  it("seat 8 (S=8): entry T/91, from T/91 3 steps → H/8/1, H/8/2, H/8/3", () => {
    expect(stepPath("T/91", 3, 8, 8)).toEqual(["H/8/1", "H/8/2", "H/8/3"]);
  });
});

describe("stepPath — non-own entry square is not special", () => {
  it("seat 1 passes through seat 2 entry T/13 without turning", () => {
    // Seat 1 at T/12, 3 steps — should go T/13, T/14, T/15 (not into home)
    expect(stepPath("T/12", 3, 1, 4)).toEqual(["T/13", "T/14", "T/15"]);
  });
});
