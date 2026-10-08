import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { ApplicationShell, BaseWidget, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalWatcher } from '@theia/terminal/lib/common/terminal-watcher';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { HonjinHerdrService } from '../../common/protocol';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { exitReason } from '../../common/exit-reason';
import { herdrClientEnv } from '../../common/herdr-client-env';
import { SetupService } from '../setup/setup-service';
import { SetupCommand } from '../setup/setup-contribution';

export const HerdrCommands = {
    FOCUS: { id: 'honjin.herdr.focus', label: 'Honjin: Focus herdr' } as Command,
    REATTACH: { id: 'honjin.herdr.reattach', label: 'Honjin: Reattach herdr' } as Command
};

export const HERDR_TERMINAL_ID = 'honjin-herdr-terminal';

@injectable()
export class HerdrTerminalContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(TerminalService) protected readonly terminals: TerminalService;
    @inject(TerminalWatcher) protected readonly watcher: TerminalWatcher;
    @inject(HonjinHerdrService) protected readonly herdr: HonjinHerdrService;
    @inject(EnvVariablesServer) protected readonly env: EnvVariablesServer;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;
    @inject(PreferenceService) protected readonly preferences: PreferenceService;
    @inject(SetupService) protected readonly setup: SetupService;

    @inject(ApplicationShell) protected readonly shell: ApplicationShell;

    protected widget?: TerminalWidget;
    protected placeholder?: BaseWidget;
    /** The placeholder says herdr is missing, so a later lookup may succeed (spec 02 step 5). */
    protected missing = false;

    async onDidInitializeLayout(): Promise<void> {
        if (!this.widget) {
            await this.create();
        }
        // Setup re-checks after its install terminal closes; that is when a missing herdr appears.
        this.setup.onDidChange(() => {
            if (this.missing && this.setup.statuses?.some(s => s.id === 'herdr' && s.found)) {
                this.missing = false; // a second check while this one resolves must not start a second terminal
                this.recreate();
            }
        });
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(HerdrCommands.FOCUS, {
            execute: async () => {
                if (this.missing) {
                    await this.recreate();
                    return;
                }
                if (!this.widget && this.placeholder && !this.placeholder.isDisposed) {
                    // The notice stands in for the herdr tab; a second tab with the same id would sit beside it.
                    await this.shell.activateWidget(this.placeholder.id);
                    return;
                }
                if (!this.widget) {
                    await this.create();
                }
                if (this.widget) {
                    await this.terminals.open(this.widget, { mode: 'activate' });
                }
            }
        });
        registry.registerCommand(HerdrCommands.REATTACH, {
            execute: () => this.recreate()
        });
    }

    protected async recreate(): Promise<void> {
        this.placeholder?.dispose();
        this.widget?.dispose();
        this.widget = undefined;
        await this.create();
    }

    protected async create(): Promise<void> {
        const { binary, session } = await this.herdr.resolveBinary();
        this.missing = !binary;
        if (!binary) {
            // Without a binary the terminal would fall back to the user's shell, so the notice stands in for it.
            await this.showPlaceholder('herdr not found', 'Set Up Honjin',
                () => this.commands.executeCommand(SetupCommand.id));
            return;
        }
        const home = FileUri.fsPath(await this.env.getHomeDirUri());
        // xterm measures its cell once at creation. Measured against the fallback font, the rows overflow the
        // pane (edges cut off) until something resizes it, so wait for the terminal font first.
        const family = this.preferences.get<string>('terminal.integrated.fontFamily', 'monospace');
        const size = this.preferences.get<number>('terminal.integrated.fontSize', 11);
        await document.fonts.load(`${size}px ${family}`).catch(() => undefined);
        const widget = await this.terminals.newTerminal({
            id: HERDR_TERMINAL_ID,
            title: 'herdr',
            useServerTitle: false,
            shellPath: binary,
            shellArgs: session ? ['--session', session] : [],
            cwd: home,
            // Theia merges process.env twice without strictEnv, which would bring back HERDR_* from a parent herdr pane.
            strictEnv: true,
            env: herdrClientEnv(home),
            destroyTermOnClose: true,
            isTransient: true
        });
        this.widget = widget;
        widget.title.closable = false;
        // herdr takes the right click for its own menu, so Theia's terminal menu (bubble listener on this node) must not
        // open over it. Capture phase runs first; xterm still sees the mousedown it reports to herdr.
        widget.node.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
        widget.onDidDispose(() => {
            if (this.widget === widget) {
                this.widget = undefined;
            }
        });
        // Open before start: herdr aborts with "zero-sized grid" if the pty is created before the widget has a size.
        await this.terminals.open(widget, { mode: 'activate', widgetOptions: { area: 'main', mode: 'split-right' } });
        // Keep a short tail of output: when herdr quits, its error is the last thing it printed.
        let tail = '';
        const output = widget.onOutput(data => { tail = (tail + data).slice(-4096); });
        widget.onDidDispose(() => output.dispose());
        await widget.start();
        const listener = this.watcher.onTerminalExit(e => {
            if (e.terminalId === widget.terminalId) {
                listener.dispose();
                output.dispose();
                const reason = exitReason(tail);
                // Theia disposes the terminal widget once its process is gone, so the message needs its own tab.
                this.showPlaceholder(reason ? `herdr exited: ${reason}` : 'herdr exited', 'Reattach', () => this.commands.executeCommand(HerdrCommands.REATTACH.id));
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
        placeholder.node.classList.add('honjin-herdr-overlay');
        const text = document.createElement('span');
        text.textContent = `${message} · `;
        const button = document.createElement('button');
        button.className = 'theia-button';
        button.textContent = action;
        button.addEventListener('click', () => run());
        placeholder.node.append(text, button);
        this.placeholder = placeholder;
        await this.shell.addWidget(placeholder, { area: 'main', mode: 'split-right' });
        await this.shell.activateWidget(placeholder.id);
    }
}
