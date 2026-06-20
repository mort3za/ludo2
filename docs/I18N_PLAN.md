# i18n Plan — English + Persian (with RTL)

Add full internationalization to the Ludo 2 client (`apps/client`, Vue 3 + Vite + Tailwind v4),
shipping **English (en)** and **Persian (fa)** locales, with **RTL** layout for Persian.

## Goals

- Every user-facing string in the client is translatable (no hardcoded copy in templates/logic).
- Two locales: `en` (LTR, default) and `fa` (RTL).
- Language switcher in the app header; choice persisted across sessions.
- Persian renders with a proper Persian font (Vazirmant from google fonts) and full RTL layout (direction, mirrored spacing, icons).

## Non-goals

- Server-side messages / API error text translation (server stays English for now; client maps known
  error keys to translated strings).
- Locale-aware number formatting for the game itself beyond what vue-i18n provides out of the box.
- Additional languages (structure should make adding them trivial, but only en/fa ship).

## Library choice

**`vue-i18n` v11** (Composition API mode, `legacy: false`). It's the de-facto Vue 3 i18n library,
integrates with Vite, and supports message functions, pluralization, and `useI18n()` in `<script setup>`.

```
bun add vue-i18n
```

## Architecture

New directory: `apps/client/src/shared/i18n/`

```
shared/i18n/
├── index.ts            # createI18n instance, exported for main.ts + setLocale()
├── locales/
│   ├── en.json         # English messages (source of truth for keys)
│   └── fa.json         # Persian messages
└── useLocale.ts        # composable: current locale, dir, setLocale(), persistence
```

- `index.ts` builds the i18n instance: `legacy: false`, `locale` resolved from persisted value →
  browser language → `'en'`, `fallbackLocale: 'en'`.
- `useLocale.ts` exposes `locale`, `dir` (`'rtl' | 'ltr'`), `availableLocales`, and `setLocale(code)`.
  `setLocale` updates i18n, writes to `localStorage` (key `ludo:locale`), and sets
  `document.documentElement.lang` + `dir`.
- Wire into `apps/client/src/main.ts`: `app.use(i18n)` and apply initial `lang`/`dir` to `<html>`
  before mount.

### Message key convention

Namespaced by area, dot-paths in JSON:

```json
{
  "common": {
    "play": "Play",
    "copy": "Copy Link",
    "copied": "Copied!",
    "ready": "Ready",
    "notReady": "Not ready"
  },
  "home": { "creating": "Creating…", "error": "Something went wrong" },
  "match": {
    "theirTurn": "Their turn",
    "waitingForDice": "Waiting for dice…",
    "yourTurnRoll": "Your turn — roll the dice!",
    "noLegalMoves": "No legal moves — passing…",
    "aiThinking": "{player} (AI) is thinking…"
  },
  "postgame": { "youWon": "You won!", "gameOver": "Game Over" },
  "colors": { "blue": "Blue", "red": "Red", "green": "Green", "yellow": "Yellow" },
  "connection": { "playerDisconnected": "Player disconnected" }
}
```

Interpolation (e.g. `"{player} (AI) is thinking…"`) uses vue-i18n named interpolation:
`t('match.aiThinking', { player })`. `en.json` is the canonical key set; `fa.json` mirrors it.

## RTL strategy (Tailwind v4)

1. **Direction source of truth**: `dir` attribute on `<html>`, toggled by `setLocale`.
2. **Use logical Tailwind utilities** instead of physical ones so layout mirrors automatically:
   - `ml-*`/`mr-*` → `ms-*`/`me-*`
   - `pl-*`/`pr-*` → `ps-*`/`pe-*`
   - `left-*`/`right-*` → `start-*`/`end-*`
   - `text-left`/`text-right` → `text-start`/`text-end`
   - `rounded-l/r-*` → `rounded-s/e-*`
     These respond to `dir` with no extra config in Tailwind v4.
3. **Directional remainders** (transforms, flex orderings, chevrons/arrows, custom CSS in
   `styles/*.css`): handle with the `rtl:` variant or `[dir=rtl]` selectors where logical utilities
   don't apply. Audit `styles/main.css`, `button.css`, `background.css` for hardcoded `left/right`.
4. **Board (`BoardView.vue`)**: the game board is a fixed geometric grid — it must NOT mirror.
   Wrap/scope it so RTL does not flip board coordinates or piece positions; only surrounding chrome
   flips. Verify capture toasts/labels still point correctly.

## Persian font

Current fonts (`akkurat`, `fragmentMono`) are Latin-only. Add a Persian webfont — **Vazirmatn**
(open source, good digits/glyph coverage):

- Add the font files/`@font-face` (self-hosted under `apps/client/public/fonts/` preferred over CDN
  for offline/dev parity), then in `styles/main.css` set the font stack so `fa` falls back to
  Vazirmatn: e.g. a `[lang=fa]` / `[dir=rtl]` rule overriding `--font-*` or `font-family`.
- Keep mono font for codes/links; ensure room codes remain legible (consider keeping room code LTR
  with `dir="ltr"` inline even under RTL).

## Language switcher UI

- Add a compact toggle/dropdown to `shared/ui/AppHeader.vue` (EN / فارسی).
- Calls `setLocale()` from `useLocale`. No reload needed — vue-i18n + `dir` update are reactive.

## Files to touch (string extraction)

All 17 `.vue` files plus any Pinia stores with user-facing strings. Replace literals with `t('…')`.
Priority order (by visible-text density):

1. `features/match/GameControls.vue` — most status strings, interpolation.
2. `pages/RoomPage.vue`, `pages/HomePage.vue` — lobby/creation copy.
3. `features/match/PostGameStandings.vue`, `pages/PostGamePage.vue` — results.
4. `features/match/CaptureToast.vue` — color names.
5. `features/match/ReconnectBanner.vue`, `TurnTimer.vue`, `SpectatorBadge.vue` — connection/turn UI.
6. `shared/ui/*` (DButton/DCard/DInput/DPill) — usually prop-driven; translate at call sites, not inside.
7. `app/App.vue`, `entities/game/BoardView.vue` — any remaining chrome.

For strings living in `.ts` (e.g. store-derived status), import `t` from the i18n instance (the
global `i18n.global.t`) rather than the composable, since they're outside component setup.

## Implementation steps

1. **Setup** — `bun add vue-i18n`; create `shared/i18n/` (instance, composable, empty `en.json`/`fa.json`);
   wire into `main.ts`; apply initial `lang`/`dir`.
2. **Extract en** — sweep the 17 components, move every literal into `en.json`, replace with `t()`.
   Build the canonical key tree as you go. App should look identical in English afterward.
3. **Add fa** — mirror `en.json` → `fa.json` with Persian translations.
4. **RTL pass** — flip physical→logical Tailwind utilities; add `rtl:`/`[dir=rtl]` for the remainder;
   protect `BoardView` from mirroring; add Persian font + `lang=fa` font stack.
5. **Switcher** — add EN/فارسی toggle to `AppHeader.vue`, persisted via `useLocale`.
6. **Verify** — see below.

## Verification

- Manual: load app, switch to فارسی → all visible text Persian, layout flips RTL, board geometry
  intact, room code still copyable/legible, AI-thinking interpolation correct.
- Switch back to EN → identical to pre-i18n look.
- Reload → persisted locale restored from `localStorage`.
- Grep guard: no remaining hardcoded user-facing literals in templates (spot-check via search for
  quoted sentence-case strings in `.vue` files).
- E2E: extend Playwright (`e2e/`) with a smoke test that toggles locale and asserts `<html dir>` +
  a known translated string.

## Risks / watch-outs

- **Board mirroring** is the main visual risk — RTL must not flip game coordinates. Scope carefully.
- **Strings in shared `DButton`/`DPill`** — translate at call sites, not inside the primitives, to
  keep them locale-agnostic.
- **`.ts`-side strings** need the global `t`, not `useI18n()`.
- **Persian digits**: decide whether room codes / counters use Latin or Persian-Indic digits
  (recommend Latin for codes to keep copy/paste and sharing unambiguous).
