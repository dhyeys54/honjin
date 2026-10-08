import { inject, injectable } from '@theia/core/shared/inversify';
import { CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode, TreeImpl, TreeNode } from '@theia/core/lib/browser';
import { ChangeFile, ChangeGroup } from '../../common/changes';
import { ChangesService } from './changes-service';

export const CHANGES_ROOT_ID = 'changes-root';

export interface ChangesProjectNode extends ExpandableTreeNode, SelectableTreeNode { kind: 'changes-project'; change: ChangeGroup }
export interface ChangesFileNode extends SelectableTreeNode { kind: 'changes-file'; change: ChangeFile }

export const isProjectNode = (node: unknown): node is ChangesProjectNode => (node as ChangesProjectNode | undefined)?.kind === 'changes-project';
export const isFileNode = (node: unknown): node is ChangesFileNode => (node as ChangesFileNode | undefined)?.kind === 'changes-file';

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
            kind: 'changes-project', id, name: group.name, parent, change: group, selected: false, children: [],
            // Expansion survives refreshes; a project starts expanded (C9).
            expanded: (this.getNode(id) as ExpandableTreeNode | undefined)?.expanded ?? true
        };
        // Children are built eagerly so an expanded project never flashes empty on refresh.
        node.children = group.files.map(file => this.fileNode(file, node));
        return node;
    }

    protected fileNode(file: ChangeFile, parent: CompositeTreeNode): ChangesFileNode {
        return { kind: 'changes-file', id: `changes:${file.path}`, name: file.rel, parent, selected: false, change: file };
    }
}
