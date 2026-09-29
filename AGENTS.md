# AGENTS.md — Corral

Instructions for any coding agent working in this repo. Read this file fully before your first edit.

## What Corral is

A macOS IDE built on **Eclipse Theia** (1.76.x) for working on many projects from one window, with coding agents
(Claude Code) running in **herdr** instead of an agent built into the IDE.

```
┌────────┬──────────────────────────┬──────────────────────────┬──────────────┐
│ Left   │ Editor                   │ herdr terminal           │ Projects     │
│ search │ (Monaco tabs)            │ (TUI: workspaces/tabs/   │ app-a      ▾ │
│ debug  │                          │  panes running `claude`) │  src/    [+] │
│        │                          │                          │ app-b      ▸ │
└────────┴──────────────────────────┴──────────────────────────┴──────────────┘
```

The feature that matters most: every folder in the Projects tree has a **+** that opens a new herdr tab in that
folder. The tab goes in the project's own herdr workspace and runs the configured startup command.

## Source of truth

| Question | Read |
|---|---|
| What are we building, and why? | `README.md`, `PRODUCT.md` |
| What exactly should feature X do? | `docs/specs/*.md` (numbered, one per area) |
| What do I work on next? | `docs/PLAN.md`: the first unchecked task |
| Why was it built this way? | `docs/DECISIONS.md` |
| How should it look? | `DESIGN.md` |

The specs are the contract. If the code and the spec disagree, the spec wins. Do not change behaviour a spec
defines without updating that spec **in the same commit** and adding a `DECISIONS.md` entry.

## Repo layout (after task T0.1)

```
corral-core/            the one Theia extension: all Corral code
  src/common/           pure logic + RPC protocol. No DOM, no Node APIs. Unit-tested.
  src/node/             backend: herdr CLI client, project scanner, stores. Integration-tested against real herdr.
  src/browser/          frontend: widgets, contributions, theme. Thin; logic lives in common/.
  test/                 jest config + shared test helpers
browser-app/            Theia browser target: used for dev and Playwright E2E
electron-app/           Theia electron target: the shipped Corral.app
e2e/                    Playwright tests (against browser-app)
branding/               icon.svg / favicon.svg masters; generated/ is produced by scripts/make-icons.sh
docs/                   specs, plan, decisions
```

## Commands

| Purpose | Command |
|---|---|
| Install | `npm install` (root; npm workspaces) |
| Build the extension | `npm run build -w corral-core` |
| Unit tests | `npm test` |
| Integration tests (real herdr) | `npm run test:int` |
| E2E (Playwright + browser-app) | `npm run test:e2e` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Run in the browser (dev) | `npm run build:browser && npm run start:browser`, then open http://127.0.0.1:3000 |
| Run Electron (dev) | `npm run build:electron && npm run start:electron` |
| Package Corral.app | `npm run package:mac` |
| Regenerate icons | `./scripts/make-icons.sh` |

Task T0.2 creates these scripts. Until they exist, do T0.1 and T0.2 first.

## How to work: TDD, one task at a time

1. Take the **first unchecked task** in `docs/PLAN.md`. Never skip ahead; tasks depend on earlier tasks.
2. Read the spec sections the task links to.
3. **Red:** write the tests the task lists. Run them and watch them fail for the right reason.
4. **Green:** write the minimum code that passes.
5. **Refactor** with the tests still green. Then run the task's full *Verify* block.
6. Tick the task's checkbox, add one line to the Progress log at the end of `PLAN.md`, then commit:
   `git add -A && git commit -m "T<id>: <summary>"`.

The full loop is in `.claude/skills/next-task/SKILL.md`. The test layers are in `docs/specs/08-testing.md`.

## Hard rules

- **Never touch the user's live herdr session.** Tests and E2E runs use a named session (`corral-test-*`) started
  headless by the test helpers. Never run `herdr server stop`, `herdr session stop` or `herdr session delete` on
  `default`. Never close workspaces, tabs or panes that Corral did not create.
- **Call herdr without a shell.** Use `execFile` with an argument array; never `exec` or a shell string. Folder
  paths can contain spaces, quotes and `$`. The one exception is the fixed login-shell lookup in
  `node/herdr-binary.ts` (spec 04), which takes no user input.
- **Keep logic in `src/common/`** as pure functions/classes with unit tests. Widgets only wire things together.
- **Check Theia APIs before using them.** Theia changes between minor versions. Before you call any Theia API,
  open its `.d.ts` in `node_modules/@theia/<pkg>/lib/...` (or query the Context7 MCP) and code against what's
  really there. Never guess a signature.
- **No new runtime dependencies** unless a spec names them or a `DECISIONS.md` entry justifies them.
- **Don't disable, skip or weaken a failing test** to get green. Fix the code, or stop and report.
- **If you're blocked after 3 honest attempts,** mark the task `[!]` in `PLAN.md` with a one-paragraph note (what
  you tried, what failed, the exact error) and stop.
- **Don't push.** Commit locally only.

## Code style

- TypeScript strict (`strictNullChecks`, `noImplicitAny`), following the generator's tsconfig. 4-space indent,
  single quotes, as in Theia's own code.
- Theia DI: `@injectable()` classes, bound in `corral-frontend-module.ts` / `corral-backend-module.ts`.
- Name files `kebab-case.ts`; tests sit next to their subject as `*.test.ts` (unit) or `*.int.test.ts` (integration).
- Comments explain *why*, not *what*. No commented-out code.
- CSS: only the tokens in `DESIGN.md` (as `--corral-*` variables). No hard-coded colours in components.
