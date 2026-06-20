# Planning

Forward-looking work and process. The scaffold/architecture decisions that used to
live here have moved to [../docs/architecture.md](../docs/architecture.md).
Per-phase implementation tasks are tracked in Linear:
[Ludo 2 — Real-time Multiplayer](https://linear.app/morteza67/project/ludo-2-real-time-multiplayer-b73cedf52453).

## Process

TDD throughout. After Phase 0 (scaffold), every implementation item is preceded by a
`tests:` item written first, watched fail, then made green. Phases are ordered so each
layer can be tested in isolation before the next layer is built on top.

## Deferred (kept behind explicit config / rule boundaries — never hard-coded)

- Owner succession when the owner disconnects or quits (§7 `[OPEN]`)
- Bot AI heuristics beyond the deterministic timeout auto-pick (§13)
- Room-config variant matrix (§14)
- 2D coordinate generation refinement for `S ≥ 5` rendering (§10.10)
