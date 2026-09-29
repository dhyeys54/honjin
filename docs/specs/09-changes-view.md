# 09 — Changes view (right panel, under Projects)

The right panel shows **Projects** stacked over **Changes**. Changes lists every uncommitted git change in each
visible project, grouped by project. A pulsing dot marks files written in the last 30 s, meaning an agent (or you)
is changing them right now. Clicking a file opens its diff against HEAD. The view is read-only: no stage, discard or
commit (D35).

All API names below were checked against `node_modules/@theia/*` 1.76. Still open the `.d.ts` before coding
against one (AGENTS.md).

## Rules (the contract)

| # | Rule |
|---|---|
| C1 | The projects are `ProjectListService.roots` (visible roots, in that order). Hidden and missing projects are never shown. |
| C2 | A file is listed if and only if some `ScmRepository` in `ScmService.repositories` has it in the `resources` of any of its `provider.groups`. That includes changes made before Corral started. It stays listed until git stops reporting it (committed or reverted). |
| C3 | Each file belongs to the project that `owningProject(filePath, roots)` returns (`common/startup-command.ts`, deepest root wins). A file with no owner is dropped. A project with zero files is not shown, so projects that aren't git repositories never appear. |
| C4 | A file in several groups (e.g. both `index` and `workingTree`) is one row. Its letter and flags come from the first group in `pickChange` order (`common/scm-change.ts`: non-`index` groups first). |
| C5 | Files within a project are sorted by their path relative to the project root (`a.localeCompare(b)`). Projects keep C1 order. |
| C6 | Row letter = `resource.decorations?.letter ?? 'M'`. `changeKind(letter, strikeThrough)`: `A` or `U` → `added`; `D` → `deleted`; `!` → `conflict`; anything else → `modified`. `strikeThrough === true` gives `deleted` whatever the letter. |
| C7 | **Live:** a listed file is live if its last write was less than `LIVE_MS` (30 000 ms) ago; a write exactly 30 000 ms ago is not live. Writes come from `FileService.onDidFilesChange`: each `event.changes[i]` of type `FileChangeType.UPDATED` or `ADDED` records `Date.now()` for `change.resource.path.toString()`. Paths containing `/.git/` are ignored (`files.watcherExclude`, D33, already filters the rest). A write to an unlisted file creates no row, but is remembered in case git lists it later. A project row is live if any of its files is live. |
| C8 | When the earliest live mark expires, the view re-renders. Use a single `setTimeout` set to `nextExpiry(...) - Date.now() + 1` (a mark expires once the 30 000 ms have passed, not at them), re-armed after every change. Bursts of events are coalesced into one recompute 50 ms after the first (D36). There is no polling interval. |
| C9 | Click or Enter on a file row calls that change's `ScmResource.open()` (git's diff against HEAD, the same as **Open Changes**). Click or Enter on a project row toggles it. Project rows start expanded, and their expansion survives refreshes. |
| C10 | File context menu: **Open File** (`open(openerService, uri)` from `@theia/core/lib/browser/opener-service`), **Reveal in Projects** (select and reveal that file in the Projects tree), **Copy Path** (absolute path). Project context menu: **Show Changes** (the existing `corral.projects.showChanges` behaviour for that project). No other items. |
| C11 | Empty state (no listed files in any project): the text `No uncommitted changes` in `fg-muted`, with `data-testid="corral-changes-empty"`. |
| C12 | Projects tree: a changed file's row shows its letter (class `corral-change-letter corral-change-<kind>`) at the end of the row, before the `+`. A project row with changes shows its file count (class `corral-change-count`, `fg-muted`). Live files, folders that contain a live file, and live project rows get the class `corral-live`. |
| C13 | Colours are registered by a `ColorContribution` and used in CSS as `var(--theia-corral-changes-<kind>)`: `modified` = `warning`, `added` = `info`, `deleted` = `danger`, `conflict` = `danger`, `live` = `accent` (hex values from `common/design-tokens.ts`). The name of a deleted row is struck through in `fg-faint`. `.corral-live` draws a 6px round dot in `--theia-corral-changes-live` whose opacity pulses 1 → 0.35 → 1 over 1.2 s, infinitely. Under `@media (prefers-reduced-motion: reduce)` the dot does not animate. |
| C14 | Layout: a view container with id `corral-projects-container`, title `Projects` and icon `codicon-root-folder`. Parts: Projects (`corral-projects`: order 0, weight 70, `canHide: false`, `disableDraggingToOtherContainers: true`), then Changes (`corral-changes`: order 1, weight 30, `canHide: true`). If a saved layout has `corral-projects` outside this container (a layout saved before this change), `onDidInitializeLayout` closes that widget with `shell.closeWidget(id)` and opens the container. "Outside" means the widget's node is not inside the container's node: `shell.getTabBarFor` resolves a part through its container, so it can't tell the two apart. In a container part, a tree gets no height from the dock panel, so `.corral-projects` and `.corral-changes` set `height: 100%` (as Theia's navigator does), and the Projects part's toolbar (Add project, Refresh, …) is always visible, not hover-only. |

## Code layout

### `common/changes.ts` (pure, unit-tested)

No Theia, DOM or Node imports.

```ts
export const LIVE_MS = 30_000;
export type ChangeKind = 'modified' | 'added' | 'deleted' | 'conflict';
export interface ChangeInput { path: string; group: string; letter?: string; strikeThrough?: boolean }
export interface ChangeFile { path: string; rel: string; letter: string; kind: ChangeKind; live: boolean }
export interface ChangeGroup { project: string; name: string; files: ChangeFile[]; live: boolean }

export function changeKind(letter: string, strikeThrough?: boolean): ChangeKind;
/** C1–C7. `name` is the last path segment of `project`. */
export function groupChanges(roots: string[], changes: ChangeInput[], writes: ReadonlyMap<string, number>,
    now: number): ChangeGroup[];
/** Every ancestor folder of each live file, up to and including its project. Nothing above the project. */
export function liveFolders(groups: ChangeGroup[]): Set<string>;
/** The earliest `write + LIVE_MS` that is still after `now`, or undefined. */
export function nextExpiry(writes: ReadonlyMap<string, number>, now: number): number | undefined;
```

For C4, reuse `pickChange`: give it `{ id: group, resources: [{ sourceUri: path, ...input }] }` groups, or apply
the same ordering (non-`index` first). Don't redefine the group order.

### `browser/changes/changes-service.ts`

An `@injectable()` class bound `inSingletonScope()`. It is the only owner of change state; both views read from it.

- It injects:
  - `ScmService` (`@theia/scm/lib/browser/scm-service`)
  - `FileService` (`@theia/filesystem/lib/browser/file-service`)
  - `ProjectListService`
- At `@postConstruct`:
  - It tracks every current repository and then `scm.onDidAddRepository`. For each repository it subscribes to `repo.provider.onDidChange` and, if present, `repo.provider.onDidChangeResources`, and keeps these disposables per repository. On `scm.onDidRemoveRepository` it disposes that repository's subscriptions.
  - It also subscribes to `fileService.onDidFilesChange` (C7) and `projectList.onDidChange`.
- It recomputes on any of these events:
  - `ChangeInput`s come from `repo.provider.groups[].resources[]`: `path = resource.sourceUri.path.toString()`, `group = group.id`, `letter = resource.decorations?.letter`, `strikeThrough = resource.decorations?.strikeThrough`.
  - `groups = groupChanges(projectList.roots, inputs, writes, Date.now())`.
  - It keeps `Map<path, ScmResource>` using the C4 winner, then fires `onDidChange`.
- Public API:
  - `groups(): ChangeGroup[]`
  - `groupFor(root: string): ChangeGroup | undefined`
  - `fileFor(path: string): ChangeFile | undefined`
  - `isLive(path: string): boolean`, true for live files, folders from `liveFolders` and live projects
  - `resourceFor(path: string): ScmResource | undefined`
  - `onDidChange: Event<void>`
- Housekeeping: C8's timer lives here. Prune write entries older than `LIVE_MS` whenever it recomputes.

### `browser/changes/changes-tree.ts`

`ChangesTree extends TreeImpl` (`@theia/core/lib/browser`).

- The root is a hidden `CompositeTreeNode`, `{ id: 'changes-root', name: '', visible: false, parent: undefined, children: [] }`. The widget sets it once with `model.root = ...`.
- `protected override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]>`:
  - **For the root:** one node per `ChangeGroup`. Each is `ExpandableTreeNode & SelectableTreeNode`, with id `changes:<project>`, `name = group.name`, `expanded = (this.getNode(id) as ExpandableTreeNode | undefined)?.expanded ?? true`, `selected: false`, and `parent`. Its file children are built eagerly, so an expanded project never flashes empty on refresh (D36).
  - **For a project node:** one `SelectableTreeNode` per file, with id `changes:<file.path>` and `name = file.rel`.
  - Store the `ChangeGroup` or `ChangeFile` on the node as a `change` property. Export `isProjectNode` / `isFileNode` type guards (the lint config forbids namespaces).

### `browser/changes/changes-widget.ts`

`ChangesWidget extends TreeWidget`, created by `createChangesWidget(parent)`, which calls `createTreeContainer(parent, { tree: ChangesTree, widget: ChangesWidget, props: { contextMenuPath: CHANGES_CONTEXT_MENU, globalSelection: false } })` and then `child.get(ChangesWidget)`. It is registered with a `WidgetFactory` whose id is `corral-changes`.

- **Setup:**
  - `id = 'corral-changes'`, `title.label = 'Changes'`, `title.caption = 'Changes'`.
  - Add class `corral-changes`.
  - Set `node.dataset.testid = 'corral-changes'`.
  - Export `CHANGES_CONTEXT_MENU = ['corral-changes-context-menu']`.
- **Refresh:** set the root in `@postConstruct`, then `model.refresh()` on `ChangesService.onDidChange`.
- **Rendering:**
  - `renderCaption`: a project node renders `name` then `<span class="corral-change-count">{files.length}</span>`. A file node renders `<span class="corral-change-letter corral-change-<kind>">{letter}</span>` then the rel path, with class `corral-change-deleted` on the path when the kind is `deleted`.
  - `createNodeClassNames` adds `corral-live` when the node's `change.live` is true.
  - `render()` shows the C11 empty state when `ChangesService.groups()` is empty. Otherwise `super.render()`.
- **Opening (C9):**
  - Subscribe to `model.onOpenNode`. For a file node, call `changes.resourceFor(path)?.open()`. For a project node, call `model.toggleNodeExpansion(node)`.
  - Override `handleClickEvent(node, event)` to call `super`, then `this.model.openNode(node)` when `node` is set and no modifier key is pressed.

### `browser/changes/changes-contribution.ts`

- Registers the C10 commands:
  - `corral.changes.openFile`: Open File
  - `corral.changes.reveal`: Reveal in Projects
  - `corral.changes.copyPath`: Copy Path
  - Show Changes reuses `corral.projects.showChanges` through a changes-specific command, `corral.changes.showChanges`, that sets the repo and opens the view.
- Registers their menus on `CHANGES_CONTEXT_MENU`. Each command acts on the widget's selected node, and `isVisible` depends on the node type.
- Implements `ColorContribution.registerColors(colors)` with `colors.register({ id: 'corral.changes.modified', defaults: { dark: <warning hex>, light: <warning hex>, hcDark: <warning hex>, hcLight: <warning hex> }, description: '…' })` and the same for `added`, `deleted`, `conflict` and `live`. Take the hex values from `colors` in `common/design-tokens.ts`.
- Binding in `corral-frontend-module.ts`:
  - `bind(ChangesContribution).toSelf().inSingletonScope()`
  - `bind(CommandContribution).toService(ChangesContribution)`
  - `bind(MenuContribution).toService(ChangesContribution)`
  - `bind(ColorContribution).toService(ChangesContribution)`

  `ColorContribution` comes from `@theia/core/lib/browser/color-application-contribution`.

### `browser/projects/projects-view-container.ts`

A `WidgetFactory` with id `corral-projects-container`, modelled on `NavigatorWidgetFactory` (`node_modules/@theia/navigator/lib/browser/navigator-widget-factory.js`).

- It injects `ViewContainer.Factory` and `WidgetManager`.
- `createWidget()`:
  1. Call `viewContainerFactory({ id: 'corral-projects-container' })`.
  2. Call `setTitleOptions({ label: 'Projects', iconClass: codicon('root-folder'), closeable: true })`.
  3. `getOrCreateWidget` both parts by id, then `addWidget(part, options)` with the C14 options.
- `ProjectsContribution` passes `viewContainerId: 'corral-projects-container'` (a field of `ViewContributionOptions`), so `openView`, Reset Layout and the toggle command open the container.

### Projects tree (C12)

In `browser/projects/projects-widget.ts`, inject `ChangesService`:

- `createNodeClassNames` adds `corral-live` when `changes.isLive(path)`.
- `renderTailDecorations`: for a file with `changes.fileFor(path)`, render the letter span. For a project row with `changes.groupFor(path)`, render the count span. Both go before the `+` button.
- Call `this.update()` on `changes.onDidChange`.
- Don't use a `TreeDecoratorService`.

### CSS: `browser/style/changes.css`

Import it in `corral-frontend-module.ts` next to `herdr.css`, the same way (`'../../src/browser/style/changes.css'`).
Use only `var(--theia-…)` variables. No hex values.

## Tests
- **Unit** (`common/changes.test.ts`): each of C1–C8's pure parts, plus `liveFolders` and `nextExpiry`, including the 29 999 / 30 000 ms boundary.
- **E2E** (`e2e/changes-view.spec.ts`), using a temp git repo added through `corral.extraProjects` (see `e2e/changes.spec.ts`):
  - container layout (C14)
  - listing, noise and count (C2, C3, C5)
  - live (C7)
  - click → diff (C9)
  - menus (C10)
  - Projects-tree marks (C12)
  - commit → empty state (C2, C11)
- **Not covered by E2E:** the 30 s expiry. The `groupChanges` and `nextExpiry` unit tests cover it.
