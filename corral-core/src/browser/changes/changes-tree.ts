import { inject, injectable } from '@theia/core/shared/inversify';
import { CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode, TreeImpl, TreeNode } from '@theia/core/lib/browser';
import { ChangeFile, ChangeGroup } from '../../common/changes';
import { ChangesService } from './changes-service';

export const CHANGES_ROOT_ID = 'changes-root';

export interface ChangesProjectNode extends ExpandableTreeNode, SelectableTreeNode { change: ChangeGroup }
export interface ChangesFileNode extends SelectableTreeNode { change: ChangeFile }

export const isProjectNode = (node: unknown): node is ChangesProjectNode =>
    ExpandableTreeNode.is(node) && 'change' in (node as object) && 'files' in (node as ChangesProjectNode).change;
export const isFileNode = (node: unknown): node is ChangesFileNode =>
    SelectableTreeNode.is(node) && 'change' in (node as object) && 'rel' in (node as ChangesFileNode).change;

/** Spec 09 §changes-tree: project nodes over file nodes, built from ChangesService. */
@injectable()
export class ChangesTree extends TreeImpl {

    @inject(ChangesService) protected readonly changes: ChangesService;

    protected override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (parent.id === CHANGES_ROOT_ID) {
            return this.changes.groups().map(group => this.projectNode(group, parent));
        }
        if (isProjectNode(parent)) {
            return parent.change.files.map(file => this.fileNode(file, parent));
        }
        return [];
    }

    protected projectNode(group: ChangeGroup, parent: CompositeTreeNode): ChangesProjectNode {
        const id = `changes:${group.project}`;
        const node: ChangesProjectNode = {
            id, name: group.name, parent, change: group, selected: false, children: [],
            // Expansion survives refreshes; a project starts expanded (C9).
            expanded: (this.getNode(id) as ExpandableTreeNode | undefined)?.expanded ?? true
        };
        // Children are built eagerly so an expanded project never flashes empty on refresh.
        node.children = group.files.map(file => this.fileNode(file, node));
        return node;
    }

    protected fileNode(file: ChangeFile, parent: CompositeTreeNode): ChangesFileNode {
        return { id: `changes:${file.path}`, name: file.rel, parent, selected: false, change: file };
    }
}
