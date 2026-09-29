# Corral — Development plan

How to use this file: `/next-task` takes the **first** line that starts with `- [ ]`, does that task (TDD, per
`AGENTS.md`), ticks it to `- [x]`, and appends a line to the Progress log at the bottom. A blocked task becomes
`- [!]` with a note underneath; the loop stops there. **G** tasks are gates: a review, then a human checkpoint.

Paths are relative to `corral-core/src/` unless they start with a top-level folder.

---

## Stage 0 — Bootstrap

- [x] **T0.1 Scaffold the Theia app**
  - Spec: 01 §Scaffold.
  - Do: run the generator in a temp dir, copy the output into the repo (keep our README/.gitignore and append
    only the generator's ignore lines that are missing; do **not** ignore `branding/generated/`, which is committed). Rename nothing else. `npm install`.
  - Verify: `npm run build:browser` succeeds; `npm run start:browser` serves http://127.0.0.1:3000 and returns 200
    (`curl -sfo /dev/null -w '%{http_code}' http://127.0.0.1:3000`), then stop it.
  - Commit: `T0.1: scaffold Theia 1.76 app (generator-theia-extension)`.

- [x] **T0.2 Tooling and scripts**
  - Spec: 08 §Layers, AGENTS.md §Commands.
  - Tests first: `common/sanity.test.ts` asserting `1 + 1 === 2` (proves the runner works); delete it in T1.2.
  - Do: Jest config at `corral-coreX/test/jest.config.ts` (unit) and `corral-core/test/jest.int.config.ts`
    (integration, `maxWorkers: 1`). Add root scripts `test`, `test:int`, `test:e2e`, `typecheck` (`tsc --noEmit -p corral-core`),
    `lint` (eslint + typescript-eslint, flat config, recommended rules only), `build` (`npm run build -w corral-core`).
    Put `package:mac` in as a placeholder that prints "see T3.5" and exits 1.
  - Verify: `npm test`, `npm run typecheck`, `npm run lint` all exit 0.

- [x] **T0.3 herdr test harness**
  - Spec: 08 §herdr test harness.
  - Tests first: `corral-core/test/herdr-harness.int.test.ts`: (a) `startHerdr()` returns a session matching `/^corral-test-/`
    whose `status server --json` reports running; (b) after `stop()`, `herdr session list` does not contain it;
    (c) the internal `assertTestSession('default')` throws; (d) `startHerdr({ session: 'corral-test-fixed' })` uses
    that name, and calling it again while that server runs reuses it instead of failing.
  - Do: `corral-core/test/herdr-harness.ts`. Use `execFile`; no shell.
  - Verify: `npm run test:int`; `herdr session list` afterwards shows only the sessions that existed before.

- [x] **T0.4 E2E skeleton**
  - Spec: 08 §E2E setup.
  - Tests first: `e2e/smoke.spec.ts`: the app shell (`#theia-app-shell`) becomes visible within 60s.
  - Do: install `@playwright/test` and `@theia/playwright` (pinned to the Theia version). Add
    `e2e/playwright.config.ts` (it fixes the session name once, spec 08 §E2E setup), globalSetup/teardown using the harness, `e2e/fixtures/projects/{alpha/src/index.ts,beta/README.md,.hidden/x}`,
    and the seeded settings. Run `npx playwright install chromium`.
  - Verify: `npm run test:e2e` passes; no `corral-test-e2e-*` session is left in `herdr session list`.

- [x] **G0 Stage 0 gate**: run the `spec-reviewer` agent on stage 0; fix its must-fix findings, then tick G0 yourself
  (no human checkpoint) and continue.

## Stage 1 — The core flow (usable)

- [x] **T1.1 App composition**
  - Spec: 01 §Packages, §Application config, §Theia AI stays off.
  - Tests first: `e2e/shell.spec.ts`: the document title contains "Corral"; the left activity bar has Search,
    Source Control and Run and Debug. `e2e/ai-disabled.spec.ts`: no AI/chat view is visible in any panel.
  - Do: add the packages and `theiaPlugins` to both apps; add `download:plugins`; set the frontend/backend config;
    turn off the getting-started page.
  - Verify: `npm run download:plugins && npm run build:browser && npm run test:e2e`.

- [x] **T1.2 Protocol and preferences**
  - Spec: 00 §Components, 05 §Preference schema.
  - Tests first: `common/preferences-schema.test.ts`: every key from spec 05 exists with the right type, default
    and `application` scope.
  - Do: `common/protocol.ts` (service paths, `CorralProjectService`, `CorralHerdrService`, request/result types),
    `common/preferences-schema.ts`, and the frontend binding (`PreferenceContribution` plus a
    `CorralPreferences` proxy). Delete `sanity.test.ts`.
  - Verify: `npm test && npm run typecheck`.

- [x] **T1.3 Project list logic**
  - Spec: 03 §Project list (rules 1–7).
  - Tests first: `common/project-list.test.ts`: one `it` per rule, plus `visibleRoots` leaving out hidden and
    missing entries.
  - Verify: `npm test -- project-list`.

- [x] **T1.4 Startup command resolution**
  - Spec: 05 §Startup-command resolution.
  - Tests first: `common/startup-command.test.ts`: the six cases listed in the spec.
  - Verify: `npm test -- startup-command`.

- [x] **T1.5 HerdrCli (unit) and binary resolver**
  - Spec: 04 §herdr-cli.ts, §Resolving the binary.
  - Tests first: `node/herdr-cli.test.ts`: the exact argv for each method, with and without a session; paths with
    spaces, `"` and `$`; error mapping for exit 1 JSON / exit 2 / ENOENT / timeout / bad JSON; `getWorkspace`
    returns undefined on not-found. `node/herdr-binary.test.ts`: the lookup order, with real executables in a temp
    dir (the resolver takes the `PATH` string and the candidate list as inputs) and the login-shell step going
    through the injected `execFileFn`.
  - Verify: `npm test -- herdr`.

- [x] **T1.6 HerdrCli (integration)**
  - Spec: 04 §Facts.
  - Tests first: `node/herdr-cli.int.test.ts` against the harness: create a workspace in a temp dir (with a space
    in its name); get it; create a tab in a sub-folder; `pane list` shows that cwd; `runInPane(pane, 'echo corral-ok')`,
    then `herdr pane read` contains `corral-ok`; `getWorkspace('w999')` returns undefined.
  - Verify: `npm run test:int`.

- [x] **T1.7 Workspace mapping and openTab**
  - Spec: 04 §Workspace mapping, §The open-tab flow.
  - Tests first: `node/workspace-map-store.test.ts` (round-trip; corrupt file → empty plus a warning; atomic write;
    entries keyed by session). `common/workspace-resolution.test.ts` (reuse / create). `node/corral-herdr-service.test.ts`
    with a fake cli: server down → `server_not_running`; first call creates the workspace and uses root_pane;
    second call reuses it and creates a tab; an empty command skips `runInPane`; two concurrent calls for the same
    project create exactly one workspace; a stale mapping is recreated. `node/corral-herdr-service.int.test.ts`:
    two `openTab` calls on the same project → 1 workspace, 2 tabs, both cwds correct.
  - Do: bind the service in `node/corral-backend-module.ts` at the protocol path.
  - Verify: `npm test && npm run test:int`.

- [x] **T1.8 Project scanning service**
  - Spec: 03 §Discovery.
  - Tests first: `node/project-scanner.int.test.ts` (real temp dirs: dot-dirs, `node_modules`, a file symlink, a
    dir symlink, a duplicate via symlink, an unreadable or missing root) and `node/corral-project-service.test.ts`
    (`missing` computation; `~` expansion).
  - Do: bind `CorralProjectService`; make sure the managed `corral.code-workspace` file gets created (spec 03
    §Roots sync; the sync itself comes in T1.14).
  - Verify: `npm test && npm run test:int`.

- [x] **T1.9 herdr terminal widget**
  - Spec: 02 §The herdr terminal widget.
  - Tests first: `e2e/herdr-terminal.spec.ts`: on startup a main-area tab titled `herdr` exists, with no close
    button; the e2e session's `status server --json` reports running and the terminal's xterm buffer shows herdr's
    UI (look at it once with the Playwright MCP and pin a stable string); typing `ctrl+b` then `q` (detach) shows the
    "herdr exited · Reattach" overlay; clicking Reattach attaches again. **Survives the IDE (R15):** create a
    workspace labelled `persist-check` through the CLI, close the page, check `status server --json` still reports
    running, open a new page → the widget attaches and `workspace list` still has `persist-check`.
  - Do: `browser/herdr/herdr-terminal-contribution.ts` and the overlay; the commands `corral.herdr.focus` and
    `corral.herdr.reattach`; `resolveBinary()` on the backend service.
  - Verify: `npm run build:browser && npm run test:e2e -- herdr-terminal`.

- [x] **T1.10 Projects view (read-only tree)**
  - Spec: 03 §The tree widget (no toolbar or context menu yet), 02 §Default layout.
  - Tests first: `e2e/projects.spec.ts`: the right panel shows the Projects view with roots `alpha` and `beta` (not
    `.hidden`), sorted; expanding `alpha` shows `src`; clicking `src/index.ts` opens an editor **in the left half**
    (its tab bar doesn't contain the herdr tab).
  - Do: `browser/projects/*` (container, model, widget, contribution with `area: 'right'`), `data-testid`s,
    `initializeLayout` default layout, and `corral.resetLayout`.
  - Verify: `npm run build:browser && npm run test:e2e -- projects`.

- [x] **T1.11 The + action**
  - Spec: 03 (+ action), 04 §The open-tab flow (frontend side), 05 §Startup-command resolution.
  - Tests first: `e2e/new-tab.spec.ts`: hover `alpha/src` → `+` is visible; click it → in the e2e session,
    `workspace list` has exactly one workspace labelled `alpha`, and `pane list` has a pane with cwd ending
    `alpha/src`; clicking `+` on `alpha` adds a second tab in the same workspace; the herdr widget is active
    afterwards. Set `corral.startupCommand` to `echo corral-e2e` in the seeded settings and check `pane read` shows
    it. `⌥⌘T` on a focused folder does the same.
  - Do: the command `corral.herdr.newTab`, the + button render, the keybinding, and the error notification with
    the "Open herdr" action.
  - Verify: `npm run build:browser && npm run test:e2e -- new-tab`.

- [x] **T1.12 Editor placement guard**
  - Spec: 02 §Editor placement guard.
  - Tests first: `common/placement.test.ts` (no editors → split-left of herdr; editors exist → tab-after the most
    recent; widget landed in herdr's group → move). `e2e/placement.spec.ts`: with the herdr terminal focused, open
    a file via Quick Open (`⌘P`) → it opens in the left half, and the herdr tab is in the right half of the main area.
  - Verify: `npm test && npm run test:e2e -- placement`.

- [x] **T1.13 First run**
  - Spec: 05 §First run.
  - Tests first: `common/first-run.test.ts` (the should-run predicate). `e2e/first-run.spec.ts` with an
    un-seeded config: the folder picker appears; choosing `e2e/fixtures/projects` fills the tree and sets
    `corral.firstRunCompleted`; after a restart the picker doesn't show.
  - Verify: `npm test && npm run test:e2e -- first-run`.

- [x] **T1.14 Workspace roots sync and the managed workspace**
  - Spec: 03 §Roots sync, 01 §Other shell behaviour (managed workspace), D6.
  - Tests first: `common/roots-diff.test.ts` (add/remove sets; order-insensitive; no-op when equal).
    `e2e/roots.spec.ts`: the workspace in use is `<configDir>/corral.code-workspace`; Search (`⇧⌘F`) for a string
    that exists only in `beta/README.md` finds it; add `beta`'s path to `corral.hiddenProjects` through the
    preference service → the same search finds nothing; the window didn't reload (a marker set on `window` survives).
  - Verify: `npm test && npm run test:e2e -- roots`.

- [x] **G1 Stage 1 gate**
  1. Run all suites: `npm test && npm run test:int && npm run test:e2e`.
  2. Run the `spec-reviewer` agent for stage 1 and fix every finding marked must-fix (each fix is its own commit).
  3. **Human checkpoint. Stop the loop.** Print to the user: how to run it (`npm run build:electron && npm run start:electron`; this uses their real herdr session, which is intended),
     what to try (pick project folders, open projects, click +, open files, search; quit Corral and check
     `herdr status server` still reports running, then relaunch and see it reattach), and ask for their go-ahead or feedback. Put that feedback
     in the specs before continuing. Only tick G1 after the user approves.

## Stage 2 — Managing projects

- [x] **T2.1 Hide / unhide and the eye toggle; empty states**
  - Spec: 03 §View toolbar, §Context menu (hide/unhide), §Empty states.
  - Tests first: `e2e/hide.spec.ts`: hide `beta` → it disappears; the eye shows it dimmed; unhide restores it;
    with no roots the empty state appears with **Choose folders…**.
  - Verify: `npm run test:e2e -- hide`.

- [ ] **T2.2 Add / remove projects; missing projects**
  - Spec: 03 §View toolbar (add), §Context menu (remove), §Project list rule 4.
  - Tests first: `e2e/add-remove.spec.ts`: add a temp folder outside the scan root → it appears (manual); remove
    it → it's gone and the folder still exists on disk; deleting a manual project's folder on disk then pressing
    Refresh → it shows as missing and its + is disabled.
  - Verify: `npm run test:e2e -- add-remove`.

- [ ] **T2.3 Per-project startup command; remove mapping**
  - Spec: 05 §"Set startup command…", 03 §Context menu.
  - Tests first: `e2e/startup-override.spec.ts`: set `alpha`'s command to `echo alpha-override` → + on alpha runs
    it, while + on beta still runs the global command; set an empty value → a plain shell (no command sent);
    "Remove from herdr mapping" → the next + creates a new workspace, and the old one still exists.
  - Verify: `npm run test:e2e -- startup-override`.

- [ ] **T2.4 File operations from the tree**
  - Spec: 03 §Selection, §Context menu.
  - Tests first: `e2e/file-ops.spec.ts`: New File in `alpha/src` → the file exists on disk and opens in the left
    half; Rename; Delete (confirm) → it's gone.
  - Verify: `npm run test:e2e -- file-ops`.

- [ ] **T2.5 Rescan triggers and window title**
  - Spec: 03 §Discovery (rescan), 01 §Other shell behaviour.
  - Tests first: `e2e/rescan.spec.ts`: create `e2e/fixtures/projects/gamma` at runtime → it appears after Refresh;
    change `corral.scanRoots` in settings → the tree updates without Refresh; the title becomes `Corral — alpha`
    after opening `alpha/src/index.ts`. Clean up `gamma` in `afterEach`.
  - Verify: `npm run test:e2e -- rescan`.

- [ ] **T2.6 herdr key passthrough**
  - Spec: 02 §Key handling.
  - Tests first: `e2e/herdr-keys.spec.ts`: with the herdr terminal focused, the herdr prefix `ctrl+b` followed by
    `c` (herdr's default `new_tab` = `prefix+c`) creates a tab (checked with `tab list`); `⌘P`
    still opens Quick Open.
  - Verify: `npm run test:e2e -- herdr-keys`.

- [ ] **G2 Stage 2 gate**: same as G1 (all suites → `spec-reviewer` → fix → **human checkpoint, stop**).

## Stage 3 — Look, feel, ship

- [ ] **T3.1 Corral Dark theme and fonts**
  - Spec: 06 §Corral Dark theme, §Typography; DESIGN.md.
  - Tests first: `browser/theme/corral-dark-theme.test.ts`: the theme JSON has every required workbench key group
    from spec 06 and all 16 ANSI colours; every colour value is a DESIGN.md token (the test imports the token
    table). `e2e/theme.spec.ts`: the computed `--theia-editor-background` equals the token `bg`.
  - Do: follow the `corral-polish` skill (Phase 1).
  - Verify: `npm test && npm run test:e2e -- theme`.

- [ ] **T3.2 Chrome polish pass (impeccable)**
  - Spec: 06 §Chrome styling; DESIGN.md.
  - Do: follow the `corral-polish` skill (Phases 2–3): one critique round, a batch of fixes, one confirmation
    round. Screenshots go to `docs/screenshots/`.
  - Verify: the full E2E suite is still green; before/after screenshots are committed.

- [ ] **T3.3 Branding wired in**
  - Spec: 06 §Icons and branding.
  - Tests first: `e2e/branding.spec.ts`: the favicon link points to the Corral favicon; the application name shown
    in Help → About is "Corral".
  - Verify: `npm run test:e2e -- branding`.

- [ ] **T3.4 README screenshots and taste check**
  - Do: capture the hero screenshot (4 panels, 3 projects, 2 herdr tabs running) with the Playwright MCP; apply the
    `design-taste-frontend` pre-flight to the README presentation; update README §Screenshots.
  - Verify: the images render in the README preview.

- [ ] **T3.5 Package Corral.app**
  - Spec: 07.
  - Do: `electron-builder` config and the `package:mac` script (`.app` only, no DMG).
  - Verify: `npm run package:mac` produces `electron-app/dist/mac-arm64/Corral.app`; `open` it; the window title
    contains "Corral"; the herdr terminal attaches (use a test session:
    `CORRAL_HERDR_SESSION=corral-test-pkg open -n …/Corral.app --env …` or `.../Contents/MacOS/Corral` with the
    env var); quit it and clean up the session.

- [ ] **G3 Final gate**: all suites → `spec-reviewer` (whole product) → fix → **human checkpoint**: hand over the
  `.app` path and the README.

---

## Progress log

<!-- /next-task appends one line per finished task: `- YYYY-MM-DD T1.3 — project-list rules 1–7 (12 tests)` -->
- 2026-09-29 T0.1 — Theia 1.76 app scaffolded; browser build passes, serves 200 on :3000 (0 tests)
- 2026-09-29 T0.2 — jest unit/int configs, eslint flat config, root scripts; test/typecheck/lint green (1 test)
- 2026-09-29 T0.3 — herdr test harness (startHerdr/assertTestSession; cli field deferred to T1.6) (3 tests)
- 2026-09-29 T0.4 — Playwright E2E skeleton on :3100 with herdr global setup/teardown and fixtures (1 test)
- 2026-09-29 G0 — spec-reviewer: no must-fix; pinned @theia/playwright exact (stage 0 complete)
- 2026-09-29 T1.1 — packages + plugins + app config in both apps; AI not installed (D9); shell/AI-disabled E2E green (3 tests)
- 2026-09-29 T1.2 — protocol.ts, preferences-schema.ts (8 keys, user scope), CorralPreferences binding; module renamed corral-frontend-module; sanity test removed (19 tests)
- 2026-09-29 T1.3 — buildProjectList rules 1–7 + visibleRoots (8 tests)
- 2026-09-29 T1.4 — owningProject + resolveStartupCommand (11 tests)
- 2026-09-29 T1.5 — HerdrCli (argv/error mapping, injectable execFileFn) + HerdrBinaryResolver (17 tests)
- 2026-09-29 T1.6 — HerdrCli against real headless herdr; fixed pane run empty stdout; harness now returns cli; int test lives in corral-core/test/ (3 int + 1 unit tests)
- 2026-09-29 T1.7 — workspace map store, resolveWorkspace, CorralHerdrServiceImpl (per-project serialised openTab), backend module + RPC binding (17 unit + 1 int tests)
- 2026-09-29 T1.8 — scanProjects, CorralProjectServiceImpl (missing, ~ expansion, managed corral.code-workspace created on first list), RPC bound (4 int + 4 unit tests)
- 2026-09-29 T1.9 — herdr terminal tab in main area (non-closable, env cleared, opens before start), exited/not-found placeholder tab with Reattach, R15 persistence (4 E2E)
- 2026-09-29 T1.10 — Projects view (FileTree on a synthetic root of project DirNodes) in the right panel, default layout + corral.resetLayout, files open left of herdr (3 E2E)
- 2026-09-29 T1.11 — + button on every directory row, corral.herdr.newTab (startup command, retry when the server is down, error notification), ⌥⌘T (2 E2E)
- 2026-09-29 T1.12 — placementFor/needsMove (common), EditorPlacementGuard moves foreign widgets out of herdr's tab bar; replaces D12's interim rule (6 unit + 1 E2E)
- 2026-09-29 T1.13 — first run: Theia folder dialog, scan roots stored with ~, firstRunCompleted, corral.projects.chooseScanRoots with confirmation; tree reloads on pref change (8 unit + 1 E2E)
- 2026-09-29 T1.14 — ProjectListService (single project list), WorkspaceRootsSync moves into <config>/corral.code-workspace and diffs roots without reloading; search covers visible projects only (5 unit + 1 E2E)
- 2026-09-29 G1 — suites green (97 unit, 11 int, 15 E2E); spec-reviewer: no must-fix; user pre-approved the human checkpoint (review pending, see FOR-REVIEW)
- 2026-09-29 T2.1 — Hide/Unhide project context-menu items, eye toolbar toggle (hidden rows at 50%), empty states with Choose/Change folders… (2 unit + 2 E2E)
