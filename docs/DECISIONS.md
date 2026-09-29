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
**Consequences.** A warning shows once per new problem: reloads that report the same warnings stay quiet, and a root that breaks again after a clean scan is reported again.
