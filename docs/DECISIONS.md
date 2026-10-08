# Decisions

Short ADRs. Add new ones at the bottom: `## D<n> — title` · date · decision · why · consequences.

## D1 — Build on Eclipse Theia, not a VS Code fork · 2026-09-29
**Decision.** Corral is a custom Theia application (Theia 1.76.x) with one extension, `corral-core`.
**Why.** The user needs the full IDE feature set (LSP, debugger, git, VS Code extensions) but a custom layout.
Theia is built for composing custom IDEs and runs VS Code extensions. A Code-OSS fork would mean re-merging a huge
upstream forever; a from-scratch app can't realistically ship a debugger or extensions.
**Consequences.** Extensions come from Open VSX (no Microsoft-only extensions such as Pylance or Remote-SSH).
Theia minor versions change APIs, so the code is checked against the installed `.d.ts` files.

## D2 — Agents run in herdr, driven through its CLI · 2026-09-29
**Decision.** Corral embeds herdr's TUI in a terminal widget and controls it only through the `herdr` CLI (JSON
output), not the raw socket protocol.
**Why.** The CLI is herdr's documented, stable surface; the socket protocol is versioned (22) and internal.
Spawning a CLI costs ~10ms, which is negligible for click-driven actions.
**Consequences.** Every herdr call goes through `HerdrCli`. Upgrading herdr means re-running `npm run test:int`.

## D3 — Corral persists project → herdr workspace mapping; never adopts foreign workspaces · 2026-09-29
**Why.** `herdr workspace list` doesn't expose a cwd, so the only way to match a project to a workspace is a stored
id. Label matching could take over the user's own workspaces.
**Consequences.** Workspaces created before Corral stay untouched. The first + on a project creates its workspace.

## D4 — Theia AI ships but is disabled · 2026-09-29
**Decision.** Include `@theia/ai-core`, `@theia/ai-chat` and `@theia/ai-chat-ui`, with `enableAI` off by default.
**Why.** The user's choice: keep the option open without the built-in agent being in the way.
**Consequences.** An E2E test guards that no AI view appears by default.

## D5 — herdr lives in the main area, split right of the editors · 2026-09-29
**Why.** It's the user's layout: editor | herdr side by side in the middle, projects on the right. Theia side
panels are tabbed (one view visible at a time), so herdr can't share the right panel with Projects.
**Consequences.** Editors could land in herdr's tab group, so `EditorPlacementGuard` (spec 02) exists.

## D6 — The Projects view is a custom FileTree, and visible projects are Theia workspace roots · 2026-09-29
**Why.** The user wants per-project dropdowns with a + on every folder. Search, git, LSP and debug only work on
workspace roots, so the visible project set is mirrored into a Corral-managed multi-root workspace.
**Consequences.** Hidden projects are also left out of search, git and LSP, which is intended (confirmed
by the user on 2026-09-29).

## D7 — Test stack: Jest (unit/integration) + Playwright via @theia/playwright (E2E) · 2026-09-29
**Why.** Jest is what the official generator scaffolds; `@theia/playwright` is Theia's own E2E toolkit. Integration
tests use a real headless herdr session (`herdr --session corral-test-* server`) rather than mocks.

## D8 — E2E runs on port 3100 · 2026-09-29
**Why.** Port 3000 is the usual dev-server port (another project's server was holding it), and Playwright's
`webServer` refuses to start when the port is taken. `start:browser` for manual use is still 3000.
**Consequences.** Spec 08 §E2E setup updated; `e2e/playwright.config.ts` uses 3100.

## D9 — Theia AI packages are not installed (supersedes D4's "ships but disabled") · 2026-09-29
**Why.** In Theia 1.76 `@theia/ai-core` sets its `ai-features.AiEnable.enableAI` context key to `true`
unconditionally and there is no such preference, so with the packages installed an "AI Chat" tab shows in the right
sidebar. The user does not want an in-IDE agent (herdr runs Claude Code).
**Consequences.** `browser-app`/`electron-app` omit `@theia/ai-*`. To bring AI back later: add the three packages,
add a Corral preference/contribution that hides the chat view, and update `e2e/ai-disabled.spec.ts`.

## D10 — Preference key `editor.enablePreview`; no `@theia/scm-extra`; debug tab is titled "Debug" · 2026-09-29
**Why.** `workbench.editor.enablePreview` does not exist in 1.76 (the key is `editor.enablePreview`);
`@theia/scm-extra` has no 1.76 release (its features live in `@theia/scm`); the activity-bar tab for `@theia/debug`
is titled "Debug", not "Run and Debug".
**Consequences.** Spec 01 updated; E2E asserts the real titles.

## D11 — herdr terminal widget details (T1.9)
**Decision.** (1) The terminal starts with `strictEnv: true`, because Theia merges `process.env` twice and herdr refuses to nest (the empty `HERDR_*` values first used here were wrong; see D30). (2) The widget is opened before `start()`, otherwise herdr aborts with "zero-sized grid". (3) Detach key is `prefix+q`, not `prefix+d` (spec 04 corrected). (4) Theia 1.76 disposes a terminal widget after its process exits, so "herdr exited" / "herdr not found" is a separate placeholder tab with the action button. (5) E2E checks the client via `pgrep`, since xterm paints on a canvas with no readable text. (6) Placement is `main` / `split-right`; "own pinned group" is not done.
**Why.** Each was found by failing tests against real herdr 0.9.1 and Theia 1.76.
**Consequences.** All are in `herdr-terminal-contribution.ts`, easy to change.

## D12 — Projects view scope and interim editor placement (T1.10)
**Decision.** The tree is built on `FileTree`/`FileTreeModel` with a synthetic invisible root. Missing projects are left out of the tree for now (they return with the toolbar/context menu tasks). Opening a file uses a small `editorPlacement()` in `ProjectsModel`: after the last editor, else split-left of the herdr tab. `corral.resetLayout` only reopens Projects and collapses the left and bottom panels. `@theia/editor` and `@theia/filesystem` were declared in `corral-core` (already installed, same version).
**Why.** Without it Theia opens editors in the herdr tab's group. The general guard is T1.12, which will replace `editorPlacement()`.
**Consequences.** Remove `editorPlacement()` when T1.12 lands.

## D13 — newTab details (T1.11)
**Decision.** `HerdrError` loses its class over RPC, so the frontend detects the server-down case by `server_not_running` in the error message (the default message is the code). The ⌥⌘T keybinding is global but does nothing unless the Projects view is active with a selection. The `+` is a plain button rendered in `renderTailDecorations`; it is not yet disabled on missing roots because those are not in the tree (D12).
**Why.** Simplest thing that works with Theia's RPC and tree APIs.
**Consequences.** If herdr error codes need to be structured, add a code field to the RPC error later.

## D14 — placement guard test opener (T1.12)
**Decision.** The E2E opens the "other opener" through File > New Text File instead of Quick Open (⌘P). It is a non-Projects opener that Theia places next to the focused widget, and it fails when the guard is disabled. The interim `editorPlacement()` from D12 is gone; `ProjectsModel` uses `EditorPlacementGuard.optionsFor()`.
**Why.** Quick Open lists nothing until workspace roots are synced (T1.14).
**Consequences.** After T1.14, add a Quick Open case to `placement.spec.ts` if wanted.

## D15 — first-run picker (T1.13)
**Decision.** The "OS folder picker" is Theia's own file dialog (`FileDialogService`), which works the same in the browser and Electron. `corral.projects.chooseScanRoots` asks for confirmation (old vs new roots) before it replaces the roots. `first-run.spec.ts` starts its own backend on port 3110 with an empty config, because the shared E2E backend is seeded.
**Why.** A native dialog cannot be driven from Playwright and would differ between the two targets.
**Consequences.** If you want the native macOS dialog in Electron, swap `pickFolders()` only.

## D16 — managed workspace, trust prompt, window title (T1.14)
**Decision.** On first start Corral opens `<configDir>/corral.code-workspace` (one page reload); afterwards roots are added/removed live. `security.workspace.trust.enabled` is `false` in both apps' default preferences. `shell.spec.ts` now matches the title `/corral/i`, because Theia titles the window after the workspace file name until T2.5 sets the real title. The E2E config dir uses `realpathSync(tmpdir())`, since macOS `/var` symlinks stopped Theia seeing external settings edits.
**Why.** Without trust off, Theia shows a "trust this folder" dialog on every start of a workspace made of the user's own projects.
**Consequences.** If you want trust prompts back, remove the preference from `browser-app/package.json` and `electron-app/package.json`.

## D17 — stage 1 review leftovers (G1)
**Decision.** Deferred, not built: persisted expanded state of the Projects tree (spec 03 says `StatefulWidget`), an E2E for the `+` on keyboard focus, a Quick Open case in `placement.spec.ts`, and asserting the exact managed-workspace path in `roots.spec.ts`. Preferences use `User` scope where spec 05 / T1.2 say `application` (same intent: settings live in the user file, never the workspace).
**Why.** None affects correctness of stage 1; each is small and isolated to add later.
**Consequences.** Tree expansion resets on restart until implemented (`storeState`/`restoreState` on `ProjectsWidget`).

## D18 — eye toggle and empty state (T2.1)
**Decision.** The eye is one toolbar item with a highlighted (toggled) state instead of swapping between `eye` and `eye-closed` icons. The "No projects found" empty state has only **Change folders…** for now; **Add project…** arrives with `corral.projects.add` in T2.2. Show-hidden state lives on the model (not yet saved in widget state).
**Why.** Keeps T2.1 small; icon swap and the extra button are cosmetic and isolated.
**Consequences.** T2.2 adds the button; stage 3 can swap the icon.

## D19 — missing projects (T2.2)
**Decision.** A missing project stays in the tree as a struck-through row (synthetic stat, no children, + disabled, ⌥⌘T ignored) so it can still be removed or hidden; it is not a workspace root. The E2E adds a folder through the real dialog, but puts it back through settings.json before the missing check.
**Why.** Removing a vanished project must stay possible from the UI.
**Consequences.** Spec 03's toolbar has `collapse-all` still unimplemented (not in any T2.x task yet; add in stage 3 or T2.5).

## D20 — startup command menu (T2.3)
**Decision.** Spec 05's second QuickInput item "Use global default (<global>)" is a separate context-menu command, "Use global startup command", shown only when the project has an override.
**Why.** Theia's `QuickInputService.input` is a single text box; a two-item picker would need a custom quick pick.
**Consequences.** The global value is not shown in the menu label; add it to the label if wanted.


## D21 — file operations in the Projects tree (T2.4)
**Decision.** File operations reuse Theia's `WorkspaceCommands` (New File/Folder, Rename, Delete). Rename is not offered on project roots (Theia disables it for workspace roots). Open / Open to the Side are left out; a click already opens in the left half. Reveal in Finder runs `open -R` in the backend via `execFile`.
**Why.** Same dialogs and confirmations as the rest of Theia, no new UI to maintain.
**Consequences.** `ProjectsTree` ids nodes by `uri.toString()` so `FileTreeModel.getNodesByUri` finds them, and project nodes are handed out through `resolveChildren` so they are registered. Theia only watches the workspace file, so each expanded folder gets one shallow `files.watch`; a recursive watch per project starved the backend search and broke the roots E2E.

## D22 — window title (T2.5)
**Decision.** The title comes from a `WindowTitleContribution` (`Corral — <project>`, plain `Corral` before any project is focused). The contribution holds no injected services; a separate `FrontendApplicationContribution` listens to the editor manager and pushes updates.
**Why.** `WindowTitleService` resolves its contributions while initialising, and `EditorManager` reaches back to it, which blanked the app with a DI cycle.
**Consequences.** Rescan on startup, Refresh and `corral.scanRoots` changes were already implemented in T1.14/T2.2; T2.5 only added tests for them.

## D23 — herdr key passthrough and terminal HOME (T2.6)
**Decision.** No keybinding changes were needed: Theia already passes `ctrl+b` and its follow-up keys to the terminal. The herdr terminal now sets `HOME` explicitly in its environment.
**Why.** With `strictEnv` the terminal had no `HOME`, so herdr resolved its socket under `$TMPDIR` and the IDE client attached to a different server than the backend's CLI calls (new tabs, status). The key test exposed it.
**Consequences.** `ctrl+b c` in the test asks for a tab name; the test presses Enter to accept the default.

## D24 — Theme registered from JSON via `registerParsedTheme` (T3.1)

The theme JSON is imported by the frontend and registered in `initialize()` (before Theia applies `defaultTheme`), rather than loaded from a URI. Fonts: Regular + Medium woff2 of JetBrains Mono v2.304 (OFL.txt alongside). `@theia/monaco` is added to corral-core's dependencies (already installed by both apps at the same version). Editor/terminal font defaults live in both apps' `preferences`. Changing a colour = edit DESIGN.md, `design-tokens.ts` and the theme JSON; unit tests keep the three in step.

## D25 — Favicon injected at runtime (T3.3)

Theia's generated `index.html` has no icon link and `browser-app` is regenerated by `theia build`, so `FaviconContribution` adds `<link rel="icon">` at startup from `corral-core/src/browser/style/favicon.svg` (a copy of `branding/favicon.svg`; re-copy when the master changes). Electron icon wiring belongs to T3.5.

## D26 — Packaging details (T3.5)

`electron-builder` 26.15.3 is added to `electron-app` devDependencies (spec 07 names it). `asar: true` with `node-pty`, `@vscode/ripgrep`, `drivelist` and Theia `.node` files unpacked; the built-in extensions from `plugins/` ship as `Resources/plugins`. A packaged app has no start script to pass `--plugins`, so the backend module sets `THEIA_DEFAULT_PLUGINS` to that folder when it exists (guarded, so dev runs are untouched). `package:mac` runs `theia build` and `electron-builder` from inside `electron-app`. Smoke check ran the binary with an `env -i` PATH of `/usr/bin:/bin` and herdr was still found. Not checked: launching from Finder with `open`, and the icon in the Dock (icns is wired via `mac.icon`).

## D27 — Stage 3 review leftovers (code-review, 2026-09-29)

- Chrome rules stay in `herdr.css` (spec 06 names `corral.css`); a rename is churn and the file already holds all Corral CSS. Uppercase view titles and square tabs come from the theme and Theia defaults; nothing custom was needed after the T3.2 critique.
- CSS reads `--theia-*` variables, which the theme maps from the DESIGN.md tokens; no `--corral-*` aliases exist. Add them only if a rule needs a token the theme does not expose.
- `editor.lineHeight` is 1.6 (DESIGN.md `code`). The terminal keeps Theia's default: herdr is a TUI and a 1.6 line height breaks its box drawing.
- Not done: favicon `.ico` fallback link, Electron dev-window icon (`icon-512.png`); both listed in FOR-REVIEW.

## D28 — packaged app unpacks `lib/prebuilds` (post-plan fix)
**Decision.** `electron-builder.yml` adds `lib/prebuilds/**` to `asarUnpack`.
**Why.** Theia's bundle loads node-pty's `spawn-helper` from `lib/prebuilds/<arch>/`, not from `node_modules`. It stayed inside `app.asar`, so the packaged Corral.app failed with `posix_spawn failed: No such file or directory` and the herdr pane stayed blank. The browser and dev builds were unaffected, so E2E never caught it.
**Consequences.** Verified by launching the rebuilt app: a herdr client now runs on its own tty.

## D29 — "herdr exited" shows herdr's last output line (post-plan fix)
**Decision.** The herdr terminal keeps the last 4 KB of output, and on exit the overlay shows the last readable line (`common/exit-reason.ts`). Spec 02 was updated.
**Why.** A wedged `default` server made every new client quit with "server did not become ready within 15s", but the overlay only said "herdr exited", so the cause was invisible.
**Consequences.** Nothing new is persisted. The tail is dropped with the widget.

## D30 — herdr client env passes no `HERDR_*` keys (post-plan fix)
**Decision.** The herdr terminal's env is `herdrClientEnv(home)` (`common/herdr-client-env.ts`): only `HOME`. `strictEnv` already keeps Corral's own `HERDR_*` variables out.
**Why.** Setting `HERDR_SOCKET_PATH` to `''` did not clear it: herdr treated it as a socket path, so the Corral client on the default session always failed with "server did not become ready within 15s" and never attached. E2E missed it because it runs with `--session corral-test-*`, which doesn't use that path.
**Consequences.** Verified by opening the packaged app: its herdr client connects to `~/.config/herdr/herdr-client.sock` and attaches to the live session.

## D31 — Git changes open from the Projects view; panels slide (post-plan change)
**Decision.** Source Control leaves the left bar. Projects gets **Open Changes** (a file's diff) and **Show Changes** (that folder's repository in Source Control, opened on the right). `CorralScmContribution` rebinds `ScmContribution`; `corral-core` now lists `@theia/scm` 1.76.0 as a dependency (already shipped by both apps, so nothing new is installed). Side and bottom panels animate open (`expandDuration` 150 ms), and `CorralSidePanelHandler` also animates collapsing. Specs 00–03 updated.
**Why.** The user asked for the change: the left Source Control view showed one repository chosen by Theia (often an unrelated project) with a 99+ badge summed across every repo, and panels snapped open and shut.
**Consequences.** Collapsing still ends at the view's CSS min-width before snapping to the tab strip. The slide is linear because Theia's `SplitPositionHandler` has no easing hook. E2E: `changes.spec.ts`, `panels.spec.ts`, and `shell.spec.ts` now asserts Source Control is absent on the left.

## D32 — A folder that holds other projects is never a workspace root (post-plan fix)
**Decision.** `visibleRoots` leaves out any entry that contains another entry, hidden ones included, and **Add project** refuses a folder that is already listed, holds listed projects, or sits inside one (`addProblem`, `common/project-list.ts`). Spec 03 updated.
**Why.** Adding the scan root `~/Desktop/projects` by mistake made it a root beside its own children: 14 GB and about 281,000 files, 25 git repositories and every hidden project went to the file watcher, git and search at once, and the window froze blank on every start until the setting was removed.
**Consequences.** Such an entry saved before this fix still shows in the tree (so it can be removed) but is not searched or watched. If one project is genuinely nested in another, the outer one is dropped from the roots; Add prevents creating that case.

## D33 — Dependency and build folders are not watched by default (post-plan fix)
**Decision.** Both apps' default preferences set `files.watcherExclude` to Theia's `.git/objects` and `.git/subtree-cache` entries plus `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `.turbo`, `.cache`, `coverage`, `.venv`, `__pycache__` and `target`. Spec 01 updated.
**Why.** Every visible project is a workspace root, so the watcher cost grows with the files under all of them, and most of those files sit in generated folders nobody edits by hand. `FileService` applies this preference to every watcher, plugin and language-server watchers included.
**Consequences.** Edits made inside those folders by other tools do not refresh the explorer until it is refreshed or the folder is reopened. They still appear in search, which uses `search.exclude`. A user setting replaces this list whole, so anyone overriding it has to repeat the entries they want to keep.

## D34 — The herdr terminal defaults to 11px text (post-plan fix)
**Decision.** `terminal.integrated.fontSize` defaults to 11 in both apps, down from 13. Spec 06 updated.
**Why.** herdr in Corral looked much larger than the same TUI in macOS Terminal, whose default Basic profile is 11 pt SF Mono. At 13, herdr's panes had fewer rows and columns than the user sees in their own terminal.
**Consequences.** The editor stays at 13 (the DESIGN.md `code` size). Users change the terminal size in settings as before.

## D35 — A read-only Changes view, backed by git, with a live marker (spec 09)
**Decision.** The right panel becomes a view container: Projects over a new Changes view. Changes lists every uncommitted git change in each visible project, grouped by project, sorted by path. Files written in the last 30 s get a pulsing accent dot, both there and in the Projects tree, which also shows change letters and per-project counts. Clicking a file opens git's diff against HEAD. There is no stage, discard or commit.
**Why.** Agents in herdr edit many projects at once, and Show Changes only shows one repository. Git gives a real diff baseline and already leaves out ignored files and saves that change nothing; raw file-watch events would list build noise and could not diff. 30 s spans an agent's multi-file step without leaving stale dots. Commits happen in herdr/Claude, and discard can lose work, so the view stays read-only.
**Consequences.** Projects that are not git repositories, and hidden projects, never appear in Changes. Layouts saved before this change had Projects as its own right-panel tab; startup moves it into the container instead of using a layout-version migration, since Theia only runs those when its own layout version changes. The container's tab id is `corral-projects-container`. The 30 s expiry is tested at unit level only.

## D36 — Dispositions from the full-app code review (stage 5)
**Decision.** Scan-root warnings travel back in `ProjectScanResult.warnings`, and the frontend writes them to the Output channel "Corral" (spec 03). `@theia/output` becomes a declared dependency of `corral-core`, at the version both apps already ship. The herdr integration tests stay in `corral-core/test/` next to their harness. `projects-actions-contribution.ts` stays one file. A tree context menu passes its anchor as the first command argument, so a command that also accepts a `URI` checks `instanceof URI`.
**Why.** The backend has no Output view, and a `console.warn` in the backend log never reached the user. Moving the int tests into `src/node/` would bring the harness under `rootDir: src` and ship it in `lib/`. Every command in the actions file reads the same Projects selection, so splitting it would duplicate that code.
`ProjectsWidget` stores only the expanded ids and `showHidden`, and re-applies them after the first project list loads; it does not store Theia's deflated tree, because the tree is rebuilt from the project list anyway. This closes the D17/D18 deferrals. Reset Layout sets the side panels with `ApplicationShell.resize` (right 300 px, left 280 px on reopen), but it does not re-split the main area: Lumino's `DockPanel` has no public way to size a split, and `restoreLayout` would re-attach the editors and the herdr terminal. Spec 09 now records what the Changes code does: file children are built eagerly, the expiry timer fires 1 ms after the mark ends, events are coalesced for 50 ms, and a recompute that yields the same groups (`sameGroups`) fires no `onDidChange`; `LIVE_MS` is a constant rather than a parameter.
Left as they are: integration tests `describe.skip` with a loud message when herdr is missing (spec 08 says so); backend services are built by hand in `corral-backend-module.ts` from plain constructor arguments, which keeps them unit-testable without a DI container; the frontend detects a stopped herdr server by `server_not_running` in the error message, because the RPC boundary drops the `HerdrError` class (D13).
**Consequences.** A warning shows once per new problem: reloads that report the same warnings stay quiet, and a root that breaks again after a clean scan is reported again.

## D37 — Go-to-market, and a later move to Corral's own Rust IDE (docs/GTM.md) · 2026-09-30
**Decision.** Corral launches as a free, MIT-licensed open-core Theia build for macOS. The launch adds an agent picker on **+** and is released unsigned, with install steps. Linux, keymap presets, a skills panel and MCP shared memory follow in v1.x. Paid enterprise features stay parked until an organization asks. After launch, and only if the founder approves it on benchmark numbers, Corral gets rewritten as its own Rust IDE: iced plus cosmic-text, `alacritty_terminal`, and a `corral-rs/` Cargo workspace in this repo. It replaces the Theia build once it is the founder's only editor for 2 weeks and beats Theia-Corral on RAM and startup.
**Why.** There are zero users, so everything before launch is a guess. A council review cut the launch to the one distinctive feature. The Rust version is Corral's own code, not a Zed fork: a fork is GPL-3 and has to absorb about 100 upstream commits a week, GPUI is effectively GPL today, and Zed's extensions and tasks can't add the Projects tree or **+**.
**Consequences.** Nothing in `docs/specs/` changes yet. Specs change when their tasks land, starting with Linux packaging and signing in spec 07. `PRODUCT.md` still says macOS-only and single-user, and will change at launch. The Rust build loses VS Code extensions that draw their own UI, and that loss is accepted.

## D38 — The resource monitor counts the whole herdr session, sampled with `ps` (spec 10)
**Decision.** A status-bar entry on the right shows memory, CPU and process count for the Corral app plus the herdr server tree of Corral's session, every workspace included. It turns warning-coloured at 50% of the machine's RAM or when a process holds 90% of a core for 5 minutes, danger-coloured at 75%, and sends one notification on crossing danger or on a new runaway; it re-arms only when everything is back to normal. Hovering lists Corral, the herdr server and each workspace by label. Four `corral.resourceMonitor.*` settings (switch, two thresholds, interval); the runaway limits are fixed. Specs 05, 06, 00, 08 and DESIGN.md updated.
**Why.** Running many Claude sessions in parallel is what loads the machine, and the load sits in the herdr panes whoever opened them (on 2026-09-30 a `ruby-lsp` under one Claude pane and a stray `python3 -` held a core each for a day, and the Mac was swapping). The Corral app alone is about 200 MB and idle, so counting only it would show nothing. One `ps` call per tick needs no new dependency. CPU alone is spiky while agents work, so it never warns; a process pinned for 5 minutes is what heats the machine.
**Consequences.** RSS summed over processes over-counts shared pages compared with Activity Monitor's footprint, which is acceptable for a threshold signal. The herdr server pid comes from a pane shell's `ppid` because `herdr status` reports no pid; with no panes the idle server's few MB are not counted. The per-workspace breakdown costs one `pane process-info` call per pane, so it is built only when the tooltip opens, not every sample. macOS only, like the rest of Corral.

## D39 — Idle agents are slept by a Corral-scoped fork of herdr-agent-hibernate (spec 11) · 2026-09-30
**Decision.** `herdr-plugin/` is a fork of `dalogax/herdr-agent-hibernate` (MIT, `50c29cb`), id `corral.agent-hibernate`. It sleeps only agents in workspaces listed in Corral's `herdr-workspaces.json` for the same herdr session, never one that has a shell (sh, bash, zsh and similar) running under it, and leaves Codex alone unless opted in. It stays a herdr plugin, so it works with Corral closed; the user installs it by hand.
**Why.** Sleeping stops the agent process (SIGTERM) and resumes the same session on focus, which frees the RAM of many idle Claude sessions (the problem behind D38). Upstream acts on every agent pane in the session, and Corral uses the default session, so it would also sleep panes Corral did not create (AGENTS.md hard rule). Upstream also has no check for background work, so an agent running a dev server would be killed and its shell orphaned. On 2026-09-30 idle Claude processes had only MCP children, while the one running a dev server had a `zsh` child, so the shell check separates them. Codex's typed `/quit` submits an unsent draft. Forking rather than installing upstream is the only way to scope it; the shell guard can go upstream as a PR.
**Consequences.** Sleeping a pane the user added by hand inside a Corral workspace is allowed: sleep is not close, and the agent resumes. The plugin reads Corral's map file, so a change to that file's shape (spec 04) must update it. A shell the agent keeps open for no reason stops that agent from sleeping, and so would an MCP server or helper launched through `sh -c` (the ones seen on 2026-09-30 were direct binaries or `npm exec`, not shells); if that shows up, the fix is to ignore shells whose only child is a known helper. The pane-to-workspace lookup relies on `pane list` returning `workspace_id`, as Corral's own `listPanes` does; the plugin fails closed if it does not. Corral does not show sleep state yet; that would be a separate spec. Running the plugin registers it machine-wide in herdr, and the scope check is what limits it to Corral.


## D40 — Dispositions from the whole-codebase review · 2026-10-07
**Decision.** Fixed: a read error other than a missing file no longer empties the workspace map (it rejects instead, so the next write cannot wipe other projects' links); a "herdr not found" lookup is no longer cached; the herdr-down retry asks `status()` instead of reading `server_not_running` from the error message (this replaces the message-matching in D36, which never matched because herdr's own error text, not the code, crosses RPC); Add project checks multi-select picks against each other; "Focus herdr" activates the exit/not-found notice instead of opening a second tab with the same id; the runaway notification rounds its minutes (spec 10 R8; the tooltip still floors, R10); the status-bar polling loop is generation-guarded so a disable/enable during a sample cannot start two loops; a failed project list leaves the empty state and logs to the Corral output channel; the editor placement guard puts a new file beside the editor in use, not the newest-created one; `settings.json` is read as JSONC. The `+` button, 30px tabs and the project path tail now follow DESIGN.md. `owningProject` and a shared `basename` live in `common/paths.ts`; the three command ids a widget needs live in `common/command-ids.ts`; Corral settings are written through the typed `setCorralPreference`.
**Why.** Each was found by reading the code against the specs and AGENTS.md, and each had a concrete failure (lost mappings, a dead retry path, nested projects, two polling loops).
`jsonc-parser` (already installed by Theia at 3.2.0) becomes a declared dependency of `corral-core`, because `settings.json` allows comments and trailing commas and a hand-rolled stripper would mishandle `//` inside strings.
Left as they are: `herdr-plugin/` keeps upstream's 2-space, double-quote style and is outside ESLint, since it is a fork meant to stay diff-able against upstream (D39). Its `isWatcherProcess` calls the real `ps` because `HIBERNATE_PS_PATH` only replaces the process-table snapshot. `ProjectsActionsContribution` stays one file and the int tests stay in `corral-core/test/` (D36). The `~/Desktop/projects` picker start is spec 05. The `zz-rescan` spec name, e2e `waitForTimeout` sleeps, and root `typescript ^5.9` vs corral-core `~5.4.5` are untouched.
**Consequences.** `openTab` can now reject with the map file's read error (shown in the usual error toast). Two project rows no longer share the `+` on selection: it appears on hover or keyboard focus only, as spec 06 says.

## D41 — Quick Open matches the project name; palette `when` clauses use where it was opened; herdr owns its right click · 2026-10-07
**Decision.** (1) The backend `FileSearchService` is rebound to `RootNameFileSearchService`, which prefixes each candidate with `../<root folder>/` before Theia matches it, so "corral readme" finds `corral/README.md`. Theia resolves the candidate against its root, so the URI is unchanged. `@theia/file-search` (already in both apps through `@theia/plugin-ext`) becomes a declared dependency of `corral-core`. (2) `QuickCommandService` is rebound to `PaletteOriginQuickCommandService`, which matches `commandPalette` `when` clauses against the element focused when the palette opened. (3) The herdr terminal swallows `contextmenu` in the capture phase, so Theia's terminal menu never opens over herdr's own.
**Why.** (1) With one workspace root per project, Theia matches only the path inside the project, so typing the project name, as VS Code allows in multi-root workspaces, returned nothing. (2) Theia 1.76 rebuilds the palette list on every keystroke against `document.activeElement`, which is the palette input by then, so every command gated on editor keys (`editorLangId`: all of Markdown: Open Preview and friends) vanished as soon as the user typed. ⇧⌘V worked, because keybindings are matched with the editor focused. (3) herdr runs with mouse reporting and draws its own right-click menu; Theia's menu stacked on top and offered "Kill Terminal" on herdr.
**Consequences.** Every file in a project now also matches the project's name, so a query that is only a project name lists that project's files (capped at Theia's 200). The palette fix relies on the protected `contexts`/`getValidCommands` of `QuickCommandService` and the `.quick-input-widget` class; recheck both on a Theia upgrade. Commands with an `enablement` clause are still checked against the palette input (only Markdown's two "Insert … from Workspace" commands use one). Copy/paste in the herdr tab goes through herdr's menu or the keyboard.
(4) Packaging: `electron-builder.yml` unpacks `lib/backend/native/rg`. Theia's bundle spawns ripgrep from `app.asar.unpacked/lib/backend/native/rg`, which was never unpacked (the old `node_modules/@vscode/ripgrep` entry matched nothing the bundle uses), so every Quick Open and workspace search in Corral.app failed while the browser build, which has no asar, passed E2E.

## D42 — An Agents view reads herdr's agent list (spec 12) · 2026-10-08
**Decision.** A third part, **Agents**, in the right container lists every agent in Corral's herdr session.
- Order: blocked, then done, then the rest.
- A badge counts the agents that need the user.
- A click runs `herdr agent focus`.
- The data comes from polling `herdr agent list` every 3 s (`corral.agents.intervalSeconds`).
- Layout: Theia ignores a part's `weight` unless it restores saved sizes, so a fresh layout splits Projects, Changes and Agents evenly. Accepted for now; the E2E focus click in `roots.spec.ts` moved from y=200 to y=150 to stay inside the shorter Projects part.

**Why.**
- `PRODUCT.md` promises that herdr "shows which ones are working, blocked or done". Corral never surfaced that, and
  every comparable tool does (`docs/research/feature-gaps.md` §2).
- **Polling, not the socket.** The CLI is the seam Corral already uses and tests. herdr's `events.subscribe` socket
  API would push changes, but its stability is still an open question for herdr's maintainers (GTM).
- **All agents in the session.** Agents in workspaces Corral didn't create are listed as well. Reading and focusing
  them changes nothing, and nothing is adopted, so this is consistent with D3. The resource monitor already covers
  the whole session (D38).

**Not done.**
- No rename, stop or prompt from the view: Corral never acts on an agent beyond focusing it.
- No macOS Dock badge, because it needs an electron-main contribution, which Corral doesn't have yet.
- No Corral-side system notifications, because herdr's own `[ui.toast]` / `[ui.sound]` settings already notify. Both
  are candidates for a later stage.

**Consequences.**
- One more `herdr` process runs every 3 s.
- A `done` agent becomes `idle` once focused from Corral (herdr marks it seen; checked on 0.9.1).
- Spec 09 C14 changes from two parts to three, in T7.4.

**Details settled while planning stage 7** (all checked on herdr 0.9.1 / Theia 1.76):
- **Time in state** resets when the status **or the kind** of a pane changes, because herdr allows a new agent kind in
  the same pane.
- **Missing fields.** `terminal_title_stripped` is often missing, so the title is optional. An empty `cwd` falls back to
  `foreground_cwd`. An unrecognised status becomes `unknown`.
- **No realpath.** herdr reports real paths (`/private/tmp/…`), and Corral compares them to project paths as given. A
  project reached through a symlink therefore labels its agents by path instead of by project name. Accepted rather
  than adding a filesystem call to every poll.
- **Old layouts.** Theia's `ViewContainer` hides a hideable part that has no saved entry, and sizes parts only from
  saved entries. So `ProjectsViewContainerFactory` appends an Agents entry to a saved state that lacks one, before the
  state is restored. A saved entry, including one the user hid, is left alone.
- **The poll loop is pure** (`AgentsPoller` in `common/agents.ts`), so its overlap, refresh and stop cases are tested
  with fake timers. Browser classes in this repo aren't unit-testable under node jest.
- **E2E fakes agents** with `herdr pane report-agent` on the E2E session, so rows, order, colours, both badges and
  click-to-focus are tested automatically. No real agent runs, so spec 08 still holds.
- **Both badges.** One on the part header (`BadgeWidget`), which needs the part to have no toolbar items, and one on the
  right-panel tab (`TabBarDecorator`).
- **Reveal in Projects** reuses Changes' reveal, moved to `ProjectsContribution.revealPath`.

## D43 — Agents: a title line and a bottom-panel timeline (spec 12 A5, A14, A15) · 2026-10-08
**Decision.** Each Agents row gains a second line with the agent's terminal title. A new **Agent Timeline** tab in the bottom panel draws one lane per agent over the last 15 minutes, coloured by status.
**Why.**
- Claude Code sets the terminal title to a short task summary, which tells you what an agent is doing without opening its pane. We already fetched it and only showed it in a tooltip.
- A list shows state now, not overlap over time. The bottom panel is empty by default and wide enough for a time axis; the right panel is not.
**Consequences.**
- History is in memory only and starts when Corral starts (herdr has no timestamps). No new dependency: plain divs, no chart library.
- No header button for the timeline: a toolbar item on the Agents part hides its badge (A7). It opens from the command palette.

## D44 — Setup installs prerequisites in a visible terminal; + picks an agent (spec 13) · 2026-10-08
**Decision.**
- A Setup view checks for herdr, the agent CLIs (claude, codex, gemini, opencode) and git. Each missing item gets an **Install** button that runs the vendor's official installer in a visible Theia terminal through `$SHELL -lc`.
- + shows a quick pick of the installed agents plus Shell. The global `corral.startupCommand` is replaced by `corral.agentCommands`, and the per-project override still skips the picker. "Use global startup command" becomes "Use agent picker".
**Why.**
- A public beta's testers start with nothing installed, and a "herdr not found" overlay is where they would quit.
- A visible terminal shows exactly what runs and can be stopped. A silent background install would cost trust and hide failures.
- The picker makes + work for Codex, Gemini and opencode users, which is GTM's launch gate.
**Consequences.**
- This is a second exception to AGENTS.md's "no shell" rule. It is allowed only for catalog strings (never user input), only after a click, and only in a visible terminal. The login-shell `command -v <binary>` lookup is extended from herdr to the catalog binaries, again from constants only.
- The install commands are copied from vendor docs (checked 2026-10-08) and can go stale. G8 tests them by hand on a fresh macOS account.
- Existing users lose a customised global startup command; they set it again in `corral.agentCommands`.

## D45 — Unsigned beta, installed by a curl script (spec 07) · 2026-10-08
**Decision.** The beta ships unsigned as an arm64 zip on GitHub Releases with `SHA256SUMS`. The headline install is `curl -fsSL …/scripts/install.sh | sh`, which verifies the checksum and replaces `/Applications/Corral.app`. This supersedes GTM's xattr-first install steps.
**Why.** A file that curl downloads has no quarantine flag, so there is no "unverified developer" block, and this costs $0. The audience already installs herdr and Claude Code with the same pattern, and re-running the script is the update path.
**Consequences.** Some people distrust `curl | sh`; the README offers the zip with manual Open Anyway steps, and building from source. Revisit signing ($99/yr) when downloads justify it. Signing would also unlock auto-update.

## D46 — A daily update check against GitHub Releases (spec 13 S12) · 2026-10-08
**Decision.** The backend GETs GitHub's latest-release API 10 s after start and then every 24 h. A newer version shows a notification with a copyable update command. `corral.updates.check` turns it off.
**Why.** Beta builds change often, and testers on stale builds file bugs that are already fixed. Electron auto-update needs a signed app (D45).
**Consequences.** This is one anonymous request to api.github.com, disclosed in the README. Failures are silent.

## D47 — No telemetry · 2026-10-08
**Decision.** Corral collects no usage data or crash reports. Feedback comes through GitHub Issues (templates plus a prefilled **Report an Issue** command) and Discussions.
**Why.** The audience is developers from an unknown author's first public release. Telemetry would cost more trust than its data is worth at this scale.
**Consequences.** Problems are known only when testers report them, so Report an Issue includes versions (no paths) to make each report useful.

## D48 — Git status item follows the active editor (spec 02) · 2026-10-08
**Decision.** `CorralScmContribution` listens to `EditorManager.onCurrentEditorChanged` and sets `ScmService.selectedRepository` to the repository containing the editor's file (`findRepository`). Preview/webview tabs leave the selection alone.
**Why.** Theia selects the first repository that registers and never changes it, so with many project roots the bottom-left item named an arbitrary project (seen: `ai-job-search` while editing `us-lead-engine`).
**Consequences.** Show Changes still selects its folder's repository, until the next editor change.

## D55 — Two critical `npm audit` findings are accepted (T8.6) · 2026-10-08
**Decision.** `npm audit` reports two critical advisories and Corral ships with both: `decompress` 4.2.1 (zip-slip, via `@theia/plugin-ext-vscode`, `@theia/plugin-ext` and `@theia/cli`) and `tar` (hardlink and symlink path traversal, via `lerna`). No fixed version exists for `decompress`, and `tar` sits behind a `lerna` major. Neither is pinned or overridden.
**Why.** Both only bite when an attacker-chosen archive is extracted. `tar` is reached only by `lerna`, a development tool that is not in the packaged app. `decompress` runs at build time (the built-in extension tarball, fetched from the Eclipse Theia release) and when a user installs a `.vsix` file themselves; Corral never fetches or extracts an archive on its own at run time. The remaining 126 findings are moderate, high or low and sit in the same Theia dependency tree.
**Consequences.** Listed in `docs/KNOWN-ISSUES.md`: install extensions only from sources you trust. Revisit when Theia moves off `decompress` or ships a newer `lerna`.
