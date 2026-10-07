import { ProjectListService } from '../projects/project-list-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { Command, CommandContribution, CommandRegistry, MessageService } from '@theia/core/lib/common';
import { ApplicationShell, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { CorralHerdrService, OpenTabRequest } from '../../common/protocol';
import { owningProject } from '../../common/paths';
import { resolveStartupCommand } from '../../common/startup-command';
import { ProjectsContribution } from '../projects/projects-contribution';
import { NEW_TAB_COMMAND_ID } from '../../common/command-ids';
import { ProjectsWidget } from '../projects/projects-widget';
import { CorralWindowTitle } from '../window-title-contribution';
import { CorralPreferences } from '../corral-preferences';
import { HerdrCommands } from './herdr-terminal-contribution';

export const NewTabCommand: Command = { id: NEW_TAB_COMMAND_ID, label: 'Corral: New herdr tab here' };

const POLL_MS = 250;
const POLL_TIMEOUT_MS = 5000;

@injectable()
export class NewTabContribution implements CommandContribution, KeybindingContribution {

    @inject(CorralHerdrService) protected readonly herdr: CorralHerdrService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(ProjectsContribution) protected readonly projects: ProjectsContribution;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;
    @inject(MessageService) protected readonly messages: MessageService;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(CorralWindowTitle) protected readonly windowTitle: CorralWindowTitle;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(NewTabCommand, {
            execute: (uri?: URI) => this.newTab(uri)
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: NewTabCommand.id,
            keybinding: 'ctrlcmd+alt+t'
        });
    }

    protected folderFromFocus(): URI | undefined {
        const widget = this.shell.activeWidget;
        if (!(widget instanceof ProjectsWidget)) {
            return undefined;
        }
        const node = widget.model.selectedFileStatNodes[0];
        if (!node) {
            return undefined;
        }
        return node.fileStat.isDirectory ? node.uri : node.uri.parent;
    }

    protected async newTab(target?: URI): Promise<void> {
        const uri = target ?? this.folderFromFocus();
        if (!uri) {
            return;
        }
        const folderPath = FileUri.fsPath(uri);
        const entries = this.projectList.entries(true);
        const projects = entries.map(e => e.path);
        const projectPath = owningProject(folderPath, projects);
        if (!projectPath || entries.some(e => e.path === projectPath && e.missing)) {
            return;
        }
        this.windowTitle.focus(projectPath);
        const command = resolveStartupCommand(folderPath, projects, this.prefs['corral.startupCommand'], this.prefs['corral.projectOverrides']);
        try {
            await this.openWithRetry({ projectPath, folderPath, command });
            await this.commands.executeCommand(HerdrCommands.FOCUS.id);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const choice = await this.messages.error(`Could not open a herdr tab: ${message}`, 'Open herdr');
            if (choice === 'Open herdr') {
                await this.commands.executeCommand(HerdrCommands.FOCUS.id);
            }
        }
    }

    // Errors cross RPC as plain Errors with no code, so "the server is down" is asked of the backend, not read from the error.
    /** An unreachable status counts as up: the original error is more useful than a retry loop. */
    protected serverIsUp(): Promise<boolean> {
        return this.herdr.status().then(s => s.running, () => true);
    }

    protected async openWithRetry(request: OpenTabRequest): Promise<void> {
        try {
            await this.herdr.openTab(request);
        } catch (e) {
            if (await this.serverIsUp()) {
                throw e;
            }
            await this.commands.executeCommand(HerdrCommands.FOCUS.id);
            const deadline = Date.now() + POLL_TIMEOUT_MS;
            while (!(await this.serverIsUp())) {
                if (Date.now() > deadline) {
                    throw e;
                }
                await new Promise(resolve => setTimeout(resolve, POLL_MS));
            }
            await this.herdr.openTab(request);
        }
    }
}
