# Decisions

Short ADRs. Add new ones at the bottom: `## D<n> — title` · date · decision · why · consequences.

## D1 — Build on Eclipse Theia, not a VS Code fork · 2026-09-29
**Decision.** Corral is a custom Theia application (Theia 1.76.x) with one extension, `corral-core`.
**Why.** The user needs the full IDE feature set (LSP, debugger, git, VS Code extensions) but a custom layout.
Theia is built for composing custom IDEs and runs VS Code extensions. A Code-OSS fork would mean re-merging a huge
upstream forever; a from-scratch app can't realistically ship a debugger or extensions.
**Consequences.** Extensions come from Open VSX (no Microsoft-only extensions such as Pylance or Remote-SSH).
Theia minor versions change APIs, so the code is checked against the installed `.d.ts` files.

## D2 — Agents run in herdr, driven through its CLI · 2026-09-29
**Decision.** Corral embeds herdr's TUI in a terminal widget and controls it only through the `herdr` CLI (JSON
output), not the raw socket protocol.
**Why.** The CLI is herdr's documented, stable surface; the socket protocol is versioned (22) and internal.
Spawning a CLI costs ~10ms, which is negligible for click-driven actions.
**Consequences.** Every herdr call goes through `HerdrCli`. Upgrading herdr means re-running `npm run test:int`.

## D3 — Corral persists project → herdr workspace mapping; never adopts foreign workspaces · 2026-09-29
**Why.** `herdr workspace list` doesn't expose a cwd, so the only way to match a project to a workspace is a stored
id. Label matching could take over the user's own workspaces.
**Consequences.** Workspaces created before Corral stay untouched. The first + on a project creates its workspace.

## D4 — Theia AI ships but is disabled · 2026-09-29
**Decision.** Include `@theia/ai-core`, `@theia/ai-chat` and `@theia/ai-chat-ui`, with `enableAI` off by default.
**Why.** The user's choice: keep the option open without the built-in agent being in the way.
**Consequences.** An E2E test guards that no AI view appears by default.

## D5 — herdr lives in the main area, split right of the editors · 2026-09-29
**Why.** It's the user's layout: editor | herdr side by side in the middle, projects on the right. Theia side
panels are tabbed (one view visible at a time), so herdr can't share the right panel with Projects.
**Consequences.** Editors could land in herdr's tab group, so `EditorPlacementGuard` (spec 02) exists.

## D6 — The Projects view is a custom FileTree, and visible projects are Theia workspace roots · 2026-09-29
**Why.** The user wants per-project dropdowns with a + on every folder. Search, git, LSP and debug only work on
workspace roots, so the visible project set is mirrored into a Corral-managed multi-root workspace.
**Consequences.** Hidden projects are also left out of search, git and LSP, which is intended (confirmed
by the user on 2026-09-29).

## D7 — Test stack: Jest (unit/integration) + Playwright via @theia/playwright (E2E) · 2026-09-29
**Why.** Jest is what the official generator scaffolds; `@theia/playwright` is Theia's own E2E toolkit. Integration
tests use a real headless herdr session (`herdr --session corral-test-* server`) rather than mocks.
