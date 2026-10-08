import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common';
import { OutputChannelManager, OutputChannelSeverity } from '@theia/output/lib/browser/output-channel';
import { HonjinProjectService } from '../../common/protocol';
import { ProjectEntry, ProjectListInput, buildProjectList, visibleRoots } from '../../common/project-list';
import { HonjinPreferences } from '../honjin-preferences';

const PROJECT_KEYS = ['honjin.scanRoots', 'honjin.extraProjects', 'honjin.hiddenProjects'];

/** The one frontend copy of the project list; the tree and the roots sync both read it. */
@injectable()
export class ProjectListService {

    @inject(HonjinProjectService) protected readonly backend: HonjinProjectService;
    @inject(HonjinPreferences) protected readonly prefs: HonjinPreferences;
    @inject(OutputChannelManager) protected readonly output: OutputChannelManager;

    protected input: ProjectListInput = { scanned: [], extra: [], hidden: [], showHidden: true, missing: [] };
    protected all: ProjectEntry[] = [];
    /** False until the first list arrives, so the view does not flash an empty state. */
    loaded = false;
    protected generation = 0;
    /** Warnings from the last scan, so every reload doesn't repeat them. */
    protected warned = new Set<string>();
    protected readonly changed = new Emitter<void>();
    readonly onDidChange: Event<void> = this.changed.event;

    @postConstruct()
    protected init(): void {
        this.prefs.onPreferenceChanged(e => {
            if (PROJECT_KEYS.includes(e.preferenceName)) {
                this.reload();
            }
        });
    }

    /** Entries for the tree; hidden ones only when asked for, missing ones always (spec 03 rule 4). */
    entries(showHidden: boolean): ProjectEntry[] {
        return showHidden ? this.all : buildProjectList({ ...this.input, showHidden });
    }

    /** Project folders that belong in the workspace: not hidden, not missing. */
    get roots(): string[] {
        return visibleRoots(this.all);
    }

    async reload(): Promise<void> {
        await this.prefs.ready;
        const generation = ++this.generation;
        const extra = this.prefs['honjin.extraProjects'];
        const hidden = this.prefs['honjin.hiddenProjects'];
        let listed: Awaited<ReturnType<HonjinProjectService['list']>>;
        try {
            listed = await this.backend.list({ scanRoots: this.prefs['honjin.scanRoots'], extra, hidden });
        } catch (e) {
            // Keep the last list, but leave the empty state: the view must not wait forever on a backend that failed.
            if (generation === this.generation) {
                this.output.getChannel('Honjin').appendLine(`Could not list projects: ${e instanceof Error ? e.message : String(e)}`, OutputChannelSeverity.Error);
                this.loaded = true;
                this.changed.fire();
            }
            return;
        }
        if (generation !== this.generation) {
            return; // a newer reload is in flight and will publish
        }
        const { scanned, missing, warnings } = listed;
        this.report(warnings);
        this.input = { scanned, extra, hidden, showHidden: true, missing };
        this.all = buildProjectList(this.input);
        this.loaded = true;
        this.changed.fire();
    }

    protected report(warnings: string[]): void {
        const fresh = warnings.filter(w => !this.warned.has(w));
        this.warned = new Set(warnings);
        if (fresh.length) {
            const channel = this.output.getChannel('Honjin');
            fresh.forEach(w => channel.appendLine(w, OutputChannelSeverity.Warning));
        }
    }
}
