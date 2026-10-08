# 11 — Agent hibernate (herdr plugin)

Idle Claude Code / OpenCode agents in Honjin's herdr panes are stopped after a quiet period to free their memory,
and resumed in the same pane, same conversation, when the user focuses the pane again. It is a herdr plugin in
`herdr-plugin/`, forked from `dalogax/herdr-agent-hibernate` at `50c29cb` (MIT), so it keeps working when Honjin is
closed (D39). Honjin itself has no code for it and does not depend on it.

## Rules (the contract)

| # | Rule |
|---|---|
| R1 | **Sleep condition.** A pane is slept only when all of these hold at the moment of sleeping: its agent kind is in `HIBERNATE_AGENTS` (default `opencode,claude`; Codex is opt-in because its typed `/quit` submits an unsent draft); its state is `idle` or `done` for at least `HIBERNATE_IDLE_MINUTES` (default 30, clock restarts on any state change); it is not focused (the manual `sleep-pane` action may sleep the focused pane); it has a native session id; R2 and R3 pass. |
| R2 | **Scope.** Only panes in a workspace listed in `${HONJIN_CONFIG_DIR:-~/.honjin}/herdr-workspaces.json` whose `session` equals the plugin's `HERDR_SESSION` (`""` in the map = `default`). The pane's workspace comes from `herdr pane list` (`result.panes[].workspace_id`; the same field Honjin's own `HerdrCli.listPanes` reads, spec 10, and not yet checked by the plugin against a real herdr: the founder does that in the install check). A missing, unreadable, non-object or empty map, or an unknown workspace, means nothing is slept; the reason is logged. The map is re-read every poll. Applies to the watcher and to `sleep-pane`. |
| R3 | **Shell guard.** The agent process is found as upstream does (`herdr pane process-info`). `ps -A -o pid=,ppid=,comm=` (argv, no shell; `HIBERNATE_PS_PATH` overrides the binary) is walked for descendants of that pid. If any has a basename (leading `-` stripped) of `sh bash zsh fish dash ksh tcsh nu`, the pane is not slept. Other descendants (MCP servers, node, npm) do not count. If `ps` fails or the agent pid is unknown, nothing is slept. The watcher runs the check on every poll for every idle, unfocused, in-scope agent (not only when the window expires), and a blocked pane restarts its idle clock, so it sleeps a full window after the shell was last seen. The check runs again right before sleeping. |
| R4 | **How it sleeps and wakes** is unchanged from upstream: SIGTERM (Codex: typed `/quit`), recorded in `registry.json` only after the agent is verified gone, and resumed on `pane.focused` with the agent's native resume argv (`claude --resume <id>`, `opencode -s <id>`, `codex resume <id>`). Wake is not scoped: only panes the plugin slept are in the registry. |
| R5 | **State.** `~/.local/state/herdr/plugins/honjin.agent-hibernate/` (per named session under `sessions/<name>`): `registry.json`, `watcher.pid`, `watch.log`. |
| R6 | **Never** touches a pane outside R2, never closes a pane, workspace or tab, and calls `herdr` and `ps` only with argv arrays. |

## Install (by the user; Honjin does not do it)

```sh
herdr integration install claude          # session identity; and opencode if used
herdr plugin link <repo>/herdr-plugin     # or: herdr plugin install <repo> --ref <commit>
```

Turn off with `herdr plugin disable honjin.agent-hibernate`. The syntax above follows upstream's README; check
`herdr plugin --help` for the installed herdr version.

## Tests

`npm run test:plugin` (Node's built-in runner, no dependencies) runs upstream's tests plus scope and shell-guard
tests against `test/fake-herdr.js` and `test/fake-ps.js`. Nothing in them touches a real herdr session.

## Not covered

Status badges in the Projects tree, keeping a pane awake because a neighbouring pane runs a shell, Windows.
