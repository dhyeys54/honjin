@AGENTS.md

# Claude Code specifics

## The build loop

Run **`/next-task`** repeatedly. Each run does exactly one task from `docs/PLAN.md` using the TDD loop, verifies
it, commits it, and stops. For an unattended run: `/loop /next-task`. It stops by itself at a `[!]` blocked task, at a
human checkpoint (G1–G4), or when the plan is complete. To continue after a checkpoint, try the build, then
tick the gate in `docs/PLAN.md` (or tell Claude "approved, tick G1") and run `/loop /next-task` again.

Suggested models: Sonnet for `/next-task`. Opus (or a fresh Sonnet) for the `spec-reviewer` agent at the end of
each stage.

## Project skills (`.claude/skills/`)

| Skill | Use when |
|---|---|
| `next-task` | Doing the next plan task (the main entry point) |
| `honjin-tdd` | Writing any test; choosing unit vs integration vs E2E; the herdr test harness |
| `theia-dev` | Touching any Theia API: widgets, contributions, preferences, RPC, terminal, layout, packaging |
| `herdr-integration` | Anything that calls the herdr CLI or depends on its JSON output |
| `honjin-polish` | Stage 3 design work: theme, typography, spacing, icons, UX copy |

## Agents (`.claude/agents/`)

- `spec-reviewer`: a read-only reviewer. It checks finished work against the specs and the plan's acceptance
  criteria. `/next-task` calls it at the end of every stage; you can also run it yourself.

## Global skills this workflow calls

- `impeccable`: the primary design skill for stage 3 (`critique`, `audit`, `typeset`, `quieter`, `polish`). It
  reads `PRODUCT.md` and `DESIGN.md` at the repo root.
- `design-taste-frontend`: the anti-slop pre-flight check; apply it to the README and screenshots. Its own scope
  excludes dense product UI, so impeccable owns the IDE chrome.
- `diagnosing-bugs`: use it when a failure has no obvious cause.

## MCP servers (`.mcp.json`, enabled automatically by `.claude/settings.json`)

- `context7`: current Theia / Playwright / Jest docs. Query it before using any Theia API you haven't verified in
  `node_modules`.
- `playwright`: drive the running browser-app (http://127.0.0.1:3000) to look at UI changes and take screenshots.

## Optional plugins (install once, user scope)

```
/plugin install typescript-lsp@claude-plugins-official      # go-to-definition / diagnostics across @theia types
/plugin marketplace add obra/superpowers-marketplace          # optional: extra debugging/review skills;
/plugin install superpowers@superpowers-marketplace           # this repo's own loop is still next-task
```
