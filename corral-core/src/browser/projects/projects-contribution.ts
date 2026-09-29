import { injectable } from '@theia/core/shared/inversify';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PROJECTS_VIEW_ID, ProjectsWidget } from './projects-widget';
import { PROJECTS_CONTAINER_ID } from './projects-view-container';

export const ProjectsCommands = {
    RESET_LAYOUT: { id: 'corral.resetLayout', label: 'Corral: Reset Layout' } as Command
};

@injectable()
export class ProjectsContribution extends AbstractViewContribution<ProjectsWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: PROJECTS_VIEW_ID,
            viewContainerId: PROJECTS_CONTAINER_ID,
            widgetName: 'Projects',
            defaultWidgetOptions: { area: 'right', rank: 100 },
            toggleCommandId: 'corral.projects.toggle'
        });
    }

    async initializeLayout(): Promise<void> {
        await this.applyDefaultLayout();
    }

    // Layouts saved before spec 09 hold Projects as its own right-panel tab: move it into the container.
    async onDidInitializeLayout(): Promise<void> {
        const standalone = this.tryGetWidget();
        if (standalone && this.shell.getTabBarFor(standalone)) {
            await this.shell.closeWidget(standalone.id);
            await this.openView({ activate: false, reveal: true });
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
        await this.shell.collapsePanel('left');
        await this.shell.collapsePanel('bottom');
    }
}
