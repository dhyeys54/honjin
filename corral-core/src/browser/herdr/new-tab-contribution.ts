import { ProjectListService } from '../projects/project-list-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { Command, CommandContribution, CommandRegistry, MessageService } from '@theia/core/lib/common';
import { ApplicationShell, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { CorralHerdrService, OpenTabRequest } from '../../common/protocol';
import { owningProject, resolveStartupCommand } from '../../common/startup-command';
import { ProjectsContribution } from '../projects/projects-contribution';
import { ProjectsWidget, NEW_TAB_COMMAND_ID } from '../projects/projects-widget';
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

    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(CorralWindowTitle) protected readonly windowTitle: CorralWindowTitle;

    protected async newTab(target?: URI): Promise<void> {
        const uri = target ?? this.folderFromFocus();
        if (!uri) {
            return;
        }
        const folderPath = FileUri.fsPath(uri);
        const projects = this.projectList.entries(true).map(e => e.path);
        const projectPath = owningProject(folderPath, projects);
        if (!projectPath || this.projectList.entries(true).some(e => e.path === projectPath && e.missing)) {
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

    // Errors cross RPC as plain Errors, so the HerdrError code is recognised from the message (it defaults to the code).
    protected async openWithRetry(request: OpenTabRequest): Promise<void> {
        try {
            await this.herdr.openTab(request);
        } catch (e) {
            if (!String((e as Error).message).includes('server_not_running')) {
                throw e;
            }
            await this.commands.executeCommand(HerdrCommands.FOCUS.id);
            const deadline = Date.now() + POLL_TIMEOUT_MS;
            while (!(await this.herdr.status()).running) {
                if (Date.now() > deadline) {
                    throw e;
                }
                await new Promise(resolve => setTimeout(resolve, POLL_MS));
            }
            await this.herdr.openTab(request);
        }
    }
}
