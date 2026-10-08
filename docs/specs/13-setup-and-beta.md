# 13 — Setup, agent picker and beta plumbing

What a stranger needs to get from "downloaded Honjin" to "an agent is running in my project", plus the pieces that
make a public beta workable: a version label, a way to report problems, and a way to hear about new builds. Rule ids
(S1–S12) are cited by `docs/PLAN.md` Stage 8.

## Prerequisites

**S1 Catalog.** `common/prerequisites.ts` exports `PREREQUISITES: Prerequisite[]`, in this order:

| id | name | binary | role | install (verified 2026-10-08 against each vendor's docs) | extra candidates |
|---|---|---|---|---|---|
| `herdr` | herdr | `herdr` | required | `curl -fsSL https://herdr.dev/install.sh \| sh` | — |
| `claude` | Claude Code | `claude` | agent | `curl -fsSL https://claude.ai/install.sh \| bash` | — |
| `codex` | Codex | `codex` | agent | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | — |
| `gemini` | Gemini CLI | `gemini` | agent | `brew install gemini-cli` when `brew` is found, else `npm install -g @google/gemini-cli` when `npm` is found, else none | — |
| `opencode` | opencode | `opencode` | agent | `curl -fsSL https://opencode.ai/install \| bash` | `~/.opencode/bin/opencode`, `~/bin/opencode` |
| `git` | git | `git` | optional | `xcode-select --install` | — |

```ts
interface Prerequisite {
    id: 'herdr' | 'claude' | 'codex' | 'gemini' | 'opencode' | 'git';
    name: string; binary: string; role: 'required' | 'agent' | 'optional';
    docsUrl: string;
    install(found: { brew: boolean; npm: boolean }): string | undefined;  // undefined: no Install button, show docsUrl
    extraCandidates: string[];                                            // `~` expanded by the backend
}
```
Docs URLs: herdr.dev/docs/install, code.claude.com/docs/en/setup, github.com/openai/codex,
github.com/google-gemini/gemini-cli, github.com/sst/opencode, developer.apple.com/xcode/resources.

| S2 | **Detection.** `node/binary-resolver.ts` generalises `HerdrBinaryResolver` (spec 04 §Resolving the binary) to any binary from the catalog: `PATH`, then `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin` and the entry's `extraCandidates`, then the login shell `command -v <binary>`. `<binary>` comes only from the catalog constant, never from user input (D44). herdr keeps its `honjin.herdr.path` first step and its behaviour. A found binary's version is the first non-empty line of `execFile(path, ['--version'])` with a 5 s timeout, or `''` if that fails. **Misses are not cached**, so a re-check after an install finds the new binary. `/usr/bin/git` is a stub that opens an install dialog when the command line tools are missing, so it counts as found only when `/usr/bin/xcode-select -p` exits 0, and it is never run before that. With `HONJIN_TEST_PATH` set (E2E), only that `PATH` is searched, for herdr too (D50); the E2E links the real herdr there. |
|---|---|
| S3 | **State.** `setupState(found: Record<id, boolean>)` returns `'ready'` when herdr and at least one agent are found, `'needs-herdr'` when herdr is missing, else `'needs-agent'`. git never blocks. |
| S4 | **RPC.** `HonjinSetupService` (path `/services/honjin-setup`) has `check(): Promise<PrerequisiteStatus[]>`, where `PrerequisiteStatus = { id, found: boolean, path?: string, version: string, install?: string }`. |

## Setup view

| S5 | **Widget.** `SetupWidget` (`id = 'honjin-setup'`, label `Set Up Honjin`, icon `codicon codicon-tools`) opens in the **main** area. It has a heading and one row per catalog entry (`[data-testid="honjin-setup-row"][data-id="<id>"]`). A found row shows a check, the name and the version. A missing row shows the name, `Required`, `Agent` or `Optional`, and an **Install** button, or a **Docs** link when `install` is undefined. Above the rows, one line states the S3 state: `Ready. Click + on any folder to start an agent.`, `Install herdr to continue.` or `Install at least one agent.` A **Re-check** button runs `check()` again. |
|---|---|
| S6 | **Install.** Install opens a Theia terminal (`TerminalService.newTerminal`, title `Install <name>`) in the bottom panel that runs `/bin/zsh -lc "<install>"` (`common/install-script.ts`) with the S2 fallback folders appended to `PATH`, so a `brew` or `npm` that detection found there also runs (D51), then prints `Finished.` or `Failed (exit <n>).` and waits for Enter before the tab closes (Theia disposes a terminal when its process ends, which would hide the installer's output; D49). The command is the catalog string, never user input (D44). When that terminal's process exits or its tab closes, the view runs `check()` again. Honjin never installs anything without this click. |
| S7 | **When it opens.** At startup the frontend runs `check()`. If the state is not `ready`, it opens the Setup view and the first-run folder picker (spec 03) waits. When a check turns `ready`, the folder picker runs if first run is still pending, then a notification says `Click + on any folder to start an agent there.` The command `honjin.setup.open` (`Honjin: Set Up Prerequisites`) opens the view at any time. A **Continue anyway** link on the view lets the user skip to the folder picker. |

## Agent picker on +

| S8 | **Choice.** `common/agent-choice.ts` has `agentChoices(installed: AgentId[], commands: Record<AgentId,string>, last?: string, paths?: Record<AgentId,string>)`. It returns the installed agents in catalog order, each `{ id, label: name, command: commands[id] }`, then `{ id: 'shell', label: 'Shell', command: '' }`, with the `last` id first when present. When a command's first word is the agent's catalog binary name and `paths` has the path Setup found for it, that word becomes the path, single-quoted if it needs it: the pane's shell may not have the folder on its `PATH` (D51). Any other command runs as written. |
|---|---|
| S9 | **Flow.** When the folder's project has a `projectOverrides[path].startupCommand`, + runs it as before, with no picker. Otherwise: if exactly one agent is installed, + runs it with no prompt. If none are installed, + opens the Setup view. Otherwise a quick pick lists `agentChoices`, with the first item preselected, so + then Enter repeats the last choice. Escape cancels and no tab opens. The chosen id is stored in `localStorage` key `honjin.lastAgent`. The installed list is the last `check()` result, refreshed when the Setup view re-checks. |
| S10 | **Settings.** `honjin.agentCommands` (object, User scope) maps an agent id to its command, default `{ claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' }`, so users can add flags. The global `honjin.startupCommand` is removed (D44). The per-project `startupCommand` override stays. |

## Beta plumbing

| S11 | **Version and label.** The app version is `0.1.0-beta.1` in `electron-app/package.json`, `browser-app/package.json` and `honjin-core/package.json`. The window title's product name is `Honjin Beta`. About shows the version. **Help → Report an Issue** (`honjin.reportIssue`) opens, in the external browser, `https://github.com/dhyeys54/honjin/issues/new?template=bug.yml&body=<encoded>`. `issueBody(env)` (pure) builds the body from the Honjin version, macOS version, chip (`process.arch`) and the S4 versions of herdr and each found agent. It includes no paths or project names. |
|---|---|
| S12 | **Update check.** When `honjin.updates.check` (boolean, default true) is on, the frontend asks the backend 10 s after start and then every 24 h, and the backend GETs `https://api.github.com/repos/dhyeys54/honjin/releases/latest` (`latestRelease()` on S4's service) with no cookies or identifiers. If `compareVersions(tag, current) > 0`, the frontend shows one notification per new tag per session: `Honjin <tag> is available.` with **Copy update command** (copies the install one-liner from spec 07) and **Release notes** (opens the release URL). Network or parse errors are silent. `compareVersions` follows semver precedence, including pre-release identifiers (`0.1.0-beta.2 > 0.1.0-beta.1`, `0.1.0 > 0.1.0-beta.9`). |

No telemetry: S12's request is the only one Honjin itself makes (D47).

## Code layout

- `common/prerequisites.ts`: the catalog, `setupState`, `PrerequisiteStatus`.
- `common/agent-choice.ts`: `agentChoices`.
- `common/beta.ts`: `compareVersions`, `issueBody`, `issueUrl`.
- `node/binary-resolver.ts`: the generalised resolver. `herdr-binary.ts` delegates to it.
- `node/honjin-setup-service.ts`: S4, plus the S12 fetch.
- `browser/setup/setup-widget.ts`, `setup-contribution.ts`: S5–S7.
- `browser/herdr/new-tab-contribution.ts`: S9.
- `browser/beta-contribution.ts`: S11 menu, S12 notification.

## Tests

- Unit tests:
  - the catalog's install strings and the gemini fallbacks;
  - `setupState`;
  - `agentChoices` (order, `last` first, shell last);
  - `compareVersions` (the cases in S12 plus equal versions);
  - `issueBody` (no paths);
  - the resolver with a fake `PATH` and candidates.
- Integration: `HonjinSetupService.check()` finds a real `herdr` and reports its version, and reports a binary absent
  from a fake `PATH` as missing.
- E2E:
  - The Setup view opens at start when the E2E environment is missing an agent (a `HONJIN_TEST_PATH` override). It
    shows Install for the missing rows and a version for herdr. Re-check updates it.
  - With herdr missing, the herdr tab shows "herdr not found · Set Up Honjin"; once Re-check finds herdr, the
    terminal replaces it without a reload (spec 02 step 5).
  - + with two fake agents shows the picker, and Enter opens a tab running the chosen command. With one agent there
    is no picker.
  - Help → Report an Issue exists.

**Not covered automatically:** that the vendor installers really install (G8 checks this by hand on a fresh macOS
account), the update notification against the real GitHub API, and macOS Gatekeeper behaviour.
