# Ludo — Gameplay & Rules

> Each numbered item is a **proposal**. Marked `[OPEN]` where a decision is still pending.

---

## 1. Game Overview

A real-time, server-authoritative multiplayer Ludo. 2–8 players (any mix of humans and bots) race to bring all four of their tokens from their starting yard, around a shared track, and into their home column.

- **Authority:** server is the single source of truth. Client is a renderer + input device.
- **Determinism:** given the same game state + same roll, the engine produces exactly one legal-move set. No client-side randomness.
- **Persistence:** each game has a stable `gameId`. State can be reconstructed from the move log alone.

---

## 2. Players, Tokens, Colors

1. **Seats:** `S` seats per board (board arms), where `S ∈ 4..8` (see §10.3). Seats are indexed `1..S` in clockwise order; each seat is assigned a unique color at game start.
2. **Player count:** 2 to 8 players total. Any mix of humans and bots is allowed — there is no minimum human count, so bot-only games (e.g. 2 bots) are valid (useful for testing).
3. **Tokens per player:** 4 tokens. All 4 start in their color's **yard**.
4. **Colors are seats, not players:** a player's identity (account) is separate from the color they're assigned for that game.

**Color assignment is never selectable by players.** At game start the server draws a unique color per seat at random from the palette in §10.8 — no fixed seat→color order, no per-game default. The only constraint is that all `S` colors are distinct on the board.

---

## 3. Objective & Win Condition

1. A player wins when their **4 tokens simultaneously occupy all 4 squares of their color's home column** (one token per square — see §5.7). There is no separate center / triangle goal square.
2. The game always continues for remaining players to determine all subsequent placements (2nd … `S`th).
3. Final standings are recorded for stats/ELO.

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
- A roll of `drv` moves the chosen token exactly `drv` squares forward (no partial / no splitting between tokens).
- A token must have a legal landing square; if no token can legally consume the roll, the turn ends with no move.

### 5.3 Extra turn on six
- Rolling a **6** grants another roll after the current move resolves. The bonus roll is granted **regardless of whether a legal move existed** — even if the 6 produced no move (all tokens blocked), the player still rolls again.
- **Three consecutive sixes** in one turn → the turn ends and the *third* six is forfeited (no move applied for it). This prevents stalling/abuse. A six that produced no legal move still counts toward the consecutive-six counter.

### 5.4 Captures
- Landing on a square occupied by exactly **one opponent token** sends that token back to its yard.
- Captures do **not** apply on safe squares (§5.5).
- Captures do **not** apply to your own tokens — instead, see §5.6 (stacking).

### 5.5 Safe squares
- The only safe squares are the **`S` start squares** (one per seat). Tokens standing on a start square cannot be captured.
- Multiple tokens of different colors **may co-occupy** a safe square (no captures occur). `[NOTE: co-occupation will be a room-config option in §14.]`
- No star squares or other extra safe spots exist on this board.

(Exact square indices are deferred to the board-map pass — §10.)

### 5.6 Stacking / blocks
- Two or more tokens of the **same color** on the same square form a **block** (up to the cell cap of 4 — i.e. all of a player's tokens).
- A block **cannot be landed on, passed through, or captured** by opposing tokens. Any move whose path crosses or terminates at a blocked square is illegal for opponents. `[NOTE: block rules will be a room-config option in §14.]`
- A block can be broken voluntarily (one token moves on its next turn).

### 5.7 Home column
- Each color has a private **home column** of exactly **4 squares**. There is no separate center home / home triangle — the 4 squares *are* the goal.
- A token enters its home column from its seat's **entry square** `T/((si−1) × K)` — with the special case that for **seat 1**, where the formula gives `T/0`, the entry is the wraparound square `T/(S × K)` (see §10.5). The entry sits one square before the seat's start, so a token traverses exactly `S × K − 1` track squares from `T/((si−1) × K + 1)` (start) to `T/((si−1) × K)` (entry); the next forward step lands on `H/si/1`.
- Home column squares are private — only that color can occupy them. No captures possible inside.
- Each home column square has a **capacity of 1**: at most one token may occupy a given home column square at a time. (No stacking, no blocks inside the home column.)
- A color wins when **all 4 of its home column squares are simultaneously occupied** by its 4 tokens (one token per square).

### 5.8 Exact roll inside the home column
- A token in the home column may stop on **any unoccupied square** of that column (subject to the cap of 1 per square — §5.7).
- A token may **not overshoot** the last (4th) home column square. Any move that would land past it is illegal.
- A token may also **not land on** an already-occupied home column square (cap of 1).

`[OPEN]` Variant: allow "bounce-back" instead of forfeit on overshoot? **Proposal: no — exact roll required (classic).**

---

## 6. Dice

- Standard fair 6-sided die. Server-side CSPRNG.
- Roll history is part of the game log (for replay and audit).
- No physics simulation server-side; client may animate but the value is authoritative from server.

---

## 7. Game Start

1. **Room creation:** any user can create a room and becomes its **owner**. The owner sets the room configuration: seat count `S ∈ 4..8` (the **cap**), how many of those seats are pre-allocated to bots, and the per-room rules (§14). The owner is the only player who can start the game, trigger a rematch (§11.6), or close the room.
2. **Joining:** every room has a **unique shareable link**. Any user with the link can join, claiming an open seat in clockwise order, until the room reaches its cap of `S` (humans + pre-allocated bots). Distribution is link-only — there is no public room browser.
3. All human players mark **ready** (bots are implicitly ready), then the **owner** triggers the start.
4. Server rolls a tiebreaker die for each seat to determine **first turn**. (Highest roll starts; ties re-roll.)
5. Play proceeds clockwise from the first seat.

`[OPEN]` Owner succession when the owner disconnects or quits — proposal: ownership passes to the longest-connected remaining human; if none, the room closes.


---

## 8. Multiplayer Concerns (high-level only — details later)

### 8.1 Turn timer
Each turn has a soft deadline. On expiry, server auto-plays a move (auto-pick rule TBD in detail pass).

### 8.2 Disconnect / timeout handling
When a human player misses a turn (turn timer expires, whether they're disconnected or just idle), the server plays that turn for them using **bot logic** — their tokens stay on the board and play continues normally. If the player reconnects / acts before being kicked, control returns to them seamlessly. After **3 consecutive missed turns** (the counter resets the moment the player acts on their own again), the player is **removed from the game**: their seat becomes vacant and **all of their tokens are removed from the board** (yard, track, and home column alike). The kicked player remains connected as a **spectator** and can watch the game finish, but their color is no longer in play.

### 8.3 Reconnect
On reconnect, server resyncs full state from the move log.

### 8.4 Forfeit / leave
A player who quits voluntarily is treated identically to a 3-strike kick (§8.2): their tokens are immediately removed from the board and the seat becomes **vacant** for the rest of the game. **No bot is parachuted in to replace them** — vacant seats are simply skipped on every subsequent turn rotation. Both voluntary quit and 3-strike kick record a **forfeit / loss** in the player's stats. Bots only ever act *during* the 3-turn grace window of a missed-turn streak (§8.2), playing single turns on the player's behalf while the tokens are still on the board.

### 8.5 Spectators
Read-only joiners receive state updates but cannot input moves.

Concrete values for the turn timer, reconnect, idle expiry, and post-game window are defined in **§11**.

---

## 9. Deferred — to detail in later passes

These are intentionally **not** proposed yet. Listed here so we don't lose them.

- §12 **Edge cases & resolution order** — what happens when one roll could capture *and* enter home; tie-breaking when multiple legal moves exist for auto-play; behavior when last token on the board cannot move at all.
- §13 **Bot AI behavior** — heuristic priorities for filling empty seats / replacing AFK players.
- §14 **Game variants & room options** — `mustRollSixToStart`, `allowBlocks`, `extraTurnOnCapture`, `turnTimerSeconds`, etc. — the room-config schema.

---

## 10. Board map & coordinate system

> First-pass structural definition. The system is **parametric in the seat count `S`** so the same engine can run a 4-seat plus-shape board, a 6-seat hexagonal star, an 8-seat octagonal star, etc. There is **no mathematical cap on `S`** — the practical product cap is **8 seats** (UI/balance), but the engine code never assumes a specific value.

### 10.1 Cell kinds

Every position on the board is exactly **one** of three kinds:

| Kind | ID prefix | Meaning |
|------|-----------|---------|
| Yard slot | `Y` | An off-board parking spot inside a seat's yard. |
| Track square | `T` | A square on the shared outer loop. |
| Home column square | `H` | A square inside a seat's private home column. |

A token's lifecycle traverses: `Y/…` → `T/…` (clockwise lap) → `H/…` (home column).

### 10.2 Cell IDs (slash-delimited)

Cell IDs are **strings**, parseable, with `/` as the delimiter. Seat indices are integers (`1..S`), so the system imposes no upper bound on seat count.

| Cell | Pattern | Examples | Notes |
|------|---------|----------|-------|
| Yard slot | `Y/<seat>/<slot>` | `Y/1/1`, `Y/1/4`, `Y/4/2` | `seat` ∈ `1..S`. `slot` ∈ `1..M` (`M=4`, see §10.3). The 4 yard slots are gameplay-equivalent — a token may deploy from any. Slot indices exist for rendering/persistence. |
| Track square | `T/<index>` | `T/1`, `T/27`, `T/52`, `T/78` | 1-based. No zero padding. Index range is `1..(S×K)`. |
| Home column square | `H/<seat>/<i>` | `H/1/1`, `H/4/4` | `seat` ∈ `1..S`. `i` ∈ `1..L` (`L=4`). `H/<seat>/1` is the entry-adjacent square (just past the entry); `H/<seat>/L` is the deepest, "winning" square for that token. |

### 10.3 Structural constants

| Constant | Symbol | Value | Notes |
|----------|--------|-------|-------|
| Arc length (squares per arm of the cross/star) | `K` | **13** | Locked. Each seat's start sits at the same offset within its arm regardless of `S`. |
| Home column length | `L` | **4** | §5.7 / §10.7. |
| Yard size (slots per yard) | `M` | **4** | One slot per token. |
| Practical max seats | — | **8** | Cap enforced by room config (§14); engine has no hard cap. |
| Minimum seats | — | **4** | Ludo boards must have at least 4 arms for geometric symmetry. Even a 2-player game uses a 4-armed board (players occupy 2 of the 4 seats; the other 2 remain vacant or are filled with bots). |

### 10.4 Seat numbering and origin

- Seats are integers `1, 2, ..., S` in **clockwise** order.
- **Seat 1 is anchored at the bottom-left** of the board.
- For any `S ∈ 4..8`, the remaining seats are placed **evenly spaced clockwise** around the board from seat 1 (i.e. `360°/S` apart). For `S=4` this resolves to bottom-left, top-left, top-right, bottom-right.
- **Client-side rotation:** each player's client rotates the board so that **their own seat always appears at the bottom-left** — analogous to chess, where you always see your own pieces on "your side." The underlying coordinates are unaffected; rotation is purely a rendering concern.

### 10.5 Track length and per-seat indices

- **Total track length:** `S × K` squares.
- **Seat `si`'s start square:** `T/((si−1) × K + 1)`.
- **Seat `si`'s entry square** (last track square before turning into the home column): `T/((si−1) × K)` — with the special case that for **seat 1**, where the formula gives `T/0`, the entry is the wraparound square `T/(S × K)`.

| `S` | Track length | Seat 1 start / entry | Seat 2 start / entry | Seat 3 start / entry | Seat 4 start / entry |
|-----|--------------|----------------------|----------------------|----------------------|----------------------|
| 4   | 52  | `T/1` / `T/52`  | `T/14` / `T/13` | `T/27` / `T/26` | `T/40` / `T/39` |
| 6   | 78  | `T/1` / `T/78`  | `T/14` / `T/13` | `T/27` / `T/26` | `T/40` / `T/39` |
| 8   | 104 | `T/1` / `T/104` | `T/14` / `T/13` | `T/27` / `T/26` | `T/40` / `T/39` |

(Same general pattern for any `S` — only seat 1's `entry` and the wrap-back length differ as `S` scales.)

**Safe squares** (§5.5): every seat's start square is safe. There are exactly `S` safe squares, all of the form `T/((si−1) × K + 1)` for `si ∈ 1..S`.

### 10.6 Token path (worked example)

For a token belonging to seat `si` in an `S`-seat game, the full forward path from yard to winning square:

```
Y/si/<slot>
   → (deploy on roll of 6) →
T/((si−1) × K + 1)       // start, safe
   → T/(...) clockwise around the loop ...
T/((si−1) × K)           // entry (wrapping for seat 1)
   →
H/si/1 → H/si/2 → H/si/3 → H/si/4   // L = 4, last is winning
```

Total dice-pip-equivalent moves to bring one token home:
**`1 (deploy) + (S × K − 1) (lap) + L (home column)` = `S × K + L` — equals `S × 13 + 4`.**

| `S` | Moves to bring one token home |
|-----|-------------------------------|
| 4   | 56 |
| 6   | 82 |
| 8   | 108 |

### 10.7 Yards and home columns

- Each seat has exactly **one yard** of `M = 4` slots: `Y/<seat>/1..Y/<seat>/4` (where `<seat>` ∈ `1..S`).
- Each seat has exactly **one home column** of `L = 4` capacity-1 squares: `H/<seat>/1..H/<seat>/4`.
- All home columns and yards are **private** to their seat — no opponent can occupy or interact with them.
- Movement inside a home column is forward-only (`H/<seat>/i → H/<seat>/i+1`); a token never goes back to the track once it has entered.

### 10.8 Seat → color assignment

Color is a **per-game attribute** of a seat, not part of any cell ID. There is **no fixed seat→color mapping** — at game start the server draws a unique color for each seat uniformly at random from the palette below.

- **Palette (8 colors, all visually distinct, chosen for accessibility):** `blue`, `red`, `green`, `yellow`, `purple`, `orange`, `cyan`, `pink`.
- For an `S`-seat game, exactly `S` of the 8 palette colors are drawn (without replacement) and assigned to seats `1..S`.
- Any combination is valid; no order or pairing constraint applies.

### 10.9 TypeScript sketch (preview, non-binding)

Sketch only — concrete types live in `packages/shared/types/game.ts` and will be refined when the engine is implemented.

```ts
type Seat = number;          // 1..S
type Slot = 1 | 2 | 3 | 4;   // M = 4
type Home = 1 | 2 | 3 | 4;   // L = 4

type CellId =
  | `Y/${Seat}/${Slot}`
  | `T/${number}`            // 1..S*K
  | `H/${Seat}/${Home}`;

interface BoardConfig {
  seatCount: number;         // S, ≥ 4
  arcLength: 13;             // K, locked
  homeColumnLength: 4;       // L, locked
  yardSize: 4;               // M, locked
}
```

### 10.10 Deferred to a sub-pass

- A full enumerated table of every cell with its **2D grid coordinate** for rendering (proposed: chess-style file/rank, `a1..o15` for `S=4`, growing for higher `S`).
- Per-cell adjacency precomputed for the engine (the "next cell" given a forward step from any cell).
- Visual layout rules for `S ≥ 5` (where the board is a star, not a cross) — exact arm angles, where each arm's three columns sit relative to the central polygon, etc.

---

## 11. Timing & timeouts

> All values below are the **defaults**. They live in the room-config schema (§14) and may be overridden per room — but every room must use values from this section's allowed ranges.

### 11.1 Turn timer

- **Duration:** **30 seconds** total per turn, covering both the roll trigger *and* the move selection.
- **Server is authoritative:** the timer is started server-side the moment the previous turn resolves and is broadcast to all clients. Local clocks may drift; the server's timestamp wins.
- **Bot turns:** bots act immediately when their turn begins (no timer; no artificial delay needed beyond a small client-side animation pause for human watchability — that's a UI concern, not a rule).

### 11.2 What happens on timeout

When the 30-second turn timer expires before the human player has acted:

1. **If they have not yet rolled:** server auto-rolls.
2. **If they rolled but did not pick a move:** server auto-picks the move. Selection heuristic: the **first legal move from the player's lowest-numbered token** (`Y/<seat>/1` first, then `Y/<seat>/2`, …; for tokens already on the track or in the home column, ordered by their current cell-ID). This is a deterministic placeholder — once §13 (bot AI) is filled in, the same heuristic the bot uses for full takeover can be used here too.
3. The turn counts as **one missed turn** for the kick threshold (§8.2).

Note: §11.2 deliberately does **not** treat "rolled but no legal move" as a missed turn — that's a normal pass (the player wouldn't have anything to do regardless). The missed-turn counter only increments when *human input* was required and didn't arrive.

### 11.3 Reconnect

- No separate "reconnect grace" timer. Reconnection is a passive state-resync operation: the client identifies itself with its session token and the server replays the move log to bring it back in sync.
- A reconnecting player can act on the **current turn** if it's theirs and the turn timer hasn't expired. If the timer has already expired and the server auto-played, the next opportunity is on their next turn.
- Reconnection itself does **not** reset the missed-turn counter — only *the player acting on their own* does (per §8.2).

### 11.4 Room idle expiry (pre-game lobby)

- A room that has been created but has **not yet started a game** auto-closes after **15 minutes of inactivity** (no new joins, no readies, no chat).
- "Auto-close" means: the room is destroyed, any connected clients are notified and dropped back to the lobby/home screen.

### 11.5 Active / vacant seats and game-end conditions

Once a game has started it does **not** idle-expire by clock. Each seat is in exactly one of three states:

- **Active seat** = a human still in the game (possibly mid-grace-window, with 0–2 missed consecutive turns) **or** a bot that was configured into the seat at game creation.
- **Vacant seat** = a human who has been kicked (§8.2) or has voluntarily quit (§8.4). Their tokens are removed from the board; the seat is **skipped** on every subsequent turn rotation. **No bot is ever parachuted in** to take over a vacant seat — bots are only first-class participants when they were configured at game creation, and they only play *single turns* during a human's grace window.
- **Empty seat** = a seat that was **never filled** at game start (no human joined, no bot pre-allocated). Empty seats have no tokens and are permanently skipped in turn rotation. They do not participate in tiebreaker rolls (§7) or standings.

Game continues until one of these terminal conditions:

- **Normal completion:** standings are decided per §3 — all initially-active placements filled.
- **Sole survivor:** if exactly **one active seat** remains (all others vacant, empty, or already finished), that seat **wins immediately** — the game does not play out alone.
- **Total abandonment:** if **zero active seats** remain (e.g. all-human game where everyone gets kicked or quits), the game is **aborted**. No winner recorded; all departed players keep the forfeit/loss recorded under §8.4.

### 11.6 Post-game window

- After a game ends (all standings decided, or game aborted per §11.5), the room remains open for **60 seconds**.
- During this window: chat is open, final standings and stats are displayed, and the **owner** (§7) may trigger a **rematch** — a new game with the **same room configuration** (same `S`, same rules); colors are re-drawn per §10.8. Currently-seated players are auto-seated; players who quit during the previous game are not re-included.
- A rematch immediately replaces the post-game window with a fresh game.
- After 60 seconds with no rematch, the room is closed automatically. The owner may also close the room manually at any time.

### 11.7 Game-state retention

- Completed-game state (the move log + final standings) is retained on the server for **24 hours** so users can replay or share. After 24 hours the move log is archived to longer-term storage / dropped depending on stats requirements (final design TBD when persistence layer §J/§K is built).

---

## Decisions log

> Append accepted decisions here as we go, so the proposals above stay clean.

- **Roll trigger:** human players must trigger their own roll via UI; the server performs the RNG and broadcasts the result. Bots roll automatically server-side. _(2026-05-01)_
- **Leaving the yard:** only a roll of **6** deploys a token from the yard. _(2026-05-01)_
- **Extra turns (§5.3):** granted only on rolling a 6 (not on capture or bringing a token home). Bonus roll fires **regardless of whether a legal move existed**. Three consecutive sixes in one turn forfeit the third roll and end the turn; empty-move sixes count toward the streak. _(2026-05-02)_
- **Safe squares (§5.5):** only the `S` start squares (one per seat). Multiple opponents may co-occupy a safe square (configurable in §14). _(2026-05-02)_
- **Blocks (§5.6):** ≥2 same-color tokens on a square form a block (cell cap: 4). Blocks cannot be landed on, passed through, or captured by opponents — any move whose path crosses a block is illegal. Block rules are a room-config option (§14). _(2026-05-02)_
- **Game end (§3):** every game plays out to full standings. Sole-survivor and zero-active-seats terminal conditions in §11.5 still apply. _(2026-05-02)_
- **Home column (§5.7):** exactly 4 squares, no separate center/triangle goal. Each square has capacity 1 (no stacking inside the column). Win = all 4 home column squares simultaneously occupied by that color's tokens. _(2026-05-01)_
- **First turn (§7):** decided by a per-seat tiebreaker roll at game start (highest wins; ties re-roll). Only active (occupied) seats roll. _(2026-05-02)_
- **Disconnect / timeout (§8.2):** missed turns are auto-played by bot logic on the player's behalf (tokens stay on the board); the player can reclaim control by reconnecting/acting. After **3 consecutive** missed turns (counter resets when the player acts on their own), the player is removed — all tokens wiped, seat becomes **vacant**, player is spectator-only. _(2026-05-01)_
- **Forfeit recording (§8.4):** both voluntary quit and 3-strike kick record a forfeit/loss in stats. _(2026-05-01)_
- **Timing (§11):** turn timer **30s**; on expiry the server auto-rolls and/or auto-picks (lowest-numbered legal token) and the turn counts as missed. Reconnection is passive (no separate grace timer). Pre-game lobby idle expiry **15 minutes**; in-game has no idle expiry (bots play it out). Post-game window **60s** for chat / rematch. Game-state retention **24 hours**. Sole-survivor → instant win. _(2026-05-02)_
- **Board map & coordinates (§10):** parametric in seat count `S` (engine has no max; product cap **8**). Cell IDs slash-delimited (`Y/<seat>/<slot>`, `T/<index>`, `H/<seat>/<i>`). Constants: `K=13`, `L=4`, `M=4`. Seats `1..S` clockwise, **seat 1 anchored at bottom-left**. Client rotates so the player's own seat is always at bottom-left. Per-seat indices: `start = T/((si−1)×13+1)`, `entry = T/((si−1)×13)` (with seat-1 wrap to `T/(S×13)`). _(2026-05-02)_
- **Seat states (§11.5):** three states — **active** (human or bot in play), **vacant** (kicked/quit mid-game; tokens removed, seat skipped), **empty** (never filled at game start; permanently skipped, no tokens, no standings). _(2026-05-02)_
- **Color assignment (§10.8):** colors drawn uniformly at random from palette `blue, red, green, yellow, purple, orange, cyan, pink`; each seat gets a unique color. No fixed mapping, no order constraint. _(2026-05-02)_
- **Home column entry (§5.7):** entry square is `T/((si−1) × K)` (with seat-1 wrap to `T/(S × K)`); token traverses `S × K − 1` track squares from start to entry, then steps to `H/si/1`. _(2026-05-02)_
- **Room owner & rematch (§7 / §11.6):** the room creator is the **owner** — starts game, triggers rematch, closes room. Rematch re-uses same config; colors re-drawn. Owner-succession on disconnect/quit is `[OPEN]`. _(2026-05-02)_
- **Room creation & joining (§7):** any user can create a room (link-only, no public browser). Users join via link until cap `S` is reached. All human players mark ready; bots are always ready; owner triggers start. _(2026-05-02)_
- **Notation (§2 / §5.2 / §10):** seat count = `S` (not `N`). Seats are **1-indexed** (`1..S`). Dice value = `drv`. Seat index = `si`. Board minimum `S = 4` (geometric symmetry). _(2026-05-02)_
