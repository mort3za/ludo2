# syntax=docker/dockerfile:1

# --- Build stage: install deps and build the client SPA ---
FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies against the full workspace (root + apps + packages)
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/shared/package.json packages/shared/package.json
# --ignore-scripts: skip simple-git-hooks (no .git) and better-sqlite3 native
# build — the server uses Bun's built-in bun:sqlite at runtime, not better-sqlite3.
RUN bun install --frozen-lockfile --ignore-scripts

# Copy the rest of the source and build the client
COPY . .
RUN cd apps/client && bun run build

# --- Runtime stage: Bun server serving API/WS + the built client ---
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8200 \
    STATIC_DIR=/app/apps/client/dist

# Workspace deps (drizzle-orm, jose, @ludo/shared symlink) + server source + client build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/client/dist ./apps/client/dist

EXPOSE 8200
CMD ["bun", "apps/server/src/index.ts"]
