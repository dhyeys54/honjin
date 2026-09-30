import { execFile } from 'child_process';
import { HerdrError } from '../common/protocol';

/** Resolves on any exit code; rejects only on spawn failure (`code: 'ENOENT'`) or timeout (`code: 'ETIMEDOUT'`). */
export type ExecFileFn = (file: string, args: string[], opts: { timeoutMs: number }) =>
    Promise<{ stdout: string; stderr: string; exitCode: number }>;

export interface HerdrCliOptions {
    binary: string;
    session?: string;
    timeoutMs?: number;
}

export const defaultExecFile: ExecFileFn = (file, args, { timeoutMs }) =>
    new Promise((resolve, reject) => {
        execFile(file, args, { timeout: timeoutMs, encoding: 'utf8' }, (error, stdout, stderr) => {
            if (!error) {
                return resolve({ stdout, stderr, exitCode: 0 });
            }
            const e = error as NodeJS.ErrnoException & { killed?: boolean };
            if (e.killed) {
                return reject(Object.assign(new Error(`${file} timed out after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }));
            }
            if (typeof e.code === 'number') {
                return resolve({ stdout, stderr, exitCode: e.code });
            }
            reject(e); // spawn failure such as ENOENT
        });
    });

export class HerdrCli {
    protected readonly timeoutMs: number;

    constructor(protected readonly opts: HerdrCliOptions, protected readonly execFileFn: ExecFileFn = defaultExecFile) {
        this.timeoutMs = opts.timeoutMs ?? 10_000;
    }

    async status(): Promise<{ running: boolean; version: string | null; protocol: number | null }> {
        // `status server --json` is plain JSON with no `result` wrapper and works while the server is down.
        const s = await this.run(['status', 'server', '--json']);
        return { running: s.running === true, version: s.version ?? null, protocol: s.protocol ?? null };
    }

    async createWorkspace(cwd: string, label: string): Promise<{ workspaceId: string; tabId: string; paneId: string }> {
        const { result } = await this.run(['workspace', 'create', '--cwd', cwd, '--label', label, '--no-focus']);
        return { workspaceId: result.workspace.workspace_id, tabId: result.tab.tab_id, paneId: result.root_pane.pane_id };
    }

    async getWorkspace(id: string): Promise<{ workspaceId: string; label: string } | undefined> {
        try {
            const { result } = await this.run(['workspace', 'get', id]);
            return { workspaceId: result.workspace.workspace_id, label: result.workspace.label };
        } catch (e) {
            if (e instanceof HerdrError && e.code === 'workspace_not_found') {
                return undefined;
            }
            throw e;
        }
    }

    async listWorkspaces(): Promise<{ workspaceId: string; label: string }[]> {
        const { result } = await this.run(['workspace', 'list']);
        return result.workspaces.map((w: { workspace_id: string; label: string }) => ({ workspaceId: w.workspace_id, label: w.label }));
    }

    async listPanes(): Promise<{ paneId: string; workspaceId: string }[]> {
        const { result } = await this.run(['pane', 'list']);
        return result.panes.map((p: { pane_id: string; workspace_id: string }) => ({ paneId: p.pane_id, workspaceId: p.workspace_id }));
    }

    /** The pid of the pane's shell; its parent is the herdr server (spec 10 R2). */
    async paneShellPid(paneId: string): Promise<number | undefined> {
        const { result } = await this.run(['pane', 'process-info', '--pane', paneId]);
        return result.process_info?.shell_pid;
    }

    async focusWorkspace(id: string): Promise<void> {
        await this.run(['workspace', 'focus', id]);
    }

    async createTab(workspaceId: string, cwd: string, label: string): Promise<{ tabId: string; paneId: string }> {
        const { result } = await this.run(['tab', 'create', '--workspace', workspaceId, '--cwd', cwd, '--label', label, '--focus']);
        return { tabId: result.tab.tab_id, paneId: result.root_pane.pane_id };
    }

    async runInPane(paneId: string, command: string): Promise<void> {
        // The real `pane run` prints nothing on success (found by the integration test).
        await this.run(['pane', 'run', paneId, command], true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- herdr's JSON is validated by use, not by a schema
    protected async run(args: string[], allowEmptyOutput = false): Promise<any> {
        const argv = [...(this.opts.session ? ['--session', this.opts.session] : []), ...args];
        let res;
        try {
            res = await this.execFileFn(this.opts.binary, argv, { timeoutMs: this.timeoutMs });
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            throw new HerdrError(code === 'ENOENT' ? 'not_found' : code === 'ETIMEDOUT' ? 'timeout' : 'cli_error', (e as Error).message);
        }
        if (res.exitCode === 1) {
            const err = tryParse(res.stderr)?.error;
            if (err?.code) {
                throw new HerdrError(err.code, err.message, 1, res.stderr);
            }
        }
        if (res.exitCode !== 0) {
            throw new HerdrError('cli_error', res.stderr.trim() || `herdr exited with ${res.exitCode}`, res.exitCode, res.stderr);
        }
        if (allowEmptyOutput && !res.stdout.trim()) {
            return {};
        }
        const parsed = tryParse(res.stdout);
        if (parsed === undefined) {
            throw new HerdrError('cli_error', `herdr printed invalid JSON: ${res.stdout.slice(0, 200)}`, 0, res.stderr);
        }
        return parsed;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParse(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}
