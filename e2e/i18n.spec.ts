import { test, expect } from "@playwright/test";

test("language switcher toggles to Persian + RTL and persists across reload", async ({ page }) => {
  // Create a room to reach a page that renders the app header (the switcher lives there).
  await page.goto("/");
  await page.getByTestId("play-btn").click();
  await page.waitForURL(/\/room\//);

  const html = page.locator("html");
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Setup the Game" })).toBeVisible();

  // Switch to Persian via the header switcher.
  await page.getByRole("button", { name: "فارسی" }).click();

  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("lang", "fa");
  await expect(page.getByRole("heading", { name: "آماده‌سازی بازی" })).toBeVisible();

  // Choice persists across reload.
  await page.reload();
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "آماده‌سازی بازی" })).toBeVisible();
});
