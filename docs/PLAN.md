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

- [x] **T2.2 Add / remove projects; missing projects**
  - Spec: 03 §View toolbar (add), §Context menu (remove), §Project list rule 4.
  - Tests first: `e2e/add-remove.spec.ts`: add a temp folder outside the scan root → it appears (manual); remove
    it → it's gone and the folder still exists on disk; deleting a manual project's folder on disk then pressing
    Refresh → it shows as missing and its + is disabled.
  - Verify: `npm run test:e2e -- add-remove`.

- [x] **T2.3 Per-project startup command; remove mapping**
  - Spec: 05 §"Set startup command…", 03 §Context menu.
  - Tests first: `e2e/startup-override.spec.ts`: set `alpha`'s command to `echo alpha-override` → + on alpha runs
    it, while + on beta still runs the global command; set an empty value → a plain shell (no command sent);
    "Remove from herdr mapping" → the next + creates a new workspace, and the old one still exists.
  - Verify: `npm run test:e2e -- startup-override`.

- [x] **T2.4 File operations from the tree**
  - Spec: 03 §Selection, §Context menu.
  - Tests first: `e2e/file-ops.spec.ts`: New File in `alpha/src` → the file exists on disk and opens in the left
    half; Rename; Delete (confirm) → it's gone.
  - Verify: `npm run test:e2e -- file-ops`.

- [x] **T2.5 Rescan triggers and window title**
  - Spec: 03 §Discovery (rescan), 01 §Other shell behaviour.
  - Tests first: `e2e/rescan.spec.ts`: create `e2e/fixtures/projects/gamma` at runtime → it appears after Refresh;
    change `corral.scanRoots` in settings → the tree updates without Refresh; the title becomes `Corral — alpha`
    after opening `alpha/src/index.ts`. Clean up `gamma` in `afterEach`.
  - Verify: `npm run test:e2e -- rescan`.

- [x] **T2.6 herdr key passthrough**
  - Spec: 02 §Key handling.
  - Tests first: `e2e/herdr-keys.spec.ts`: with the herdr terminal focused, the herdr prefix `ctrl+b` followed by
    `c` (herdr's default `new_tab` = `prefix+c`) creates a tab (checked with `tab list`); `⌘P`
    still opens Quick Open.
  - Verify: `npm run test:e2e -- herdr-keys`.

- [x] **G2 Stage 2 gate**: same as G1 (all suites → `spec-reviewer` → fix → **human checkpoint, stop**).

## Stage 3 — Look, feel, ship

- [x] **T3.1 Corral Dark theme and fonts**
  - Spec: 06 §Corral Dark theme, §Typography; DESIGN.md.
  - Tests first: `browser/theme/corral-dark-theme.test.ts`: the theme JSON has every required workbench key group
    from spec 06 and all 16 ANSI colours; every colour value is a DESIGN.md token (the test imports the token
    table). `e2e/theme.spec.ts`: the computed `--theia-editor-background` equals the token `bg`.
  - Do: follow the `corral-polish` skill (Phase 1).
  - Verify: `npm test && npm run test:e2e -- theme`.

- [x] **T3.2 Chrome polish pass (impeccable)**
  - Spec: 06 §Chrome styling; DESIGN.md.
  - Do: follow the `corral-polish` skill (Phases 2–3): one critique round, a batch of fixes, one confirmation
    round. Screenshots go to `docs/screenshots/`.
  - Verify: the full E2E suite is still green; before/after screenshots are committed.

- [x] **T3.3 Branding wired in**
  - Spec: 06 §Icons and branding.
  - Tests first: `e2e/branding.spec.ts`: the favicon link points to the Corral favicon; the application name shown
    in Help → About is "Corral".
  - Verify: `npm run test:e2e -- branding`.

- [x] **T3.4 README screenshots and taste check**
  - Do: capture the hero screenshot (4 panels, 3 projects, 2 herdr tabs running) with the Playwright MCP; apply the
    `design-taste-frontend` pre-flight to the README presentation; update README §Screenshots.
  - Verify: the images render in the README preview.

- [x] **T3.5 Package Corral.app**
  - Spec: 07.
  - Do: `electron-builder` config and the `package:mac` script (`.app` only, no DMG).
  - Verify: `npm run package:mac` produces `electron-app/dist/mac-arm64/Corral.app`; `open` it; the window title
    contains "Corral"; the herdr terminal attaches (use a test session:
    `CORRAL_HERDR_SESSION=corral-test-pkg open -n …/Corral.app --env …` or `.../Contents/MacOS/Corral` with the
    env var); quit it and clean up the session.

- [x] **G3 Final gate**: all suites → `spec-reviewer` (whole product) → fix → **human checkpoint**: hand over the
  `.app` path and the README.

---

## Stage 4 — Changes view (spec 09)

Spec 09 is the contract; its rule ids (C1–C14) are cited below. Before coding against any Theia API, open its
`.d.ts` in `node_modules` (spec 09 names every one it uses). Unit tests run with
`npx jest -c corral-core/test/jest.config.ts <name>` from the repo root (plain `jest` inside corral-core fails on TS).

- [x] **T4.1 Changes logic**
  - Spec: 09 §Rules C1–C8, §Code layout `common/changes.ts`.
  - Tests first: `common/changes.test.ts`, one `it` per rule:
    - C1: groups follow `roots` order; a repo path under no root is dropped.
    - C3: a file maps to its deepest root (roots `/p` and `/p/inner` → `/p/inner/x` belongs to `/p/inner`); a root
      with no files is omitted; `name` is the root's last segment.
    - C4: the same path in `index` (letter `A`) and `workingTree` (letter `M`) gives one row with letter `M`.
    - C5: files sort by `rel` (`b/a.ts` after `a.ts`, `rel` has no leading slash).
    - C6: `changeKind` for `A`, `U` → added; `D` → deleted; `!` → conflict; `M`, `R`, `C`, `T` → modified; a
      missing letter gives `M`/modified in `groupChanges`; `strikeThrough: true` → deleted.
    - C7: with `now = 100_000`, a write at 70_001 is live and one at 70_000 is not; a write to an unlisted path
      adds no row; a live file makes its group `live`.
    - `liveFolders`: live `/p/src/a/x.ts` in project `/p` → `{'/p/src/a', '/p/src', '/p'}` and not `/`.
    - `nextExpiry`: returns the smallest `write + 30_000` greater than `now`; `undefined` when none.
  - Do: implement `common/changes.ts` exactly as spec 09's signatures. Pure: no Theia/DOM/Node imports. Reuse
    `owningProject` (`common/startup-command.ts`) and the group order of `pickChange` (`common/scm-change.ts`).
  - Verify: `npx jest -c corral-core/test/jest.config.ts changes`, then `npm test && npm run typecheck && npm run lint`.

- [x] **T4.2 ChangesService**
  - Spec: 09 §`browser/changes/changes-service.ts`, C7, C8.
  - Tests first: none at unit level (pure wiring, like `ProjectListService`); exercised by T4.4/T4.5 E2E.
  - Do: implement it; bind `ChangesService` `toSelf().inSingletonScope()` in `corral-frontend-module.ts`. Open and
    code against: `node_modules/@theia/scm/lib/browser/scm-service.d.ts`, `.../scm-repository.d.ts`,
    `.../scm-provider.d.ts`, `node_modules/@theia/filesystem/lib/browser/file-service.d.ts` (`onDidFilesChange`),
    `node_modules/@theia/filesystem/lib/common/files.d.ts` (`FileChangesEvent.changes`, `FileChangeType`).
    `FileChangeType` is a `const enum`: import it from `@theia/filesystem/lib/common/files`.
  - Verify: `npm run typecheck && npm run lint && npm test && npm run build:browser`.

- [x] **T4.3 Projects + Changes view container**
  - Spec: 09 C14, C11; 02 §Default layout.
  - Tests first:
    - `e2e/panels.spec.ts`: the tab locator becomes `.theia-app-right #shell-tab-corral-projects-container`.
    - New `e2e/changes-view.spec.ts`, test "Projects and Changes are stacked in one right-panel container":
      after `page.goto('/')`, `#theia-right-content-panel [data-testid="corral-projects"]` and
      `#theia-right-content-panel [data-testid="corral-changes"]` are both visible, and the Projects part's top is
      above the Changes part's top (compare `boundingBox().y`).
    - Run them; they fail because the container does not exist.
  - Do: `browser/projects/projects-view-container.ts` (spec 09 §projects-view-container), `ChangesWidget` with only
    the C11 empty state for now (`browser/changes/changes-widget.ts` + its `WidgetFactory`, id `corral-changes`),
    `viewContainerId` in `ProjectsContribution`, and the old-layout fix-up in `ProjectsContribution`'s
    `onDidInitializeLayout` (pattern: `browser/scm/corral-scm-contribution.ts`).
  - Verify: `npm run build:browser && npx playwright test -c e2e/playwright.config.ts panels changes-view shell projects placement`.

- [x] **T4.4 Changes tree**
  - Spec: 09 C2, C3, C5, C7, C9–C11, C13; §changes-tree, §changes-widget, §changes-contribution, §CSS.
  - Tests first: in `e2e/changes-view.spec.ts` add one test that builds a temp repo exactly like `e2e/changes.spec.ts`
    (`mkdtempSync` under `realpathSync(tmpdir())`, `git init`, commit `a.txt` and `.gitignore` containing `ignored.log`,
    then write `a.txt` = `two`, `new.txt`, `ignored.log`), adds it via `corral.extraProjects` (restore the original
    settings in `finally`), then:
    - (a) the Changes view shows a project row `delta` whose `.corral-change-count` is `2`, and rows `a.txt` (letter
      `M`) and `new.txt` (letter `U`), and no `ignored.log` (`expect.poll`, 30 s: git refresh is async);
    - (b) the `a.txt` row has class `corral-live` (write it again right before asserting if needed);
    - (c) clicking `a.txt` shows `.monaco-diff-editor`;
    - (d) right-click `a.txt` → menu has Open File, Reveal in Projects, Copy Path; right-click `delta` → Show Changes.
      Wait for the menu to render before counting items; close menus by clicking `#theia-statusBar` at `{x:1,y:1}`
      (Escape does not close Theia menus);
    - (e) `git add -A` + commit (with `-c user.name=t -c user.email=t@t`) → the `delta` row disappears and
      `[data-testid="corral-changes-empty"]` is visible.
  - Do: `changes-tree.ts`, the full `changes-widget.ts`, `changes-contribution.ts` (commands, menus,
    `ColorContribution`), `style/changes.css`, bindings in `corral-frontend-module.ts`.
  - Verify: `npm run build:browser && npx playwright test -c e2e/playwright.config.ts changes-view changes panels`.

- [x] **T4.5 Marks in the Projects tree**
  - Spec: 09 C12.
  - Tests first: extend the T4.4 test, before the commit step: expand `delta` in the Projects tree (click the row,
    `ArrowRight`); the `a.txt` row has `.corral-change-letter` with text `M`; the `delta` row has
    `.corral-change-count` with text `2`; the `delta` row has class `corral-live`. After the commit, the `delta`
    row has no `.corral-change-count` and `a.txt` has no `.corral-change-letter`.
  - Do: in `ProjectsWidget`, inject `ChangesService`; `createNodeClassNames` adds `corral-live`;
    `renderTailDecorations` renders the letter / count spans before the `+` button; `update()` on `onDidChange`.
    No `TreeDecoratorService`.
  - Verify: `npm run build:browser && npx playwright test -c e2e/playwright.config.ts changes-view projects hide changes`.

- [x] **T4.6 Docs, full suite, package**
  - Spec: 09 (all). README: add a "Changes (right, under Projects)" bullet to the feature list and a CHANGES block
    to the diagram (also fix the diagram's duplicated `debug` line).
  - Do: walk C1–C14 and confirm each has a test or visible code; fix gaps. Then package and install:
    `npm run package:mac`; `osascript -e 'quit app "Corral"'` and wait until `pgrep -f "Corral.app/Contents/MacOS"`
    is empty (never replace the app while it runs); `rm -rf /Applications/Corral.app && ditto
    electron-app/dist/mac-arm64/Corral.app /Applications/Corral.app && open /Applications/Corral.app`.
  - Verify: `npm test && npm run typecheck && npm run lint && npm run test:e2e` (`roots.spec.ts` and
    `first-run.spec.ts` are known flaky late in a full run: re-run them alone, they must pass). The installed app
    shows Projects over Changes and herdr attached.

- [x] **G4 Stage 4 gate**: all suites → `spec-reviewer` on spec 09 and stage 4 → fix must-fix findings →
  **human checkpoint, stop**.

## Stage 5 — Review fixes (full-app code review, 2026-09-29)

Findings from the two-axis review (standards + spec) of `22ada6e...HEAD` and the G4 spec-review should-fixes,
each checked against the code. Not acted on, with the reason recorded in D36: `describe.skip` when herdr is
missing (spec 08 sanctions it); hand-built backend services (constructor injection keeps them unit-testable);
`server_not_running` matched by message (the RPC boundary drops the `HerdrError` class).

- [x] **T5.1 Missing projects always listed (spec 03 rule 4)**
  - Tests first: `common/project-list.test.ts`: `shownEntries(all, false)` keeps a hidden **missing** project and
    drops a hidden present one; `shownEntries(all, true)` keeps all.
  - Do: `shownEntries` in `common/project-list.ts`; `ProjectListService.entries` calls it. *(Done instead by
    `entries(false)` calling `buildProjectList`, whose rule-4 unit test already covers this; plus the
    `add-remove.spec.ts` E2E.)*
  - Verify: `npm test`, typecheck, lint.

- [x] **T5.2 Single click previews a file (spec 03 §Opening files)**
  - Tests first: `e2e/projects.spec.ts`: one click on a file opens an editor tab that is a preview
    (`.theia-editor-preview-title-unpinned`, or the class Theia 1.76 really uses: check `@theia/editor`);
    a double click pins it.
  - Do: `ProjectsWidget.tapNode` calls `model.previewNode` when `workbench.list.openMode` is `singleClick`
    (same as `NavigatorWidget.tapNode`).
  - Verify: `npx playwright test -c e2e/playwright.config.ts e2e/projects.spec.ts e2e/placement.spec.ts`.

- [x] **T5.3 Robustness fixes**
  - Tests first:
    - `node/workspace-map-store.test.ts`: two concurrent `set`s for different projects both persist.
    - `common/project-list.test.ts` or a new unit: none for the model race (wiring); covered by existing E2E.
  - Do:
    - `WorkspaceMapStore`: serialise read-modify-write through one promise chain.
    - `ProjectsModel.rebuild`: generation guard so an older rebuild cannot publish after a newer one.
    - `HerdrTerminalContribution`: register the dispose of the `output` listener before `widget.start()`.
    - `CorralProjectServiceImpl.list`: dedupe with a `Set`, check paths in parallel.
    - `corral-backend-module.ts`: one `resourcesPath` constant instead of the repeated cast.
  - Verify: `npm test`, `npm run test:int`, typecheck, lint.

- [x] **T5.4 Changes: cheaper recompute, Reveal scrolls**
  - Tests first: `common/changes.test.ts`: `sameGroups(a, b)` is true for equal results and false when a
    letter, a live flag or a file differs. `common/scm-change.test.ts`: `pickChange` behaviour unchanged.
  - Do:
    - `ChangesService`: index files and live folders in `Map`/`Set` during `recompute`, so `fileFor`/`isLive`
      are O(1); one pass over SCM groups; fire `onDidChange` only when `sameGroups` is false.
    - Reveal in Projects scrolls the selected row into view (use what `TreeWidget` exposes in 1.76; check the `.d.ts`).
  - Verify: `npm test`; `npx playwright test -c e2e/playwright.config.ts e2e/changes-view.spec.ts e2e/changes.spec.ts`.

- [x] **T5.5 Standards cleanup**
  - Tests first: `common/paths.test.ts` for `trimSlash` and `isInside` (moved, not new behaviour).
  - Do:
    - Delete the empty `browser/corral-core-contribution.ts` and its binding.
    - Fix the misplaced `resolveBinary` comment in `common/protocol.ts` and the stale "T1.5" comment in `test/herdr-harness.ts`.
    - ~~Move the two herdr int tests into `node/`~~: kept in `test/`, because `rootDir: src` would pull the harness into
      the shipped `lib/` (D36).
    - `common/paths.ts`: one `trimSlash` and one `isInside`, used by `project-list.ts`, `roots-diff.ts`,
      `startup-command.ts` and `changes.ts`.
    - Browser code uses `FileUri.fsPath` instead of Node's `fileURLToPath` (4 files).
    - One `showChanges` implementation: the Changes view runs the Projects command.
    - `new-tab-contribution.ts` uses `OpenTabRequest`.
    - `changes-tree.ts` guards on a `kind` tag instead of duck typing.
    - Readable names in `common/changes.ts`; drop the `withoutPath` alias; drop `liveMs` params the code never passes.
    - Spec 04 binary candidate order: `~/.local/bin`, then Homebrew, then `/usr/local/bin`.
    - Split `projects-actions-contribution.ts` if a clean seam exists (SCM/Show Changes), else leave it. Left as is:
      every command reads the same selection (D36).
  - Verify: `npm test`, `npm run test:int`, typecheck, lint, full `npm run test:e2e`.

- [x] **T5.6 Scan warnings in the Output channel "Corral" (spec 03)**
  - Tests first: `node/project-scanner.int.test.ts` (or unit): `list()` returns the warning for an unreadable
    scan root in `ProjectScanResult.warnings`.
  - Do: carry warnings over RPC; the frontend appends them to an `OutputChannel` named `Corral`
    (`@theia/output`, already in the app; declare it in `corral-core/package.json`, D36).
  - Verify: `npm test`, `npm run test:int`, typecheck, lint.

- [x] **T5.7 Projects tree state survives a restart (spec 03, closes D17/D18 deferrals)**
  - Tests first: `e2e/projects.spec.ts`: expand a project and turn on show-hidden, reload the page, both are kept.
  - Do: `ProjectsWidget.storeState`/`restoreState` save expanded project/folder ids and `showHidden`; re-apply
    them after the first rebuild.
  - Verify: `npx playwright test -c e2e/playwright.config.ts e2e/projects.spec.ts e2e/hide.spec.ts`.

- [x] **T5.8 Reset Layout sets sizes (spec 02)**
  - Tests first: `e2e/panels.spec.ts`: after `corral.resetLayout`, the right panel is 300 px ± 2 and the left
    panel opens at 280 px ± 2.
  - Do: `ApplicationShell.resize(size, area)` in `applyDefaultLayout`. The 50/50 editor/herdr split only if a
    public API does it; otherwise amend spec 02 in this commit.
  - Verify: `npx playwright test -c e2e/playwright.config.ts e2e/panels.spec.ts e2e/shell.spec.ts`.

- [x] **T5.9 Stage 4 test gaps**
  - Tests first, all in `e2e/changes-view.spec.ts`:
    - a saved layout with Projects outside the container is fixed up on reload (C14);
    - Open File opens the plain editor, Copy Path puts the path on the clipboard (C10);
    - Enter on a file opens the diff, click on a project row toggles it, expansion survives a refresh (C9);
    - a hidden project's changes are not listed (C1).
  - Do: fix whatever these tests expose.
  - Verify: `npx playwright test -c e2e/playwright.config.ts e2e/changes-view.spec.ts`.

- [x] **T5.10 E2E hygiene**
  - Do: `e2e/helpers.ts` for the copied helpers (`row`, `settingsFile`, `writeSettings`, `closeMenu`, `git`, temp
    dirs); replace fixed `waitForTimeout` sleeps with polled expectations where a condition exists; await
    `stopServer()` in `first-run.spec.ts`.
  - Verify: full `npm run test:e2e` twice.

- [x] **T5.11 Specs match decisions**
  - Do: amend spec 02 (herdr tab not pinned, D11), spec 03 (no Open / Open to the Side, no Rename on roots, D21),
    spec 05 (`User` scope, D17; "Use global startup command" command, D20), spec 06 (`herdr.css`/`changes.css`,
    `--theia-*` variables, icon leftovers, D27), spec 09 (eager children, +1 ms expiry, 50 ms coalescing),
    `AGENTS.md` CSS rule. Add D36 (this stage's dispositions, including the int tests staying in `test/` and
    `projects-actions-contribution.ts` staying one file).
  - Verify: `npm test`; grep that each amended spec cites its decision.

- [x] **G5 Stage 5 gate**: all suites → `spec-reviewer` on stage 5 → fix must-fix findings → **human checkpoint, stop**.

## Stage 6 — Resource monitor (spec 10)

Spec 10 is the contract; its rule ids (R1–R12) are cited below. Every Theia API it names was checked in
`node_modules` (`status-bar-types.d.ts`, `status-bar.js`, `message-service.d.ts`, `preference-proxy.d.ts`,
`markdown-string.d.ts`, `electron-main-application.js`); open a `.d.ts` before using any other. Unit tests run with
`npx jest -c corral-core/test/jest.config.ts <name>` from the repo root.

- [ ] **T6.1 Resource logic**
  - Spec: 10 R3–R9, §Code layout `common/resource-usage.ts`.
  - Tests first: `common/resource-usage.test.ts`, one `it` per rule:
    - R3 `parsePs`: `'  12    1  2048  3.5 /bin/zsh\n  13   12  1024 97.0 Corral Helper (Renderer)\n'` gives two rows
      (`{pid:12,ppid:1,rssKb:2048,cpu:3.5,command:'/bin/zsh'}`, and the second with command `Corral Helper (Renderer)`);
      blank and malformed lines (`'garbage'`, `'1 2 x 4 y'`) are skipped.
    - `subtree`: rows 1←2←3, 1←4 and 9 (ppid 8) give `subtree(rows, 1)` = {1,2,3,4}; a root that is not in the rows gives
      an empty set.
    - R4 `summarize`: rss 1024 and 2048 KiB → `memBytes` 3 145 728; cpu 50 and 30 with 10 cores → `cpuPct` 8; `count` 2;
      pids outside the set are ignored.
    - R5 `memLevel` with total 1000 and limits 50/75: 499 → normal, 500 → warning, 749 → warning, 750 → danger; with
      limits 50/40 (danger below warning), 499 → normal and 500 → danger.
    - R6 `trackRunaways`, `now` = 1 000 000: a pid in scope hot since 700 000 is a runaway with `sinceMs` 300 000; hot since
      700 001 is not (but stays in the map); a first-time hot pid is stored with `now`; a pid at cpu 89.9 is dropped from
      the map; a pid outside the set is ignored; a pid missing from the rows is dropped; `command` `/usr/bin/ruby-lsp`
      becomes `ruby-lsp`.
    - R7 `entryLevel`: (normal, [r]) → warning; (danger, [r]) → danger; (warning, []) → warning; (normal, []) → normal.
    - R8 `notifyStep`: armed + danger → `{notify:'danger', armed:false}`; disarmed + danger → no notify, stays disarmed;
      disarmed + warning → stays disarmed; disarmed + normal + no runaways → `armed:true`, no notify; disarmed + normal +
      a runaway → stays disarmed; armed + normal + a runaway whose pid is not in `previous` → notifies that runaway,
      `armed:false`; the same runaway with its pid in `previous` → no notify, stays armed; armed + danger + a new
      runaway → notifies `'danger'`.
    - R9: `formatBytes(500 * 1024 ** 2)` = `500 MB`; `formatBytes(1024 ** 3 * 1.44)` = `1.4 GB`;
      `formatBytes(1024 ** 3)` = `1.0 GB`; `formatEntry({memBytes: 1024 ** 3 * 1.44, cpuPct: 11.6, count: 38})` =
      `$(pulse) 1.4 GB · 12% · 38`.
  - Do: implement exactly the signatures in spec 10. Pure: no imports from Theia, the DOM or Node.
  - Verify: `npx jest -c corral-core/test/jest.config.ts resource-usage`, then `npm test && npm run typecheck && npm run lint`.

- [ ] **T6.2 herdr listing calls**
  - Spec: 10 §Code layout `node/herdr-cli.ts`.
  - Tests first: in `node/herdr-cli.test.ts`, with the file's `fake` / `ok` helpers:
    - `listWorkspaces()` sends `['workspace','list']` and maps `{workspaces:[{workspace_id:'w1',label:'a'}]}` to
      `[{workspaceId:'w1',label:'a'}]`.
    - `listPanes()` sends `['pane','list']` and maps `{panes:[{pane_id:'w1:p1',workspace_id:'w1'}]}` to
      `[{paneId:'w1:p1',workspaceId:'w1'}]`.
    - `paneShellPid('w1:p1')` sends `['pane','process-info','--pane','w1:p1']` and returns 41889 from
      `{process_info:{shell_pid:41889}}`, and `undefined` when `shell_pid` is missing.
    - With `session: 's'` a call is prefixed `['--session','s', …]`.
  - Do: add the three methods, in the style of the existing ones.
  - Verify: `npx jest -c corral-core/test/jest.config.ts herdr-cli`, then `npm test && npm run typecheck && npm run lint`.

- [ ] **T6.3 CorralResourceService (backend)**
  - Spec: 10 R1–R6, R10, §Code layout `node/corral-resource-service.ts`, `common/protocol.ts`, `node/corral-backend-module.ts`.
  - Tests first: `node/corral-resource-service.test.ts` with a fake `ExecFileFn` that returns fixed `ps` text (`exitCode` 0)
    and a fake herdr object (a plain object with the three methods, counting calls). Tree: Corral root 100 → 101 and 102;
    herdr server 200 → shell 201 (pane `w1:p1`, workspace `w1` "alpha") → 202 (`claude`) → 203 (`node`); server 200 → shell
    211 (pane `w2:p1`, workspace `w2` "beta"); an unrelated pid 300. Give every row `rss` 1024 except 202, which gets 4096.
    - `sample()` counts {100,101,102,200,201,202,203,211} (`count` 8) and not 300; `totalMemBytes` is the constructor value.
    - The server pid is resolved once: a second `sample()` makes no herdr calls. When a later `ps` text no longer contains
      200, the next `sample()` resolves it again.
    - A herdr object whose `listPanes` rejects gives the Corral subtree only (`count` 3), and `sample()` still resolves.
    - A `ps` exit code of 1 makes `sample()` reject.
    - Runaways: `now` stubbed; 202 at cpu 97 in a sample at t = 0 and another at t = 300 000 → the second `sample()` has
      `runaways[0]` with `pid` 202 and `sinceMs` 300 000; the first has none.
    - `breakdown()` returns the rows `Corral` (3), `herdr server` (pid 200 only, `count` 1), `alpha` (201–203, `count` 3)
      and `beta` (`count` 1), sorted by `memBytes` descending (so `alpha` first).
    - `breakdown()` with herdr throwing returns only `Corral`.
  - Do:
    - Implement the service and add the protocol additions.
    - In `corral-backend-module.ts`, move the herdr binding's `resolveBinary` closure to module scope as a function of the
      environment, so the herdr and resource bindings share it; then bind the service and its `RpcConnectionHandler`.
    - `corralRoot` follows R1.
  - Verify: `npx jest -c corral-core/test/jest.config.ts corral-resource-service`, then `npm test && npm run typecheck && npm run lint`.

- [ ] **T6.4 Integration against real herdr**
  - Spec: 10 R1–R2, R10; spec 08 (integration tests live in `corral-core/test/`).
  - Tests first: `corral-core/test/corral-resource-service.int.test.ts`, written like `corral-herdr-service.int.test.ts`
    (an `installed` check and `describe.skip` when herdr is missing):
    - `startHerdr()` gives a `corral-test-*` session; `harness.cli.createWorkspace(os.tmpdir(), 'res-int')`.
    - Build `CorralResourceServiceImpl` with `async () => harness.cli`, `defaultExecFile`, `process.pid`,
      `os.cpus().length` and `os.totalmem()`.
    - `sample().count` is greater than 1 and `memBytes` is greater than 0.
    - `breakdown()` contains a row labelled `res-int` with `count ≥ 1`, and a `herdr server` row.
    - `afterAll` calls `harness.stop()`.
  - Do: fix whatever real herdr output breaks. If the real output differs from spec 10, correct the spec in this commit and
    add a DECISIONS note.
  - Verify: `npm run test:int`; `herdr session list` shows no `corral-test-*` session left over.

- [ ] **T6.5 Settings**
  - Spec: 10 R12; spec 05.
  - Tests first: in `common/preferences-schema.test.ts`, add the four keys to `expected` (types `boolean`, `number`,
    `number`, `number`; defaults `true`, 50, 75, 5). Add one `it` that each has `scope` `PreferenceScope.User`, and that
    `warningPercent` and `dangerPercent` have `minimum` 1 and `maximum` 100 and `intervalSeconds` has `minimum` 1.
  - Do: add them to `CorralPreferenceKeys`, `CorralConfiguration` and `corralPreferenceSchema`; add the rows to spec 05's
    key table.
  - Verify: `npm test && npm run typecheck && npm run lint`.

- [ ] **T6.6 Status-bar entry (frontend)**
  - Spec: 10 R7–R12, §Code layout `browser/resource-monitor/…`, `browser/corral-frontend-module.ts`, `browser/theme/…`.
  - Tests first: `e2e/resource-monitor.spec.ts` (use `writeSettings`, `settingsFile` from `e2e/helpers.ts`; restore the
    original settings in `finally`, as `changes-view.spec.ts` does):
    - after `page.goto('/')`, `#status-bar-corral-resources` is visible within 30 s and its text matches
      `/\d+(\.\d)? (MB|GB) · \d+% · \d+/`;
    - hovering it shows `.theia-hover` containing `Corral` and `Memory`, within 15 s;
    - writing `"corral.resourceMonitor.enabled": false` makes the entry disappear, and restoring the settings brings it back.
  - Do:
    - Implement `ResourceStatusContribution` and bind it and the RPC proxy in `corral-frontend-module.ts`.
    - The colours are only the `var(--theia-statusBarItem-*)` strings from R9, never literals.
    - Add the four `statusBarItem.*` colours to `browser/theme/corral-dark-color-theme.json`, next to the `statusBar.*`
      keys (values in spec 10 §Code layout).
  - Verify: `npx jest -c corral-core/test/jest.config.ts corral-dark-theme`; then
    `npm run build -w corral-core && npm run build:browser && npx playwright test -c e2e/playwright.config.ts resource-monitor`;
    then `npm run test:e2e` (nothing else regressed).

- [ ] **T6.7 Docs, full suite, package**
  - Spec: 10; the cross-references in specs 00 and 08 and DESIGN.md (D38).
  - Do:
    - Check that every rule R1–R12 has a test or is visibly implemented; fix any gap.
    - Run the full suites (below).
    - `npm run package:mac` (`.tool-versions` pins `python system` for node-gyp; if node-gyp still cannot find Python,
      prefix `PYTHON=/usr/bin/python3`).
    - Quit Corral with `osascript -e 'quit app "Corral"'`, wait until `pgrep -f "Corral.app/Contents/MacOS"` prints nothing, then
      `rm -rf /Applications/Corral.app && ditto electron-app/dist/mac-arm64/Corral.app /Applications/Corral.app && open /Applications/Corral.app`.
    - In the installed app, check R1: `ps -axo pid,ppid,comm | grep Corral` shows the helpers under one main `Corral` process,
      and the entry's process count is at least that many. If the backend's parent is not that main process, fix `corralRoot`
      and correct R1 in the spec, with a DECISIONS note.
  - Verify: `npm test && npm run typecheck && npm run lint && npm run test:int && npm run test:e2e` (roots and first-run are
    known flaky late in a full run and must pass when run alone). The installed app shows the entry, and its memory is in
    the same ballpark as the sum of the same processes in Activity Monitor.

- [ ] **G6 Stage 6 gate**: all suites → `spec-reviewer` on stage 6 → fix must-fix findings → **human checkpoint, stop**.
  - Ask the user to check in the installed app: the entry sits on the right of the status bar; hovering shows Corral,
    herdr server and each workspace by name, heaviest first; setting `corral.resourceMonitor.warningPercent` to 5 turns it
    amber within one interval; setting `dangerPercent` to 5 as well turns it red and shows one notification, only one;
    `corral.resourceMonitor.enabled: false` removes it.

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
- 2026-09-29 T2.2 — Add project… (folder dialog → extraProjects), Remove from list (manual only, never deletes files), Refresh, missing projects struck through with + disabled; FolderPicker shared with first run (1 E2E)
- 2026-09-29 T2.3 — Set startup command… (QuickInput, empty = plain shell), Use global startup command, Remove from herdr mapping (forgetProject RPC, workspace stays) (2 unit + 1 E2E)
- 2026-09-29 T2.4 — Tree context menu: New File…/New Folder…/Rename…/Delete (Theia WorkspaceCommands), Copy Path, Reveal in Finder (backend `open -R`); tree refreshes on disk changes (1 unit + 1 E2E)
- 2026-09-29 T2.5 — Rescan verified (Refresh button, scanRoots change); window title `Corral — <project>` from the active editor or last + click (3 E2E)
- 2026-09-29 T2.6 — herdr prefix (ctrl+b c) and ⌘P verified from the focused terminal; fixed the terminal env missing HOME, which attached the in-IDE client to a different herdr server than the backend's (2 E2E)
- 2026-09-29 G2 — spec-reviewer run; fixed collapse-all, eye/eye-closed toggle, hidden/missing row flags, E2E races; leftovers in FOR-REVIEW #8–9 (unit 102, int 11, e2e 26)
- 2026-09-29 T3.1 — Corral Dark theme (all tokens), JetBrains Mono bundled, font defaults (117 unit + 1 E2E)
- 2026-09-29 T3.2 — one critique round + one fix batch (flat selection bar, quiet notification buttons); before/after shots in docs/screenshots (27 E2E)
- 2026-09-29 T3.3 — favicon link injected at startup, About shows Corral (2 E2E)
- 2026-09-29 T3.4 — README hero screenshot (3 projects, 2 herdr tabs, real app) and Screenshots section
- 2026-09-29 T3.5 — `npm run package:mac` builds electron-app/dist/mac-arm64/Corral.app; smoke-tested: title "Corral — alpha", herdr terminal attached with a minimal PATH, Corral Dark applied
- 2026-09-29 G3 — all suites green (117 unit, 11 int, 29 E2E); spec-reviewer found no must-fix; ticked per the standing "do not stop at gates" instruction, awaiting human review
- 2026-09-29 T4.1 — common/changes.ts: groupChanges (C1–C7), changeKind, liveFolders, nextExpiry (10 tests)
- 2026-09-29 T4.2 — ChangesService: git repos + file writes + project list → groups, live flags, one expiry timer; bound as a singleton (0 new tests, wiring; E2E in T4.4)
- 2026-09-29 T4.3 — Projects over Changes in one `corral-projects-container` view container; old layouts fixed up; Projects toolbar stays visible (144 unit, 34 e2e)
- 2026-09-29 T4.4 — Changes tree: projects over files, letters/counts, live dot, diff on click, context menus, colours (144 unit, 35 e2e)
- 2026-09-29 T4.5 — Projects tree shows change letters, project counts and live dots; layout fix-up no longer re-closes Projects on every start (144 unit, 35 e2e)
- 2026-09-29 T4.6 — Docs (README, specs 08/09), full suite green, Corral.app repackaged and installed with Projects over Changes (144 unit, 35 e2e)
- 2026-09-29 T5.1 — a hidden project that vanished from disk stays listed (spec 03 rule 4): the service reuses `buildProjectList` instead of its own filter; E2E in add-remove.spec (144 unit)
- 2026-09-29 T5.2 — a single click in the Projects tree previews a file (italic tab), a double click pins it; honours `workbench.list.openMode` (144 unit, +1 e2e)
- 2026-09-29 T5.3 — workspace-map writes are serialised, stale Projects rebuilds are dropped, the herdr output listener cannot leak, missing-project checks run in parallel (145 unit, 11 int)
- 2026-09-29 T5.4 — Changes recompute is one linear pass (`pickChanges`), lookups are O(1), views re-render only when the result changed; Open Changes reuses ChangesService. Reveal already scrolls (TreeWidget scrolls to the selection), so no change there (145 unit)
- 2026-09-29 T5.5 — shared `paths.ts` (`trimSlash`, `isInside`); one Show Changes (Changes view runs the Projects command, which ignores the menu-anchor arg); dead stub removed; `FileUri.fsPath` in browser code; kind-tagged Changes nodes; spec 04 binary order (147 unit, 11 int)
- 2026-09-29 T5.6 — an unreadable scan root is reported once in the Output channel "Corral" (warnings come back from `list()` over RPC; `@theia/output` declared, D36) (148 unit, 11 int)
- 2026-09-29 T5.7 — Projects tree keeps expanded folders and show-hidden across a restart (widget state holds ids only; re-applied after the first list) (+1 e2e)
- 2026-09-29 T5.8 — Reset Layout sets the right panel to 300 px and the left to reopen at 280 px; the 50/50 main split is only the initial split (spec 02 amended, D36) (+1 e2e)
- 2026-09-29 T5.9 — Changes E2E covers the old-layout fix-up (C14, checked red with the fix-up off), Open File / Copy Path (C10), Enter, project toggle and collapsed-through-refresh (C9), hidden projects (C1); nothing needed fixing (+2 e2e)
- 2026-09-30 T5.10 — e2e/helpers.ts replaces 13 copies of the settings/row/git/herdr/temp-dir helpers; ai-disabled waits for .theia-preload instead of 2 s; first-run awaits the server going down. Kept: the two sleeps guarding negative checks (nested, startup-override) and the herdr TUI pacing sleeps (no observable condition). Two full runs: 39/40, the known roots flake, which passes alone (40 e2e)
- 2026-09-30 T5.11 — specs 02, 03, 05, 06, 09 and the AGENTS.md CSS rule now describe what was built (D11, D17, D20, D21, D25, D27, D36); D36 records the Changes-code details (docs only; 148 unit)
- 2026-09-30 G4, G5 — approved by the user after checking the packaged app
