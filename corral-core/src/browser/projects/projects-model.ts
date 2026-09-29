import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { CompositeTreeNode, OpenerService, TreeNode, open } from '@theia/core/lib/browser';
import { FileNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorPlacementGuard } from '../editor-placement-guard';
import { ProjectEntry } from '../../common/project-list';
import { ProjectListService } from './project-list-service';
import { ProjectsTree } from './projects-tree';

@injectable()
export class ProjectsModel extends FileTreeModel {

    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(ProjectsTree) protected readonly projectsTree: ProjectsTree;
    @inject(OpenerService) protected readonly openers: OpenerService;
    @inject(EditorPlacementGuard) protected readonly guard: EditorPlacementGuard;
    @inject(FileService) protected readonly files: FileService;

    showHidden = false;
    entries: ProjectEntry[] = [];

    protected override init(): void {
        super.init();
        this.toDispose.push(this.projectList.onDidChange(() => this.rebuild()));
        this.rebuild();
    }

    async reload(): Promise<void> {
        await this.projectList.reload();
    }

    protected async rebuild(): Promise<void> {
        this.entries = this.projectList.entries(this.showHidden);
        const root: CompositeTreeNode = this.projectsTree.createRoot();
        const nodes = await Promise.all(this.entries.filter(e => !e.missing).map(async e => {
            try {
                return this.projectsTree.createProjectNode(await this.files.resolve(new URI().withScheme('file').withPath(e.path)), root);
            } catch {
                return undefined; // vanished between scan and stat; the next refresh drops it
            }
        }));
        root.children = nodes.filter((n): n is NonNullable<typeof n> => !!n);
        this.root = root;
    }

    // Files open in an editor (single click previews, double click / Enter pins); folders toggle as usual.
    protected override doOpenNode(node: TreeNode): void {
        if (FileNode.is(node)) {
            open(this.openers, node.uri, { widgetOptions: this.guard.optionsFor() });
        } else {
            super.doOpenNode(node);
        }
    }

    previewNode(node: TreeNode): void {
        if (FileNode.is(node)) {
            open(this.openers, node.uri, { widgetOptions: this.guard.optionsFor(), mode: 'reveal', preview: true });
        }
    }
}
