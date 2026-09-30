# Plan: Corral agent hibernate (a herdr plugin forked from dalogax/herdr-agent-hibernate)

Background: `docs/research/herdr-session-sleep.md`, especially its final "Evaluation" section. The repo's rules
in `AGENTS.md` apply in full.

## Goal

An idle agent pane that Corral created is stopped after a quiet period, which frees its RAM. It keeps its pane and
its session id. When the user focuses that pane again, the same conversation resumes.

Two things are never slept:
- an agent that is still running a shell (a background task, or a dev server it started);
- any pane outside a Corral workspace.

## Constraints

- **Fork, don't rewrite.** Upstream is `https://github.com/dalogax/herdr-agent-hibernate` at commit `50c29cb`.
  Clone it into your scratchpad. Copy files only; don't run upstream's code before it's in the repo.
  - Copy `bin/`, `test/`, `herdr-plugin.toml`, `package.json`, `LICENSE` and `README.md` into `herdr-plugin/` at
    the repo root.
  - Leave out `demo/`, `.github/` and `.git`.
  - Keep the upstream MIT `LICENSE` unchanged. Add an "Origin" line to the README naming the upstream repo and commit.
- **Keep it Node standard library only, JavaScript, with no build step.** It is not an npm workspace, so don't add it
  to the root `package.json` `workspaces`.
- **Plugin id:** `corral.agent-hibernate`, name "Corral Agent Hibernate". This lets it coexist with the upstream
  plugin, and it keeps its own state dir.
- **Call external commands without a shell.** Call `herdr` and `ps` only through `spawnSync`/`execFile` with an
  argv array, as upstream already does.
- **Fail closed everywhere.** If the Corral map is missing, unreadable or corrupt, or a pane's workspace can't be
  determined, or `ps` fails, then do not sleep. Log the reason instead.
- **Never touch the user's live herdr.** Don't run `herdr plugin link`/`install`, and don't run any herdr command
  that changes state against `default`. Tests use a fake herdr and a fake `ps` only.
- **Don't change `corral-core`.** This work is only the plugin, plus docs.
- **Out of scope:**
  - Working/done status badges in Corral (a separate future task).
  - Keeping a pane awake because a *neighbouring* shell pane is busy.
  - Sending the guard upstream as a pull request (the founder does that).
  - Windows.

## What to implement

1. **Import** the upstream files as above. Rename the plugin id, the name and the `PLUGIN_ID` constant in
   `bin/hibernate.js`. Commit that on its own ("import upstream at 50c29cb"), so the diff that follows shows only
   Corral's changes.

2. **Default agent set:** `HIBERNATE_AGENTS` defaults to `opencode,claude`. Codex's `/quit` submits any unsent
   draft. Codex can still be opted in through the env var, and its README warning stays.

3. **Scope guard: Corral workspaces only.**
   - Read `${CORRAL_CONFIG_DIR:-$HOME/.corral}/herdr-workspaces.json`. Its shape is
     `{ [projectPath]: { workspaceId, session } }` (spec 04, `corral-core/src/node/workspace-map-store.ts`).
   - Allowed workspaces are the `workspaceId`s whose `session` matches the plugin's session. Corral writes `""` for
     the default session, and the plugin calls it `"default"`, so normalize both.
   - Get each pane's workspace from a herdr field (for example `workspace_id` on `herdr pane list` or
     `herdr agent list` entries). Confirm the field exists with `--help` or the herdr source first. Parse the
     `w1:p2` id format only if no field exists, and if you do, record that in D39.
   - Apply the guard in `assertSleepable`, so it covers both the watcher and the manual `sleep-pane` action.
   - Re-read the map on every poll, because Corral adds workspaces at run time.

4. **Shell guard: keep the agent awake while it has a running shell.**
   - After finding the agent's pid (`agentPid`), list processes with `ps -A -o pid=,ppid=,comm=`. The `ps` path can
     be overridden with `HIBERNATE_PS_PATH`, for tests.
   - Walk the agent's descendants. If any descendant's basename is in
     `{sh, bash, zsh, fish, dash, ksh, tcsh, nu}`, refuse to sleep: `"<pane> has a running shell (<name> pid N)"`.
   - Other children (MCP servers under node or python) don't block sleep.
   - In the watcher, a pane blocked by this guard gets its idle clock reset, so it sleeps a full window after the
     shell ends, never immediately.
   - **Check this first:** does an *idle* `claude` or `opencode` always keep a shell child, for example a
     persistent Bash-tool shell? Check with `ps` in a `corral-test-*` session you started yourself. If one always
     exists, the guard as written never lets that agent sleep. In that case, stop and report rather than inventing
     an exception.

5. **Tests** (`node --test`, extending upstream's `test/fake-herdr.js`, plus a new `test/fake-ps.js` driven by the
   same state file):
   - A pane outside the Corral map is never slept, whether by the watcher or by `sleep-pane`.
   - A pane in the map is slept and then resumed on focus. This is upstream's happy path, re-scoped.
   - The map is missing, corrupt, or has a session mismatch: nothing is slept.
   - The agent has a `zsh` descendant: not slept. After that descendant exits, it sleeps only after a full idle
     window.
   - The agent has only a `node` child (an MCP server): it is slept.
   - `ps` fails: not slept.
   - Codex is not slept by default, and is slept when `HIBERNATE_AGENTS` includes it.
   - All the upstream tests still pass, adjusted only for the new scope. Don't weaken any assertion.

6. **Docs, in the same commit as the behaviour:**
   - A new `docs/specs/11-agent-hibernate.md`, a short spec covering sleep conditions, scope, the shell guard, wake,
     config env vars and state dir, and the install steps below.
   - `docs/DECISIONS.md` D39: forking rather than installing upstream, scoping by the Corral map, the shell guard,
     Codex off by default. Also: sleeping a user-added pane *inside* a Corral workspace is allowed, because sleep
     is not close and the agent resumes.
   - A `herdr-plugin/README.md` section "Corral changes".
   - One line in the `docs/PLAN.md` Progress log.

7. **Root script:** add `"test:plugin": "node --test herdr-plugin/test/"` to the root `package.json`. If
   `npm run lint` picks up `herdr-plugin/`, either make it pass or add `herdr-plugin/**` to the eslint ignores,
   the same way `plugins/**` is ignored.

## Human checkpoint (the founder does this, not the implementing model)

Try it on a scratch Corral project before any real use. Take the exact `plugin link` and action syntax from
upstream's README and `herdr plugin --help`, since the lines below are a sketch:
```sh
herdr plugin link ./herdr-plugin     # registers machine-wide; the scope guard limits it to Corral workspaces
HIBERNATE_IDLE_MINUTES=1 herdr plugin action invoke ensure-watcher --plugin corral.agent-hibernate
```
Then check each of these:
- An idle Claude pane in a Corral workspace sleeps after about 1 minute and resumes on focus.
- A pane running `sleep 600 &` via the agent stays awake.
- A non-Corral workspace is never touched.

To turn it off: `herdr plugin disable corral.agent-hibernate`.

## Done when

- `npm run test:plugin` passes (all upstream tests plus the new ones). `npm test`, `npm run lint` and
  `npm run typecheck` are still green.
- `herdr-plugin/` contains the fork with the upstream LICENSE and the Origin line.
- Spec 11, D39, the README section and the Progress-log line are written, and `git diff <import-commit>..HEAD`
  shows only Corral's changes.
- Nothing ran against a live herdr session.
- Two commits exist: the upstream import, then `Agent hibernate: Corral-scoped fork with shell guard (D39)`. Do not
  push.
