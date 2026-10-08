# 05 — Settings, overrides, first run

## Preference schema: `common/preferences-schema.ts`

Every key lives under `honjin.*` with scope `User` (D17; the user settings file `~/.honjin/settings.json`). Workspace-
or folder-scoped values are ignored, so project repos are never touched.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `honjin.scanRoots` | `string[]` | `[]` | Folders whose immediate subfolders are projects. `~` allowed. |
| `honjin.extraProjects` | `string[]` | `[]` | Projects added by hand. |
| `honjin.hiddenProjects` | `string[]` | `[]` | Projects left out of the tree and the workspace. |
| `honjin.agentCommands` | `object` map agent id → command | `{ claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' }` | The command + types for each agent in the picker (spec 13 S8–S10). Replaces the global `honjin.startupCommand` (D44). |
| `honjin.projectOverrides` | `object` map `path → { startupCommand?: string }` | `{}` | Per-project overrides. |
| `honjin.herdr.path` | `string` | `"herdr"` | herdr binary name or absolute path. |
| `honjin.herdr.session` | `string` | `""` | herdr session name; `""` means herdr's default session. |
| `honjin.firstRunCompleted` | `boolean` | `false` | Set once the first-run picker has been shown. |
| `honjin.resourceMonitor.enabled` | `boolean` | `true` | Show the resource entry in the status bar (spec 10 R12). |
| `honjin.resourceMonitor.warningPercent` | `number` (1–100) | `50` | Share of RAM at which the entry turns warning-coloured. |
| `honjin.resourceMonitor.dangerPercent` | `number` (1–100) | `75` | Share of RAM at which it turns danger-coloured and notifies once. |
| `honjin.resourceMonitor.intervalSeconds` | `number` (min 1) | `5` | Seconds between samples. |
| `honjin.agents.intervalSeconds` | `number` (min 1) | `3` | Seconds between Agents-view polls (spec 12 A13). |
| `honjin.updates.check` | `boolean` | `true` | Once a day, ask GitHub for the latest release and offer an update (spec 13 S12). |

Check how 1.76 declares and binds a preference schema (`PreferenceContribution`, `PreferenceSchema`,
`createPreferenceProxy`) in `node_modules/@theia/core/lib/common/preferences/` or `lib/browser/preferences/`
before implementing. The location moved between versions.

## Startup-command resolution: `common/startup-command.ts` (pure)

```ts
function resolveStartupCommand(
    folderPath: string, projects: string[],
    overrides: Record<string, { startupCommand?: string }>): string | undefined
```

- The owning project (exported as `owningProject(folderPath, projects)`, also used by the + handler in spec 04) is
  the longest entry of `projects` that equals `folderPath` or is a prefix of it at a path boundary (`/a/b` owns
  `/a/b/c`, not `/a/bc`).
- If that project has an override whose `startupCommand` is a string (including `""`), return it. Otherwise
  return `undefined`, which means + uses the agent picker (spec 13 S9).
- If no project owns the folder, return `undefined`.

Unit tests cover: an exact match, a nested folder, the prefix-boundary case, an empty-string override, a missing
override and nested projects (the longest wins).

## "Set startup command…" (project root context menu)

- A QuickInput titled `Startup command for <name>`, with the value pre-filled with the override (empty when there is none) and the
  placeholder `Leave empty for a plain shell · Esc to cancel`.
- Enter with a value: write `projectOverrides[path].startupCommand`. Enter with an empty value: store `""`, an
  explicit plain shell.
- A separate context-menu command, "Use agent picker" (formerly "Use global startup command", D44), deletes the
  override entry. It is shown only when the project has an override (D20).

## First run: `browser/first-run-contribution.ts`

This runs when `honjin.firstRunCompleted` is false **and** both `scanRoots` and `extraProjects` are empty.

1. After the layout is ready, open the OS folder picker: `canSelectFolders: true, canSelectMany: true`, title
   "Choose the folders that hold your projects", default path `~/Desktop/projects` if it exists, else `~`.
2. On OK: set `honjin.scanRoots` to the chosen paths (store them with `~` abbreviated).
3. In either case (OK or Cancel), set `honjin.firstRunCompleted = true`. After Cancel, the Projects view shows its
   empty state (spec 03), which has the same picker behind **Choose folders…**.
4. Command `honjin.projects.chooseScanRoots` ("Honjin: Choose Project Folders…") reopens the picker at any time.
   It **replaces** the scan roots and shows a confirmation that lists the old and new roots.
