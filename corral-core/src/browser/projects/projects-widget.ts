import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ContextMenuRenderer, TreeProps } from '@theia/core/lib/browser';
import { FileTreeWidget } from '@theia/filesystem/lib/browser';
import { ProjectsModel } from './projects-model';

export const PROJECTS_VIEW_ID = 'corral-projects';

@injectable()
export class ProjectsWidget extends FileTreeWidget {

    constructor(
        @inject(TreeProps) props: TreeProps,
        @inject(ProjectsModel) readonly model: ProjectsModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
        this.id = PROJECTS_VIEW_ID;
        this.title.label = 'Projects';
        this.title.caption = 'Projects';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-root-folder';
        this.addClass('corral-projects');
        this.node.dataset.testid = 'corral-projects';
    }

    @postConstruct()
    protected override init(): void {
        super.init();
        this.model.reload();
    }
}
