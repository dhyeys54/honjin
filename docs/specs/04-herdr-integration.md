# 04 — herdr integration

herdr 0.9.1 (protocol 22). The installed binary is the authority for syntax. Run `herdr <group>` with no
subcommand to print a group's usage; never probe a mutating command by leaving out its arguments. `herdr --skill`
prints herdr's own agent guide.

## Facts verified against herdr 0.9.1

- `herdr [--session S] <cmd>`: every control command accepts the global `--session`. With no `--session` it uses
  the default session (socket `~/.config/herdr/herdr.sock`).
- `herdr --session S server` runs a **headless** server in the foreground. `herdr --session S server stop` stops it,
  and `herdr session delete S` removes its directory. Integration tests use this.
- `herdr` (no args) launches or attaches the TUI and starts the server if it isn't running. This is what the
  Corral terminal widget runs.
- Control commands print JSON on stdout and exit 0. Server errors print JSON on **stderr** and exit 1; CLI syntax
  errors exit 2. For example, when the server isn't running:
  `{"id":"cli:workspace:list","error":{"code":"server_not_running","message":"…"}}`.
- `herdr status server --json` prints `{"status":"running"|"not_running","running":bool,"version":…,"protocol":…,"socket":…}`.
  It is plain JSON with no `result` wrapper, and it works when the server is down.
- `herdr workspace create --cwd P --label L --no-focus` returns
  `.result.workspace.workspace_id`, `.result.tab.tab_id` and `.result.root_pane.pane_id` (`root_pane.cwd` is the
  resolved cwd).
- `herdr workspace get W` returns `.result.workspace`. An unknown id returns an error JSON with exit 1.
- `herdr workspace list` returns `.result.workspaces[]` with `workspace_id`, `label`, `focused` and
  `agent_status`. It has **no cwd**, which is why Corral persists the mapping.
- `herdr workspace focus W` focuses a workspace.
- `herdr tab create --workspace W --cwd F --label L --focus` returns `.result.tab.tab_id` and
  `.result.root_pane.pane_id`.
- `herdr pane run <PANE_ID> <COMMAND>`: sends the command text plus Enter in one call. Pass the command as a single
  argv element.
- IDs are opaque (`w1`, `w1:t1`, `w1:p1`) and are never reused after close.
- `agent_status` is one of `idle | working | blocked | done | unknown`.
- Default keys (`~/.config/herdr/config.toml` can override them; the user's file has no overrides as of
  2026-09-29): prefix `ctrl+b`, detach `prefix+q`, new tab `prefix+c`, new workspace `prefix+n`, help `prefix+?`.

## `node/herdr-cli.ts`

```ts
// Injectable seam for unit tests. Resolves on any exit code; rejects only on spawn failure (ENOENT) or timeout.
type ExecFileFn = (file: string, args: string[], opts: { timeoutMs: number }) =>
    Promise<{ stdout: string; stderr: string; exitCode: number }>;
interface HerdrCliOptions { binary: string; session?: string; timeoutMs?: number /* default 10000 */ }
class HerdrError extends Error { code: string; exitCode: number; stderr: string; }
class HerdrCli {
    constructor(opts: HerdrCliOptions, execFileFn?: ExecFileFn /* injectable for unit tests */);
    status(): Promise<{ running: boolean; version: string | null; protocol: number | null }>;
    createWorkspace(cwd: string, label: string): Promise<{ workspaceId: string; tabId: string; paneId: string }>;
    getWorkspace(id: string): Promise<{ workspaceId: string; label: string } | undefined>; // undefined on not-found
    focusWorkspace(id: string): Promise<void>;
    createTab(workspaceId: string, cwd: string, label: string): Promise<{ tabId: string; paneId: string }>;
    runInPane(paneId: string, command: string): Promise<void>;
}
```

- Always call `execFile(binary, [...(session ? ['--session', session] : []), ...args])`. **Never use a shell.**
- Parse stdout as JSON. On exit 1, parse the stderr JSON and throw `HerdrError` with `code = error.code`. On exit 2
  or unparseable output, use `code = 'cli_error'`. On timeout, use `code = 'timeout'`. On ENOENT, use
  `code = 'not_found'`.
- Unit tests inject a fake `execFileFn` and assert the **exact argv** of every method, including paths containing
  spaces, quotes and `$`. Integration tests run every method against a real headless session.

## Resolving the binary: `node/herdr-binary.ts`

An app launched from Finder has a minimal `PATH`. Resolve the binary in this order:
1. The preference `corral.herdr.path`, if it is an absolute path to an existing executable.
2. The `PATH` lookup of `corral.herdr.path` (default `herdr`).
3. The candidates `~/.local/bin/herdr`, `/opt/homebrew/bin/herdr`, `/usr/local/bin/herdr`.
4. `execFileFn($SHELL, ['-lc', 'command -v herdr'])` (login shell), with a 3s timeout. The script is a fixed
   string with no user input; this is the one allowed shell use (AGENTS.md §Hard rules).

Cache the result per value of `corral.herdr.path`. If nothing is found, return `undefined`; the terminal widget
then shows its "not found" overlay.

## Effective session

`effectiveSession = process.env.CORRAL_HERDR_SESSION || preference corral.herdr.session || ''` (empty means
herdr's default session). The env variable exists so E2E and dev runs never touch the user's live session.

## Workspace mapping

`node/workspace-map-store.ts` persists `{ [projectPath]: { workspaceId, session } }` as JSON in
`<configDir>/herdr-workspaces.json`. Write atomically (temp file + rename) and tolerate a missing or corrupt file
(treat it as empty and log a warning). Entries are keyed by project path **and** session, so switching sessions
never reuses the wrong id.

`common/workspace-resolution.ts` (pure) decides between:
- `{ kind: 'reuse', workspaceId }`: the mapping has an id and `getWorkspace(id)` found it.
- `{ kind: 'create' }`: no mapping, or the mapped workspace no longer exists. Then create it with
  `--cwd <folderPath> --label <project name>` (the clicked folder, so the first tab opens where the user clicked)
  and store the new id under the project path.

Corral **never adopts** a herdr workspace it didn't create, even when the labels match. This avoids hijacking the
user's existing workspaces.

## The open-tab flow: `CorralHerdrService.openTab(req)`

```ts
interface OpenTabRequest { projectPath: string; folderPath: string; command: string /* may be '' */ }
interface OpenTabResult { workspaceId: string; tabId: string; paneId: string; createdWorkspace: boolean }
```

1. `status()`. If the server isn't running, throw `HerdrError('server_not_running')`.
2. Resolve the workspace (above).
3. If a workspace was just created, its root tab **is** the new tab: use `root_pane` and skip step 4.
4. Otherwise run `createTab(workspaceId, folderPath, basename(folderPath))`.
5. `focusWorkspace(workspaceId)`.
6. If `command.trim()` isn't empty, run `runInPane(paneId, command)`.

Calls are **serialised per project path** (a promise chain keyed by path), so a double click never creates two
workspaces. Unit-test this with a fake cli.

**Frontend side** (`corral.herdr.newTab` command handler):
1. Resolve the owning project with `owningProject()` from `common/startup-command.ts` (spec 05, path-boundary rule).
2. Compute the command (spec 05).
3. Call `openTab`, then reveal and activate the herdr terminal widget.
4. If the call fails with `server_not_running`: focus the herdr terminal. If the widget isn't running, (re)create it,
   wait until `status()` reports running (poll every 250ms, 5s max), then retry once. On any other error, show a
   notification with the herdr message and an **Open herdr** action.
