import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for rematch flow.
 *
 * Verifies that after a game ends:
 * - Owner can request rematch within the post-game window
 * - Colors are re-drawn for the new game
 * - Currently-connected players are re-seated
 */

test.describe("rematch", () => {
  test.skip("rematch re-draws colors and re-seats players", async ({ browser }) => {
    // This test requires:
    // 1. A complete game (all tokens home, or all but one player kicked)
    // 2. Owner sends rematch within 60s window
    // 3. Server creates new GameState with shuffled colors
    // 4. All connected players receive new state message
    // 5. The seat-to-color mapping differs from the previous game
    //
    // Implementing a full game to completion in E2E is complex.
    // This test will be enabled when the game engine supports
    // a "force-finish" test hook or shorter game configurations.
  });
});
