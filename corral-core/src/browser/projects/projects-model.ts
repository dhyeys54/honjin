import { Disposable, DisposableCollection } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { CompositeTreeNode, OpenerService, TreeNode, open } from '@theia/core/lib/browser';
import { DirNode, FileNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorPlacementGuard } from '../editor-placement-guard';
import { ProjectEntry } from '../../common/project-list';
import { ProjectListService } from './project-list-service';
import { ProjectsTree } from './projects-tree';

/** A stand-in stat so a vanished project can still be listed (struck through) and removed. */
const missingStat = (resource: URI): FileStat => ({
    resource, name: resource.path.base, isFile: false, isDirectory: true, isSymbolicLink: false, isReadonly: false
});

@injectable()
export class ProjectsModel extends FileTreeModel {

    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(ProjectsTree) protected readonly projectsTree: ProjectsTree;
    @inject(OpenerService) protected readonly openers: OpenerService;
    @inject(EditorPlacementGuard) protected readonly guard: EditorPlacementGuard;
    @inject(FileService) protected readonly files: FileService;

    showHidden = false;
    entries: ProjectEntry[] = [];

    get hiddenPaths(): Set<string> {
        return new Set(this.entries.filter(e => e.hidden).map(e => e.path));
    }

    get missingPaths(): Set<string> {
        return this.projectsTree.missing;
    }

    protected override init(): void {
        super.init();
        this.toDispose.push(this.projectList.onDidChange(() => this.rebuild()));
        this.toDispose.push(this.toDisposeOnRebuild);
        this.toDispose.push(Disposable.create(() => this.watches.forEach(w => w.dispose())));
        this.toDispose.push(this.onExpansionChanged(node => this.watchExpanded(node)));
        this.rebuild();
    }

    async reload(): Promise<void> {
        await this.projectList.reload();
    }

    toggleShowHidden(): void {
        this.showHidden = !this.showHidden;
        this.rebuild();
    }

    protected readonly toDisposeOnRebuild = new DisposableCollection();

    // Theia only watches the workspace file, so folders shown in the tree are watched as they expand.
    // A recursive watch per project starves the backend search of file handles, hence one shallow watch per open folder.
    protected readonly watches = new Map<string, Disposable>();

    protected watchExpanded(node: Readonly<{ id: string, expanded?: boolean }>): void {
        if (!DirNode.is(node as never)) {
            return;
        }
        const dir = node as unknown as DirNode;
        this.watches.get(dir.id)?.dispose();
        this.watches.delete(dir.id);
        if (dir.expanded) {
            this.watches.set(dir.id, this.files.watch(dir.uri));
        }
    }

    protected generation = 0;

    protected async rebuild(): Promise<void> {
        const generation = ++this.generation;
        this.entries = this.projectList.entries(this.showHidden);
        const root: CompositeTreeNode = this.projectsTree.createRoot();
        this.toDisposeOnRebuild.dispose();
        this.watches.forEach(w => w.dispose());
        this.watches.clear();
        this.projectsTree.missing = new Set(this.entries.filter(e => e.missing).map(e => e.path));
        const nodes = await Promise.all(this.entries.map(async e => {
            const uri = new URI().withScheme('file').withPath(e.path);
            try {
                return this.projectsTree.createProjectNode(e.missing ? missingStat(uri) : await this.files.resolve(uri), root);
            } catch {
                return undefined; // vanished between scan and stat; the next refresh shows it as missing
            }
        }));
        if (generation !== this.generation) {
            return; // a newer rebuild started while this one was resolving stats
        }
        this.projectsTree.projects = nodes.filter((n): n is NonNullable<typeof n> => !!n);
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
