# 03 — Projects view (right panel)

## Project list: `common/project-list.ts` (pure)

```ts
interface ProjectListInput {
    scanned: string[];        // absolute dirs found under scan roots (backend)
    extra: string[];          // corral.extraProjects
    hidden: string[];         // corral.hiddenProjects
    showHidden: boolean;      // view toggle state
    missing: string[];        // paths that no longer exist (backend)
}
interface ProjectEntry { path: string; name: string; hidden: boolean; missing: boolean; manual: boolean; }
function buildProjectList(input: ProjectListInput): ProjectEntry[];
function visibleRoots(list: ProjectEntry[]): string[];   // not hidden, not missing, holds no other entry → workspace roots
function addProblem(folder: string, list: ProjectEntry[]): string | undefined;   // why Add refuses a folder
```

Rules (each one gets a unit test):
1. Union of `scanned` ∪ `extra`, compared after normalising (no trailing slash; `~` expanded by the backend before
   this function runs).
2. `manual = true` iff the path is in `extra`, even if it was also scanned.
3. Hidden projects are left out unless `showHidden` is on. When shown, they have `hidden: true`.
4. Missing projects are always included, with `missing: true`, so the user can remove or unhide them.
5. `name` = the last path segment. If two entries share a name, both are shown as `name — parent` (for example
   `api — work`).
6. Sort by `name`, case-insensitive, then by path.
7. The result never contains duplicate paths.

## Discovery: `node/project-scanner.ts`

- For each scan root: its immediate subdirectories, excluding names that start with `.`, `node_modules`, and
  symlinks that point to files. Symlinked directories are included, resolved with `realpath`; duplicates are
  removed.
- A scan root that doesn't exist or can't be read adds no projects and produces one warning in the Output channel
  "Corral".
- `CorralProjectService.list()` returns `{ scanned, missing }`. `missing` = the entries of `extra` ∪ `hidden` that
  no longer exist.
- Rescan: on startup, on the view's **Refresh** button, and when `corral.scanRoots` changes.

## The tree widget

Changed-file letters, per-project change counts and live dots come from the Changes view's state (spec 09 C12).

Build it on `@theia/filesystem`'s `FileTreeWidget` / `FileTreeModel`, following how `@theia/navigator` builds
`FileNavigatorWidget` (read `node_modules/@theia/navigator/lib/browser/navigator-container.js` and
`navigator-model.js` first).

- The view id is `corral-projects`, label "Projects", in the right area, opened by default. Its root is a
  `CompositeTreeNode` whose children are one `DirNode` per `ProjectEntry`. Project roots start collapsed.
  Expanded folders and the show-hidden toggle persist across restarts (`StatefulWidget`, D36).
- Children load lazily through `FileService` and respect `files.exclude`. File icons come from the active icon
  theme.
- **Project root row:** the name, plus the path as a tooltip. Hidden roots render at 50% opacity with an eye-off
  glyph. Missing roots render struck through with "missing".
- **+ action:** every directory row (project roots included) shows a `+` button at the right edge on hover and when
  keyboard-focused. It has `aria-label="New herdr tab in <folder name>"` and tooltip "New herdr tab here (⌥⌘T)".
  Clicking it runs command `corral.herdr.newTab` with the row's URI. It is disabled on missing roots.
- **Keyboard:** arrows move and expand like the Explorer; `Enter` opens a file or toggles a folder; `⌥⌘T` runs
  `corral.herdr.newTab` on the focused directory (or the focused file's parent folder).
- **Opening files:** a single click opens a preview editor; a double click pins it. Both go through
  `EditorPlacementGuard` (spec 02).
- **Selection:** the tree publishes its selection to Theia's `SelectionService`, so the stock workspace file
  commands (new file, new folder, rename, delete, copy path, reveal in OS) work from the context menu.

### View toolbar (title bar, left to right)

| Icon | Command | Behaviour |
|---|---|---|
| `add` | `corral.projects.add` | Folder picker (multi-select). Adds the chosen folders to `corral.extraProjects`. A folder that is already listed, holds listed projects (a scan root), or sits inside one is refused with a warning (`addProblem`). |
| `eye` / `eye-closed` | `corral.projects.toggleShowHidden` | Flips `showHidden`. The toggle state is saved in the widget state, not in preferences. |
| `refresh` | `corral.projects.refresh` | Rescans. |
| `collapse-all` | `corral.projects.collapseAll` | Collapses every project. |

### Context menu

| Target | Items |
|---|---|
| Any directory | New herdr tab here · New File… · New Folder… · Rename… · Delete · Show Changes · Copy Path · Reveal in Finder |
| Any file | Open · Open to the Side · Rename… · Delete · Open Changes (changed files only) · Copy Path · Reveal in Finder |
| Project root (additional) | Hide project / Unhide project · Set startup command… · Remove from list (manual projects only) · Remove from herdr mapping |

- **Hide / Unhide** adds the path to, or removes it from, `corral.hiddenProjects`.
- **Remove from list** removes the path from `corral.extraProjects`. It never deletes files.
- **Set startup command…** opens a QuickInput pre-filled with the current effective command. Empty input clears
  the override. Details are in spec 05.
- **Open Changes** opens the git diff of that file (working tree before staged; `common/scm-change.ts`). It shows
  only when git reports a change for the file.
- **Show Changes** selects the git repository that holds the folder and opens Source Control on the right (spec 02),
  so the list is that project's changes only. A folder outside any repository gets an info message.
- **Remove from herdr mapping** forgets the project→herdr-workspace link. It does **not** close the herdr
  workspace.

### Empty states

- **No scan roots and no extra projects:** the message "Choose the folders that hold your projects" with a
  **Choose folders…** button (the first-run flow, spec 05).
- **Scan roots set but no projects found:** "No projects found in <roots>" with **Add project…** and
  **Change folders…** buttons.

## Roots sync: `browser/workspace-roots-sync.ts`

- Keeps the Theia workspace roots equal to `visibleRoots(list)`, using `WorkspaceService` root add/remove
  operations. Diff the two sets and apply only the changes; never reset all roots.
- The workspace is the managed file `<configDir>/corral.code-workspace` (`~/.corral/` in normal use), created by the backend if it is missing.
- Changing roots must not reload the window. If the installed Theia version can't do that, record it in
  DECISIONS and fall back to editing the workspace file directly (Theia watches it).
