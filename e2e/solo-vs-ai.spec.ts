import { test, expect, type Page } from "@playwright/test";
import { SERVER_PORT } from "../packages/shared/src/constants/network.ts";

const serverOrigin = `http://127.0.0.1:${SERVER_PORT}`;

test.setTimeout(120_000);

async function registerGuest(page: Page) {
  const res = await page.request.post(`${serverOrigin}/auth/guest`, {});
  const body = (await res.json()) as { token: string; playerId: string };
  await page.goto("/");
  await page.evaluate(({ token, playerId }) => {
    localStorage.setItem("ludo_token", token);
    localStorage.setItem("ludo_player", playerId);
  }, body);
  return body;
}

test.describe("solo match vs AI", () => {
  test("home → lobby with AI → match", async ({ page }) => {
    await registerGuest(page);

    // 1. Navigate home and click "Play" — goes straight to the lobby
    await page.goto("/");
    await page.getByTestId("play-btn").click();
    await page.waitForURL(/\/room\/.+/);

    // 2. Add a bot via the owner-only counter
    await page.getByTestId("add-bot-btn").click();

    // 3. Lobby: verify bot seat shows "(AI)"
    await expect(page.getByTestId("player-list")).toContainText("(AI)", { timeout: 5000 });

    // 4. Mark self ready and start
    await page.getByTestId("ready-btn").click();
    await page.getByTestId("start-btn").click();

    // 5. Navigate to match
    await page.waitForURL(/\/match\/.+/, { timeout: 10_000 });

    // 6. Match controls render for the human player
    await expect(page.getByRole("button", { name: "Roll" })).toBeVisible({ timeout: 5000 });
  });
});
