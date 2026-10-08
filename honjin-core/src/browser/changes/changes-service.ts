import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { DisposableCollection, Emitter, Event } from '@theia/core/lib/common';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { ScmRepository } from '@theia/scm/lib/browser/scm-repository';
import { ScmResource } from '@theia/scm/lib/browser/scm-provider';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileChangeType } from '@theia/filesystem/lib/common/files';
import { ChangeFile, ChangeGroup, LIVE_MS, groupChanges, liveFolders, nextExpiry, sameGroups } from '../../common/changes';
import { pickChanges } from '../../common/scm-change';
import { ProjectListService } from '../projects/project-list-service';

/** Git fires several events per operation; one recompute per burst is enough. */
const COALESCE_MS = 50;

/** The one owner of Changes state (spec 09): the Changes view and the Projects tree both read it. */
@injectable()
export class ChangesService {

    @inject(ScmService) protected readonly scm: ScmService;
    @inject(FileService) protected readonly files: FileService;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;

    protected readonly perRepo = new Map<ScmRepository, DisposableCollection>();
    /** Last write time per path (C7), kept for unlisted paths too in case git lists them a moment later. */
    protected readonly writes = new Map<string, number>();
    protected current: ChangeGroup[] = [];
    protected live = new Set<string>();
    protected byPath = new Map<string, ChangeFile>();
    protected resources = new Map<string, ScmResource>();
    protected recomputeTimer: ReturnType<typeof setTimeout> | undefined;
    protected expiryTimer: ReturnType<typeof setTimeout> | undefined;
    protected readonly changed = new Emitter<void>();
    readonly onDidChange: Event<void> = this.changed.event;

    @postConstruct()
    protected init(): void {
        this.scm.repositories.forEach(r => this.track(r));
        this.scm.onDidAddRepository(r => { this.track(r); this.schedule(); });
        this.scm.onDidRemoveRepository(r => { this.perRepo.get(r)?.dispose(); this.perRepo.delete(r); this.schedule(); });
        this.projectList.onDidChange(() => this.schedule());
        this.files.onDidFilesChange(e => {
            const now = Date.now();
            for (const c of e.changes) {
                const path = c.resource.path.toString();
                if ((c.type === FileChangeType.UPDATED || c.type === FileChangeType.ADDED) && !path.includes('/.git/')) {
                    this.writes.set(path, now);
                }
            }
            this.schedule();
        });
        this.recompute();
    }

    groups(): ChangeGroup[] {
        return this.current;
    }

    groupFor(root: string): ChangeGroup | undefined {
        return this.current.find(g => g.project === root);
    }

    fileFor(path: string): ChangeFile | undefined {
        return this.byPath.get(path);
    }

    /** True for a live file, a folder that contains one, and a project with one. */
    isLive(path: string): boolean {
        return this.live.has(path) || !!this.byPath.get(path)?.live;
    }

    resourceFor(path: string): ScmResource | undefined {
        return this.resources.get(path);
    }

    protected track(repo: ScmRepository): void {
        if (this.perRepo.has(repo)) {
            return;
        }
        const toDispose = new DisposableCollection();
        toDispose.push(repo.provider.onDidChange(() => this.schedule()));
        if (repo.provider.onDidChangeResources) {
            toDispose.push(repo.provider.onDidChangeResources(() => this.schedule()));
        }
        this.perRepo.set(repo, toDispose);
    }

    protected schedule(): void {
        if (this.recomputeTimer === undefined) {
            this.recomputeTimer = setTimeout(() => this.recompute(), COALESCE_MS);
        }
    }

    protected recompute(): void {
        this.recomputeTimer = undefined;
        const now = Date.now();
        for (const [path, at] of this.writes) {
            if (now - at >= LIVE_MS) {
                this.writes.delete(path);
            }
        }
        const groups = this.scm.repositories.flatMap(repo => repo.provider.groups.map(group => ({
            id: group.id,
            resources: group.resources.map(resource => {
                const path = resource.sourceUri.path.toString();
                return { path, sourceUri: path, group: group.id, letter: resource.decorations?.letter,
                    strikeThrough: resource.decorations?.strikeThrough, resource };
            })
        })));
        const next = groupChanges(this.projectList.roots, groups.flatMap(g => g.resources), this.writes, now);
        // The same winner rule as the row, so a click opens the diff of the change that is shown.
        this.resources = new Map([...pickChanges(groups)].map(([path, c]) => [path, c.resource]));
        this.armExpiry(now);
        if (sameGroups(this.current, next)) {
            return;
        }
        this.current = next;
        this.live = liveFolders(next);
        this.byPath = new Map(next.flatMap(g => g.files).map(f => [f.path, f]));
        this.changed.fire();
    }

    /** C8: one timer to the next moment a live mark runs out, no polling. */
    protected armExpiry(now: number): void {
        if (this.expiryTimer !== undefined) {
            clearTimeout(this.expiryTimer);
            this.expiryTimer = undefined;
        }
        const at = nextExpiry(this.writes, now);
        if (at !== undefined) {
            this.expiryTimer = setTimeout(() => { this.expiryTimer = undefined; this.recompute(); }, at - now + 1);
        }
    }
}
