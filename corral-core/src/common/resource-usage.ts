// Pure logic for the status-bar resource monitor (spec 10). No Node, DOM or Theia imports.
import { basename } from './paths';

export interface ProcRow { pid: number; ppid: number; rssKb: number; cpu: number; command: string }
export type Level = 'normal' | 'warning' | 'danger';
export interface Summary { memBytes: number; cpuPct: number; count: number }
export interface Runaway { pid: number; command: string; cpu: number; sinceMs: number }

export const RUNAWAY_CPU = 90;
export const RUNAWAY_MS = 300_000;

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
// comm can hold spaces, so only the four numeric fields are split off and the rest is the command.
const PS_LINE = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(.+?)\s*$/;

export function parsePs(stdout: string): ProcRow[] {
    const rows: ProcRow[] = [];
    for (const line of stdout.split('\n')) {
        const m = PS_LINE.exec(line);
        if (m) {
            rows.push({ pid: +m[1], ppid: +m[2], rssKb: +m[3], cpu: +m[4], command: m[5] });
        }
    }
    return rows;
}

/** The root and all its descendants; empty when the root is not among the rows. */
export function subtree(rows: ProcRow[], rootPid: number): Set<number> {
    const pids = new Set(rows.map(r => r.pid));
    const result = new Set<number>();
    if (!pids.has(rootPid)) {
        return result;
    }
    const children = new Map<number, number[]>();
    for (const r of rows) {
        children.set(r.ppid, [...(children.get(r.ppid) ?? []), r.pid]);
    }
    const queue = [rootPid];
    while (queue.length) {
        const pid = queue.pop()!;
        if (!result.has(pid)) {
            result.add(pid);
            queue.push(...(children.get(pid) ?? []));
        }
    }
    return result;
}

export function summarize(rows: ProcRow[], pids: Set<number>, cores: number): Summary {
    let rssKb = 0;
    let cpu = 0;
    let count = 0;
    for (const r of rows) {
        if (pids.has(r.pid)) {
            rssKb += r.rssKb;
            cpu += r.cpu;
            count++;
        }
    }
    return { memBytes: rssKb * 1024, cpuPct: cpu / cores, count };
}

/** R12: settings.json can hold anything, so a bad interval must not turn the poll loop into a busy loop. */
export function resourceIntervalMs(value: unknown): number {
    return (typeof value === 'number' && Number.isFinite(value) ? Math.max(1, value) : 5) * 1000;
}

/** R12: a warning or danger percentage clamped to 1-100; `fallback` (the schema default) when it is not a number. */
export function percentSetting(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : fallback;
}

export function memLevel(memBytes: number, totalBytes: number, warnPct: number, dangerPct: number): Level {
    const danger = Math.max(dangerPct, warnPct);
    // Integer-safe form of memBytes >= pct% of total.
    if (memBytes * 100 >= danger * totalBytes) {
        return 'danger';
    }
    return memBytes * 100 >= warnPct * totalBytes ? 'warning' : 'normal';
}

export function trackRunaways(hotSince: ReadonlyMap<number, number>, rows: ProcRow[], pids: Set<number>, now: number):
    { hotSince: Map<number, number>; runaways: Runaway[] } {
    const next = new Map<number, number>();
    const runaways: Runaway[] = [];
    for (const r of rows) {
        if (!pids.has(r.pid) || r.cpu < RUNAWAY_CPU) {
            continue;
        }
        const since = hotSince.get(r.pid) ?? now;
        next.set(r.pid, since);
        if (now - since >= RUNAWAY_MS) {
            runaways.push({ pid: r.pid, command: basename(r.command), cpu: r.cpu, sinceMs: now - since });
        }
    }
    return { hotSince: next, runaways };
}

export function entryLevel(mem: Level, runaways: Runaway[]): Level {
    if (mem === 'danger') {
        return 'danger';
    }
    return mem === 'warning' || runaways.length ? 'warning' : 'normal';
}

/** One notification per episode: after it fires, nothing more until the level is normal with no runaways. */
export function notifyStep(armed: boolean, level: Level, runaways: Runaway[], previous: number[]):
    { notify: 'danger' | Runaway | undefined; armed: boolean } {
    if (!armed) {
        return { notify: undefined, armed: level === 'normal' && runaways.length === 0 };
    }
    if (level === 'danger') {
        return { notify: 'danger', armed: false };
    }
    const fresh = runaways.find(r => !previous.includes(r.pid));
    return fresh ? { notify: fresh, armed: false } : { notify: undefined, armed: true };
}

export function formatBytes(bytes: number): string {
    return bytes < GiB ? `${Math.round(bytes / MiB)} MB` : `${(bytes / GiB).toFixed(1)} GB`;
}

export function formatEntry(s: Summary): string {
    return `$(pulse) ${formatBytes(s.memBytes)} · ${Math.round(s.cpuPct)}% · ${s.count}`;
}

const MIN = 60_000;

/** R8 text. The danger line needs memory and the machine total; a runaway line only the runaway. */
export function formatNotice(notice: 'danger' | Runaway, mem: { memBytes: number; totalMemBytes: number }): string {
    return notice === 'danger'
        ? `Corral is using ${formatBytes(mem.memBytes)} (${Math.round(mem.memBytes * 100 / mem.totalMemBytes)}% of RAM).`
        : `${notice.command} (pid ${notice.pid}) has used a full CPU core for ${Math.round(notice.sinceMs / MIN)} min.`;
}

/** R10 tooltip line; unlike the notification it floors the minutes. */
export const formatRunawayLine = (r: Runaway): string =>
    `⚠ ${r.command} — ${Math.round(r.cpu)}% of a core for ${Math.floor(r.sinceMs / MIN)} min`;
