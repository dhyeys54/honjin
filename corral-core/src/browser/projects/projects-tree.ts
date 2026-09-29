import { injectable } from '@theia/core/shared/inversify';
import { CompositeTreeNode, TreeNode } from '@theia/core/lib/browser';
import { DirNode, FileTree } from '@theia/filesystem/lib/browser';
import { FileStat } from '@theia/filesystem/lib/common/files';

export const PROJECTS_ROOT_ID = 'corral-projects-root';

/** A FileTree whose root is a synthetic node holding one DirNode per project. */
@injectable()
export class ProjectsTree extends FileTree {

    createRoot(): CompositeTreeNode {
        return { id: PROJECTS_ROOT_ID, name: 'Projects', parent: undefined, children: [], visible: false };
    }

    createProjectNode(stat: FileStat, root: CompositeTreeNode): TreeNode {
        return this.toNode(stat, root) as DirNode;
    }
}
