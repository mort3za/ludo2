# Dev vs Prod Differences

How behavior differs between development and production. Gated by `NODE_ENV` (server) and Vite mode `import.meta.env.DEV/PROD` (client).

> ⚠️ **Turn timer gotcha:** Turn countdown + auto-move + kick are **disabled in dev**. Two independent gates (server + client). Playing locally = no timer, no auto-move, infinite turn time. Expected, not a bug. See [#1](#1-turn-timer--auto-move-disabled-in-dev).

## Summary table

| #   | Feature                | DEV                            | PROD                               | Source                                                                  |
| --- | ---------------------- | ------------------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| 1   | Turn timeout (server)  | DISABLED — no auto-move/kick   | ENABLED — 30s deadline             | [router.ts:52](../apps/server/src/ws/router.ts#L52)                     |
| 1   | Turn timer UI (client) | HIDDEN                         | SHOWN                              | [TurnTimer.vue:52](../apps/client/src/features/match/TurnTimer.vue#L52) |
| 2   | JWT secret             | hardcoded dev default OK       | env var, 32+ chars, else `exit(1)` | [index.ts:18](../apps/server/src/index.ts#L18)                          |
| 3   | DB storage             | `:memory:` default             | file-based, mkdir parent           | [connection.ts:31](../apps/server/src/db/connection.ts#L31)             |
| 4   | API base URL           | `""` (Vite proxy)              | `VITE_API_URL` env                 | [api.ts:1](../apps/client/src/shared/config/api.ts#L1)                  |
| 5   | Dev server proxy       | Vite proxies → :3000           | none (static build)                | [vite.config.ts:17](../apps/client/vite.config.ts#L17)                  |
| 6   | Tests (CI flag)        | parallel, no retry, `.only` OK | 1 worker, 2 retries, no `.only`    | [playwright.config.ts:6](../playwright.config.ts#L6)                    |
| 7   | Build/run              | `--watch` / `vite` (HMR)       | bundled `dist` / static            | package.json scripts                                                    |

---

## 1. Turn timer + auto-move (DISABLED in dev)

**Two gates, must flip together** — flip one only → mismatch (countdown hits 0 w/ no move, or move w/ no countdown).

Server — [router.ts:51-52](../apps/server/src/ws/router.ts#L51-L52):

```ts
function scheduleTurnTimeout(roomId: string) {
  if (!isProduction) return;   // isProduction = NODE_ENV === "production"
```

DEV: `handleTimeout()` never fires → no auto-move, no 3-miss kick, infinite turn time.
PROD: `setTimeout(handleTimeout, TIMINGS.turnTimeout)` (30s) → auto-move + kick after 3 misses.

Client — [TurnTimer.vue:52](../apps/client/src/features/match/TurnTimer.vue#L52):

```html
<div v-if="!isDev && deadline && remaining > 0" ...></div>
```

`isDev = import.meta.env.DEV`. DEV: countdown UI never renders. PROD: shows seconds, red+pulse ≤5s.

Logic + timing correct & tested either way. Constants: [rules.ts](../packages/shared/src/constants/rules.ts) — `turnTimeout: 30_000`, `kickAfterMisses: 3`.

**Verify locally:** run server `NODE_ENV=production`, client `vite build` + `vite preview`.

## 2. JWT secret ([index.ts:14-26](../apps/server/src/index.ts#L14-L26))

DEV: default `"dev-secret-change-in-production-32ch"` allowed.
PROD: `JWT_SECRET` env required, ≥32 chars, else FATAL `process.exit(1)`.

## 3. DB storage ([connection.ts:28-41](../apps/server/src/db/connection.ts#L28-L41))

Path = `filename ?? DB_PATH ?? ":memory:"`.
DEV: in-memory SQLite (ephemeral, wiped on restart).
PROD: if `NODE_ENV=production` && path ≠ `:memory:` → creates parent dir for file DB.

## 4. API base URL ([api.ts:1](../apps/client/src/shared/config/api.ts#L1))

`BASE_URL = VITE_API_URL ?? ""`.
DEV: `""` → relative reqs hit Vite proxy.
PROD: must set `VITE_API_URL` → points at prod API.

## 5. Vite dev proxy ([vite.config.ts:17-28](../apps/client/vite.config.ts#L17-L28))

DEV only: client :5173 proxies `/auth /rooms /games /health` → `localhost:3000`, `/ws` → ws upgrade.
PROD: static files, no proxy (real API URL via #4).

## 6. Tests — `CI` env flag ([playwright.config.ts](../playwright.config.ts))

| Setting               | local | CI    |
| --------------------- | ----- | ----- |
| `forbidOnly`          | false | true  |
| `retries`             | 0     | 2     |
| `workers`             | all   | 1     |
| `reuseExistingServer` | true  | false |

## 7. Build / run scripts

Server: `dev` = `bun --watch` (HMR) · `build` = `bun build → dist`.
Client: `dev` = `vite` (HMR + proxy) · `build` = `vite build` (bundle/minify) · `preview` = serve build.

---

## Env var reference

| Var            | Side   | Default       | Notes                         |
| -------------- | ------ | ------------- | ----------------------------- |
| `NODE_ENV`     | server | unset         | `"production"` flips #1,#2,#3 |
| `JWT_SECRET`   | server | dev default   | required in prod, ≥32 chars   |
| `DB_PATH`      | server | `:memory:`    | file DB path                  |
| `PORT`         | server | `SERVER_PORT` | listen port                   |
| `LOG_LEVEL`    | server | `info`        | `info`/`warn`/`error`         |
| `VITE_API_URL` | client | `""`          | prod API origin               |
| `CI`           | tests  | unset         | flips Playwright strictness   |
