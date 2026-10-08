# 12 — Agents view (right panel, under Changes)

The right panel's container gets a third section, **Agents**. It lists every coding agent running in Corral's herdr
session, across all projects. The ones that need the user come first: blocked on a question or approval, or done and
not yet looked at. Clicking a row jumps to that agent's pane in the herdr terminal. Until now this state was only
visible inside herdr's own TUI, although `PRODUCT.md` promises it (D42, `docs/research/feature-gaps.md`).

```
AGENTS                                   2
● claude   corral            blocked  4m      ← danger dot
● claude   app-a/src         done     12s     ← accent dot
● codex    app-b             working  1m      ← info dot, pulsing
  claude   designer          idle     2h      ← no dot (space kept), status in fg-muted
```

Every herdr fact below was checked against herdr 0.9.1 (protocol 22) on a `corral-test-*` session, 2026-10-08. Every
Theia API named was checked in `node_modules/@theia/*` 1.76, with the file given. Still open the `.d.ts` before coding
against one (AGENTS.md).

## herdr facts

- **List.** `herdr [--session S] agent list` prints `{"id":…,"result":{"agents":[…],"type":"agent_list"}}`. There is one
  entry per pane that holds a recognised agent, and an empty array when there are none.
  - Fields in 0.9.1: `agent`, `agent_status`, `cwd`, `focused`, `foreground_cwd`, `pane_id`, `revision`,
    `state_change_seq`, `tab_id`, `terminal_id`, `workspace_id`, and sometimes `terminal_title_stripped`.
  - Corral uses `pane_id` (`w5:p1`), `workspace_id`, `agent` (the kind: `claude`, `codex`, …), `agent_status`, `cwd`,
    `foreground_cwd` and `terminal_title_stripped`.
  - **`terminal_title_stripped` is absent** when the pane has set no title, so treat it as optional.
  - Captured with a title:
    `{"agent":"claude","agent_status":"idle","cwd":"/Users/…/designer","pane_id":"w5:p1","tab_id":"w5:t1","terminal_title_stripped":"Commit and push changes","workspace_id":"w5",…}`.
  - Paths are real paths. On macOS a pane opened in `/tmp/x` reports `/private/tmp/x`.
- **Statuses.** `agent_status` is `idle | working | blocked | done | unknown`.
  - `done` means ready for input and not yet seen. `idle` means ready and seen.
  - `blocked` means herdr recognised an approval or question prompt.
  - `unknown` means an agent is there but herdr can't classify it.
  - Source: `herdr --skill`, "Understand layout, panes, and agents".
- **Done vs idle.** A pane going `working` → `idle` shows as `done` only if it **isn't focused**. If it is focused, it
  shows `idle` straight away.
- **Focus.** `herdr agent focus <pane_id>` focuses that pane and **marks it seen**, so `done` becomes `idle`. It prints
  `{"result":{"agent":{…}}}`.
  - An unknown pane exits 1 with `{"error":{"code":"agent_not_found",…}}`.
  - `agent list` and other reads mark nothing seen.
- **Server down.** With the server stopped, `agent list` exits 1 with `{"error":{"code":"server_not_running",…}}`.
- **Kind and lifetime.** The kind in a pane can change, for example `claude` → `codex` in the same pane. Closing the pane
  removes the entry.
- **No timestamps.** The list has no timestamps, so Corral measures time-in-state itself (A4).
- **Faking an agent (tests only).** `herdr --session corral-test-… pane report-agent --source <id> --agent <kind>
  --state <idle|working|blocked|unknown> <pane_id>` makes any pane show up in `agent list` with that kind and state, with
  no real agent running.
  - The `done` state is reached by reporting `working` and then `idle` on an unfocused pane.
  - `herdr pane release-agent <pane_id> --source <id> --agent <kind>` takes the report back. Put the pane id first, as
    shown; that order is the one that was tested.
  - Use this **only** on a test session (AGENTS.md hard rules).

## Rules (the contract)

| # | Rule |
|---|---|
| A1 | **Source.** The backend method `CorralAgentService.list()` runs `herdr agent list` through `HerdrCli.listAgents()` for the effective session (spec 04). It lists **all** agents in the session, including ones in workspaces Corral didn't create. Corral only reads them and focuses them, never adopts or changes them (D3, D42). If herdr reports `server_not_running`, or isn't found (`not_found`, from `getClient`), `list()` resolves `{ running: false, agents: [] }`. Any other error rejects, for example `timeout`, or `cli_error` from a herdr too old to have `agent list`. **Mapping** of each entry: `paneId` = `pane_id` (entries without a string `pane_id` are skipped); `workspaceId` = `workspace_id` or `''`; `kind` = `agent` or `'agent'` when empty; `status` = `toAgentStatus(agent_status)`, where anything other than the five statuses becomes `unknown`; `cwd` = `cwd`, else `foreground_cwd`, else `''`; `title` = `terminal_title_stripped` or `''`. A missing `result.agents` counts as `[]`. |
| A2 | **Location.** `agentLocation(cwd, projects)`, where `projects` are `{ path, name }` for the workspace roots: `ProjectListService.entries(false)` filtered to paths in `ProjectListService.roots`. Hidden projects are therefore not owners. Strip any trailing slash from `cwd` with `trimSlash` first. The owner is `owningProject(cwd, paths)` from `common/paths.ts`, the longest match. **With an owner**, the label is the owner's display `name` (which already tells apart projects with the same folder name: `app — parent`), plus `/<rel>` when `cwd` is deeper, where `rel` is `cwd` without `owner + '/'`. **With no owner**, the label is the last two non-empty segments of `cwd` joined by `/`; one segment gives just that segment, `/` gives `/`, and `''` gives `?`. Paths are compared as given, with no realpath: a project reached through a symlink won't own agents whose `cwd` herdr reports as a real path, and those agents get the no-owner label. |
| A3 | **Order.** By status rank: `blocked` 0, `done` 1, `working` 2, `unknown` 3, `idle` 4. Then by `since` ascending, so the agent that has waited longest comes first. Then by `paneId` (`localeCompare`). |
| A4 | **Since.** The frontend keeps a `Map<paneId, Seen>`, where `Seen = { kind, status, since }`. `trackSince(prev, agents, now)` returns a new map. An agent seen for the first time gets `since = now`, and so does one whose `status` **or `kind`** differs from the stored entry. Otherwise the stored `since` is kept. Panes missing from `agents` are dropped, so an agent that comes back starts again at `now`. The map lives only in the window, so a reload restarts every age. |
| A5 | **Row.** In order: a status dot (A10), `kind`, the location label (A2) in `fg`, then aligned right the status word and `formatAge(Date.now() - since)` in `fg-muted`, e.g. `blocked 4m`. **`formatAge(ms)`**: `ms ≤ 0` or under 1 s gives `0s`; under 60 s `<n>s`; under 60 min `<n>m`; otherwise `<n>h`, with no day unit (`26h`). Here `n = Math.floor(...)`. **Tooltip** (the row's `title` attribute): `cwd` alone, or `<title>\n<cwd>` when `title` isn't empty. Ages repaint on each successful poll (A6); there is no separate timer. **Second line (amended, D43):** when `title` is non-empty, the row also shows it on a line of its own below, `div.corral-agent-title` in `fg-muted`, one line, ellipsised; with no title the row stays one line. |
| A6 | **Polling.** `AgentsPoller` (pure, in `common/agents.ts`) drives the loop. `start()` calls `list()` at once. The next call is scheduled `intervalMs()` after a response or a rejection settles: a `setTimeout` chain, so calls never overlap (as in spec 10 R11). `intervalMs()` is read every time a call is scheduled, so a setting change takes effect after the current wait. A rejection goes to `onError` and keeps the last list. `refresh()` cancels the pending timer and calls `list()` at once. A response still in flight from before the refresh is dropped and doesn't schedule anything, so exactly one chain survives. `stop()` cancels the timer and drops any in-flight response. `start()` while running does nothing; `refresh()` and `stop()` while stopped do nothing. An exception thrown by `onResult` goes to `onError` and doesn't break the chain. The loop starts in `AgentsService.onStart` (a `FrontendApplicationContribution`) and stops in `onStop`. It polls even while the part is collapsed or hidden, because the badge (A7) needs the data. `AgentsService` fires `onDidChange` after every successful poll, after a failed poll that changes the error text (A11), and when `ProjectListService.onDidChange` fires (labels depend on the project list). |
| A7 | **Badge.** `n = needsYou(agents)`, the number of agents whose status is `blocked` or `done`. **Part header:** `AgentsWidget` implements `BadgeWidget` (`@theia/core/lib/browser/view-container`), with `badge = n \|\| undefined` and `badgeTooltip = badgeTooltip(n)`: `1 agent needs you`, otherwise `<n> agents need you`. It fires `onDidChangeBadge` and `onDidChangeBadgeTooltip` only when `n` changes. Theia hides a part-header badge while the part shows any toolbar item (`view-container.js` `updateBadge`), so **the Agents part registers no toolbar items**. **Right-panel tab:** `AgentsContribution` also implements `TabBarDecorator` (`@theia/core/lib/browser/shell/tab-bar-decorator`) with `id = 'corral-agents-badge'`. `decorate(title)` returns `[{ badge: n }]` when `title.owner.id === PROJECTS_CONTAINER_ID` and `n > 0`, and `[]` otherwise. It fires `onDidChangeDecorations` only when `n` changes. The model is `@theia/navigator/lib/browser/navigator-tab-bar-decorator.js`. Theia draws the tab badge as `.theia-badge-decorator-sidebar`, and only while the core preference `workbench.editor.decorations.badges` is true, which is the default. |
| A8 | **Open.** Clicking a row (no Shift, Meta or Ctrl), or pressing Enter on it, calls `AgentsService.focus(paneId)`. That runs the backend method `CorralAgentService.focus(paneId)`, which runs `herdr agent focus <paneId>`. On success the frontend runs `corral.herdr.focus`, so the herdr terminal tab is revealed. On failure, for example `agent_not_found` because the pane closed since the last poll, or `server_not_running`, it shows `messageService.error('Could not focus agent: <message>')` and does not reveal the tab. **In both cases** it then calls `refresh()` (A6), so the row updates at once (`done` → `idle`). |
| A9 | **Context menu** on a row. Path `['corral-agents-context-menu']`, group `1_agent`. Right-click selects the row first, as in every Theia tree. **Focus Agent** (`corral.agents.focus`, same as A8). **Reveal in Projects** (`corral.agents.reveal`) opens the Projects view and selects `cwd` in the Projects tree, using the same code as Changes' reveal (moved to `ProjectsContribution.revealPath`); it is **visible only when A2 found an owner**. **Copy Path** (`corral.agents.copyPath`) writes `cwd` to the clipboard (`ClipboardService`). Each command's `isVisible` is false when no agent row is selected, so none shows in the command palette by accident. No rename, stop or prompt: Corral never acts on agents beyond focusing them (D42). |
| A10 | **Colours.** Registered by `AgentsContribution` as a `ColorContribution`, with the same hex for dark, light, hcDark and hcLight, from `colors` in `common/design-tokens.ts`. `corral.agents.blocked` = `colors.danger`, `corral.agents.done` = `colors.accent`, `corral.agents.working` = `colors.info`, `corral.agents.unknown` = `colors['fg-faint']`. CSS uses them as `var(--theia-corral-agents-<status>)`. `idle` has no dot colour; the dot keeps its space (`visibility: hidden`), so the columns line up. While `working`, the dot uses the existing `corral-live-pulse` keyframes (`changes.css`, spec 09 C13), and it stops pulsing under `prefers-reduced-motion: reduce`. |
| A11 | **Empty states.** When there are no rows, the widget renders one `div.corral-agents-empty` with `data-testid="corral-agents-empty"`, in `fg-muted`, whose text is the first that applies: (1) **before the first poll has settled**: empty text, so nothing flashes; (2) **the last poll rejected**: `Could not list agents: <message>`; (3) `running` is false: `herdr is not running`; (4) otherwise `No agents running`. When there are rows, a rejected poll changes nothing visible (A6). A successful poll clears the error. |
| A12 | **Layout** (amends spec 09 C14). `corral-projects-container` gets a third part: `corral-agents` at order 2, weight 20, `canHide: true`, `initiallyCollapsed: false`. Projects (order 0, weight 70) and Changes (order 1, weight 30) are unchanged. **Initial sizes:** Theia applies `weight` only when it restores saved sizes, so a layout with no saved state splits the three parts evenly (about a third each); the weights only order the parts' priority. A user's drag is saved and restored as usual. **Restoring a saved layout:** Theia's `ViewContainer.doRestoreState` hides any hideable part that has no entry in the saved state. It sizes parts only from saved entries, so un-hiding afterwards would leave Agents at zero height. So `ProjectsViewContainerFactory` wraps the container's `restoreState`: when `state.parts` has no entry with `partId === 'corral-agents'`, it appends `{ partId: 'corral-agents', hidden: false, collapsed: false, relativeSize: 0.2, originalContainerId: PROJECTS_CONTAINER_ID }` before calling the original. A saved entry is always respected, so an Agents part the user hid stays hidden. The part's DOM id is `corral-projects-container--corral-agents` (`ViewContainerPart` id = `<container>--<widget>`). |
| A13 | **Setting** (spec 05, `User` scope): `corral.agents.intervalSeconds`, a `number` with minimum 1 and default 3. It is read every time a poll is scheduled, through `agentsIntervalMs(value)`: a finite number gives `max(1, value) * 1000`; anything else (missing, a string, `NaN`, `Infinity`) gives 3000. |
| A14 | **History.** The frontend keeps `Map<paneId, AgentLane>`, where `AgentLane = { paneId, kind, cwd, segments: Segment[] }` and `Segment = { status, start, end? }` (`end` absent while open). `trackHistory(prev, agents, now, windowMs)` (pure, `common/agents.ts`) returns a new map and leaves `prev` alone. A new pane gets a lane with one open segment starting at `now`. For a known pane, an unchanged status and kind leaves the open segment alone; otherwise the open segment is closed at `now` and a new open one starts. `kind` and `cwd` always take the latest values. A pane missing from `agents` has its open segment closed at `now`; its lane stays. Then segments with `end <= now - windowMs` are dropped, and lanes left with no segments are dropped. `TIMELINE_WINDOW_MS = 15 * 60_000`. History is in memory only: it starts when Corral starts, and transitions are known to within one poll interval (A6). `AgentsService` updates it in the same step as `trackSince`. |
| A15 | **Timeline.** A widget `AgentTimelineWidget` (`id = 'corral-agent-timeline'`, label `Agent Timeline`, icon `codicon codicon-graph-line`) in the **bottom** panel, opened by the command `corral.agents.timeline.toggle` ("Agents: Show Timeline"). It is **not** opened by default, and there is no header button (A7: any toolbar item on the Agents part hides its badge). One `div.corral-timeline-lane[data-testid="corral-timeline-lane"]` per lane. Order: lanes whose pane is in the current rows, in row order (A3), then the others by latest segment end, newest first (`orderLanes`). Each lane has a label (`kind` and the A2 location, or `kind` and the last path segments when the pane is gone) and a track. The track shows the last `TIMELINE_WINDOW_MS`, "now" at the right. Each segment is a `div.corral-timeline-seg corral-agent-<status>` placed by `segmentGeometry(seg, now, windowMs)` as percentages of the track, with `title` `<status> <formatAge(duration)>`. Colours are the A10 variables; `idle` segments are transparent. The axis labels are `-15m`, `-10m`, `-5m` and `now`. Clicking a lane label runs `AgentsService.focus(paneId)` when that pane is still listed. The widget repaints on every `AgentsService.onDidChange`. With no lanes it shows `No agent activity yet`. |

## Code layout

- **`common/agents.ts`** — pure, with no Theia, DOM or Node imports:

  ```ts
  export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';
  export interface AgentInfo { paneId: string; workspaceId: string; kind: string; status: AgentStatus; cwd: string; title: string }
  export interface AgentList { running: boolean; agents: AgentInfo[] }
  export interface Seen { kind: string; status: AgentStatus; since: number }
  export interface AgentRow extends AgentInfo { since: number; project?: string; location: string }
  export interface ProjectRef { path: string; name: string }

  export function toAgentStatus(value: unknown): AgentStatus;                                              // A1
  export function trackSince(prev: ReadonlyMap<string, Seen>, agents: AgentInfo[], now: number): Map<string, Seen>; // A4
  export function agentLocation(cwd: string, projects: ProjectRef[]): { project?: string; location: string }; // A2
  export function agentRows(agents: AgentInfo[], seen: ReadonlyMap<string, Seen>, projects: ProjectRef[]): AgentRow[]; // A2, A3 (since defaults to 0 if unseen)
  export function needsYou(agents: AgentInfo[]): number;                                                    // A7
  export function badgeTooltip(n: number): string;                                                          // A7
  export function formatAge(ms: number): string;                                                            // A5
  export function agentsIntervalMs(value: unknown): number;                                                 // A13
  export interface Segment { status: AgentStatus; start: number; end?: number }                             // A14
  export interface AgentLane { paneId: string; kind: string; cwd: string; segments: Segment[] }
  export const TIMELINE_WINDOW_MS: number;
  export function trackHistory(prev: ReadonlyMap<string, AgentLane>, agents: AgentInfo[], now: number, windowMs: number): Map<string, AgentLane>;
  export function segmentGeometry(seg: Segment, now: number, windowMs: number): { left: number; width: number }; // A15, percent
  export function orderLanes(lanes: AgentLane[], rowPaneIds: string[]): AgentLane[];                        // A15

  /** A6: one setTimeout chain; calls never overlap; refresh() supersedes anything in flight. */
  export class AgentsPoller {
      constructor(
          list: () => Promise<AgentList>,
          intervalMs: () => number,
          onResult: (list: AgentList) => void,
          onError: (error: unknown) => void
      );
      start(): void;
      stop(): void;
      refresh(): void;
  }
  ```

  The poller holds a `generation` number. `start`, `refresh` and `stop` bump it. A tick checks it after `await` and
  before calling back or arming the timer. This is the same guard as `ResourceStatusContribution.tick` (D40).

- **`common/protocol.ts`** — add:
  - `CORRAL_AGENTS_PATH = '/services/corral-agents'`;
  - `export const CorralAgentService = Symbol('CorralAgentService')`;
  - `interface CorralAgentService { list(): Promise<AgentList>; focus(paneId: string): Promise<void> }`, with
    `AgentList` imported from `./agents`.
- **`node/herdr-cli.ts`** — `listAgents(): Promise<AgentInfo[]>` runs `['agent', 'list']` and maps per A1.
  `focusAgent(paneId)` runs `['agent', 'focus', paneId]`.
- **`node/corral-agent-service.ts`**:
  - `export type AgentClient = Pick<HerdrCli, 'listAgents' | 'focusAgent'>`;
  - `class CorralAgentServiceImpl implements CorralAgentService`, constructed as `(getCli: () => Promise<AgentClient>)`.
  - It is built by hand in `corral-backend-module.ts` from the module's existing `access(env).getClient`, as
    `new CorralAgentServiceImpl(async () => (await getClient()).cli)` (D36).
  - Bind it with an `RpcConnectionHandler` on `CORRAL_AGENTS_PATH`, exactly like `CorralResourceService`.
- **`browser/agents/agents-service.ts`** — `@injectable() AgentsService implements FrontendApplicationContribution`:
  - Injects `CorralAgentService`, `CorralPreferences`, `ProjectListService`, `CommandService` and `MessageService`.
  - Owns one `AgentsPoller`, the `Seen` map, the last `AgentList`, `loaded` and `error`.
  - Public surface: `rows(): AgentRow[]`, `needsYou(): number`, `running`, `loaded`, `error`, `onDidChange`,
    `refresh()`, and `focus(paneId)` (A8).
- **`browser/agents/agents-tree.ts`** — `AgentsTree extends TreeImpl`:
  - Root id `agents-root`. Root children are `AgentNode`s:
    `{ kind: 'agent', id: 'agent:' + paneId, name: row.kind, parent, selected: false, row }`, so selection survives
    refreshes by id. Built like `ChangesTree`.
  - Also exports `isAgentNode`.
- **`browser/agents/agents-widget.ts`** — `AgentsWidget extends TreeWidget implements BadgeWidget`, with
  `createAgentsWidget(parent)` using `createTreeContainer` (props `{ contextMenuPath: AGENTS_CONTEXT_MENU, globalSelection: false }`).
  - `id = AGENTS_VIEW_ID = 'corral-agents'`, `title.label = 'Agents'`, `title.caption = 'Agents'`,
    `title.iconClass = 'codicon codicon-hubot'`, `title.closable = true`.
  - Class `corral-agents`, `node.dataset.testid = 'corral-agents'`.
  - `render()`: A11 when there are no rows, otherwise `super.render()`.
  - `getCaptionChildren`: the A5 spans, with classes `corral-agent-dot corral-agent-<status>`, `corral-agent-kind`,
    `corral-agent-location` and `corral-agent-state`.
  - `createNodeAttributes` adds `title` (A5) and `data-testid="corral-agent-row"`.
  - `createNodeClassNames` adds `corral-agent-row-<status>`.
  - Click and Enter are handled like `ChangesWidget`: `handleClickEvent` + `model.onOpenNode` → `agents.focus(paneId)`.
- **`browser/agents/agent-timeline-widget.ts`** (A15): `AgentTimelineWidget extends ReactWidget`;
  `browser/agents/agent-timeline-contribution.ts`: an `AbstractViewContribution` for the bottom area with the toggle
  command. `AgentsService` gains `lanes(): AgentLane[]` (ordered) and `now()` is passed in by the widget.
- **`browser/agents/agents-contribution.ts`** — `AgentsContribution implements CommandContribution, MenuContribution,
  ColorContribution, TabBarDecorator`: A9, A10 and the tab half of A7.
- **`browser/projects/projects-contribution.ts`** — gains `revealPath(path: string): Promise<void>`. Its body is moved
  unchanged from `ChangesContribution.reveal`, which now calls it.
- **`browser/projects/projects-view-container.ts`** — adds the A12 part and the `restoreState` wrapper.
- **`browser/style/agents.css`** — `var(--theia-…)` variables only, imported at the top of `corral-frontend-module.ts`.

## Tests

- **Unit** `common/agents.test.ts` covers every pure function and `AgentsPoller`. The exact cases are listed in PLAN T7.1.
  The poller tests use `jest.useFakeTimers()` and `await jest.advanceTimersByTimeAsync(ms)` (jest 29.7).
- **Unit** `node/herdr-cli.test.ts` covers `listAgents` and `focusAgent`: argv, the `--session` prefix, the A1 mapping
  edge cases, and the error codes passing through.
- **Unit** `node/corral-agent-service.test.ts` covers the A1 error mapping and `focus` passing the pane id through.
- **Unit** `common/preferences-schema.test.ts` covers the new key.
- **Integration** `corral-core/test/corral-agent-service.int.test.ts`, in a `corral-test-*` session:
  - No agent → `running: true` and no agents.
  - A pane faked with `report-agent` (§herdr facts) → one agent, with the real field mapping.
  - Focusing an unknown pane rejects with `agent_not_found`.
  - With the server stopped → `running: false`.
- **E2E** `e2e/agents-view.spec.ts`, against the E2E session (`CORRAL_E2E_SESSION`), with agents faked by
  `report-agent`. Faking is not running a real agent, so spec 08 still holds.
  - The A12 order.
  - The A11 empty state.
  - Rows, order, labels, colour classes and both badges.
  - Click-to-focus turning `done` into `idle`.
  - The A9 menu.
  - The two A12 restore cases.
  - The A5 title line and the A15 timeline (lanes, segment colours, order, click-to-focus).
  - **Unit** `common/agents.test.ts` also covers `trackHistory`, `segmentGeometry` and `orderLanes`.
- **Not covered automatically:**
  - The `Could not list agents: <error>` text (A11) and the `Could not focus agent` message (A8). Both are
    one-line branches in `AgentsWidget` and `AgentsService.focus`; the error codes feeding them are unit-tested.
  - Hidden projects not counting as owners (A2, the `entries(false)` filter in `AgentsService.rows`),
    `ProjectListService.onDidChange` refiring `AgentsService.onDidChange` (A6), each A9 command's `isVisible`
    being false without a selection, and A7's "fires only when `n` changes" (the E2E checks the counts, not the
    number of events).
  - Enter on a row and the Shift, Meta and Ctrl click exceptions (A8): Theia's tree routes Enter to the same
    `onOpenNode` that click uses.
  - `corral.agents.intervalSeconds` changing the live poll period (A13): `agentsIntervalMs` and the poller reading
    the interval at each schedule are unit-tested.
  - The `herdr is not running` state in the browser. The E2E server is shared by every spec, so it isn't stopped
    mid-run; the unit and integration tests cover the mapping.
  - Real Claude Code status detection (herdr's job).
  - Both go to the G7 human checkpoint.
