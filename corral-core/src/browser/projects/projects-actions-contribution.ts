import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, Emitter, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { Widget } from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { DirNode } from '@theia/filesystem/lib/browser';
import { QuickInputService } from '@theia/core/lib/browser';
import { withHidden, withoutPath } from '../../common/hidden-projects';
import { resolveStartupCommand, withOverride } from '../../common/startup-command';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { WorkspaceCommands } from '@theia/workspace/lib/browser/workspace-commands';
import { FileStatNode } from '@theia/filesystem/lib/browser';
import { CorralHerdrService, CorralProjectService } from '../../common/protocol';
import { FolderPicker } from '../folder-picker';
import { CorralPreferences } from '../corral-preferences';
import { ProjectListService } from './project-list-service';
import { NEW_TAB_COMMAND_ID, PROJECTS_CONTEXT_MENU, ProjectsWidget } from './projects-widget';
import { ProjectsContribution } from './projects-contribution';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { ScmResource } from '@theia/scm/lib/browser/scm-provider';
import { ScmContribution } from '@theia/scm/lib/browser/scm-contribution';
import { pickChange } from '../../common/scm-change';

export const ProjectsActions = {
    TOGGLE_SHOW_HIDDEN: { id: 'corral.projects.toggleShowHidden', label: 'Corral: Show Hidden Projects' } as Command,
    HIDE: { id: 'corral.projects.hide', label: 'Hide project' } as Command,
    ADD: { id: 'corral.projects.add', label: 'Corral: Add Project…' } as Command,
    REMOVE: { id: 'corral.projects.remove', label: 'Remove from list' } as Command,
    SET_STARTUP: { id: 'corral.projects.setStartupCommand', label: 'Set startup command…' } as Command,
    USE_GLOBAL: { id: 'corral.projects.useGlobalCommand', label: 'Use global startup command' } as Command,
    FORGET: { id: 'corral.projects.forgetMapping', label: 'Remove from herdr mapping' } as Command,
    COPY_PATH: { id: 'corral.projects.copyPath', label: 'Copy Path' } as Command,
    REVEAL: { id: 'corral.projects.revealInFinder', label: 'Reveal in Finder' } as Command,
    REFRESH: { id: 'corral.projects.refresh', label: 'Corral: Refresh Projects' } as Command,
    COLLAPSE_ALL: { id: 'corral.projects.collapseAll', label: 'Corral: Collapse All Projects' } as Command,
    UNHIDE: { id: 'corral.projects.unhide', label: 'Unhide project' } as Command,
    OPEN_CHANGES: { id: 'corral.projects.openChanges', label: 'Open Changes' } as Command,
    SHOW_CHANGES: { id: 'corral.projects.showChanges', label: 'Show Changes' } as Command
};

const ROOT_GROUP = [...PROJECTS_CONTEXT_MENU, '9_project'];

/** View toolbar and context-menu actions of the Projects view (spec 03). */
@injectable()
export class ProjectsActionsContribution implements CommandContribution, MenuContribution, TabBarToolbarContribution {

    @inject(ProjectsContribution) protected readonly view: ProjectsContribution;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(QuickInputService) protected readonly quickInput: QuickInputService;
    @inject(CorralHerdrService) protected readonly herdr: CorralHerdrService;
    @inject(ClipboardService) protected readonly clipboard: ClipboardService;
    @inject(CorralProjectService) protected readonly projectService: CorralProjectService;
    @inject(FolderPicker) protected readonly picker: FolderPicker;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(ScmService) protected readonly scm: ScmService;
    @inject(ScmContribution) protected readonly scmView: ScmContribution;
    @inject(MessageService) protected readonly messages: MessageService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ProjectsActions.TOGGLE_SHOW_HIDDEN, {
            execute: () => {
                this.widget?.model.toggleShowHidden();
                this.eyeChanged.fire();
            },
            isToggled: () => !!this.widget?.model.showHidden
        });
        commands.registerCommand(ProjectsActions.COLLAPSE_ALL, { execute: () => this.widget?.model.collapseAll() });
        commands.registerCommand(ProjectsActions.COPY_PATH, {
            execute: () => this.clipboard.writeText(this.selectedPaths().join('\n')),
            isVisible: () => this.selectedPaths().length > 0
        });
        commands.registerCommand(ProjectsActions.REVEAL, {
            execute: () => this.projectService.reveal(this.selectedPaths()[0]),
            isVisible: () => this.selectedPaths().length === 1
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
        commands.registerCommand(ProjectsActions.OPEN_CHANGES, {
            execute: () => this.selectedChange()?.open(),
            isVisible: () => !!this.selectedChange()
        });
        commands.registerCommand(ProjectsActions.SHOW_CHANGES, {
            execute: () => this.showChanges(),
            isVisible: () => this.selectedDir() !== undefined
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
        // Theia's own workspace commands act on the selection, which the tree publishes (globalSelection).
        const NEW = [...PROJECTS_CONTEXT_MENU, '1_new'];
        menus.registerMenuAction(NEW, { commandId: NEW_TAB_COMMAND_ID, label: 'New herdr tab here', order: 'a' });
        menus.registerMenuAction(NEW, { commandId: WorkspaceCommands.NEW_FILE.id, label: 'New File…', order: 'b' });
        menus.registerMenuAction(NEW, { commandId: WorkspaceCommands.NEW_FOLDER.id, label: 'New Folder…', order: 'c' });
        const EDIT = [...PROJECTS_CONTEXT_MENU, '2_edit'];
        menus.registerMenuAction(EDIT, { commandId: WorkspaceCommands.FILE_RENAME.id, label: 'Rename…', order: 'a' });
        menus.registerMenuAction(EDIT, { commandId: WorkspaceCommands.FILE_DELETE.id, label: 'Delete', order: 'b' });
        const GIT = [...PROJECTS_CONTEXT_MENU, '2_git'];
        menus.registerMenuAction(GIT, { commandId: ProjectsActions.OPEN_CHANGES.id, order: 'a' });
        menus.registerMenuAction(GIT, { commandId: ProjectsActions.SHOW_CHANGES.id, order: 'b' });
        const PATH = [...PROJECTS_CONTEXT_MENU, '3_path'];
        menus.registerMenuAction(PATH, { commandId: ProjectsActions.COPY_PATH.id, order: 'a' });
        menus.registerMenuAction(PATH, { commandId: ProjectsActions.REVEAL.id, order: 'b' });
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
            id: ProjectsActions.COLLAPSE_ALL.id, command: ProjectsActions.COLLAPSE_ALL.id, icon: 'codicon codicon-collapse-all',
            tooltip: 'Collapse all projects', priority: 40, isVisible: (w: Widget | undefined) => w instanceof ProjectsWidget
        });
        // One item per state: the icon of a toolbar item is fixed, so the eye swaps for eye-closed while hidden projects are shown.
        const eye = (id: string, icon: string, tooltip: string, shown: boolean) => toolbar.registerItem({
            id, command: ProjectsActions.TOGGLE_SHOW_HIDDEN.id, icon, tooltip, priority: 20,
            onDidChange: this.eyeChanged.event,
            isVisible: (w: Widget | undefined) => w instanceof ProjectsWidget && !!w.model.showHidden === shown
        });
        eye(ProjectsActions.TOGGLE_SHOW_HIDDEN.id, 'codicon codicon-eye', 'Show hidden projects', false);
        eye(ProjectsActions.TOGGLE_SHOW_HIDDEN.id + '.on', 'codicon codicon-eye-closed', 'Hide hidden projects', true);
    }

    protected readonly eyeChanged = new Emitter<void>();

    protected get widget(): ProjectsWidget | undefined {
        return this.view.tryGetWidget();
    }

    /** The project root the context menu was opened on: a selected directory whose parent is the synthetic root. */
    protected selectedProject(): string | undefined {
        const node = this.widget?.model.selectedNodes.find(n => DirNode.is(n) && !DirNode.is(n.parent));
        return node && DirNode.is(node) ? node.uri.path.toString() : undefined;
    }

    protected selectedPaths(): string[] {
        return (this.widget?.model.selectedNodes ?? []).filter(FileStatNode.is).map(n => n.uri.path.fsPath());
    }

    protected selectedNode(): FileStatNode | undefined {
        const nodes = (this.widget?.model.selectedNodes ?? []).filter(FileStatNode.is);
        return nodes.length === 1 ? nodes[0] : undefined;
    }

    protected selectedDir(): FileStatNode | undefined {
        const node = this.selectedNode();
        return node && DirNode.is(node) ? node : undefined;
    }

    /** The git change of the one selected file, if it has one: the menu item only shows for changed files. */
    protected selectedChange(): ScmResource | undefined {
        const node = this.selectedNode();
        const repo = node && !DirNode.is(node) ? this.scm.findRepository(node.uri) : undefined;
        if (!repo) {
            return undefined;
        }
        const groups = repo.provider.groups.map(g => ({ id: g.id, resources: g.resources.map(r => ({ sourceUri: r.sourceUri.toString(), r })) }));
        return pickChange(groups, node!.uri.toString())?.r;
    }

    /** The Source Control view only shows the selected repository, so point it at this folder's repo first. */
    protected async showChanges(): Promise<void> {
        const dir = this.selectedDir();
        const repo = dir && this.scm.findRepository(dir.uri);
        if (!repo) {
            this.messages.info(`${dir?.fileStat.name ?? 'This folder'} is not in a git repository.`);
            return;
        }
        this.scm.selectedRepository = repo;
        await this.scmView.openView({ activate: true, reveal: true });
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
