import { inject, injectable } from '@theia/core/shared/inversify';
import { ViewContainer, WidgetFactory, WidgetManager, codicon } from '@theia/core/lib/browser';
import { PROJECTS_VIEW_ID } from './projects-widget';
import { CHANGES_VIEW_ID } from '../changes/changes-widget';

export const PROJECTS_CONTAINER_ID = 'corral-projects-container';

/** Spec 09 C14: Projects over Changes in one right-panel container, modelled on Theia's NavigatorWidgetFactory. */
@injectable()
export class ProjectsViewContainerFactory implements WidgetFactory {

    readonly id = PROJECTS_CONTAINER_ID;

    @inject(ViewContainer.Factory) protected readonly viewContainerFactory: ViewContainer.Factory;
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;

    async createWidget(): Promise<ViewContainer> {
        const container = this.viewContainerFactory({ id: PROJECTS_CONTAINER_ID });
        container.setTitleOptions({ label: 'Projects', iconClass: codicon('root-folder'), closeable: true });
        const projects = await this.widgetManager.getOrCreateWidget(PROJECTS_VIEW_ID);
        const changes = await this.widgetManager.getOrCreateWidget(CHANGES_VIEW_ID);
        container.addWidget(projects, { order: 0, weight: 70, canHide: false, initiallyCollapsed: false, disableDraggingToOtherContainers: true });
        container.addWidget(changes, { order: 1, weight: 30, canHide: true, initiallyCollapsed: false });
        return container;
    }
}
