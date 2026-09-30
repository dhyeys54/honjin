import { CorralResourceService, ResourceBreakdownRow, ResourceSample } from '../common/protocol';
import { ProcRow, parsePs, subtree, summarize, trackRunaways } from '../common/resource-usage';
import { ExecFileFn, HerdrCli } from './herdr-cli';

type Herdr = Pick<HerdrCli, 'listWorkspaces' | 'listPanes' | 'paneShellPid'>;

const PS_ARGS = ['-axo', 'pid=,ppid=,rss=,%cpu=,comm='];

/** Memory, CPU and process count of Corral plus the herdr session's process tree (spec 10). */
export class CorralResourceServiceImpl implements CorralResourceService {
    protected hotSince = new Map<number, number>();
    /** The herdr server's pid: the parent of a pane shell, cached until it leaves the ps output. */
    protected serverPid: number | undefined;

    constructor(
        protected readonly getHerdr: () => Promise<Herdr>,
        protected readonly execFileFn: ExecFileFn,
        protected readonly corralRoot: number,
        protected readonly cores: number,
        protected readonly totalMemBytes: number,
        protected readonly now: () => number = Date.now
    ) { }

    async sample(): Promise<ResourceSample> {
        const rows = await this.ps();
        const server = await this.resolveServer(rows);
        const scope = new Set([...subtree(rows, this.corralRoot), ...(server === undefined ? [] : subtree(rows, server))]);
        const tracked = trackRunaways(this.hotSince, rows, scope, this.now());
        this.hotSince = tracked.hotSince;
        return { ...summarize(rows, scope, this.cores), totalMemBytes: this.totalMemBytes, runaways: tracked.runaways };
    }

    async breakdown(): Promise<ResourceBreakdownRow[]> {
        const rows = await this.ps();
        const shells = await this.workspaceShells();
        const server = shells.map(s => rows.find(r => r.pid === s.shell)?.ppid).find(p => p !== undefined);
        if (server !== undefined) {
            this.serverPid = server;
        }
        const entries = [{ label: 'Corral', pids: subtree(rows, this.corralRoot) }];
        if (server !== undefined) {
            entries.push({ label: 'herdr server', pids: new Set([server]) });
        }
        const byWorkspace = new Map<string, { label: string; pids: Set<number> }>();
        for (const { workspace, shell } of shells) {
            const entry = byWorkspace.get(workspace.workspaceId) ?? { label: workspace.label, pids: new Set<number>() };
            subtree(rows, shell).forEach(p => entry.pids.add(p));
            byWorkspace.set(workspace.workspaceId, entry);
        }
        entries.push(...byWorkspace.values());
        return entries
            .map(e => ({ label: e.label, ...summarize(rows, e.pids, this.cores) }))
            .filter(r => r.count > 0)
            .sort((a, b) => b.memBytes - a.memBytes);
    }

    protected async ps(): Promise<ProcRow[]> {
        const { stdout, exitCode } = await this.execFileFn('ps', PS_ARGS, { timeoutMs: 5000 });
        if (exitCode !== 0) {
            throw new Error(`ps exited with ${exitCode}`);
        }
        return parsePs(stdout);
    }

    /** Spec 10 R2: any herdr failure leaves the server unknown, so the scope is Corral alone until the next sample. */
    protected async resolveServer(rows: ProcRow[]): Promise<number | undefined> {
        if (this.serverPid !== undefined && rows.some(r => r.pid === this.serverPid)) {
            return this.serverPid;
        }
        this.serverPid = undefined;
        try {
            const herdr = await this.getHerdr();
            for (const pane of await herdr.listPanes()) {
                const shell = await herdr.paneShellPid(pane.paneId);
                const row = rows.find(r => r.pid === shell);
                if (row) {
                    return (this.serverPid = row.ppid);
                }
            }
        } catch {
            // herdr stopped or missing: count Corral alone
        }
        return undefined;
    }

    /** Every pane's shell pid with its workspace; empty when herdr cannot be asked. */
    protected async workspaceShells(): Promise<{ workspace: { workspaceId: string; label: string }; shell: number }[]> {
        try {
            const herdr = await this.getHerdr();
            const [workspaces, panes] = await Promise.all([herdr.listWorkspaces(), herdr.listPanes()]);
            const shells = await Promise.all(panes.map(async p => ({ p, shell: await herdr.paneShellPid(p.paneId) })));
            return shells.flatMap(({ p, shell }) => {
                const workspace = workspaces.find(w => w.workspaceId === p.workspaceId);
                return workspace && shell !== undefined ? [{ workspace, shell }] : [];
            });
        } catch {
            return [];
        }
    }
}
