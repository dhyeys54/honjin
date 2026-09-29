import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { Widget } from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { DirNode } from '@theia/filesystem/lib/browser';
import { withHidden } from '../../common/hidden-projects';
import { CorralPreferences } from '../corral-preferences';
import { ProjectListService } from './project-list-service';
import { PROJECTS_CONTEXT_MENU, ProjectsWidget } from './projects-widget';
import { ProjectsContribution } from './projects-contribution';

export const ProjectsActions = {
    TOGGLE_SHOW_HIDDEN: { id: 'corral.projects.toggleShowHidden', label: 'Corral: Show Hidden Projects' } as Command,
    HIDE: { id: 'corral.projects.hide', label: 'Hide project' } as Command,
    UNHIDE: { id: 'corral.projects.unhide', label: 'Unhide project' } as Command
};

const ROOT_GROUP = [...PROJECTS_CONTEXT_MENU, '9_project'];

/** View toolbar and context-menu actions of the Projects view (spec 03). */
@injectable()
export class ProjectsActionsContribution implements CommandContribution, MenuContribution, TabBarToolbarContribution {

    @inject(ProjectsContribution) protected readonly view: ProjectsContribution;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ProjectsActions.TOGGLE_SHOW_HIDDEN, {
            execute: () => this.widget?.model.toggleShowHidden(),
            isToggled: () => !!this.widget?.model.showHidden
        });
        commands.registerCommand(ProjectsActions.HIDE, {
            execute: () => this.setHidden(true),
            isVisible: () => !!this.selectedProject() && !this.isHidden(this.selectedProject()!)
        });
        commands.registerCommand(ProjectsActions.UNHIDE, {
            execute: () => this.setHidden(false),
            isVisible: () => !!this.selectedProject() && this.isHidden(this.selectedProject()!)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.HIDE.id, order: 'a' });
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.UNHIDE.id, order: 'b' });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: ProjectsActions.TOGGLE_SHOW_HIDDEN.id,
            command: ProjectsActions.TOGGLE_SHOW_HIDDEN.id,
            icon: 'codicon codicon-eye',
            tooltip: 'Show hidden projects',
            priority: 20,
            isVisible: (w: Widget | undefined) => w instanceof ProjectsWidget
        });
    }

    protected get widget(): ProjectsWidget | undefined {
        return this.view.tryGetWidget();
    }

    /** The project root the context menu was opened on: a selected directory whose parent is the synthetic root. */
    protected selectedProject(): string | undefined {
        const node = this.widget?.model.selectedNodes.find(n => DirNode.is(n) && !DirNode.is(n.parent));
        return node && DirNode.is(node) ? node.uri.path.toString() : undefined;
    }

    protected isHidden(path: string): boolean {
        return this.projectList.entries(true).some(e => e.path === path && e.hidden);
    }

    protected async setHidden(hide: boolean): Promise<void> {
        const path = this.selectedProject();
        if (path) {
            await this.preferenceService.set('corral.hiddenProjects',
                withHidden(this.prefs['corral.hiddenProjects'], path, hide), PreferenceScope.User);
        }
    }
}
