import { owningProject, trimSlash } from './paths';

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';
export interface AgentInfo { paneId: string; workspaceId: string; kind: string; status: AgentStatus; cwd: string; title: string }
export interface AgentList { running: boolean; agents: AgentInfo[] }
export interface Seen { kind: string; status: AgentStatus; since: number }
export interface AgentRow extends AgentInfo { since: number; project?: string; location: string }
export interface ProjectRef { path: string; name: string }

const STATUSES: readonly AgentStatus[] = ['idle', 'working', 'blocked', 'done', 'unknown'];
const RANK: Record<AgentStatus, number> = { blocked: 0, done: 1, working: 2, unknown: 3, idle: 4 };

/** A1: anything herdr reports that Corral doesn't know becomes `unknown`. */
export function toAgentStatus(value: unknown): AgentStatus {
    return STATUSES.includes(value as AgentStatus) ? value as AgentStatus : 'unknown';
}

/** A4: herdr has no timestamps, so time-in-state is measured here. A new status or kind starts a new age. */
export function trackSince(prev: ReadonlyMap<string, Seen>, agents: AgentInfo[], now: number): Map<string, Seen> {
    const next = new Map<string, Seen>();
    for (const { paneId, kind, status } of agents) {
        const old = prev.get(paneId);
        next.set(paneId, { kind, status, since: old && old.kind === kind && old.status === status ? old.since : now });
    }
    return next;
}

/** A2 */
export function agentLocation(cwd: string, projects: ProjectRef[]): { project?: string; location: string } {
    const path = trimSlash(cwd);
    const project = owningProject(path, projects.map(p => p.path));
    if (project !== undefined) {
        const name = projects.find(p => p.path === project)!.name;
        return { project, location: path === project ? name : `${name}/${path.slice(project.length + 1)}` };
    }
    return { location: path === '' ? '?' : path === '/' ? '/' : path.split('/').filter(Boolean).slice(-2).join('/') };
}

/** A3 (`since` is 0 for a pane that hasn't been tracked yet) */
export function agentRows(agents: AgentInfo[], seen: ReadonlyMap<string, Seen>, projects: ProjectRef[]): AgentRow[] {
    return agents
        .map(agent => ({ ...agent, since: seen.get(agent.paneId)?.since ?? 0, ...agentLocation(agent.cwd, projects) }))
        .sort((x, y) => RANK[x.status] - RANK[y.status] || x.since - y.since || x.paneId.localeCompare(y.paneId));
}

/** A7: agents waiting on the user. */
export const needsYou = (agents: AgentInfo[]): number => agents.filter(a => a.status === 'blocked' || a.status === 'done').length;

export const badgeTooltip = (n: number): string => n === 1 ? '1 agent needs you' : `${n} agents need you`;

/** A5 */
export function formatAge(ms: number): string {
    const s = Math.floor(Math.max(0, ms) / 1000);
    return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
}

/** A13 */
export function agentsIntervalMs(value: unknown): number {
    return (typeof value === 'number' && Number.isFinite(value) ? Math.max(1, value) : 3) * 1000;
}

/** A6: one setTimeout chain; calls never overlap; refresh() supersedes anything in flight. */
export class AgentsPoller {
    protected generation = 0;
    protected running = false;
    protected timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        protected readonly list: () => Promise<AgentList>,
        protected readonly intervalMs: () => number,
        protected readonly onResult: (list: AgentList) => void,
        protected readonly onError: (error: unknown) => void
    ) { }

    start(): void {
        if (!this.running) {
            this.running = true;
            void this.tick(++this.generation);
        }
    }

    stop(): void {
        this.running = false;
        this.generation++;
        clearTimeout(this.timer);
    }

    refresh(): void {
        if (this.running) {
            clearTimeout(this.timer);
            void this.tick(++this.generation);
        }
    }

    protected async tick(generation: number): Promise<void> {
        try {
            const list = await this.list();
            if (generation === this.generation) {
                this.onResult(list);
            }
        } catch (e) {
            if (generation === this.generation) {
                this.onError(e);
            }
        }
        if (generation === this.generation) {
            this.timer = setTimeout(() => void this.tick(generation), this.intervalMs());
        }
    }
}
