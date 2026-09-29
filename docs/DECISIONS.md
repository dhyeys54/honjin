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
**Decision.** (1) The terminal starts with `strictEnv: true` and empty `HERDR_*` values, because Theia merges `process.env` twice and herdr refuses to nest. (2) The widget is opened before `start()`, otherwise herdr aborts with "zero-sized grid". (3) Detach key is `prefix+q`, not `prefix+d` (spec 04 corrected). (4) Theia 1.76 disposes a terminal widget after its process exits, so "herdr exited" / "herdr not found" is a separate placeholder tab with the action button. (5) E2E checks the client via `pgrep`, since xterm paints on a canvas with no readable text. (6) Placement is `main` / `split-right`; "own pinned group" is not done.
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
