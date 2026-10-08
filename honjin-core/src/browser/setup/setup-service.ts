import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWatcher } from '@theia/terminal/lib/common/terminal-watcher';
import { HonjinSetupService } from '../../common/protocol';
import { installScript } from '../../common/install-script';
import { AGENTS, AgentId, PrerequisiteStatus, SetupState, setupState } from '../../common/prerequisites';

/** Spec 13 S5–S7: the last prerequisite check, shared by the Setup view, first run and + (S9). */
@injectable()
export class SetupService {

    @inject(HonjinSetupService) protected readonly backend: HonjinSetupService;
    @inject(TerminalService) protected readonly terminals: TerminalService;
    @inject(TerminalWatcher) protected readonly watcher: TerminalWatcher;

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;
    protected readonly readyOrSkipped = new Deferred<void>();
    statuses: PrerequisiteStatus[] | undefined;

    get state(): SetupState | undefined {
        return this.statuses && setupState(Object.fromEntries(this.statuses.map(s => [s.id, s.found])));
    }

    installedAgents(): AgentId[] {
        return AGENTS.filter(a => this.statuses?.some(s => s.id === a.id && s.found)).map(a => a.id);
    }

    async check(): Promise<SetupState> {
        this.statuses = await this.backend.check();
        this.onDidChangeEmitter.fire();
        const state = this.state!;
        if (state === 'ready') {
            this.readyOrSkipped.resolve();
        }
        return state;
    }

    /** S7 "Continue anyway". */
    skip(): void {
        this.readyOrSkipped.resolve();
    }

    /** Resolves once setup is ready or skipped; true when that took the user (so first run shows the + hint). */
    async untilReady(): Promise<boolean> {
        if ((this.statuses ? this.state : await this.check()) === 'ready') {
            return false;
        }
        await this.readyOrSkipped.promise;
        return true;
    }

    /** S6: the catalog command in a visible terminal, only on a click; a re-check follows when it ends. */
    async install(name: string, command: string): Promise<void> {
        const script = installScript(command);
        const widget = await this.terminals.newTerminal({
            title: `Install ${name}`, useServerTitle: false, shellPath: '/bin/zsh', shellArgs: ['-lc', script], destroyTermOnClose: true
        });
        await this.terminals.open(widget, { mode: 'activate', widgetOptions: { area: 'bottom' } });
        await widget.start();
        let done = false;
        const recheck = () => {
            if (!done) {
                done = true;
                listener.dispose();
                void this.check();
            }
        };
        const listener = this.watcher.onTerminalExit(e => e.terminalId === widget.terminalId && recheck());
        widget.onDidDispose(recheck);
    }
}
