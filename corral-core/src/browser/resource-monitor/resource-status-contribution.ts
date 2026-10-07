import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { StatusBar, StatusBarAlignment, StatusBarEntry } from '@theia/core/lib/browser/status-bar/status-bar-types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { MarkdownString, MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import { CorralPreferences } from '../corral-preferences';
import { CorralPreferenceKeys } from '../../common/preferences-schema';
import { CorralResourceService, ResourceSample } from '../../common/protocol';
import { Level, Runaway, entryLevel, formatBytes, formatEntry, formatNotice, formatRunawayLine, memLevel, notifyStep } from '../../common/resource-usage';

const ENTRY_ID = 'corral-resources';
const K = CorralPreferenceKeys;

/** The status-bar entry of spec 10: polls the backend, colours by level, notifies once per episode. */
@injectable()
export class ResourceStatusContribution implements FrontendApplicationContribution {
    @inject(StatusBar) protected readonly statusBar: StatusBar;
    @inject(CorralResourceService) protected readonly service: CorralResourceService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(MessageService) protected readonly messages: MessageService;

    protected running = false;
    /** Bumped on every enable/disable, so a sample still in flight from an earlier run stops instead of re-arming the timer. */
    protected generation = 0;
    protected timer: ReturnType<typeof setTimeout> | undefined;
    protected armed = true;
    protected previousRunaways: number[] = [];

    async onStart(): Promise<void> {
        await this.prefs.ready;
        this.prefs.onPreferenceChanged(e => {
            if (e.preferenceName === K.resourceMonitorEnabled) {
                this.apply();
            }
        });
        this.apply();
    }

    onStop(): void {
        this.running = false;
        this.generation++;
        clearTimeout(this.timer);
    }

    protected apply(): void {
        const enabled = this.prefs[K.resourceMonitorEnabled];
        if (enabled && !this.running) {
            this.running = true;
            this.tick(++this.generation);
        } else if (!enabled && this.running) {
            this.running = false;
            this.generation++;
            clearTimeout(this.timer);
            this.statusBar.removeElement(ENTRY_ID);
        }
    }

    /** R11: the next tick is scheduled after the response, so calls never overlap; an error keeps the last text. */
    protected async tick(generation: number): Promise<void> {
        try {
            const sample = await this.service.sample();
            if (generation === this.generation) {
                this.show(sample);
            }
        } catch {
            // keep the last text; the next tick retries
        }
        if (generation === this.generation) {
            this.timer = setTimeout(() => this.tick(generation), Math.max(1, this.prefs[K.resourceMonitorIntervalSeconds]) * 1000);
        }
    }

    protected show(sample: ResourceSample): void {
        const level = entryLevel(
            memLevel(sample.memBytes, sample.totalMemBytes, this.prefs[K.resourceMonitorWarningPercent], this.prefs[K.resourceMonitorDangerPercent]),
            sample.runaways);
        const entry: StatusBarEntry = {
            name: 'Corral resources',
            text: formatEntry(sample),
            alignment: StatusBarAlignment.RIGHT,
            priority: 100,
            tooltip: () => this.tooltip(sample.runaways),
            ...colours(level)
        };
        this.statusBar.setElement(ENTRY_ID, entry);

        const step = notifyStep(this.armed, level, sample.runaways, this.previousRunaways);
        this.armed = step.armed;
        this.previousRunaways = sample.runaways.map(r => r.pid);
        if (step.notify) {
            this.messages.warn(formatNotice(step.notify, sample));
        }
    }

    /** R10: built on hover, so the herdr calls behind the breakdown are not made every tick. */
    protected async tooltip(runaways: Runaway[]): Promise<MarkdownString> {
        const md = new MarkdownStringImpl();
        try {
            for (const r of runaways) {
                md.appendMarkdown(`${formatRunawayLine(r)}\n\n`);
            }
            md.appendMarkdown('| | Memory | CPU | Procs |\n|---|---:|---:|---:|\n');
            for (const row of await this.service.breakdown()) {
                md.appendMarkdown(`| ${row.label} | ${formatBytes(row.memBytes)} | ${Math.round(row.cpuPct)}% | ${row.count} |\n`);
            }
        } catch (e) {
            return new MarkdownStringImpl().appendText(`Breakdown unavailable: ${e instanceof Error ? e.message : String(e)}`);
        }
        return md;
    }
}

function colours(level: Level): Pick<StatusBarEntry, 'backgroundColor' | 'color'> {
    if (level === 'normal') {
        return {};
    }
    const kind = level === 'danger' ? 'error' : 'warning';
    return { backgroundColor: `var(--theia-statusBarItem-${kind}Background)`, color: `var(--theia-statusBarItem-${kind}Foreground)` };
}
