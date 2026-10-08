# 00 — Overview and architecture

## Goal

A single-window macOS IDE for 4–8 active projects at once. The window has four regions:

| Region | Contents |
|---|---|
| Left side panel | Search, Run and Debug. These are stock Theia views. Git changes open per file or per project from the Projects view (spec 03). |
| Main area, left half | Editors (Monaco). |
| Main area, right half | One terminal widget attached to **herdr**. |
| Right side panel | The **Projects** view: all projects as collapsible roots, each a VS Code-style file tree. Every folder gets a hover **+** action. |

Out of scope: an agent/chat built into the IDE (Theia AI ships, **disabled**), remote development, Windows/Linux,
and multi-window.

## Glossary

| Term | Meaning |
|---|---|
| Project | An absolute directory path shown as a root in the Projects view. |
| Scan root | A directory whose immediate subdirectories are auto-discovered as projects. |
| Extra project | A project added by hand, outside any scan root. |
| Hidden project | A project in the hidden list. It is left out of the tree (unless *show hidden* is on) and out of the Theia workspace. |
| herdr workspace | herdr's top-level grouping (`w1`, `w2`, …). Honjin maps each project to exactly one. |
| Startup command | The command typed into a new herdr tab (default `claude`). Can be overridden per project. |

## Components

```
browser (frontend)                                 node (backend)
─────────────────────────────                      ─────────────────────────────────────
ProjectsWidget (right panel) ── RPC ─────────────► HonjinProjectService
  └─ uses common/project-list.ts                     └─ ProjectScanner (fs)
  + button ─► startup-command.ts ── RPC ─────────► HonjinHerdrService
HerdrTerminalContribution                            ├─ HerdrCli (execFile herdr …, JSON)
  └─ Theia TerminalWidget running `herdr`            └─ WorkspaceMapStore (<configDir>/herdr-workspaces.json)
EditorPlacementGuard (keeps editors left of herdr)
WorkspaceRootsSync (visible projects → Theia workspace roots)
FirstRunContribution, HonjinThemeContribution
ResourceStatusContribution (status bar) ── RPC ──► HonjinResourceService (ps + herdr CLI, spec 10)
```

- **Frontend ↔ backend:** Theia JSON-RPC services at `/services/honjin-projects` `/services/honjin-herdr` and `/services/honjin-resources`.
  The paths and interfaces are defined in `src/common/protocol.ts`.
- **Configuration:** Theia preferences under `honjin.*`, application/user scope only (spec 05). The config folder
  is `~/.honjin` (spec 01).
- **Theia workspace:** Honjin owns a managed multi-root workspace file, `<configDir>/honjin.code-workspace` (`~/.honjin/` in normal use). Its
  roots always equal the visible projects, so search, git, LSP and debug cover every project (spec 03 §Roots sync).

## Spec index

| Spec | Area |
|---|---|
| 01-app-shell | Theia app composition, packages, branding, AI disabled, config folder |
| 02-layout | Default layout, the herdr terminal widget, editor placement guard |
| 03-projects-view | Project discovery, hide/show, the tree, the + action, file operations, roots sync |
| 04-herdr-integration | The herdr CLI contract, workspace mapping, the open-tab flow, errors |
| 05-settings | Preference schema, per-project overrides, first run |
| 06-theme-and-branding | Honjin Dark theme, fonts, icons |
| 07-packaging | Building the signed-less local macOS `.app` |
| 08-testing | TDD layers, tools, fixtures, commands |
| 09-changes-view | Changes view under Projects, live-write marker |
| 10-resource-monitor | Status-bar memory / CPU / process total, warnings, per-workspace tooltip |
| 11-agent-hibernate | herdr plugin: sleeps idle agents in Honjin workspaces, never with a shell running |
| 12-agents-view | Right-panel list of every herdr agent by status, badge, click to focus |
