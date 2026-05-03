# Dictionary

Canonical definitions for terms used across the codebase and design docs. When code or docs use these words, they mean exactly what's defined here.

---

## Board & geometry

| Term | Definition |
|------|-----------|
| **Board** | The complete playing surface: `S` arms arranged in a cross (S=4) or star (S≥5), plus yards and home columns. |
| **Arm** | One of the `S` symmetric extensions radiating from the board center. Each arm contains `K=11` track squares plus its seat's yard and home column. |
| **Seat** | A numbered position on the board (`1..S`). Each seat has one yard, one start square, one entry square, and one home column. A seat may be active, vacant, or empty. |
| **Track** | The shared outer loop of `S × K` squares that all tokens traverse clockwise. Indexed `T/1..T/(S×K)`. |
| **Cell** | Any discrete position on the board — a yard slot, a track square, or a home column square. Identified by a Cell ID. |
| **Cell ID** | Slash-delimited string uniquely identifying a cell: `Y/<seat>/<slot>`, `T/<index>`, or `H/<seat>/<i>`. |

## Tokens & movement

| Term | Definition |
|------|-----------|
| **Token** | A player's game piece. Each seat has exactly 4 tokens. A token is always on exactly one cell. |
| **Deploy** | Moving a token from the yard onto the seat's start square. Requires rolling a 6. |
| **Capture** | Landing on a track square occupied by exactly one opponent token, sending it back to its yard. Does not apply on safe squares or to blocks. |
| **Block** | Two or more same-color tokens on the same track square. Opponents cannot land on, pass through, or capture a block. |
| **Pass through** | A move whose path (not just landing square) crosses a given cell. Blocks make pass-through illegal for opponents. |

## Board zones

| Term | Definition |
|------|-----------|
| **Yard** | A seat's off-board holding area with `M=4` slots (`Y/<seat>/1..4`). Tokens start here and return here when captured. |
| **Start square** | The track square where a token deploys from the yard: `T/((si−1)×K+1)` for seat `si`. Also a safe square. |
| **Entry square** | The last track square before a token turns into its home column: `T/((si−1)×K)` (seat 1 wraps to `T/(S×K)`). |
| **Home column** | A seat's private column of `L=4` capacity-1 squares (`H/<seat>/1..4`). Forward-only, no captures, no stacking. A token enters from the entry square. |
| **Safe square** | A start square. Tokens on safe squares cannot be captured. Multiple colors may co-occupy a safe square. |

## Players & rooms

| Term | Definition |
|------|-----------|
| **Player** | A human user or bot occupying a seat. Identity (account) is separate from color. |
| **Bot** | A server-controlled player that acts immediately using heuristic AI (§13, deferred). Pre-allocated at room creation. |
| **Color** | A per-game visual attribute of a seat, drawn at random from the palette. Not tied to player identity or seat number. |
| **Palette** | The fixed set of 8 visually distinct colors available for assignment: `blue`, `red`, `green`, `yellow`, `purple`, `orange`, `cyan`, `pink`. |
| **Owner** | The human who created the room. Has exclusive authority to start the game, trigger rematch, and close the room. |
| **Room** | A lobby instance identified by a unique shareable link. Contains room config, player list, and game state. |
| **Room config** | Owner-set parameters: seat count `S`, bot allocation, and per-room rules (§14). |
| **Spectator** | A read-only observer who receives state updates but cannot make moves. Kicked players become spectators. |

## Seat states

| Term | Definition |
|------|-----------|
| **Active** | A seat occupied by a human (possibly in missed-turn grace window) or a bot. Participates in turn rotation and standings. |
| **Vacant** | A seat whose player was kicked (§8.2) or voluntarily quit (§8.4). Tokens removed; seat permanently skipped. |
| **Empty** | A seat that was never filled at game start. No tokens, no turns, no standings entry. Permanently skipped. |

## Turn & dice

| Term | Definition |
|------|-----------|
| **Turn** | One cycle of: roll → resolve legal moves → player input → apply move → decide next. |
| **Roll** | The act of generating a die value (`drv ∈ 1..6`) via server-side CSPRNG. Human players trigger; bots auto-trigger. |
| **Legal move** | A token + destination pair that the current roll value permits, given board state (no overshoot, no blocks in path, etc.). |
| **Extra turn** | A bonus roll granted after rolling a 6 (regardless of whether a legal move existed). |
| **Missed turn** | A turn where the human's input did not arrive before the timer expired. Counts toward the 3-strike kick threshold. |
| **Forfeit** | A loss recorded when a player voluntarily quits or is kicked after 3 missed turns. |

## Game lifecycle

| Term | Definition |
|------|-----------|
| **Game** | A single match from first roll to final standings. Identified by `gameId`. Fully reconstructible from the move log. |
| **Move log** | The append-only, ordered record of every roll and move in a game. Serves as the single source for replay, reconnect resync, and audit. |
| **Standings** | The ordered list of placements (1st, 2nd, … up to the number of initially-active seats). |
| **Rematch** | A new game in the same room with the same config. Colors are re-drawn; currently-seated players are auto-seated. |
| **Sole survivor** | Terminal condition: when exactly one active seat remains, it wins immediately. |

## Constants & symbols

| Symbol | Meaning | Value |
|--------|---------|-------|
| `S` | Seat count (board arms) | `4..8` |
| `K` | Arc length (track squares per arm) | `11` (locked) |
| `L` | Home column length | `4` (locked) |
| `M` | Yard size (slots per yard) | `4` (locked) |
| `drv` | Dice roll value | `1..6` |
| `si` | Seat index variable | `1..S` |
