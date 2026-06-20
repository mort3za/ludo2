# MOR-200 — Home area is no-stacking (code drifted from spec)

## The rule (unchanged, canonical)

The home area has **exactly 4 squares** (`H/si/1..4`), each with **capacity 1**. There
is **no center/goal square** and **no stacking anywhere in the home area**. A seat
**wins when all 4 home squares are simultaneously occupied, one token per square**.

This was always the spec — see `gameplay.md` §3 (Win Condition), §5.7 (Home column),
§5.8 (Exact roll inside the home column), and `dictionary.md` ("Home column").

## What was wrong

The **code**, not the docs, had drifted. Two spots implemented a "pile all 4 tokens
onto the final square `H/si/4` to win" model:

- `apps/server/src/game/rules/terminal.ts` — win was `every token at H/si/HOME_COLUMN_LENGTH`
  (i.e. all stacked on the last square).
- `packages/shared/src/board/legal-moves.ts` — `isHomePathBlocked` only treated home
  squares with `index < HOME_COLUMN_LENGTH` as obstacles, so a token could legally land
  on an **occupied final square** `H/si/4`.

Because the client highlight and the server validation share the _same_ `legalMoves`
function, there was never a "highlights but won't move" mismatch — the real defect was
that stacking onto `H/si/4` was wrongly allowed, and the win condition required it.

## The fix

- `legal-moves.ts`: occupied home squares block at **every** index (drop the
  `index < HOME_COLUMN_LENGTH` exemption). No move may land on or pass through an
  occupied home square.
- `terminal.ts`: win = all `TOKENS_PER_PLAYER` tokens are in the home area on
  **distinct** squares (`homeCells.size === seatTokens.length`).

### Consequence: fill order is forced

To reach `H/si/k` a token traverses `H/si/1..k`, and it may not pass an occupied
square. So the **deepest square fills first** (`H/si/4`, then `/3`, `/2`, `/1`); the
last token always enters from the track onto `H/si/1` with an exact roll. Tests use a
token on the entry-approach square `T/(S×11 − 1)` + a roll of 1 to land `H/si/1`.

## Don't reintroduce

There is **no goal/triangle square** and **no stacking** in the home area. If you find
code treating `H/si/4` as a pile-up "home" cell, it is wrong — see the sections above.
