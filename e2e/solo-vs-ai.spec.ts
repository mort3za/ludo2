import { test, expect, type Page } from "@playwright/test";

test.setTimeout(120_000);

async function registerGuest(page: Page) {
  const res = await page.request.post("http://localhost:3000/auth/guest", {});
  const body = (await res.json()) as { token: string; playerId: string };
  await page.evaluate(({ token, playerId }) => {
    localStorage.setItem("ludo_token", token);
    localStorage.setItem("ludo_player", playerId);
  }, body);
  return body;
}

test.describe("solo match vs AI", () => {
  test("full loop: home → create → lobby → match → winner", async ({ page }) => {
    await registerGuest(page);

    // 1. Navigate home and click "Play vs AI"
    await page.goto("/");
    await page.getByTestId("play-vs-ai-btn").click();
    await page.waitForURL(/\/create/);

    // 2. Create the room (bots=1 from query param)
    await page.getByTestId("create-room-btn").click();
    await page.waitForURL(/\/room\/.+/);

    // 3. Lobby: verify bot seat shows "(AI)"
    await expect(page.getByTestId("player-list")).toContainText("(AI)", { timeout: 5000 });

    // 4. Mark self ready and start
    await page.getByTestId("ready-btn").click();
    await page.getByTestId("start-btn").click();

    // 5. Navigate to match
    await page.waitForURL(/\/match\/.+/, { timeout: 10_000 });

    // 6. Play as the human until the game is over
    let turnsPlayed = 0;
    while (turnsPlayed < 500) {
      // Wait until we're on post-game or still on match
      const currentUrl = page.url();
      if (currentUrl.includes("/post-game/")) break;

      // Try to roll if the roll button is enabled
      const rollBtn = page.getByRole("button", { name: "Roll" });
      const isRollEnabled = await rollBtn.isEnabled().catch(() => false);
      if (isRollEnabled) {
        await rollBtn.click();
        turnsPlayed++;
        await page.waitForTimeout(300);
        continue;
      }

      // Try to click a token pick button if visible
      const tokenBtns = page.locator("button").filter({ hasNotText: /Roll|Ready|Start/ });
      const tokenCount = await tokenBtns.count();
      if (tokenCount > 0) {
        const firstEnabled = tokenBtns.first();
        if (await firstEnabled.isEnabled().catch(() => false)) {
          await firstEnabled.click();
          turnsPlayed++;
          await page.waitForTimeout(300);
          continue;
        }
      }

      // AI is thinking or animations running — wait a bit
      await page.waitForTimeout(500);

      // Check if navigated to post-game
      if (page.url().includes("/post-game/")) break;
    }

    // 7. Should reach post-game
    await page.waitForURL(/\/post-game\/.+/, { timeout: 30_000 });

    // 8. "Game Over" heading and back button are visible
    await expect(page.getByText("Game Over")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Back to Lobby/i })).toBeVisible();
  });
});
