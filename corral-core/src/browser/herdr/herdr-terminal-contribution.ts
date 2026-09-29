import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { ApplicationShell, BaseWidget, CommonCommands, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalWatcher } from '@theia/terminal/lib/common/terminal-watcher';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { CorralHerdrService } from '../../common/protocol';
import { fileURLToPath } from 'url';

export const HerdrCommands = {
    FOCUS: { id: 'corral.herdr.focus', label: 'Corral: Focus herdr' } as Command,
    REATTACH: { id: 'corral.herdr.reattach', label: 'Corral: Reattach herdr' } as Command
};

export const HERDR_TERMINAL_ID = 'corral-herdr-terminal';

// herdr refuses to nest and would follow HERDR_SOCKET_PATH to another server when Corral itself was
// launched from inside a herdr pane. Theia merges process.env twice (server, then ShellProcess), which would re-add cleared variables, so strictEnv
// is needed: the first merge already produced the complete environment.
const HERDR_ENV_TO_CLEAR = ['HERDR_ENV', 'HERDR_PANE_ID', 'HERDR_SOCKET_PATH', 'HERDR_TAB_ID', 'HERDR_WORKSPACE_ID'];

@injectable()
export class HerdrTerminalContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(TerminalService) protected readonly terminals: TerminalService;
    @inject(TerminalWatcher) protected readonly watcher: TerminalWatcher;
    @inject(CorralHerdrService) protected readonly herdr: CorralHerdrService;
    @inject(EnvVariablesServer) protected readonly env: EnvVariablesServer;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;

    @inject(ApplicationShell) protected readonly shell: ApplicationShell;

    protected widget?: TerminalWidget;
    protected placeholder?: BaseWidget;

    async onDidInitializeLayout(): Promise<void> {
        if (!this.widget) {
            await this.create();
        }
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(HerdrCommands.FOCUS, {
            execute: async () => {
                if (!this.widget) {
                    await this.create();
                }
                if (this.widget) {
                    await this.terminals.open(this.widget, { mode: 'activate' });
                }
            }
        });
        registry.registerCommand(HerdrCommands.REATTACH, {
            execute: async () => {
                this.placeholder?.dispose();
                this.widget?.dispose();
                this.widget = undefined;
                await this.create();
            }
        });
    }

    protected async create(): Promise<void> {
        const { binary, session } = await this.herdr.resolveBinary();
        const home = fileURLToPath(await this.env.getHomeDirUri());
        // Without a binary the widget would fall back to the user's shell, so start it only when herdr exists.
        const widget = await this.terminals.newTerminal({
            id: HERDR_TERMINAL_ID,
            title: 'herdr',
            useServerTitle: false,
            shellPath: binary,
            shellArgs: session ? ['--session', session] : [],
            cwd: home,
            strictEnv: true,
            env: Object.fromEntries(HERDR_ENV_TO_CLEAR.map(k => [k, ''])),
            destroyTermOnClose: true,
            isTransient: true
        });
        this.widget = widget;
        widget.title.closable = false;
        widget.onDidDispose(() => {
            if (this.widget === widget) {
                this.widget = undefined;
            }
        });
        // Open before start: herdr aborts with "zero-sized grid" if the pty is created before the widget has a size.
        await this.terminals.open(widget, { mode: 'activate', widgetOptions: { area: 'main', mode: 'split-right' } });
        if (!binary) {
            widget.dispose();
            await this.showPlaceholder('herdr not found. Set corral.herdr.path in Settings', 'Open Settings',
                () => this.commands.executeCommand(CommonCommands.OPEN_PREFERENCES.id));
            return;
        }
        await widget.start();
        const listener = this.watcher.onTerminalExit(e => {
            if (e.terminalId === widget.terminalId) {
                listener.dispose();
                // Theia disposes the terminal widget once its process is gone, so the message needs its own tab.
                this.showPlaceholder('herdr exited', 'Reattach', () => this.commands.executeCommand(HerdrCommands.REATTACH.id));
            }
        });
        widget.onDidDispose(() => listener.dispose());
    }

    protected async showPlaceholder(message: string, action: string, run: () => unknown): Promise<void> {
        this.placeholder?.dispose();
        const placeholder = new BaseWidget();
        placeholder.id = HERDR_TERMINAL_ID;
        placeholder.title.label = 'herdr';
        placeholder.title.closable = false;
        placeholder.node.classList.add('corral-herdr-overlay');
        const text = document.createElement('span');
        text.textContent = `${message} · `;
        const button = document.createElement('button');
        button.className = 'theia-button';
        button.textContent = action;
        button.addEventListener('click', () => { placeholder.dispose(); run(); });
        placeholder.node.append(text, button);
        this.placeholder = placeholder;
        await this.shell.addWidget(placeholder, { area: 'main', mode: 'split-right' });
        await this.shell.activateWidget(placeholder.id);
    }
}
