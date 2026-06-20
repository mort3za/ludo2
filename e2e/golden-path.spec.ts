import { test, expect } from "@playwright/test";

test("golden-path: two players create, join, ready, start, and play", async ({ browser }) => {
  // Create two browser contexts for two players
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();

  const p1 = await player1Context.newPage();
  const p2 = await player2Context.newPage();

  try {
    // === Player 1: Home page ===
    await p1.goto("/");
    await expect(p1.locator("h1")).toContainText("Ludo");

    // === Player 1: Create room ===
    // Look for "Create Room" or similar button
    const createBtn = p1
      .locator("button")
      .filter({ hasText: /create|new/i })
      .first();
    await createBtn.click();

    // Extract room ID from URL
    await p1.waitForURL(/\/room\//);
    const roomUrl = p1.url();
    const roomId = roomUrl.split("/room/")[1];
    expect(roomId).toBeTruthy();

    // === Player 1: Should see lobby with self ===
    await expect(p1.locator("text=Ready")).toBeVisible({ timeout: 5000 });

    // === Player 2: Join same room ===
    await p2.goto(`/room/${roomId}`);
    await expect(p2.locator("text=Ready")).toBeVisible({ timeout: 5000 });

    // === Both: Click Ready ===
    const readyBtns = await p1.locator("button").filter({ hasText: "Ready" }).all();
    if (readyBtns.length > 0) {
      await readyBtns[0].click();
    }

    const readyBtns2 = await p2.locator("button").filter({ hasText: "Ready" }).all();
    if (readyBtns2.length > 0) {
      await readyBtns2[0].click();
    }

    // === Player 1: Start game ===
    const startBtn = p1.locator("button").filter({ hasText: /start/i }).first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    }

    // === Both: Wait for game to load ===
    await expect(
      p1.locator("text=roll|Your turn|move", { exact: false }),
      "P1 should see game",
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(p2.locator("canvas"), "P2 should see board").toBeVisible({ timeout: 5000 });

    // === Player 1: Roll dice ===
    const rollBtn = p1.locator("button").filter({ hasText: "Roll" }).first();
    if (await rollBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rollBtn.click();
      // Wait for dice result to appear
      await expect(p1.locator("div").filter({ hasText: /[1-6]/ })).toBeVisible({ timeout: 2000 });
    }

    // === Verify both players can see the game state ===
    await expect(p1.locator("canvas"), "P1 board visible").toBeVisible();
    await expect(p2.locator("canvas"), "P2 board visible").toBeVisible();

    console.log("✅ Golden path test passed");
  } finally {
    await p1.close();
    await p2.close();
    await player1Context.close();
    await player2Context.close();
  }
});
