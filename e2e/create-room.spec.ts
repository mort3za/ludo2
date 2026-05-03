import { test, expect, type Page } from "@playwright/test";

/**
 * Helper: register a guest player and navigate to the home page.
 */
async function guestLogin(page: Page, name: string) {
  // Hit the API directly to get a token
  const res = await page.request.post("http://localhost:3000/auth/guest", {
    data: { name },
  });
  const body = (await res.json()) as { token: string; playerId: string };
  // Store in localStorage so the client picks it up
  await page.evaluate(
    ({ token, playerId }) => {
      localStorage.setItem("ludo_token", token);
      localStorage.setItem("ludo_player", playerId);
    },
    body,
  );
  return body;
}

test("create room → second player joins → both ready → game starts", async ({
  browser,
}) => {
  // Create two isolated browser contexts (two "players")
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const player1 = await ctx1.newPage();
  const player2 = await ctx2.newPage();

  // --- Player 1: Create room from home page ---
  await player1.goto("/");
  await expect(player1.locator("h1")).toHaveText("Ludo");

  await player1.getByTestId("name-input").fill("Alice");
  await player1.getByTestId("create-room-btn").click();

  // Should navigate to /room/:roomId
  await player1.waitForURL(/\/room\/.+/);
  const roomUrl = player1.url();
  const roomId = roomUrl.split("/room/")[1];
  expect(roomId).toBeTruthy();

  // --- Player 2: Login then join via room URL ---
  await player2.goto("/");
  await guestLogin(player2, "Bob");
  await player2.goto(roomUrl);

  // Both should see the lobby
  await expect(player1.getByTestId("room-id")).toHaveText(roomId!);
  await expect(player2.getByTestId("room-id")).toHaveText(roomId!);

  // --- Both players ready up ---
  await player1.getByTestId("ready-btn").click();
  await player2.getByTestId("ready-btn").click();

  // Game should start — players navigate to match page
  // The game state message triggers navigation
  await player1.waitForURL(/\/match\/.+/, { timeout: 5000 });

  // Clean up
  await ctx1.close();
  await ctx2.close();
});
