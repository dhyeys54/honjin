import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import {
    CompositeTreeNode, ContextMenuRenderer, NodeProps, TreeModel, TreeNode, TreeProps, TreeWidget, createTreeContainer
} from '@theia/core/lib/browser';
import { ChangesService } from './changes-service';
import { CHANGES_ROOT_ID, ChangesTree, isFileNode, isProjectNode } from './changes-tree';

export const CHANGES_VIEW_ID = 'honjin-changes';
export const CHANGES_CONTEXT_MENU = ['honjin-changes-context-menu'];

/** Spec 09: uncommitted files grouped by project, read-only. */
@injectable()
export class ChangesWidget extends TreeWidget {

    @inject(ChangesService) protected readonly changes: ChangesService;

    constructor(
        @inject(TreeProps) props: TreeProps,
        @inject(TreeModel) model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
        this.id = CHANGES_VIEW_ID;
        this.title.label = 'Changes';
        this.title.caption = 'Changes';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-git-compare';
        this.addClass('honjin-changes');
        this.node.dataset.testid = 'honjin-changes';
    }

    @postConstruct()
    protected override init(): void {
        super.init();
        this.model.root = { id: CHANGES_ROOT_ID, name: '', visible: false, parent: undefined, children: [] } as CompositeTreeNode;
        this.toDispose.push(this.changes.onDidChange(() => { this.model.refresh(); this.update(); }));
        this.toDispose.push(this.model.onOpenNode(node => {
            if (isFileNode(node)) {
                this.changes.resourceFor(node.change.path)?.open();
            }
        }));
    }

    protected override render(): React.ReactNode {
        if (this.changes.groups().length === 0) {
            return React.createElement('div', { className: 'honjin-changes-empty', 'data-testid': 'honjin-changes-empty' },
                'No uncommitted changes');
        }
        return super.render();
    }

    protected override getCaptionChildren(node: TreeNode, props: NodeProps): React.ReactNode[] {
        if (isProjectNode(node)) {
            return [node.name, React.createElement('span', { key: 'n', className: 'honjin-change-count' }, node.change.files.length)];
        }
        if (isFileNode(node)) {
            const { kind, letter } = node.change;
            return [
                React.createElement('span', { key: 'l', className: `honjin-change-letter honjin-change-${kind}` }, letter),
                React.createElement('span', { key: 'p', className: kind === 'deleted' ? 'honjin-change-deleted' : undefined }, node.change.rel)
            ];
        }
        return super.getCaptionChildren(node, props);
    }

    protected override createNodeClassNames(node: TreeNode, props: NodeProps): string[] {
        const classes = super.createNodeClassNames(node, props);
        if ((isProjectNode(node) || isFileNode(node)) && node.change.live) {
            classes.push('honjin-live');
        }
        return classes;
    }

    protected override handleClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        super.handleClickEvent(node, event);
        if (isFileNode(node) && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
            this.model.openNode(node);
        }
    }
}

export function createChangesWidget(parent: interfaces.Container): ChangesWidget {
    const child = createTreeContainer(parent, {
        tree: ChangesTree,
        widget: ChangesWidget,
        props: { contextMenuPath: CHANGES_CONTEXT_MENU, globalSelection: false }
    });
    return child.get(ChangesWidget);
}
