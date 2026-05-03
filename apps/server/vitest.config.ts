import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    globals: true,
    exclude: ["dist/**", "node_modules/**"],
  },
});
