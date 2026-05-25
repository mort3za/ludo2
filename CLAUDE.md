# Ludo 2

## Tasks & Todos

All implementation work is tracked as Linear issues, **not** in repo files.

- **Project**: [Ludo 2 — Real-time Multiplayer](https://linear.app/morteza67/project/ludo-2-real-time-multiplayer-b73cedf52453) (id `f2727b43-1d7b-4e8e-ad5c-5ec04af336d4`)
- **Team**: Morteza (id `9f19f748-dfb0-4305-af12-dc25a89ea779`)
- **Issue prefix**: `MOR-`

### How to read todos (via Linear MCP)

Before starting work, list open issues for this project to pick the next task:

```
mcp__plugin_linear_linear__list_issues
  project: f2727b43-1d7b-4e8e-ad5c-5ec04af336d4
  state: Backlog            # or Todo / In Progress
  orderBy: createdAt        # phase order (MOR-5 → MOR-55)
```

Fetch a single issue (full description, status, links):

```
mcp__plugin_linear_linear__get_issue
  id: MOR-<n>
```

### How to update status

Move an issue as you progress:

```
mcp__plugin_linear_linear__save_issue
  id: MOR-<n>
  state: "In Progress"      # or "Done" / "Canceled"
```

Add an attachment (PR link, doc) when relevant:

```
mcp__plugin_linear_linear__save_issue
  id: MOR-<n>
  links: [{ url: "...", title: "..." }]
```

### Conventions

- Issues are titled `Phase <n>: <task>`; phase order is the implementation order — do not jump phases without reason.
- TDD: tests-first items are titled `... (TDD)` — write the failing test before the impl in the same issue.
- Architecture, scaffold rationale, and deferred work live in [.claude/planning.md](.claude/planning.md). Do not duplicate that content into Linear.
- Commiting: after finishing every Linear task, create a git commit using /commit-general
