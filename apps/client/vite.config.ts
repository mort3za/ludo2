import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { CLIENT_PORT, SERVER_PORT } from "../../packages/shared/src/constants/network.ts";

const serverOrigin = `http://localhost:${SERVER_PORT}`;
const wsOrigin = `ws://localhost:${SERVER_PORT}`;

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: CLIENT_PORT,
    proxy: {
      "/auth": serverOrigin,
      "/rooms": serverOrigin,
      "/games": serverOrigin,
      "/health": serverOrigin,
      "/ws": {
        target: wsOrigin,
        ws: true,
      },
    },
  },
});
