import { describe, it, expect } from "vitest";
import { BOT_PERSONALITIES, PERSONALITY_TITLES } from "./ai.js";

describe("AI types", () => {
  it("defines three bot personalities", () => {
    expect(BOT_PERSONALITIES).toHaveLength(3);
    expect(BOT_PERSONALITIES).toContain("aggressor");
    expect(BOT_PERSONALITIES).toContain("defender");
    expect(BOT_PERSONALITIES).toContain("sprinter");
  });

  it("provides titles for all personalities", () => {
    for (const personality of BOT_PERSONALITIES) {
      expect(PERSONALITY_TITLES[personality]).toBeDefined();
      expect(typeof PERSONALITY_TITLES[personality]).toBe("string");
      expect(PERSONALITY_TITLES[personality].length).toBeGreaterThan(0);
    }
  });
});
