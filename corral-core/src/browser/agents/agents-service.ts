import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService, Emitter, Event } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common/message-service';
import { AgentList, AgentRow, AgentsPoller, Seen, agentRows, agentsIntervalMs, needsYou, trackSince } from '../../common/agents';
import { CorralPreferenceKeys } from '../../common/preferences-schema';
import { CorralAgentService } from '../../common/protocol';
import { CorralPreferences } from '../corral-preferences';
import { HerdrCommands } from '../herdr/herdr-terminal-contribution';
import { ProjectListService } from '../projects/project-list-service';

const K = CorralPreferenceKeys;

/** The one owner of Agents state (spec 12): polls the backend, tracks time-in-state, serves the view and the badges. */
@injectable()
export class AgentsService implements FrontendApplicationContribution {

    @inject(CorralAgentService) protected readonly backend: CorralAgentService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(CommandService) protected readonly commands: CommandService;
    @inject(MessageService) protected readonly messages: MessageService;

    protected seen: ReadonlyMap<string, Seen> = new Map();
    protected list: AgentList = { running: true, agents: [] };
    protected _loaded = false;
    protected _error: string | undefined;
    protected readonly changed = new Emitter<void>();
    readonly onDidChange: Event<void> = this.changed.event;

    protected readonly poller = new AgentsPoller(
        () => this.backend.list(),
        () => agentsIntervalMs(this.prefs[K.agentsIntervalSeconds]),
        list => this.onResult(list),
        e => this.onError(e)
    );

    async onStart(): Promise<void> {
        await this.prefs.ready;
        this.projectList.onDidChange(() => this.changed.fire());
        this.poller.start();
    }

    onStop(): void {
        this.poller.stop();
    }

    get loaded(): boolean {
        return this._loaded;
    }

    get error(): string | undefined {
        return this._error;
    }

    get running(): boolean {
        return this.list.running;
    }

    rows(): AgentRow[] {
        const projects = this.projectList.entries(false).filter(e => this.projectList.roots.includes(e.path));
        return agentRows(this.list.agents, this.seen, projects);
    }

    needsYou(): number {
        return needsYou(this.list.agents);
    }

    refresh(): void {
        this.poller.refresh();
    }

    /** A8: focus the pane in herdr, reveal the herdr tab, and refresh either way so `done` turns `idle` at once. */
    async focus(paneId: string): Promise<void> {
        try {
            await this.backend.focus(paneId);
            await this.commands.executeCommand(HerdrCommands.FOCUS.id);
        } catch (e) {
            this.messages.error(`Could not focus agent: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            this.refresh();
        }
    }

    protected onResult(list: AgentList): void {
        this.seen = trackSince(this.seen, list.agents, Date.now());
        this.list = list;
        this._loaded = true;
        this._error = undefined;
        this.changed.fire();
    }

    protected onError(e: unknown): void {
        const message = e instanceof Error ? e.message : String(e);
        this._loaded = true;
        if (message !== this._error) {
            this._error = message;
            this.changed.fire();
        }
    }
}
