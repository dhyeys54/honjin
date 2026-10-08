import { injectable } from '@theia/core/shared/inversify';
import { CompositeTreeNode, TreeNode } from '@theia/core/lib/browser';
import { DirNode, FileTree } from '@theia/filesystem/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { FileStat } from '@theia/filesystem/lib/common/files';

export const PROJECTS_ROOT_ID = 'honjin-projects-root';

/** A FileTree whose root is a synthetic node holding one DirNode per project. */
@injectable()
export class ProjectsTree extends FileTree {

    /** Project folders that no longer exist; they show as rows but have nothing to expand. */
    missing = new Set<string>();

    /** Project nodes for the synthetic root. Going through resolveChildren registers them with the tree, which file-change refreshes rely on. */
    projects: TreeNode[] = [];

    override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (parent.id === PROJECTS_ROOT_ID) {
            return this.projects;
        }
        if (DirNode.is(parent) && this.missing.has(parent.uri.path.toString())) {
            return [];
        }
        return super.resolveChildren(parent);
    }

    // FileTreeModel.getNodesByUri looks nodes up by uri.toString(); the base FileTree ids them by path, so file-change refreshes never found ours.
    protected override toNodeId(uri: URI): string {
        return uri.toString();
    }

    createRoot(): CompositeTreeNode {
        return { id: PROJECTS_ROOT_ID, name: 'Projects', parent: undefined, children: [], visible: false };
    }

    createProjectNode(stat: FileStat, root: CompositeTreeNode): TreeNode {
        return this.toNode(stat, root) as DirNode;
    }
}
