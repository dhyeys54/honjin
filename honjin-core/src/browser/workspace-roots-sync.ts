import { inject, injectable } from '@theia/core/shared/inversify';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { HonjinProjectService } from '../common/protocol';
import { diffRoots } from '../common/roots-diff';
import { ProjectListService } from './projects/project-list-service';

const toUri = (path: string) => FileUri.create(path);

/**
 * Keeps the workspace roots equal to the visible projects, so search, git and debug cover exactly
 * what the Projects view shows. Runs inside Honjin's own managed workspace file, never the user's.
 */
@injectable()
export class WorkspaceRootsSync implements FrontendApplicationContribution {

    @inject(WorkspaceService) protected readonly workspace: WorkspaceService;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(HonjinProjectService) protected readonly backend: HonjinProjectService;

    async onDidInitializeLayout(): Promise<void> {
        await this.workspace.ready;
        const managed = await this.backend.workspaceFile();
        if (this.workspace.workspace?.resource.path.toString() !== managed) {
            // Reloads once; the next start already sits in the managed workspace.
            this.workspace.open(toUri(managed), { preserveWindow: true });
            return;
        }
        this.projectList.onDidChange(() => this.sync().catch(e => console.error('Honjin: syncing workspace roots failed', e)));
        await this.projectList.reload();
    }

    protected sync = async (): Promise<void> => {
        const current = this.workspace.tryGetRoots().map(r => r.resource.path.toString());
        const { add, remove } = diffRoots(current, this.projectList.roots);
        if (remove.length) {
            await this.workspace.removeRoots(remove.map(toUri));
        }
        if (add.length) {
            await this.workspace.addRoot(add.map(toUri));
        }
    };
}
