import { interfaces } from '@theia/core/shared/inversify';
import { defaultTreeProps } from '@theia/core/lib/browser';
import { createFileTreeContainer } from '@theia/filesystem/lib/browser';
import { ProjectsModel } from './projects-model';
import { ProjectsTree } from './projects-tree';
import { PROJECTS_CONTEXT_MENU, ProjectsWidget } from './projects-widget';

export function createProjectsWidget(parent: interfaces.Container): ProjectsWidget {
    const child = createFileTreeContainer(parent, {
        tree: ProjectsTree,
        model: ProjectsModel,
        widget: ProjectsWidget,
        props: { ...defaultTreeProps, multiSelect: true, contextMenuPath: PROJECTS_CONTEXT_MENU, search: true, globalSelection: true }
    });
    return child.get(ProjectsWidget);
}
