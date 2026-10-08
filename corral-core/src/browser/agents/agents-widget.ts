import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import {
    BadgeWidget, CompositeTreeNode, ContextMenuRenderer, NodeProps, TreeModel, TreeNode, TreeProps, TreeWidget, createTreeContainer
} from '@theia/core/lib/browser';
import { badgeTooltip, formatAge } from '../../common/agents';
import { AgentsService } from './agents-service';
import { AGENTS_ROOT_ID, AgentsTree, isAgentNode } from './agents-tree';

export const AGENTS_VIEW_ID = 'corral-agents';
export const AGENTS_CONTEXT_MENU = ['corral-agents-context-menu'];

/** Spec 12: every agent in the herdr session, most urgent first. */
@injectable()
export class AgentsWidget extends TreeWidget implements BadgeWidget {

    @inject(AgentsService) protected readonly agents: AgentsService;

    protected readonly onDidChangeBadgeEmitter = new Emitter<void>();
    readonly onDidChangeBadge = this.onDidChangeBadgeEmitter.event;
    protected readonly onDidChangeBadgeTooltipEmitter = new Emitter<void>();
    readonly onDidChangeBadgeTooltip = this.onDidChangeBadgeTooltipEmitter.event;
    badge?: number;
    badgeTooltip?: string;

    constructor(
        @inject(TreeProps) props: TreeProps,
        @inject(TreeModel) model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
        this.id = AGENTS_VIEW_ID;
        this.title.label = 'Agents';
        this.title.caption = 'Agents';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-hubot';
        this.addClass('corral-agents');
        this.node.dataset.testid = 'corral-agents';
    }

    @postConstruct()
    protected override init(): void {
        super.init();
        this.model.root = { id: AGENTS_ROOT_ID, name: '', visible: false, parent: undefined, children: [] } as CompositeTreeNode;
        this.toDispose.push(this.onDidChangeBadgeEmitter);
        this.toDispose.push(this.onDidChangeBadgeTooltipEmitter);
        this.toDispose.push(this.agents.onDidChange(() => { this.model.refresh(); this.update(); this.updateBadge(); }));
        this.toDispose.push(this.model.onOpenNode(node => {
            if (isAgentNode(node)) {
                void this.agents.focus(node.row.paneId);
            }
        }));
    }

    /** A7: fires only when the count changes. */
    protected updateBadge(): void {
        const n = this.agents.needsYou();
        if ((this.badge ?? 0) !== n) {
            this.badge = n || undefined;
            this.badgeTooltip = badgeTooltip(n);
            this.onDidChangeBadgeEmitter.fire();
            this.onDidChangeBadgeTooltipEmitter.fire();
        }
    }

    /** A11: the first of four texts that applies; before the first poll settles it is empty so nothing flashes. */
    protected emptyText(): string {
        if (!this.agents.loaded) {
            return '';
        }
        if (this.agents.error !== undefined) {
            return `Could not list agents: ${this.agents.error}`;
        }
        return this.agents.running ? 'No agents running' : 'herdr is not running';
    }

    protected override render(): React.ReactNode {
        if (this.agents.rows().length === 0) {
            return React.createElement('div', { className: 'corral-agents-empty', 'data-testid': 'corral-agents-empty' }, this.emptyText());
        }
        return super.render();
    }

    protected override getCaptionChildren(node: TreeNode, props: NodeProps): React.ReactNode[] {
        if (isAgentNode(node)) {
            const { row } = node;
            return [React.createElement('div', { key: 'r', className: 'corral-agent-row-body' },
                React.createElement('div', { className: 'corral-agent-main' },
                    React.createElement('span', { className: `corral-agent-dot corral-agent-${row.status}` }),
                    React.createElement('span', { className: 'corral-agent-kind' }, row.kind),
                    React.createElement('span', { className: 'corral-agent-location' }, row.location),
                    React.createElement('span', { className: 'corral-agent-state' }, `${row.status} ${formatAge(Date.now() - row.since)}`)),
                row.title ? React.createElement('div', { className: 'corral-agent-title' }, row.title) : undefined)];
        }
        return super.getCaptionChildren(node, props);
    }

    /** A5: the tooltip is the cwd, preceded by the pane title when there is one. */
    protected override createNodeAttributes(node: TreeNode, props: NodeProps): React.Attributes & React.HTMLAttributes<HTMLElement> {
        const attributes = super.createNodeAttributes(node, props);
        if (isAgentNode(node)) {
            const { cwd, title } = node.row;
            return { ...attributes, title: title ? `${title}\n${cwd}` : cwd, 'data-testid': 'corral-agent-row' } as typeof attributes;
        }
        return attributes;
    }

    protected override createNodeClassNames(node: TreeNode, props: NodeProps): string[] {
        const classes = super.createNodeClassNames(node, props);
        if (isAgentNode(node)) {
            classes.push(`corral-agent-row-${node.row.status}`);
        }
        return classes;
    }

    protected override handleClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        super.handleClickEvent(node, event);
        if (isAgentNode(node) && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
            this.model.openNode(node);
        }
    }
}

export function createAgentsWidget(parent: interfaces.Container): AgentsWidget {
    const child = createTreeContainer(parent, {
        tree: AgentsTree,
        widget: AgentsWidget,
        props: { contextMenuPath: AGENTS_CONTEXT_MENU, globalSelection: false }
    });
    return child.get(AgentsWidget);
}
