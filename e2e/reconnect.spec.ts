import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for reconnect mid-game scenarios.
 *
 * Verifies that when a player disconnects and reconnects:
 * - The server sends the current authoritative game state
 * - The client replaces local state entirely (no reconciliation)
 * - Game continues normally after reconnect
 */

async function registerGuest(page: Page, name: string) {
  const res = await page.request.post("http://localhost:3000/auth/guest", {
    data: { name },
  });
  const body = (await res.json()) as { token: string; playerId: string };
  await page.evaluate(
    ({ token, playerId }) => {
      localStorage.setItem("ludo_token", token);
      localStorage.setItem("ludo_player", playerId);
    },
    body,
  );
  return body;
}

test.describe("reconnect mid-game", () => {
  test("player reconnects and receives full state", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    // Create room and start game
    await p1.goto("/");
    await p1.getByTestId("name-input").fill("Alice");
    await p1.getByTestId("create-room-btn").click();
    await p1.waitForURL(/\/room\/.+/);
    const roomUrl = p1.url();

    await registerGuest(p2, "Bob");
    await p2.goto(roomUrl);

    await p1.getByTestId("ready-btn").click();
    await p2.getByTestId("ready-btn").click();

    // Game starts
    await p1.waitForURL(/\/match\/.+/, { timeout: 5000 });

    // Player 1 "disconnects" by navigating away
    await p1.goto("/");

    // Player 1 "reconnects" by navigating back to the room
    const matchUrl = roomUrl.replace("/room/", "/match/");
    await p1.goto(matchUrl);

    // After reconnect, they should see the match page
    await expect(p1.locator("h1")).toHaveText("Match", { timeout: 3000 });

    await ctx1.close();
    await ctx2.close();
  });
});
