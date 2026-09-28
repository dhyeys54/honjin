---
name: theia-dev
description: Working guide for Eclipse Theia 1.76 in Corral. Covers where to find true API signatures, the DI and contribution patterns, widgets and trees, preferences, frontend-backend RPC, the terminal, layout, plugins and build commands. Use before writing or changing any code that imports @theia/*.
---

# Theia development in Corral

## Rule 0: verify, don't recall

Theia's APIs move between minor versions, and your memory may describe an older one. Before calling anything:

1. Find it: `grep -rn "export declare class TerminalService\|interface TerminalWidgetOptions" node_modules/@theia/terminal/lib --include=*.d.ts`
2. Read the `.d.ts` (and the `.js` next to it if you need behaviour).
3. Find a real usage in Theia's own packages. For example, how the navigator builds its tree:
   `node_modules/@theia/navigator/lib/browser/navigator-container.js`.
4. If it's still unclear, query the **Context7 MCP** (library "eclipse-theia/theia") or the generator templates
   (`npx -y -p generator-theia-extension` → `templates/`).

If the spec assumed an API that doesn't exist, adapt it, update the spec, and add a DECISIONS entry.

## Where things go

| Kind | File |
|---|---|
| Frontend DI bindings | `src/browser/corral-frontend-module.ts` |
| Backend DI bindings | `src/node/corral-backend-module.ts` |
| RPC paths + interfaces | `src/common/protocol.ts` |
| Preferences schema | `src/common/preferences-schema.ts` |
| Views | `src/browser/<feature>/*-widget.tsx`, `*-contribution.ts` |
| CSS | `src/browser/style/*.css` (imported from the frontend module) |

## Patterns (confirm each against the installed .d.ts)

- **Contributions:** `@injectable()` classes implementing `FrontendApplicationContribution`, `CommandContribution`,
  `MenuContribution`, `KeybindingContribution`, `TabBarToolbarContribution`. Bind with
  `bind(X).toSelf().inSingletonScope(); bind(CommandContribution).toService(X);`.
- **Views:** `AbstractViewContribution<W>` with `defaultWidgetOptions: { area: 'right' | 'left' | 'main' | 'bottom' }`,
  plus a `WidgetFactory` binding (`{ id, createWidget }`). Default layout comes from
  `FrontendApplicationContribution.initializeLayout(app)`: `openView({ activate, reveal })` for each view.
- **Trees:** follow the navigator: `createTreeContainer(parent, { props, model, widget, tree })` and the file tree
  classes from `@theia/filesystem/lib/browser` (`FileTree`, `FileTreeModel`, `FileTreeWidget`, `DirNode`,
  `FileStatNode`). Override `renderTailDecorations(node, props)` (or the 1.76 equivalent) for the `+` button. Use
  `StatefulWidget` (`storeState`/`restoreState`) for expansion state.
- **Preferences:** `PreferenceContribution` with the schema, and a typed proxy via `createPreferenceProxy`. Check
  the 1.76 locations in `@theia/core/lib/common/preferences` and `@theia/core/lib/browser/preferences`. React to
  `onPreferenceChanged`.
- **RPC:** the backend binds `ConnectionHandler` → `new RpcConnectionHandler(PATH, () => ctx.container.get(Impl))`.
  The frontend gets a proxy via `ServiceConnectionProvider.createProxy<T>(container, PATH)` (older name:
  `WebSocketConnectionProvider`). Copy the exact shape from the generator's `templates/backend/*` for this version.
- **Terminal:** `TerminalService.newTerminal(options)` → `widget.start()` → `terminalService.open(widget, { widgetOptions: { area: 'main', mode: 'split-right', ref } })`.
  Listen with `onTerminalDidClose` / `onDidDispose`. Check `TerminalWidgetOptions` in `@theia/terminal/lib/browser/base/terminal-widget.d.ts`.
- **Shell and layout:** `ApplicationShell` (`addWidget(w, { area, mode, ref })`, `activateWidget`, `revealWidget`,
  `onDidAddWidget`, `getTabBarFor(widget)`, `mainPanel`).
- **Opening files:** `EditorManager.open(uri, { mode: 'reveal' | 'activate', preview?, widgetOptions })` or
  `open(openerService, uri, options)`. Always route through the placement decision (spec 02).
- **Workspace roots:** `WorkspaceService` (`tryGetRoots`, `addRoot`, `removeRoots`, `spliceRoots`, `open`).
- **Dialogs:** `FileDialogService.showOpenDialog({ canSelectFolders, canSelectMany, title })`. Quick input:
  `QuickInputService.input(...)` / `showQuickPick`.
- **Theme:** `MonacoThemingService.register({ id, label, uiTheme: 'vs-dark', json })` and `ThemeService`.

## Build and run

| Need | Command |
|---|---|
| Recompile the extension only | `npm run build -w corral-core` (tsc to `lib/`) |
| Rebuild the browser bundle (after any extension change, for E2E) | `npm run build:browser` |
| Dev server | `npm run start:browser` → http://127.0.0.1:3000 |
| Electron dev | `npm run build:electron && npm run start:electron` |
| Plugins changed (`theiaPlugins`) | `npm run download:plugins` |
| Native module errors after an Electron/browser switch | `npm run rebuild -w browser-app` or `-w electron-app` (`theia rebuild:*`) |

A mismatched `@theia/*` version across packages breaks DI at runtime ("Cannot find binding"). Keep every `@theia/*`
dependency on the same exact version and run `npm ls @theia/core` to confirm there's a single copy.

## Debugging tips

- The browser console errors from the frontend show up in Playwright traces (`npx playwright show-trace`).
- The backend logs go to the stdout of `npm run start:browser`. Add `--log-level=debug` to see RPC traffic.
- "No binding for X": the module wasn't loaded (check `theiaExtensions` paths point into `lib/`, and rebuild).
