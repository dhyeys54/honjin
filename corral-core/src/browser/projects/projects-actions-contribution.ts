import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { Widget } from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { DirNode } from '@theia/filesystem/lib/browser';
import { QuickInputService } from '@theia/core/lib/browser';
import { withHidden, withoutPath } from '../../common/hidden-projects';
import { resolveStartupCommand, withOverride } from '../../common/startup-command';
import { CorralHerdrService } from '../../common/protocol';
import { FolderPicker } from '../folder-picker';
import { CorralPreferences } from '../corral-preferences';
import { ProjectListService } from './project-list-service';
import { PROJECTS_CONTEXT_MENU, ProjectsWidget } from './projects-widget';
import { ProjectsContribution } from './projects-contribution';

export const ProjectsActions = {
    TOGGLE_SHOW_HIDDEN: { id: 'corral.projects.toggleShowHidden', label: 'Corral: Show Hidden Projects' } as Command,
    HIDE: { id: 'corral.projects.hide', label: 'Hide project' } as Command,
    ADD: { id: 'corral.projects.add', label: 'Corral: Add Project…' } as Command,
    REMOVE: { id: 'corral.projects.remove', label: 'Remove from list' } as Command,
    SET_STARTUP: { id: 'corral.projects.setStartupCommand', label: 'Set startup command…' } as Command,
    USE_GLOBAL: { id: 'corral.projects.useGlobalCommand', label: 'Use global startup command' } as Command,
    FORGET: { id: 'corral.projects.forgetMapping', label: 'Remove from herdr mapping' } as Command,
    REFRESH: { id: 'corral.projects.refresh', label: 'Corral: Refresh Projects' } as Command,
    UNHIDE: { id: 'corral.projects.unhide', label: 'Unhide project' } as Command
};

const ROOT_GROUP = [...PROJECTS_CONTEXT_MENU, '9_project'];

/** View toolbar and context-menu actions of the Projects view (spec 03). */
@injectable()
export class ProjectsActionsContribution implements CommandContribution, MenuContribution, TabBarToolbarContribution {

    @inject(ProjectsContribution) protected readonly view: ProjectsContribution;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(QuickInputService) protected readonly quickInput: QuickInputService;
    @inject(CorralHerdrService) protected readonly herdr: CorralHerdrService;
    @inject(FolderPicker) protected readonly picker: FolderPicker;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ProjectsActions.TOGGLE_SHOW_HIDDEN, {
            execute: () => this.widget?.model.toggleShowHidden(),
            isToggled: () => !!this.widget?.model.showHidden
        });
        commands.registerCommand(ProjectsActions.ADD, { execute: () => this.add() });
        commands.registerCommand(ProjectsActions.REFRESH, { execute: () => this.projectList.reload() });
        commands.registerCommand(ProjectsActions.REMOVE, {
            execute: () => this.remove(),
            isVisible: () => this.isManual(this.selectedProject())
        });
        commands.registerCommand(ProjectsActions.SET_STARTUP, { execute: () => this.setStartupCommand(), isVisible: () => !!this.selectedProject() });
        commands.registerCommand(ProjectsActions.USE_GLOBAL, {
            execute: () => this.useGlobalCommand(),
            isVisible: () => { const p = this.selectedProject(); return !!p && p in this.prefs['corral.projectOverrides']; }
        });
        commands.registerCommand(ProjectsActions.FORGET, {
            execute: () => this.herdr.forgetProject(this.selectedProject()!),
            isVisible: () => !!this.selectedProject()
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
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.REMOVE.id, order: 'c' });
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.SET_STARTUP.id, order: 'd' });
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.USE_GLOBAL.id, order: 'e' });
        menus.registerMenuAction(ROOT_GROUP, { commandId: ProjectsActions.FORGET.id, order: 'f' });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: ProjectsActions.ADD.id, command: ProjectsActions.ADD.id, icon: 'codicon codicon-add',
            tooltip: 'Add project…', priority: 10, isVisible: (w: Widget | undefined) => w instanceof ProjectsWidget
        });
        toolbar.registerItem({
            id: ProjectsActions.REFRESH.id, command: ProjectsActions.REFRESH.id, icon: 'codicon codicon-refresh',
            tooltip: 'Refresh projects', priority: 30, isVisible: (w: Widget | undefined) => w instanceof ProjectsWidget
        });
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

    protected isManual(path: string | undefined): boolean {
        return !!path && this.projectList.entries(true).some(e => e.path === path && e.manual);
    }

    protected async add(): Promise<void> {
        const chosen = (await this.picker.pick('Add projects')).map(u => u.path.fsPath());
        if (chosen.length) {
            const current = this.prefs['corral.extraProjects'];
            await this.preferenceService.set('corral.extraProjects',
                [...current, ...chosen.filter(p => !current.includes(p))], PreferenceScope.User);
        }
    }

    /** Only forgets the entry; the folder itself is never touched. */
    protected async remove(): Promise<void> {
        const path = this.selectedProject();
        if (path) {
            await this.preferenceService.set('corral.extraProjects',
                withoutPath(this.prefs['corral.extraProjects'], path), PreferenceScope.User);
        }
    }

    protected async setStartupCommand(): Promise<void> {
        const path = this.selectedProject();
        if (!path) {
            return;
        }
        const overrides = this.prefs['corral.projectOverrides'];
        const value = await this.quickInput.input({
            title: `Startup command for ${path.slice(path.lastIndexOf('/') + 1)}`,
            value: resolveStartupCommand(path, [path], this.prefs['corral.startupCommand'], overrides),
            placeHolder: 'Leave empty for a plain shell · Esc to cancel'
        });
        if (value !== undefined) { // Esc gives undefined; Enter on empty stores '' (an explicit plain shell)
            await this.preferenceService.set('corral.projectOverrides', withOverride(overrides, path, value), PreferenceScope.User);
        }
    }

    protected async useGlobalCommand(): Promise<void> {
        const path = this.selectedProject();
        if (path) {
            await this.preferenceService.set('corral.projectOverrides',
                withOverride(this.prefs['corral.projectOverrides'], path, undefined), PreferenceScope.User);
        }
    }
}
