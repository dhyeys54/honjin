import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common';
import { CorralProjectService } from '../../common/protocol';
import { ProjectEntry, ProjectListInput, buildProjectList, visibleRoots } from '../../common/project-list';
import { CorralPreferences } from '../corral-preferences';

const PROJECT_KEYS = ['corral.scanRoots', 'corral.extraProjects', 'corral.hiddenProjects'];

/** The one frontend copy of the project list; the tree and the roots sync both read it. */
@injectable()
export class ProjectListService {

    @inject(CorralProjectService) protected readonly backend: CorralProjectService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;

    protected input: ProjectListInput = { scanned: [], extra: [], hidden: [], showHidden: true, missing: [] };
    protected all: ProjectEntry[] = [];
    /** False until the first list arrives, so the view does not flash an empty state. */
    loaded = false;
    protected generation = 0;
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
        const extra = this.prefs['corral.extraProjects'];
        const hidden = this.prefs['corral.hiddenProjects'];
        const { scanned, missing } = await this.backend.list({ scanRoots: this.prefs['corral.scanRoots'], extra, hidden });
        if (generation !== this.generation) {
            return; // a newer reload is in flight and will publish
        }
        this.input = { scanned, extra, hidden, showHidden: true, missing };
        this.all = buildProjectList(this.input);
        this.loaded = true;
        this.changed.fire();
    }
}
