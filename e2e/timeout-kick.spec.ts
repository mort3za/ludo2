import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for timeout, kick, and spectator scenarios.
 *
 * These tests verify the server-authoritative timeout behavior:
 * - Auto-roll on turn timeout
 * - Kick after 3 consecutive missed turns
 * - Spectator mode for kicked/disconnected players
 *
 * NOTE: These tests rely on server-side timeout timers.
 * For practical E2E testing, the server would need configurable
 * turn timeout values. These tests document the expected behavior
 * and will be enabled when the server supports short timeout overrides.
 */

async function registerGuest(page: Page) {
  const res = await page.request.post("http://localhost:3000/auth/guest", {});
  const body = (await res.json()) as { token: string; playerId: string };
  await page.evaluate(({ token, playerId }) => {
    localStorage.setItem("ludo_token", token);
    localStorage.setItem("ludo_player", playerId);
  }, body);
  return body;
}

test.describe("timeout, kick, spectator", () => {
  test.skip("player is kicked after 3 missed turns", async ({ browser }) => {
    // This test requires configurable short turn timeouts on the server.
    // When enabled:
    // 1. Create room with 2 players
    // 2. Start game
    // 3. Active player does NOT roll for 3 consecutive turns
    // 4. Server auto-rolls and eventually kicks the player
    // 5. Kicked player receives "kicked" message
    // 6. Remaining player continues
  });

  test.skip("kicked player becomes spectator", async ({ browser }) => {
    // When a player is kicked:
    // 1. They can still see the game state
    // 2. They cannot roll or make moves
    // 3. UI shows SpectatorBadge
  });

  test.skip("timeout auto-rolls for inactive player", async ({ browser }) => {
    // When turn timer expires:
    // 1. Server auto-rolls the dice
    // 2. If there are legal moves, server auto-picks (random or first)
    // 3. Turn advances to next player
    // 4. All clients receive rolled/moved/turn messages
  });
});
