# 02 — Layout and the herdr terminal

## Default layout (fresh profile, or after "Honjin: Reset Layout")

| Region | Content | Default size |
|---|---|---|
| Left panel | Search, Run and Debug. **Collapsed**; the activity bar stays visible. | 280px when opened |
| Main area | Editor group on the left, herdr terminal on the right | 50/50 when herdr first splits it; Reset Layout leaves this split alone (D36) |
| Right panel | Projects view over the Changes view (`honjin-projects-container`, spec 09 C14), **expanded** | 300px |
| Bottom panel | Collapsed (Problems/Output live here when opened) | — |

- Reset Layout and the Projects toggle open the whole `honjin-projects-container` (spec 09 C14).
- Theia's Explorer (navigator) is not in the default layout. It can still be opened from the View menu.
- Command `honjin.resetLayout` ("Honjin: Reset Layout") rebuilds this layout, except the main-area split (D36). Use it via the application's
  `initializeLayout` hook (a `FrontendApplicationContribution`) so a fresh profile gets it automatically.

## Source Control (on demand)

Source Control is not in the left bar (DECISIONS D31). `HonjinScmContribution` replaces Theia's `ScmContribution`:
its view opens in the **right** panel (rank 200, after Projects) and only when asked, from the Projects view's
**Show Changes** (spec 03). A layout saved with it in the left bar closes it there on startup. Theia's
`scmView:toggle` (⌃⇧G) opens it on the right too; it then shows the repository that was last selected.

The selected repository follows the active editor (DECISIONS D48): when the current editor changes, the repository
that contains its file becomes the selected one, so the bottom-left git item names that project and branch. Theia
itself only selects the first repository that registers. Preview and webview tabs have no file, so they leave the
selection as it was. E2E: `e2e/scm-follows-editor.spec.ts`.

## Panel transitions

Side and bottom panels slide instead of snapping: `expandDuration` is 150 ms for all three
(`ApplicationShellOptions`). Theia only animates opening, so `HonjinSidePanelHandler` also slides a side panel shut
before collapsing it, and keeps the width it reopens at. Nothing animates while the layout is being restored.

## The herdr terminal widget

`HerdrTerminalContribution` (frontend) owns a single Theia `TerminalWidget`:

| Option | Value |
|---|---|
| `id` | `honjin-herdr-terminal` |
| `title` | `herdr` (`useServerTitle: false`) |
| `shellPath` | the resolved herdr binary (backend `HonjinHerdrService.resolveBinary()`, spec 04) |
| `shellArgs` | `['--session', S]` when the effective session `S` is non-empty, otherwise `[]` |
| `cwd` | the user's home directory |
| `destroyTermOnClose` | `true` |
| `closable` | `false` (the tab has no close button) |
| Placement | main area, `mode: 'split-right'` of the editor area; not pinned, and no group of its own (D11) |

Check the real `TerminalWidgetOptions` and `WidgetOpenerOptions` fields in
`node_modules/@theia/terminal/lib/browser/base/terminal-widget.d.ts` and `.../terminal-service.d.ts` before
writing code.

**Lifecycle**
1. On `onDidInitializeLayout`, if the widget doesn't exist, create it, start it, and open it at the placement
   above.
2. Command `honjin.herdr.focus` ("Honjin: Focus herdr") reveals and activates it.
3. If the herdr process exits (the user detaches, or herdr crashes), the widget shows an overlay: "herdr exited ·
   **Reattach**". When herdr printed something before exiting, its last line follows ("herdr exited: <line>"), so
   errors such as a server that won't accept clients are visible. Reattach runs `honjin.herdr.reattach`, which disposes the widget and recreates it at the same
   placement. It never recreates it automatically in a loop.
4. Closing the widget or quitting Honjin ends only the herdr **client**. The herdr server and its agents keep
   running; Honjin never stops the server. On the next launch step 1 attaches to it again (R15, tested in T1.9).
5. If the herdr binary can't be found, the overlay reads "herdr not found" and has a **Set Up Honjin** button that
   opens the Setup view (spec 13 S5). No terminal is started. When a Setup check later finds herdr, or
   `honjin.herdr.focus` runs while this overlay is up, Honjin looks for herdr again and replaces the overlay with
   the herdr terminal; still missing, the overlay stays.

**Key handling.** Keys typed while the herdr terminal has focus must reach herdr. That includes its prefix
`ctrl+b` and its alt/arrow bindings. If Theia keybindings swallow any of these, add them to the terminal's
"skip shell" / passthrough mechanism, or add a keybinding context guard (`!terminalFocus`) to the conflicting Theia
binding. The E2E test `herdr-keys.spec.ts` sends `ctrl+b c` and checks herdr reacted (a new tab in `tab list`).

## Editor placement guard

Editors must always open in the editor half, never as tabs next to herdr.

`EditorPlacementGuard` (frontend):
- When Honjin itself opens a file (Projects view), pass widget options that target the editor area: `ref` = the
  most recent editor widget, `mode: 'tab-after'`. If no editor is open, use `mode: 'split-left'` with `ref` = the
  herdr widget.
- For every other opener (search results, go-to-definition, SCM diffs, the debugger), listen to
  `ApplicationShell.onDidAddWidget`. If a non-herdr widget lands in the herdr terminal's tab bar, move it to the
  editor group (same `ref`/`mode` rule) and activate it.
- The rule is pure and lives in `common/placement.ts`: `(state) → WidgetOpenerOptions-like decision`. Unit-test
  it; the guard only applies the decision.
