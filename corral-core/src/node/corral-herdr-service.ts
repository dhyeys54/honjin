import { basename } from 'path';
import { CorralHerdrService, HerdrError, OpenTabRequest, OpenTabResult } from '../common/protocol';
import { resolveWorkspace } from '../common/workspace-resolution';
import { HerdrCli } from './herdr-cli';
import { WorkspaceMapStore } from './workspace-map-store';

export type HerdrClient = Pick<HerdrCli, 'status' | 'createWorkspace' | 'getWorkspace' | 'focusWorkspace' | 'createTab' | 'runInPane'>;

export class CorralHerdrServiceImpl implements CorralHerdrService {
    protected readonly chains = new Map<string, Promise<unknown>>();

    constructor(
        protected readonly getClient: () => Promise<{ cli: HerdrClient; session: string }>,
        protected readonly store: WorkspaceMapStore,
        protected readonly binaryResolver: () => Promise<{ binary: string | undefined; session: string }> =
            async () => ({ binary: undefined, session: '' })
    ) { }

    resolveBinary(): Promise<{ binary: string | undefined; session: string }> {
        return this.binaryResolver();
    }

    forgetProject(projectPath: string): Promise<void> {
        return this.store.delete(projectPath);
    }

    async status(): Promise<{ running: boolean }> {
        const { cli } = await this.getClient();
        return { running: (await cli.status()).running };
    }

    /** Serialised per project path so a double click cannot create two workspaces. */
    openTab(req: OpenTabRequest): Promise<OpenTabResult> {
        const prev = this.chains.get(req.projectPath) ?? Promise.resolve();
        const run = prev.catch(() => undefined).then(() => this.doOpenTab(req));
        this.chains.set(req.projectPath, run);
        return run;
    }

    protected async doOpenTab(req: OpenTabRequest): Promise<OpenTabResult> {
        const { cli, session } = await this.getClient();
        if (!(await cli.status()).running) {
            throw new HerdrError('server_not_running', 'herdr server is not running');
        }
        const mapped = await this.store.get(req.projectPath, session);
        const exists = mapped !== undefined && !!(await cli.getWorkspace(mapped));
        const resolution = resolveWorkspace(mapped, exists);

        let result: OpenTabResult;
        if (resolution.kind === 'reuse') {
            const tab = await cli.createTab(resolution.workspaceId, req.folderPath, basename(req.folderPath));
            result = { workspaceId: resolution.workspaceId, ...tab, createdWorkspace: false };
        } else {
            const ws = await cli.createWorkspace(req.folderPath, basename(req.projectPath));
            await this.store.set(req.projectPath, session, ws.workspaceId);
            result = { ...ws, createdWorkspace: true };
        }
        await cli.focusWorkspace(result.workspaceId);
        if (req.command.trim()) {
            await cli.runInPane(result.paneId, req.command);
        }
        return result;
    }
}
