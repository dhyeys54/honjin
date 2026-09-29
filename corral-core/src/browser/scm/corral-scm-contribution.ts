import { injectable } from '@theia/core/shared/inversify';
import { ApplicationShell } from '@theia/core/lib/browser';
import { ScmContribution } from '@theia/scm/lib/browser/scm-contribution';

/** Spec 02: Source Control is not in the left bar. It opens on demand, next to Projects, for one project. */
@injectable()
export class CorralScmContribution extends ScmContribution {

    override get defaultViewOptions(): ApplicationShell.WidgetOptions {
        return { area: 'right', rank: 200 };
    }

    override async initializeLayout(): Promise<void> {
        // Not opened by default: "Show Changes" on a project opens it.
    }

    // Layouts saved before D31 still hold the view in the left bar.
    async onDidInitializeLayout(): Promise<void> {
        const container = this.shell.getWidgetById(this.effectiveWidgetId);
        if (container && this.shell.getAreaFor(container) === 'left') {
            await this.shell.closeWidget(container.id);
        }
    }
}
