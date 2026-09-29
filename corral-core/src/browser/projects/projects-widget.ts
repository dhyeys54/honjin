import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import { CommandService } from '@theia/core/lib/common';
import { ContextMenuRenderer, NodeProps, TreeNode, TreeProps } from '@theia/core/lib/browser';
import { DirNode, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { CorralPreferences } from '../corral-preferences';
import { ProjectsModel } from './projects-model';

export const PROJECTS_VIEW_ID = 'corral-projects';
export const NEW_TAB_COMMAND_ID = 'corral.herdr.newTab';

@injectable()
export class ProjectsWidget extends FileTreeWidget {

    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(CommandService) protected readonly commandService: CommandService;

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
        const projectKeys = ['corral.scanRoots', 'corral.extraProjects', 'corral.hiddenProjects'];
        this.toDispose.push(this.prefs.onPreferenceChanged(e => {
            if (projectKeys.includes(e.preferenceName)) {
                this.model.reload();
            }
        }));
    }

    // The + button of every directory row; CSS shows it on hover and keyboard focus.
    protected override renderTailDecorations(node: TreeNode, props: NodeProps): React.ReactNode {
        const decorations = super.renderTailDecorations(node, props);
        if (!DirNode.is(node)) {
            return decorations;
        }
        const label = this.labelProvider.getName(node.uri);
        return React.createElement(React.Fragment, undefined, decorations,
            React.createElement('button', {
                className: 'corral-new-tab codicon codicon-add',
                title: 'New herdr tab here (⌥⌘T)',
                'aria-label': `New herdr tab in ${label}`,
                'data-testid': 'corral-new-tab',
                onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    this.commandService.executeCommand(NEW_TAB_COMMAND_ID, node.uri);
                }
            }));
    }
}
