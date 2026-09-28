# 02 — Layout and the herdr terminal

## Default layout (fresh profile, or after "Corral: Reset Layout")

| Region | Content | Default size |
|---|---|---|
| Left panel | Search, Source Control, Run and Debug. **Collapsed**; the activity bar stays visible. | 280px when opened |
| Main area | Editor group on the left, herdr terminal on the right | 50/50 split |
| Right panel | Projects view, **expanded** | 300px |
| Bottom panel | Collapsed (Problems/Output live here when opened) | — |

- Theia's Explorer (navigator) is not in the default layout. It can still be opened from the View menu.
- Command `corral.resetLayout` ("Corral: Reset Layout") rebuilds exactly this layout. Use it via the application's
  `initializeLayout` hook (a `FrontendApplicationContribution`) so a fresh profile gets it automatically.

## The herdr terminal widget

`HerdrTerminalContribution` (frontend) owns a single Theia `TerminalWidget`:

| Option | Value |
|---|---|
| `id` | `corral-herdr-terminal` |
| `title` | `herdr` (`useServerTitle: false`) |
| `shellPath` | the resolved herdr binary (backend `CorralHerdrService.resolveBinary()`, spec 04) |
| `shellArgs` | `['--session', S]` when the effective session `S` is non-empty, otherwise `[]` |
| `cwd` | the user's home directory |
| `destroyTermOnClose` | `true` |
| `closable` | `false` (the tab has no close button) |
| Placement | main area, `mode: 'split-right'` of the editor area; the tab is pinned in its own group |

Check the real `TerminalWidgetOptions` and `WidgetOpenerOptions` fields in
`node_modules/@theia/terminal/lib/browser/base/terminal-widget.d.ts` and `.../terminal-service.d.ts` before
writing code.

**Lifecycle**
1. On `onDidInitializeLayout`, if the widget doesn't exist, create it, start it, and open it at the placement
   above.
2. Command `corral.herdr.focus` ("Corral: Focus herdr") reveals and activates it.
3. If the herdr process exits (the user detaches, or herdr crashes), the widget shows an overlay: "herdr exited ·
   **Reattach**". Reattach runs `corral.herdr.reattach`, which disposes the widget and recreates it at the same
   placement. It never recreates it automatically in a loop.
4. Closing the widget or quitting Corral ends only the herdr **client**. The herdr server and its agents keep
   running; Corral never stops the server. On the next launch step 1 attaches to it again (R15, tested in T1.9).
5. If the herdr binary can't be found, the overlay reads "herdr not found. Set `corral.herdr.path` in Settings" and
   has an **Open Settings** button.

**Key handling.** Keys typed while the herdr terminal has focus must reach herdr. That includes its prefix
`ctrl+b` and its alt/arrow bindings. If Theia keybindings swallow any of these, add them to the terminal's
"skip shell" / passthrough mechanism, or add a keybinding context guard (`!terminalFocus`) to the conflicting Theia
binding. The E2E test `herdr-keys.spec.ts` sends `ctrl+b c` and checks herdr reacted (a new tab in `tab list`).

## Editor placement guard

Editors must always open in the editor half, never as tabs next to herdr.

`EditorPlacementGuard` (frontend):
- When Corral itself opens a file (Projects view), pass widget options that target the editor area: `ref` = the
  most recent editor widget, `mode: 'tab-after'`. If no editor is open, use `mode: 'split-left'` with `ref` = the
  herdr widget.
- For every other opener (search results, go-to-definition, SCM diffs, the debugger), listen to
  `ApplicationShell.onDidAddWidget`. If a non-herdr widget lands in the herdr terminal's tab bar, move it to the
  editor group (same `ref`/`mode` rule) and activate it.
- The rule is pure and lives in `common/placement.ts`: `(state) → WidgetOpenerOptions-like decision`. Unit-test
  it; the guard only applies the decision.
