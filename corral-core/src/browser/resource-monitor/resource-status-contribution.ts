import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { StatusBar, StatusBarAlignment, StatusBarEntry } from '@theia/core/lib/browser/status-bar/status-bar-types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { MarkdownString, MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import { CorralPreferences } from '../corral-preferences';
import { CorralPreferenceKeys } from '../../common/preferences-schema';
import { CorralResourceService, ResourceSample } from '../../common/protocol';
import { Level, Runaway, entryLevel, formatBytes, formatEntry, memLevel, notifyStep } from '../../common/resource-usage';

const ENTRY_ID = 'corral-resources';
const K = CorralPreferenceKeys;
const MIN = 60_000;

/** The status-bar entry of spec 10: polls the backend, colours by level, notifies once per episode. */
@injectable()
export class ResourceStatusContribution implements FrontendApplicationContribution {
    @inject(StatusBar) protected readonly statusBar: StatusBar;
    @inject(CorralResourceService) protected readonly service: CorralResourceService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(MessageService) protected readonly messages: MessageService;

    protected running = false;
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
        clearTimeout(this.timer);
    }

    protected apply(): void {
        const enabled = this.prefs[K.resourceMonitorEnabled];
        if (enabled && !this.running) {
            this.running = true;
            this.tick();
        } else if (!enabled && this.running) {
            this.running = false;
            clearTimeout(this.timer);
            this.statusBar.removeElement(ENTRY_ID);
        }
    }

    /** R11: the next tick is scheduled after the response, so calls never overlap; an error keeps the last text. */
    protected async tick(): Promise<void> {
        try {
            const sample = await this.service.sample();
            if (this.running) {
                this.show(sample);
            }
        } catch {
            // keep the last text; the next tick retries
        }
        if (this.running) {
            this.timer = setTimeout(() => this.tick(), Math.max(1, this.prefs[K.resourceMonitorIntervalSeconds]) * 1000);
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
        if (step.notify === 'danger') {
            this.messages.warn(`Corral is using ${formatBytes(sample.memBytes)} (${Math.round(sample.memBytes * 100 / sample.totalMemBytes)}% of RAM).`);
        } else if (step.notify) {
            this.messages.warn(`${step.notify.command} (pid ${step.notify.pid}) has used a full CPU core for ${minutes(step.notify)} min.`);
        }
    }

    /** R10: built on hover, so the herdr calls behind the breakdown are not made every tick. */
    protected async tooltip(runaways: Runaway[]): Promise<MarkdownString> {
        const md = new MarkdownStringImpl();
        try {
            for (const r of runaways) {
                md.appendMarkdown(`⚠ ${r.command} — ${Math.round(r.cpu)}% of a core for ${minutes(r)} min\n\n`);
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

const minutes = (r: Runaway) => Math.floor(r.sinceMs / MIN);

function colours(level: Level): Pick<StatusBarEntry, 'backgroundColor' | 'color'> {
    if (level === 'normal') {
        return {};
    }
    const kind = level === 'danger' ? 'error' : 'warning';
    return { backgroundColor: `var(--theia-statusBarItem-${kind}Background)`, color: `var(--theia-statusBarItem-${kind}Foreground)` };
}
