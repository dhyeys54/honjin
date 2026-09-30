# 10 — Resource monitor (status bar)

A status-bar entry on the right shows the total memory, CPU and process count of everything Corral is responsible for:
the Corral app plus the herdr session it attaches to, including every Claude session and the tools it started. It turns
warning- or danger-coloured when memory gets high or one process runs away, and sends one notification when things get
serious (D38).

```
                                            (pulse icon) 1.4 GB · 12% · 38     ← normal
                                            (pulse icon) 8.9 GB · 31% · 61     ← warning (amber) or danger (red)
```

Every Theia API named below was checked against `node_modules/@theia/*` 1.76. Still open the `.d.ts` before coding
against one (AGENTS.md).

## Rules (the contract)

| # | Rule |
|---|---|
| R1 | **Scope** = the Corral subtree ∪ the herdr-server subtree. A subtree is a root pid plus all its descendants by `ppid`. The Corral root is `process.env.THEIA_ELECTRON_VERSION ? process.ppid : process.pid`: Electron forks the backend from its main process and sets that variable (`electron-main-application.js`, `startBackend`), so the root is the main `Corral` process and its helpers are counted; the browser-app backend is its own root. The herdr server is the one for Corral's effective session (the same binary and session as `CorralHerdrService`). The scope includes every workspace of that session, not only the ones Corral created. |
| R2 | **herdr server pid** = the `ppid` (from the same `ps` sample) of the first pane whose `paneShellPid` is defined and present in the sample. It is cached, and resolved again when the cached pid is missing from a sample. While it is unknown (herdr stopped, no panes, or any herdr call throws) the scope is the Corral subtree only, and the failed lookup is retried at the next sample. `sample()` never rejects because of herdr. |
| R3 | **Sampling:** one `execFileFn('ps', ['-axo', 'pid=,ppid=,rss=,%cpu=,comm='], { timeoutMs: 5000 })` per call. No shell (AGENTS.md). A non-zero exit code throws. `comm` can contain spaces (`Corral Helper (Renderer)`), so the first four whitespace-separated fields are numbers and the rest of the line is `command`. `rss` is KiB. `%cpu` is percent of one core. Lines that do not parse are skipped. |
| R4 | **Totals** over the pids in scope: `memBytes = Σ rss × 1024`, `cpuPct = Σ %cpu ÷ cores` (whole machine, `cores = os.cpus().length`), `count` = number of pids. |
| R5 | **Memory level:** `memBytes ≥ dangerPct% × totalMemBytes` → `danger`; else `≥ warnPct%` → `warning`; else `normal`. `totalMemBytes = os.totalmem()`. If `dangerPct < warnPct`, the danger limit is raised to `warnPct`, so danger never comes before warning. |
| R6 | **Runaway:** a process in scope whose `%cpu ≥ 90` (`RUNAWAY_CPU`) in every sample for at least 300 000 ms (`RUNAWAY_MS`). The service keeps `hotSince: Map<pid, firstHotMs>`: a pid that is hot for the first time is stored with `now`; a pid that is not hot in a sample, or is no longer in scope, is dropped from the map. `Runaway.command` is the last `/` segment of `comm`. |
| R7 | **Entry level** = `danger` if the memory level is `danger`; else `warning` if the memory level is `warning` or there is any runaway; else `normal`. CPU alone never changes the level. |
| R8 | **Notification** (frontend, one `messageService.warn`). The frontend holds `armed` (starts `true`) and `previous` (the runaway pids of the last sample, starts `[]`). Each tick: if not armed, it re-arms only when the level is `normal` and there are no runaways, and never notifies on that tick. If armed: level `danger` → notify `'danger'`; otherwise the first runaway whose pid is not in `previous` → notify that runaway; otherwise nothing. Notifying disarms. Then `previous` is replaced by this sample's runaway pids. Texts: `Corral is using <formatBytes(mem)> (<n>% of RAM).` with `n = Math.round(mem / total × 100)`, or `<command> (pid <pid>) has used a full CPU core for <m> min.` with `m = Math.round(sinceMs / 60000)`. |
| R9 | **Entry:** id `corral-resources` (Theia renders it as `#status-bar-corral-resources`), `alignment: StatusBarAlignment.RIGHT`, `priority: 100`. Text is `formatEntry`: `$(pulse) <mem> · <cpu>% · <count>`. Memory is `<n> MB` (whole number) below 1 GiB and `<n.n> GB` (one decimal) from 1 GiB up, with 1 GiB = 1024³ bytes. CPU is `Math.round(cpuPct)`. Warning sets `backgroundColor: 'var(--theia-statusBarItem-warningBackground)'` and `color: 'var(--theia-statusBarItem-warningForeground)'`; danger sets the `errorBackground` / `errorForeground` pair; normal sets neither. The colours are registered in the Corral Dark theme from the `warning`, `danger` and `bg` tokens (spec 06, DESIGN.md). |
| R10 | **Tooltip:** a function `(token) => Promise<MarkdownString>`; Theia shows "Loading..." until it resolves. It calls `breakdown()` and renders, in this order: one line per runaway of the last `sample()` (`⚠ <command> — <cpu>% of a core for <m> min`, `m = Math.floor(sinceMs / 60000)`); then a markdown table with the header `\| \| Memory \| CPU \| Procs \|` and one row per entry: `Corral`, `herdr server`, and every herdr workspace by its **label** (all of them, including ones Corral did not create). Rows are sorted by memory, heaviest first, and all three kinds take part in the sort. Cells: `formatBytes`, `Math.round(cpuPct)%`, `count`. If `breakdown()` rejects, the tooltip is the text `Breakdown unavailable: <message>`. There is no click action. |
| R11 | **Polling:** the frontend calls `sample()` once at start and then every `intervalSeconds`, as a `setTimeout` chain re-armed after each response, so calls never overlap. A rejected call leaves the last entry as it was and the next tick tries again. |
| R12 | **Settings** (spec 05, `User` scope): see the table below. Values are read at every tick, so a change applies at the next one. A non-numeric or out-of-range value is clamped: `intervalSeconds` to at least 1 (default 5 when not a number). Changing `enabled` acts at once: `false` stops the timer and calls `statusBar.removeElement('corral-resources')`; `true` starts polling. The runaway limits (90 %, 5 min) are fixed. |

| Key | Type | Default | Meaning |
|---|---|---|---|
| `corral.resourceMonitor.enabled` | `boolean` | `true` | Show the resource entry in the status bar. |
| `corral.resourceMonitor.warningPercent` | `number` (1–100) | `50` | Share of the machine's RAM at which the entry turns warning-coloured. |
| `corral.resourceMonitor.dangerPercent` | `number` (1–100) | `75` | Share of RAM at which it turns danger-coloured and one notification is sent. |
| `corral.resourceMonitor.intervalSeconds` | `number` (min 1) | `5` | Seconds between samples. |

## Code layout

- **`common/resource-usage.ts`** — pure logic; no Theia, DOM or Node imports:

  ```ts
  export interface ProcRow { pid: number; ppid: number; rssKb: number; cpu: number; command: string }
  export type Level = 'normal' | 'warning' | 'danger';
  export interface Summary { memBytes: number; cpuPct: number; count: number }
  export interface Runaway { pid: number; command: string; cpu: number; sinceMs: number }
  export const RUNAWAY_CPU = 90;
  export const RUNAWAY_MS = 300_000;

  export function parsePs(stdout: string): ProcRow[];                                                  // R3
  export function subtree(rows: ProcRow[], rootPid: number): Set<number>;                              // root included only if it is in rows
  export function summarize(rows: ProcRow[], pids: Set<number>, cores: number): Summary;                // R4
  export function memLevel(memBytes: number, totalBytes: number, warnPct: number, dangerPct: number): Level; // R5
  export function trackRunaways(hotSince: ReadonlyMap<number, number>, rows: ProcRow[], pids: Set<number>, now: number):
      { hotSince: Map<number, number>; runaways: Runaway[] };                                          // R6; sinceMs = now - firstHotMs
  export function entryLevel(mem: Level, runaways: Runaway[]): Level;                                  // R7
  export function notifyStep(armed: boolean, level: Level, runaways: Runaway[], previous: number[]):
      { notify: 'danger' | Runaway | undefined; armed: boolean };                                      // R8
  export function formatBytes(bytes: number): string;                                                  // R9
  export function formatEntry(s: Summary): string;                                                     // R9
  ```

- **`common/protocol.ts`** — add (`Summary` and `Runaway` come from `./resource-usage`):

  ```ts
  export const CORRAL_RESOURCES_PATH = '/services/corral-resources';
  export const CorralResourceService = Symbol('CorralResourceService');
  export interface ResourceSample extends Summary { totalMemBytes: number; runaways: Runaway[] }
  export interface ResourceBreakdownRow extends Summary { label: string }
  export interface CorralResourceService { sample(): Promise<ResourceSample>; breakdown(): Promise<ResourceBreakdownRow[]> }
  ```

- **`node/herdr-cli.ts`** — three new methods on `HerdrCli`, written like the existing ones (`const { result } = await this.run([...])`; `run` adds `--session` and parses the JSON):
  - `listWorkspaces(): Promise<{ workspaceId: string; label: string }[]>` runs `['workspace', 'list']` and maps `result.workspaces[]` (`workspace_id`, `label`).
  - `listPanes(): Promise<{ paneId: string; workspaceId: string }[]>` runs `['pane', 'list']` and maps `result.panes[]` (`pane_id`, `workspace_id`).
  - `paneShellPid(paneId: string): Promise<number | undefined>` runs `['pane', 'process-info', '--pane', paneId]` and returns `result.process_info.shell_pid`.

  Output captured from herdr 0.9.1, for reference:
  `{"id":"cli:pane:process_info","result":{"process_info":{"foreground_process_group_id":41889,"foreground_processes":[…],"pane_id":"w1:p1","shell_pid":41889},"type":"pane_process_info"}}`.

- **`node/corral-resource-service.ts`** — `CorralResourceServiceImpl implements CorralResourceService`. Not `@injectable`: built by hand like the other backend services (D36).

  ```ts
  constructor(
      getHerdr: () => Promise<Pick<HerdrCli, 'listWorkspaces' | 'listPanes' | 'paneShellPid'>>,
      execFileFn: ExecFileFn,            // from ./herdr-cli
      corralRoot: number, cores: number, totalMemBytes: number, now: () => number = Date.now)
  ```

  - `sample()` (R1–R6): run `ps`; resolve the server pid (R2; herdr is called only when the cache misses); scope = `subtree(corralRoot) ∪ subtree(serverPid)`; return `summarize` plus `totalMemBytes` and the runaways; keep `hotSince` on the instance.
  - `breakdown()` (R10): run `ps`; call `listWorkspaces()` and `listPanes()`, then `paneShellPid` for every pane (`Promise.all`); if herdr throws, only the `Corral` row is returned. Rows: `Corral` = `subtree(corralRoot)`; `herdr server` = the server pid alone; one row per workspace = the union of `subtree(shellPid)` over that workspace's panes. Rows with `count` 0 are dropped. Sort by `memBytes` descending. It also fills the server-pid cache.

- **`node/corral-backend-module.ts`** — the herdr binding's `resolveBinary` closure moves to module scope as a function of the environment, so both services use it (do not copy it). Bind `CorralResourceService` with `toDynamicValue(...).inSingletonScope()`, where `getHerdr` builds a `HerdrCli` from `resolveBinary` and the session exactly as `getClient` does (no binary → `throw new HerdrError('not_found')`), `execFileFn` is `defaultExecFile`, `corralRoot` follows R1, `cores = os.cpus().length`, `totalMemBytes = os.totalmem()`. Add a `ConnectionHandler` with `new RpcConnectionHandler(CORRAL_RESOURCES_PATH, …)` beside the two existing ones.

- **`common/preferences-schema.ts`** — the four keys of R12 in `CorralPreferenceKeys`, `CorralConfiguration` and `corralPreferenceSchema` (same `scope` constant; `minimum` / `maximum` in the schema properties).

- **`browser/resource-monitor/resource-status-contribution.ts`** — `@injectable() ResourceStatusContribution implements FrontendApplicationContribution`. It injects `StatusBar` (`@theia/core/lib/browser/status-bar/status-bar-types`), `CorralResourceService`, `CorralPreferences` (`browser/corral-preferences.ts`) and `MessageService` (`@theia/core/lib/common/message-service`).
  - `onStart()` starts polling when `enabled` is true, and listens to `prefs.onPreferenceChanged` (compare `e.preferenceName`, as `project-list-service.ts` does) for `corral.resourceMonitor.enabled`.
  - Each tick: `memLevel` → `entryLevel` (R7) → `statusBar.setElement` (R9) → `notifyStep` (R8) → `messageService.warn`.
  - The tooltip builds a `MarkdownStringImpl` (`@theia/core/lib/common/markdown-rendering/markdown-string`) with `appendMarkdown`.

- **`browser/corral-frontend-module.ts`** — bind the RPC proxy (`ServiceConnectionProvider.createProxy<CorralResourceService>(ctx.container, CORRAL_RESOURCES_PATH)`, `inSingletonScope()`) and the contribution (`toSelf().inSingletonScope()` plus `bind(FrontendApplicationContribution).toService(...)`), like the neighbouring services.

- **`browser/theme/corral-dark-color-theme.json`** — `statusBarItem.warningBackground` `#e0b45a`, `statusBarItem.warningForeground` `#0c0f0e`, `statusBarItem.errorBackground` `#e5736b`, `statusBarItem.errorForeground` `#0c0f0e` (DESIGN.md `warning`, `bg`, `danger`, `bg`; `corral-dark-theme.test.ts` allows only DESIGN.md tokens).

## Tests

- **Unit** `common/resource-usage.test.ts`: one `it` per rule R3–R9.
- **Unit** `node/herdr-cli.test.ts`: argv and parsing of the three new methods (existing `fake()` / `ok()` helpers).
- **Unit** `node/corral-resource-service.test.ts`: fake `ps` text and a fake herdr object (R1, R2, R6, R10).
- **Unit** `common/preferences-schema.test.ts`: the four new keys (the existing "exactly the keys" test grows with them).
- **Integration** `corral-core/test/corral-resource-service.int.test.ts`: real herdr through `startHerdr()` (a `corral-test-*` session only).
- **E2E** `e2e/resource-monitor.spec.ts`: entry text, hover table, the `enabled` switch.
- Not covered by E2E: the 5-minute runaway and the RAM thresholds. The unit tests cover them with fixed numbers.
