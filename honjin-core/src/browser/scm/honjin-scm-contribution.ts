import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { ScmContribution } from '@theia/scm/lib/browser/scm-contribution';

/** Spec 02: Source Control is not in the left bar. It opens on demand, next to Projects, for one project. */
@injectable()
export class HonjinScmContribution extends ScmContribution {

    @inject(EditorManager) protected readonly editors: EditorManager;

    override get defaultViewOptions(): ApplicationShell.WidgetOptions {
        return { area: 'right', rank: 200 };
    }

    // Theia keeps whichever repository registered first selected, so with many projects the status bar
    // would name the wrong one. It follows the file being edited instead; the preview tabs keep the last one.
    override onStart(): void {
        super.onStart();
        this.editors.onCurrentEditorChanged(editor => {
            const uri = editor?.getResourceUri();
            const repository = uri && this.scmService.findRepository(uri);
            if (repository) {
                this.scmService.selectedRepository = repository;
            }
        });
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
