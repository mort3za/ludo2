import { test, expect, type Page } from "@playwright/test";
import { SERVER_PORT } from "../packages/shared/src/constants/network.ts";

const serverOrigin = `http://127.0.0.1:${SERVER_PORT}`;

/**
 * Helper: register a guest player and seed their token in localStorage.
 */
async function guestLogin(page: Page) {
  const res = await page.request.post(`${serverOrigin}/auth/guest`, {});
  const body = (await res.json()) as { token: string; playerId: string };
  await page.goto("/");
  await page.evaluate(({ token, playerId }) => {
    localStorage.setItem("ludo_token", token);
    localStorage.setItem("ludo_player", playerId);
  }, body);
  return body;
}

test("create room → second player joins → both ready → game starts", async ({ browser }) => {
  // Create two isolated browser contexts (two "players")
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const player1 = await ctx1.newPage();
  const player2 = await ctx2.newPage();

  // --- Player 1: Create room from home page ---
  await player1.goto("/");
  await expect(player1.locator("h1")).toHaveText("Ludo");
  await player1.getByTestId("play-btn").click();

  // Should navigate straight to /room/:roomId
  await player1.waitForURL(/\/room\/.+/);
  const roomUrl = player1.url();
  const roomId = roomUrl.split("/room/")[1];
  expect(roomId).toBeTruthy();

  // --- Player 2: Login then join via room URL ---
  await player2.goto("/");
  await guestLogin(player2);
  await player2.goto(roomUrl);

  // Both should see the lobby
  await expect(player1.getByTestId("room-id")).toHaveText(roomId!);
  await expect(player2.getByTestId("room-id")).toHaveText(roomId!);

  // The setup list shows joiners/bots and excludes the owner.
  await expect(player1.getByTestId("player-list")).toContainText("Player2");
  await expect(player1.getByTestId("player-list")).not.toContainText("Player1");

  // --- Both players ready up ---
  await player1.getByTestId("ready-btn").click();
  await player2.getByTestId("ready-btn").click();

  await expect(player1.getByTestId("start-btn")).toBeEnabled();
  await player1.getByTestId("start-btn").click();

  // Game should start — players navigate to match page
  // The game state message triggers navigation
  await player1.waitForURL(/\/match\/.+/, { timeout: 5000 });
  await player2.waitForURL(/\/match\/.+/, { timeout: 5000 });

  // Clean up
  await ctx1.close();
  await ctx2.close();
});

test("room join clears stale session and auto-joins", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto("/");
  await host.getByTestId("play-btn").click();
  await host.waitForURL(/\/room\/.+/);
  const roomUrl = host.url();

  await guest.goto("/");
  await guest.evaluate(() => {
    localStorage.setItem("ludo_token", "stale-token");
    localStorage.setItem("ludo_player", "stale-player");
  });

  await guest.goto(roomUrl);

  await expect(guest.getByTestId("room-id")).toBeVisible({ timeout: 5000 });
  await expect(guest.locator("text=Disconnected — reconnecting…")).toHaveCount(0);

  await hostCtx.close();
  await guestCtx.close();
});
