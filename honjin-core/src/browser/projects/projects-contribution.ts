import { injectable } from '@theia/core/shared/inversify';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { FileUri } from '@theia/core/lib/common/file-uri';
import URI from '@theia/core/lib/common/uri';
import { AbstractViewContribution, ExpandableTreeNode, FrontendApplicationContribution, SelectableTreeNode } from '@theia/core/lib/browser';
import { PROJECTS_VIEW_ID, ProjectsWidget } from './projects-widget';
import { PROJECTS_CONTAINER_ID } from './projects-view-container';

export const ProjectsCommands = {
    RESET_LAYOUT: { id: 'honjin.resetLayout', label: 'Honjin: Reset Layout' } as Command
};

@injectable()
export class ProjectsContribution extends AbstractViewContribution<ProjectsWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: PROJECTS_VIEW_ID,
            viewContainerId: PROJECTS_CONTAINER_ID,
            widgetName: 'Projects',
            defaultWidgetOptions: { area: 'right', rank: 100 },
            toggleCommandId: 'honjin.projects.toggle'
        });
    }

    async initializeLayout(): Promise<void> {
        await this.applyDefaultLayout();
    }

    // Layouts saved before spec 09 hold Projects as its own right-panel tab: move it into the container.
    async onDidInitializeLayout(): Promise<void> {
        const standalone = this.tryGetWidget();
        // getTabBarFor also resolves a part through its container, so "standalone" means: not inside the container.
        const container = this.shell.getWidgetById(PROJECTS_CONTAINER_ID);
        if (standalone && this.shell.getTabBarFor(standalone) && !container?.node.contains(standalone.node)) {
            await this.shell.closeWidget(standalone.id);
            await this.openView({ activate: false, reveal: true });
        }
    }

    /** Expands each folder from the project down to the path in the Projects tree, then selects it. */
    async revealPath(path: string): Promise<void> {
        const uri = FileUri.create(path);
        const projects = await this.widget;
        await this.openView({ activate: true, reveal: true });
        const model = projects.model;
        const chain: URI[] = [];
        for (let u = uri; !u.path.isRoot; u = u.parent) {
            chain.unshift(u);
        }
        for (const step of chain) {
            const node = [...model.getNodesByUri(step)][0];
            if (node && ExpandableTreeNode.is(node) && !node.expanded && step !== uri) {
                await model.expandNode(node);
            } else if (node && step === uri && SelectableTreeNode.is(node)) {
                model.selectNode(node);
            }
        }
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(ProjectsCommands.RESET_LAYOUT, { execute: () => this.applyDefaultLayout() });
    }

    // Spec 02: left panel and bottom collapsed, Projects expanded on the right. Collapsing is per area, so
    // resetting only touches those and never closes editors or the herdr tab.
    protected async applyDefaultLayout(): Promise<void> {
        await this.openView({ activate: false, reveal: true });
        this.shell.resize(300, 'right');
        await this.shell.collapsePanel('left');
        this.shell.resize(280, 'left'); // collapsed, so this is the width it reopens at
        await this.shell.collapsePanel('bottom');
    }
}
