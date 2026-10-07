import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { WidgetManager } from '@theia/core/lib/browser';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { colors } from '../../common/design-tokens';
import { ProjectsContribution } from '../projects/projects-contribution';
import { AGENTS_CONTEXT_MENU, AGENTS_VIEW_ID, AgentsWidget } from './agents-widget';
import { AgentNode, isAgentNode } from './agents-tree';
import { AgentsService } from './agents-service';

export const AgentsCommands = {
    FOCUS: { id: 'corral.agents.focus', label: 'Focus Agent' } as Command,
    REVEAL: { id: 'corral.agents.reveal', label: 'Reveal in Projects' } as Command,
    COPY_PATH: { id: 'corral.agents.copyPath', label: 'Copy Path' } as Command
};

const definitions: [string, string, string][] = [
    ['blocked', colors.danger, 'The dot of an agent that is waiting for you to answer.'],
    ['done', colors.accent, 'The dot of an agent that finished while you were not looking.'],
    ['working', colors.info, 'The dot of an agent that is working.'],
    ['unknown', colors['fg-faint'], 'The dot of an agent whose state herdr does not report.']
];

/** Spec 12 A9 and A10: the context menu and the status colours (the badges join this class in T7.7). */
@injectable()
export class AgentsContribution implements CommandContribution, MenuContribution, ColorContribution {

    @inject(WidgetManager) protected readonly widgets: WidgetManager;
    @inject(ClipboardService) protected readonly clipboard: ClipboardService;
    @inject(ProjectsContribution) protected readonly projectsView: ProjectsContribution;
    @inject(AgentsService) protected readonly agents: AgentsService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AgentsCommands.FOCUS, {
            execute: () => this.agents.focus(this.selected()!.row.paneId), isVisible: () => !!this.selected()
        });
        commands.registerCommand(AgentsCommands.REVEAL, {
            execute: () => this.projectsView.revealPath(this.selected()!.row.cwd), isVisible: () => !!this.selected()?.row.project
        });
        commands.registerCommand(AgentsCommands.COPY_PATH, {
            execute: () => this.clipboard.writeText(this.selected()!.row.cwd), isVisible: () => !!this.selected()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const AGENT = [...AGENTS_CONTEXT_MENU, '1_agent'];
        menus.registerMenuAction(AGENT, { commandId: AgentsCommands.FOCUS.id, order: 'a' });
        menus.registerMenuAction(AGENT, { commandId: AgentsCommands.REVEAL.id, order: 'b' });
        menus.registerMenuAction(AGENT, { commandId: AgentsCommands.COPY_PATH.id, order: 'c' });
    }

    protected selected(): AgentNode | undefined {
        const node = this.widgets.tryGetWidget<AgentsWidget>(AGENTS_VIEW_ID)?.model.selectedNodes[0];
        return isAgentNode(node) ? node : undefined;
    }

    registerColors(registry: ColorRegistry): void {
        registry.register(...definitions.map(([status, hex, description]) => ({
            id: `corral.agents.${status}`, defaults: { dark: hex, light: hex, hcDark: hex, hcLight: hex }, description
        })));
    }
}
