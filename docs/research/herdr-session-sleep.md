# Research: sleeping idle herdr agent panes and waking them on focus

Date: 2026-09-30. herdr source read at tag `v0.9.1` (commit `065ef9d`), which is the installed version. `H/` below
means `https://github.com/herdrdev/herdr/blob/v0.9.1/`.

## Short answer

**Partly, and mostly for RAM.** herdr 0.9.1 has no sleep/hibernate feature, but it already has the pieces for one:
per-pane native agent session ids, an `agent start --pane` command, and a `pane.focused` event. The approach that
works is **kill and resume**: stop the idle agent, keep the pane, and on focus run `claude --resume <id>`. The
conversation comes back. Running tools, background shells and the exact screen do not. A third-party herdr plugin
already does this over the CLI. Pausing processes with SIGSTOP saves almost nothing (idle agents barely use CPU)
and breaks herdr's session tracking. Recommendation: don't build a Corral feature yet (details in §5).

## 1. What herdr already has

- **No suspend or hibernate.** Searching the source for suspend/hibernate/SIGSTOP/SIGCONT finds only unrelated
  Windows process-spawn code and SSH-bridge idle timeouts (`H/src/platform/windows.rs:961`,
  `H/src/platform/remote_bridge.rs:8`).
- **Idle memory work already exists inside herdr.** It compresses idle terminal scrollback (libghostty-vt), 250 ms
  after output settles (`H/src/pane.rs:66`, `:1079-1230`; CHANGELOG 0.9.1: "Idle terminal scrollback now uses less
  memory", #3556). This shrinks herdr's own process, not the agent processes.
- **Agent status:** the API reports `idle | working | blocked | done | unknown` (`H/src/api/schema/common.rs:160`).
  herdr works these out by pattern-matching the bottom of each pane's screen (`H/src/detect/mod.rs:1-20`), or from
  integration hooks where they exist. `done` means idle and not yet seen by the user (`herdr --skill`, line 59).
- **Native session identity:** the Claude integration's `SessionStart` hook reports `session_id` and
  `transcript_path` to herdr through `pane.report_agent_session`
  (`H/src/integration/assets/claude/herdr-agent-state.sh:54-82`). Panes then expose `agent_session` in `pane get`,
  `pane list`, `agent get` and `agent list` (`H/docs/next/website/src/content/docs/cli-reference.mdx:296`).
  **herdr clears it when the agent process exits** (`H/src/terminal/state.rs:314-511`). So a sleeper has to record
  the id *before* it stops the agent.
- **Resume after a server restart (not while idle):** `[session] resume_agents_on_restore = true` is the default
  (`H/src/config/model.rs:266-278`). herdr saves the per-pane `agent_session`, `cwd` and `launch_argv`
  (`H/src/persist/snapshot.rs:98-110`). On restore it spawns a fresh shell and types the resume command into it
  (`H/src/app/agent_resume.rs:205-285`). The mapping is `claude --resume <id>`, `codex resume <id>`,
  `opencode --session <id>` and others (`H/src/agent_resume.rs:136-250`). Gemini has no mapping. Restore starts
  agents in every pane eagerly, "without waiting for each pane to be focused"
  (`H/docs/next/website/src/content/docs/session-state.mdx:65`). Agent panes do not get their old screen back;
  the agent redraws its own history (`H/src/persist/restore.rs:739-782`). Shell panes get their screen back only with
  `[experimental] pane_history = true` (`session-state.mdx:47`).
- **Observability:** `events.subscribe` streams `pane.focused`, `tab.focused`, `workspace.focused` and
  `pane.agent_status_changed` (`H/src/api/schema/events.rs:18-84`). `pane.focused` reports manual selection from
  any client (`socket-api.mdx:828`). The only way to get this stream is the raw Unix socket (JSON lines). The CLI
  has no `subscribe` command; `herdr api --help` lists only `snapshot` and `schema`. `pane process-info` returns the
  shell pid, the foreground process-group id and the foreground processes (`socket-api.mdx:243`). `herdr agent start
  <name> --kind KIND --pane ID [-- args]` starts an agent in an existing idle-shell pane (`cli-reference.mdx:341-350`).
- **Things that look relevant but aren't:** `pane release-agent` does **not** stop the agent process. It only ends
  a hook source's lifecycle authority (`cli-reference.mdx:294`). A user confirmed this in
  https://github.com/herdrdev/herdr/discussions/631. There is also no `last_activity` timestamp on panes; a request
  for one is open at https://github.com/herdrdev/herdr/discussions/3619.
- **Upstream status:** two feature issues asking for this, #630 and #1818, were auto-closed as "not planned"
  because feature requests belong in Discussions, not issues. The open discussions are #631 (auto-hibernate),
  #1829, #2128 (lazy/unloaded tabs) and #3077 and #1841 (lazy restore). No maintainer has replied. Related: v0.9.2
  now starts restored agents one at a time, 100 ms apart, set by `startup_per_agent_delay_ms` (#4102, CHANGELOG 0.9.2).
- **Existing implementations:**
  - `dalogax/herdr-agent-hibernate` (MIT, herdr ≥ 0.9.0, pushed 2026-09-28). It polls `herdr agent list` and
    sleeps panes that are `idle`/`done` and unfocused for 30 minutes. It stops Claude/OpenCode with SIGTERM and
    Codex by typing `/quit`. On `pane.focused` it runs `herdr agent start … -- --resume <id>`
    (https://github.com/dalogax/herdr-agent-hibernate README; discussion #4724).
  - `prabhatgmp/herdr-park` does the same on demand, with an Enter-to-resume stub (discussion #1829).
  - Both authors say a plugin cannot keep the pane's sidebar badge.

## 2. Candidate mechanisms

**a. SIGSTOP/SIGCONT on the pane's process group: not recommended.**
- SIGSTOP cannot be caught; SIGCONT resumes the process (`man 3 signal`).
- It frees CPU only, and idle agents barely use any: `ps` on this machine showed 13 idle `claude` processes at
  0-2.5 % CPU and 140-420 MB RSS each.
- Corral starts the agent with `pane run`, which types it into the pane's interactive shell
  (`corral-core/src/node/herdr-cli.ts:72`), so the agent is a shell job. Under POSIX job control, when the
  foreground job stops the shell takes the terminal back (zsh `man zshmisc`, JOBS). A bare SIGCONT then leaves the
  agent in the background, where it stops again on its first terminal read (SIGTTIN). Waking it would mean
  typing `fg`. (UNVERIFIED end to end in herdr; this is inferred from job-control rules.)
- herdr drops a Claude pane's saved session id when another process briefly takes the foreground, including
  Ctrl-Z/`fg` (open issue #1647; duplicate #4127). A stopped pane would then restore as a bare shell.
- Stopping the group also stops Claude's MCP child processes if they share it. HTTP/streaming connections may
  time out while stopped. (UNVERIFIED.)
- RAM only moves to compressed memory or swap under memory pressure. (macOS memory compression: UNVERIFIED, no
  primary source read.)

**b. Kill and resume: the viable mechanism.**
- Getting the session id reliably: read `agent_session.value` from `herdr pane get` while the agent is alive (needs
  `herdr integration install claude`). Claude's own hook input also carries `session_id`/`transcript_path`.
- Transcripts live at `~/.claude/projects/<project>/<session-id>.jsonl`. They are kept for 30 days by default
  (`cleanupPeriodDays`). `--resume <id>` finds the id from any directory
  (https://code.claude.com/docs/en/sessions).
- Kept on resume: the full conversation including tool calls and results, the model, the permission mode (except
  `bypassPermissions` and `plan`, which revert to the default mode), the agent, the active goal, and scheduled tasks.
- Lost on resume: "Background Bash and monitor tasks aren't" restored. Flags such as `--mcp-config`,
  `--settings`, `--add-dir` and `--plugin-dir` must be passed again. A tool that was mid-run is marked cut off
  (same page).
- Resuming a session idle for more than about an hour with over 100k tokens re-processes the whole history once,
  because the prompt cache has expired. That is a real cost on every wake (same page, "Resume from summary").
- "If you resume the same session in two terminals … messages from both interleave." Waking must never start a
  second copy (same page).
- Terminal scrollback of the old process is lost; Claude redraws the conversation itself.
- Other agents:
  - Codex: `codex resume <SESSION_ID>`, or `--last` scoped to the cwd
    (https://learn.chatgpt.com/docs/developer-commands?surface=cli). Codex's storage path is not documented there.
  - Gemini: `gemini --resume <id|index>`; sessions live in `~/.gemini/tmp/<project_hash>/chats/`
    (https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/session-management.md). herdr has no
    Gemini session reporting, so there is no reliable id source. (UNVERIFIED alternative.)
  - opencode: `opencode --session <id>`, per herdr's mapping only. (opencode docs UNVERIFIED.)
- How to stop the agent: the hibernate plugin uses SIGTERM for Claude, not typing `/exit`. Typing `/exit` would
  append it to any unsent draft and submit that as a real prompt (plugin README, "Why a signal").

**c. herdr-level recreation.** `layout.apply` rebuilds structure, labels, cwd and argv. It "does not preserve live
PTYs, scrollback, or running processes" (`socket-api.mdx:259-263`). Across server restarts herdr keeps the layout,
and keeps agents only through native resume (`session-state.mdx`, "What survives" table). Keeping the pane (b) is
simpler than recreating it.

**d. OS-level.** Linux cgroup v2 `cgroup.freeze` stops every process in a cgroup
(https://docs.kernel.org/admin-guide/cgroup-v2.html). It is not a signal, so the shell doesn't notice it. It is
Linux-only, and Corral ships on macOS. App Nap applies to GUI apps; whether it affects PTY children of the Theia
Electron app is UNVERIFIED.

## 3. Where it should live

- **Upstream herdr (best).** herdr already has everything a native version needs. A terminal can exist without a
  running runtime but with a `pending_agent_resume_plan`; that is exactly how restore defers launches
  (`H/src/app/agent_resume.rs:158-203`). A native `pane hibernate` would drop the runtime, keep the plan, and start
  it on first focus or visibility instead of eagerly. That would also keep the sidebar badge and dedupe resumes.
  Proposed shape:
  - `herdr pane hibernate|wake <pane>`
  - a `hibernated` agent status
  - `last_output_at` / `state_changed_at` fields (#3619)
  - optional `[session] hibernate_idle_minutes`, off by default
  - `[session] lazy_restore` (#3077)

  Post this on discussion #631, not as an issue; issues are for bugs only.
- **Corral-side, over the CLI:**
  - This is only possible within Corral's hard rules (AGENTS.md: never touch panes Corral didn't create).
  - Corral persists only `workspaceId` per project (`docs/specs/04-herdr-integration.md`, "Workspace mapping"),
    and users can open their own tabs inside those workspaces. So Corral would have to record the pane ids it
    created (`openTab` returns `paneId`) and sleep only those.
  - It runs in the user's `default` session, so the Corral-created-panes-only rule matters there.
  - Subscribing to `pane.focused` needs a Node `net` client on the herdr socket. That is stdlib, not a new
    dependency, but it is a new protocol surface next to the CLI-only rule in spec 04.
- **Installing the plugin yourself** is zero Corral code, but it applies to *every* pane in the session. That's the
  user's choice to make; Corral must not install it for them.

## 4. Safety

- **Choosing what to sleep:**
  - Sleep only when the status is exactly `idle`/`done`, the pane is unfocused, and it has been quiet past a
    threshold.
  - Re-check the status immediately before stopping.
  - Never sleep `working`, `blocked` (waiting for approval or a question) or `unknown`.
  - Screen detection can misread. herdr's changelog is full of fixes where Claude showed idle while it was actually
    working, and "an idle prompt with only a background shell running" counts as idle (CHANGELOG 0.9.1). An idle
    Claude can therefore still own background Bash tasks, and killing it ends them for good. A sleeper should
    skip panes whose `process-info` shows child processes other than MCP servers. (That heuristic is UNVERIFIED.)
- **Record before stopping:** save the session id first (herdr clears it on exit). Confirm the agent actually exited
  before recording the pane as asleep. Never wake a pane twice (the interleaving risk above).
- **Waking:**
  - Triggers are `pane.focused`, `tab.focused`, or Corral's own `+`/reveal action.
  - Waking takes 10-20 s according to one user report (discussion #1829).
  - `agent start` requires the pane's shell to hold the foreground (`cli-reference.mdx:348`).
- **Failure modes:**
  - The transcript was pruned after 30 days.
  - Launch flags were lost; herdr's `launch_argv` helps, and there is an open request for this (#632).
  - The user typed into the sleeping shell.
  - Codex was stopped by typed `/quit` and submitted an unsent draft.

## 5. Recommendation and effort

1. **Now (about 0.5 day, docs only):** document the herdr-agent-hibernate plugin as an opt-in the user installs
   themselves. It is two days old and has no stars, so test it on a named session first.
2. **Upstream (preferred long-term):** post the native-hibernate shape above on discussion #631. Implementation in
   herdr: roughly 3-5 days for someone familiar with the codebase. (That estimate is UNVERIFIED; it's a guess from
   the code size.)
3. **Corral-native (only if upstream declines): about 4-6 days.**
   - Pane-ownership store: 0.5 d.
   - Pure idle-policy module plus unit tests: 1 d.
   - Socket event client: 1 d.
   - Sleep/wake orchestration plus integration tests against a `corral-test-*` session: 1.5-2 d.
   - Spec 04 update and a DECISIONS entry: 0.5 d.

   Claude only at first.

Skip SIGSTOP.

## Open questions

- Does herdr's maintainer want native hibernation? None of the discussions has a maintainer reply.
- How much memory do Claude's MCP children use per pane here? The 140-420 MB above excludes children and
  compressed pages.
- Is the cost of re-processing history on wake (cache expiry) acceptable to the user?
- Should Corral's rule "never touch panes Corral didn't create" cover stopping (not closing) an agent in a
  Corral-created pane? Needs a DECISIONS entry.
- Gemini/opencode session-id sources: UNVERIFIED.

## Evaluation of dalogax/herdr-agent-hibernate (read at commit 50c29cb, 2026-09-30)

Source was read, not run. Running its test suite was not permitted in this session.

**Good:**
- The code is careful and small: `bin/hibernate.js` is 618 lines, uses only the Node standard library, and calls herdr with argv arrays through `spawnSync`, never a shell string.
- It sleeps only agents whose state is `idle` or `done`, and never the focused pane.
- It re-checks the state just before stopping the agent.
- It records a sleeper only after the agent has actually exited (15 s timeout).
- A per-pane wake lock stops several focus events from starting the agent twice.
- It stops Claude Code and OpenCode with SIGTERM rather than typing `/exit`, which avoids an unsent draft being submitted as a prompt.
- Tests run against a fake herdr, with CI. The licence is MIT.

**Gaps for Corral:**
1. **No child-process guard.** An idle agent that is still running a shell (a background Bash task, or a dev server started through the agent) is sent SIGTERM, and that kills the shell's work.
   - The guard needed: walk the agent's process tree (`herdr pane process-info` plus `ps -o pid,ppid,comm`) and skip the pane if any shell descendant (`sh`, `bash`, `zsh`, `fish`) exists.
   - MCP server children are ignored by this guard.
2. **Scope.** It acts on every agent pane in the herdr session. Corral runs in the user's default session, so it would also sleep panes Corral didn't create, which breaks AGENTS.md's hard rule if Corral ships or installs it.
3. **Codex `/quit`** submits any unsent draft, so exclude Codex with `HIBERNATE_AGENTS=opencode,claude`.
4. **Trust.** It is a single-author repo a few days old, and herdr plugins run unsandboxed as the user. If installed, pin a commit with `--ref`.

**Status flags.** herdr already reports `agent_status` per agent pane: `working`, `blocked`, `idle`, `done`, `unknown` (`herdr agent list`, as used by the plugin's `normalizeAgent`). "Sleeping" can be read from the plugin registry. Corral doesn't read any of this yet: `corral-core/src/node/herdr-cli.ts` has no agent calls.
