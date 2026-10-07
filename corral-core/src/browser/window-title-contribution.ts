import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WindowTitleContribution, WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { owningProject } from '../common/paths';
import { ProjectListService } from './projects/project-list-service';

/**
 * `Corral — <project>`: the project owning the active editor, or the last one a herdr tab was opened for (spec 01).
 * It must have no injected dependencies: WindowTitleService resolves its contributions while initialising, and
 * anything that reaches back to it (EditorManager does) is a cycle. `CorralWindowTitleRefresh` does the wiring instead.
 */
@injectable()
export class CorralWindowTitle implements WindowTitleContribution {

    protected project?: string;
    protected readonly changed = new Emitter<void>();
    readonly onDidChange = this.changed.event;

    focus(projectPath: string | undefined): void {
        this.project = projectPath;
        this.changed.fire();
    }

    enhanceTitle(): string {
        const name = this.project?.split('/').filter(Boolean).pop();
        return name ? `Corral — ${name}` : 'Corral';
    }
}

@injectable()
export class CorralWindowTitleRefresh implements FrontendApplicationContribution {

    @inject(CorralWindowTitle) protected readonly title: CorralWindowTitle;
    @inject(WindowTitleService) protected readonly service: WindowTitleService;
    @inject(EditorManager) protected readonly editors: EditorManager;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;

    onStart(): void {
        this.editors.onCurrentEditorChanged(editor => {
            const uri = editor?.getResourceUri();
            if (uri?.scheme === 'file') {
                this.title.focus(owningProject(FileUri.fsPath(uri), this.projectList.entries(true).map(e => e.path)));
            }
        });
        this.title.onDidChange(() => this.service.update({}));
        this.service.update({});
    }
}
