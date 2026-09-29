# 05 — Settings, overrides, first run

## Preference schema: `common/preferences-schema.ts`

Every key lives under `corral.*` with scope `User` (D17; the user settings file `~/.corral/settings.json`). Workspace-
or folder-scoped values are ignored, so project repos are never touched.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `corral.scanRoots` | `string[]` | `[]` | Folders whose immediate subfolders are projects. `~` allowed. |
| `corral.extraProjects` | `string[]` | `[]` | Projects added by hand. |
| `corral.hiddenProjects` | `string[]` | `[]` | Projects left out of the tree and the workspace. |
| `corral.startupCommand` | `string` | `"claude"` | Typed into every new herdr tab. `""` means a plain shell. |
| `corral.projectOverrides` | `object` map `path → { startupCommand?: string }` | `{}` | Per-project overrides. |
| `corral.herdr.path` | `string` | `"herdr"` | herdr binary name or absolute path. |
| `corral.herdr.session` | `string` | `""` | herdr session name; `""` means herdr's default session. |
| `corral.firstRunCompleted` | `boolean` | `false` | Set once the first-run picker has been shown. |

Check how 1.76 declares and binds a preference schema (`PreferenceContribution`, `PreferenceSchema`,
`createPreferenceProxy`) in `node_modules/@theia/core/lib/common/preferences/` or `lib/browser/preferences/`
before implementing. The location moved between versions.

## Startup-command resolution: `common/startup-command.ts` (pure)

```ts
function resolveStartupCommand(
    folderPath: string, projects: string[],
    global: string, overrides: Record<string, { startupCommand?: string }>): string
```

- The owning project (exported as `owningProject(folderPath, projects)`, also used by the + handler in spec 04) is
  the longest entry of `projects` that equals `folderPath` or is a prefix of it at a path boundary (`/a/b` owns
  `/a/b/c`, not `/a/bc`).
- If that project has an override whose `startupCommand` is a string (including `""`), return it. Otherwise
  return `global`.
- If no project owns the folder, return `global`.

Unit tests cover: an exact match, a nested folder, the prefix-boundary case, an empty-string override, a missing
override and nested projects (the longest wins).

## "Set startup command…" (project root context menu)

- A QuickInput titled `Startup command for <name>`, with the value pre-filled with the effective command and the
  placeholder `Leave empty for a plain shell · Esc to cancel`.
- Enter with a value: write `projectOverrides[path].startupCommand`. Enter with an empty value: store `""`, an
  explicit plain shell.
- A separate context-menu command, "Use global startup command", deletes the override entry. It is shown only
  when the project has an override (D20).

## First run: `browser/first-run-contribution.ts`

This runs when `corral.firstRunCompleted` is false **and** both `scanRoots` and `extraProjects` are empty.

1. After the layout is ready, open the OS folder picker: `canSelectFolders: true, canSelectMany: true`, title
   "Choose the folders that hold your projects", default path `~/Desktop/projects` if it exists, else `~`.
2. On OK: set `corral.scanRoots` to the chosen paths (store them with `~` abbreviated).
3. In either case (OK or Cancel), set `corral.firstRunCompleted = true`. After Cancel, the Projects view shows its
   empty state (spec 03), which has the same picker behind **Choose folders…**.
4. Command `corral.projects.chooseScanRoots` ("Corral: Choose Project Folders…") reopens the picker at any time.
   It **replaces** the scan roots and shows a confirmation that lists the old and new roots.
