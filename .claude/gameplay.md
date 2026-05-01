# Ludo — Gameplay & Rules

> Living document. We start with the **big picture** here. Details (exact board coordinates, turn-timer values, edge-case resolution order, etc.) come in later passes.
>
> Each numbered item is a **proposal** — accept (✅), reject (❌), or modify. Marked `[OPEN]` where a decision is still pending.

---

## 1. Game Overview

A real-time, server-authoritative multiplayer Ludo. 2–4 human players (or bots filling empty seats) race to bring all four of their tokens from their starting yard, around a shared cross-shaped track, and into their home column.

- **Authority:** server is the single source of truth. Client is a renderer + input device.
- **Determinism:** given the same game state + same roll, the engine produces exactly one legal-move set. No client-side randomness.
- **Persistence:** each game has a stable `gameId`. State can be reconstructed from the move log alone.

---

## 2. Players, Tokens, Colors

1. **Seats:** exactly 4 seats per board — `red`, `green`, `yellow`, `blue` (fixed clockwise order, in that sequence).
2. **Player count:** 2 to 4 players total. Any mix of humans and bots is allowed — there is no minimum human count, so bot-only games (e.g. 2 bots) are valid (useful for testing).
3. **Tokens per player:** 4 tokens. All 4 start in their color's **yard**.
4. **Colors are seats, not players:** a player's identity (account) is separate from the color they're assigned for that game.

**Color assignment is never selectable by players.** The server assigns colors at game start. For 2-player matches, the two players are always placed on **opposing seats** (diagonally across the board) for symmetry.

---

## 3. Objective & Win Condition

1. A player wins when their **4 tokens simultaneously occupy all 4 squares of their color's home column** (one token per square — see §5.7). There is no separate center / triangle goal square.
2. The game continues for remaining players to determine 2nd, 3rd, 4th place — *unless* the room is configured `winnerOnlyMode: true`, in which case the game ends immediately on first win.
3. Final standings are recorded for stats/ELO.

**Default for `winnerOnlyMode`:** `false` (play out to full standings) for **ranked** games, `true` (end on first win) for **casual** games.

---

## 4. Turn Structure (high-level)

A turn consists of:

1. **Roll** — the active player must trigger the roll themselves (UI gesture / button). The server then performs the actual RNG and broadcasts the result. The client-side trigger is purely a presentation/UX gate — the value is never decided on the client. For bot players, the server triggers and rolls in one step (no input needed).
2. **Resolve legal moves** — server computes which of the player's 4 tokens can legally move with that roll.
3. **Player input** — client picks one of the legal moves (or is forced if only one exists, or auto-passed if none exist).
4. **Apply move** — server mutates state, emits update, handles captures/blocks/home entries.
5. **Decide next turn** — either the same player rolls again (extra turn rules, §5.3) or turn passes to the next seat clockwise.

Detailed timing/timeouts are in §8.

---

## 5. Core Rules (proposal)

### 5.1 Leaving the yard
- A token leaves its yard onto its **start square** only when the player rolls a **6**.
- Rolling a 6 does *not* force the player to deploy a token — they may instead move an already-active token. (Some Ludo variants force deployment; we don't.)

### 5.2 Movement
- Tokens move **clockwise** around the shared outer track.
- A roll of N moves the chosen token exactly N squares forward (no partial / no splitting between tokens).
- A token must have a legal landing square; if no token can legally consume the roll, the turn ends with no move.

### 5.3 Extra turn on six
- Rolling a **6** grants another roll after the current move resolves.
- **Three consecutive sixes** in one turn → the turn ends and the *third* six is forfeited (no move applied for it). This prevents stalling/abuse.

### 5.4 Captures
- Landing on a square occupied by exactly **one opponent token** sends that token back to its yard.
- Captures do **not** apply on safe squares (§5.5).
- Captures do **not** apply to your own tokens — instead, see §5.6 (stacking).

### 5.5 Safe squares
- The only safe squares are the **4 start squares** (one per color, marked with a small arrow on the reference board). Tokens standing on a start square cannot be captured.
- No star squares or other extra safe spots exist on this board.

(Exact square indices are deferred to the board-map pass — §10.)

### 5.6 Stacking / blocks
- Two tokens of the **same color** on the same square form a **block**.
- A block **cannot be passed through or captured** by opposing tokens of any single roll.
- A block can be broken voluntarily (one token moves on its next turn).

### 5.7 Home column
- Each color has a private **home column** of exactly **4 squares**. There is no separate center home / home triangle — the 4 squares *are* the goal.
- A token enters its home column only after completing a full lap and reaching its color's **entry point**.
- Home column squares are private — only that color can occupy them. No captures possible inside.
- Each home column square has a **capacity of 1**: at most one token may occupy a given home column square at a time. (No stacking, no blocks inside the home column.)
- A color wins when **all 4 of its home column squares are simultaneously occupied** by its 4 tokens (one token per square).

### 5.8 Exact roll inside the home column
- A token in the home column may stop on **any unoccupied square** of that column (subject to the cap of 1 per square — §5.7).
- A token may **not overshoot** the last (4th) home column square. Any move that would land past it is illegal.
- A token may also **not land on** an already-occupied home column square (cap of 1).
- If, on a given roll, no legal move exists for any of the player's tokens (yard / track / home column), the turn ends with no move.

`[OPEN]` Variant: allow "bounce-back" instead of forfeit on overshoot? **Proposal: no — exact roll required (classic).**

---

## 6. Dice

- Standard fair 6-sided die. Server-side CSPRNG.
- Roll history is part of the game log (for replay and audit).
- No physics simulation server-side; client may animate but the value is authoritative from server.

---

## 7. Game Start

1. Room fills (2–4 humans + optional bots).
2. All players mark **ready**.
3. Server rolls a tiebreaker die for each seat to determine **first turn**. (Highest roll starts; ties re-roll.)
4. Play proceeds clockwise from the first seat.


---

## 8. Multiplayer Concerns (high-level only — details later)

1. **Turn timer:** each turn has a soft deadline. On expiry, server auto-plays a move (auto-pick rule TBD in detail pass).
2. **Disconnect / timeout handling:** when a human player misses a turn (turn timer expires, whether they're disconnected or just idle), the server plays that turn for them using **bot logic** — their tokens stay on the board and play continues normally. If the player reconnects / acts before being kicked, control returns to them seamlessly. After **3 consecutive missed turns** (the counter resets the moment the player acts on their own again), the player is **removed from the game**: their seat becomes empty and **all of their tokens are removed from the board** (yard, track, and home column alike). The kicked player remains connected as a **spectator** and can watch the game finish, but their color is no longer in play.
3. **Reconnect:** on reconnect, server resyncs full state from the move log.
4. **Forfeit / leave:** a player who quits voluntarily is replaced by a bot for the rest of the game. Both voluntary quit and 3-strike kick (§8.2) record a **forfeit / loss** in the player's stats.
5. **Spectators:** read-only joiners receive state updates but cannot input moves.

`[OPEN]` Default turn-timer length, grace window, AFK-skip threshold — **decide in detail pass §11**.

---

## 9. Deferred — to detail in later passes

These are intentionally **not** proposed yet. Listed here so we don't lose them.

- §10 **Board map & coordinate system** — exact 52-square outer track, the 4 home columns, the 4 yards, a chess-like coordinate notation (e.g. `R1` = red's start, `T13` = track index 13, `H-r-3` = red's home-column square 3), starting squares per color, entry points per color, and the 8 safe squares.
- §11 **Timing & timeouts** — turn timer, reconnect grace, AFK rules, room idle expiry.
- §12 **Edge cases & resolution order** — what happens when one roll could capture *and* enter home; tie-breaking when multiple legal moves exist for auto-play; behavior when last token on the board cannot move at all.
- §13 **Bot AI behavior** — heuristic priorities for filling empty seats / replacing AFK players.
- §14 **Game variants & room options** — `winnerOnlyMode`, `mustRollSixToStart`, `allowBlocks`, `extraTurnOnCapture`, `turnTimerSeconds`, etc. — the room-config schema.

---

## Decisions log

> Append accepted decisions here as we go, so the proposals above stay clean.

- **Player count:** 2–4 total players, any mix of humans and bots, no minimum humans (bot-only games allowed for testing). _(2026-05-01)_
- **Roll trigger:** human players must trigger their own roll via UI; the server performs the RNG and broadcasts the result. Bots roll automatically server-side. _(2026-05-01)_
- **Leaving the yard:** only a roll of **6** deploys a token from the yard. _(2026-05-01)_
- **Extra turns:** granted only on rolling a 6 (not on capture or bringing a token home). Three consecutive sixes in one turn forfeit the third roll and end the turn. _(2026-05-01)_
- **Safe squares:** only the 4 start squares (one per color). No star or additional safe squares — the board has none. _(2026-05-01)_
- **Color assignment:** server-assigned, never player-selectable. 2-player matches are placed on opposing (diagonal) seats. _(2026-05-01)_
- **`winnerOnlyMode` default:** `false` for ranked games (play out to full standings), `true` for casual games (end on first win). _(2026-05-01)_
- **Blocks (§5.6):** immune — cannot be captured, even by another block. Size cap: up to 4 (any number of same-color tokens on a square forms a block). _(2026-05-01)_
- **Home column (§5.7):** exactly 4 squares, no separate center/triangle goal. Each square has capacity 1 (no stacking inside the column). Win = all 4 home column squares simultaneously occupied by that color's tokens. _(2026-05-01)_
- **First turn (§7):** decided by a per-seat tiebreaker roll at game start (highest wins; ties re-roll). _(2026-05-01)_
- **Disconnect / timeout (§8.2):** missed turns are auto-played by bot logic on the player's behalf (tokens stay on the board); the player can reclaim control by reconnecting/acting. After **3 consecutive** missed turns (counter resets when the player acts on their own), the player is removed from the game — **all their tokens are wiped from the board**, the seat becomes empty, and they continue as a spectator only. _(2026-05-01)_
- **Forfeit recording (§8.4):** both voluntary quit and 3-strike kick record a forfeit/loss in stats. _(2026-05-01)_
