import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { ApplicationShell, CompositeTreeNode, OpenerService, TreeNode, open } from '@theia/core/lib/browser';
import { FileNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager } from '@theia/editor/lib/browser';
import { HERDR_TERMINAL_ID } from '../herdr/herdr-terminal-contribution';
import { CorralProjectService } from '../../common/protocol';
import { ProjectEntry, buildProjectList } from '../../common/project-list';
import { CorralPreferences } from '../corral-preferences';
import { ProjectsTree } from './projects-tree';

@injectable()
export class ProjectsModel extends FileTreeModel {

    @inject(CorralProjectService) protected readonly projectService: CorralProjectService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(ProjectsTree) protected readonly projectsTree: ProjectsTree;
    @inject(OpenerService) protected readonly openers: OpenerService;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(EditorManager) protected readonly editors: EditorManager;
    @inject(FileService) protected readonly files: FileService;

    showHidden = false;
    entries: ProjectEntry[] = [];

    async reload(): Promise<void> {
        await this.prefs.ready;
        const extra = this.prefs['corral.extraProjects'];
        const hidden = this.prefs['corral.hiddenProjects'];
        const { scanned, missing } = await this.projectService.list({
            scanRoots: this.prefs['corral.scanRoots'], extra, hidden
        });
        this.entries = buildProjectList({ scanned, extra, hidden, showHidden: this.showHidden, missing });
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
            open(this.openers, node.uri, this.editorPlacement());
        } else {
            super.doOpenNode(node);
        }
    }

    previewNode(node: TreeNode): void {
        if (FileNode.is(node)) {
            open(this.openers, node.uri, { ...this.editorPlacement(), mode: 'reveal', preview: true });
        }
    }

    // Interim placement until the general guard (T1.12): never land in the herdr tab's group.
    protected editorPlacement(): { widgetOptions?: ApplicationShell.WidgetOptions } {
        const lastEditor = this.editors.all[this.editors.all.length - 1];
        if (lastEditor) {
            return { widgetOptions: { area: 'main', mode: 'tab-after', ref: lastEditor } };
        }
        const herdr = this.shell.getWidgets('main').find(w => w.id === HERDR_TERMINAL_ID);
        return herdr ? { widgetOptions: { area: 'main', mode: 'split-left', ref: herdr } } : {};
    }
}
