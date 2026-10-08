import { inject, injectable } from '@theia/core/shared/inversify';
import { CompositeTreeNode, SelectableTreeNode, TreeImpl, TreeNode } from '@theia/core/lib/browser';
import { AgentRow } from '../../common/agents';
import { AgentsService } from './agents-service';

export const AGENTS_ROOT_ID = 'agents-root';

export interface AgentNode extends SelectableTreeNode { kind: 'agent'; row: AgentRow }
export const isAgentNode = (node: unknown): node is AgentNode => (node as AgentNode | undefined)?.kind === 'agent';

/** Spec 12 §agents-tree: a flat list of rows; ids come from the pane, so selection survives refreshes. */
@injectable()
export class AgentsTree extends TreeImpl {

    @inject(AgentsService) protected readonly agents: AgentsService;

    protected override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (parent.id !== AGENTS_ROOT_ID) {
            return [];
        }
        return this.agents.rows().map(row => ({
            kind: 'agent', id: `agent:${row.paneId}`, name: row.kind, parent, selected: false, row
        } as AgentNode));
    }
}
