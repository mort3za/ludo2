import { defineConfig, devices } from "@playwright/test";
import { CLIENT_PORT, SERVER_PORT } from "./packages/shared/src/constants/network.ts";

const clientOrigin = `http://localhost:${CLIENT_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: clientOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run --cwd apps/server src/index.ts",
      url: `http://localhost:${SERVER_PORT}/health`,
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: "bun run --filter @ludo/client dev",
      url: clientOrigin,
      reuseExistingServer: !process.env["CI"],
    },
  ],
});
