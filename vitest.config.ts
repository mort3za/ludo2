import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/client", "apps/server", "packages/shared"],
    passWithNoTests: true,
  },
});
