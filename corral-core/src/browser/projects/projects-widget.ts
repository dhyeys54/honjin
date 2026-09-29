import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
// The shared React typings use `export =`, which this tsconfig (no esModuleInterop) only allows via require-style import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import React = require('@theia/core/shared/react');
import { CommandService } from '@theia/core/lib/common';
import { ContextMenuRenderer, NodeProps, TreeNode, TreeProps } from '@theia/core/lib/browser';
import { DirNode, FileStatNode, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { ChangesService } from '../changes/changes-service';
import { CorralPreferences } from '../corral-preferences';
import { ProjectListService } from './project-list-service';
import { ProjectsModel } from './projects-model';

export const PROJECTS_VIEW_ID = 'corral-projects';
export const PROJECTS_CONTEXT_MENU = ['corral-projects-context-menu'];
export const NEW_TAB_COMMAND_ID = 'corral.herdr.newTab';

@injectable()
export class ProjectsWidget extends FileTreeWidget {

    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(ProjectListService) protected readonly projectList: ProjectListService;
    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(ChangesService) protected readonly changes: ChangesService;

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
        this.toDispose.push(this.projectList.onDidChange(() => this.update()));
        this.toDispose.push(this.changes.onDidChange(() => this.update()));
    }

    // Spec 03 §Empty states. Hidden projects count as projects, so hiding the last one is not "empty".
    protected override render(): React.ReactNode {
        if (!this.projectList.loaded || this.projectList.entries(true).length > 0) {
            return super.render();
        }
        const roots = this.prefs['corral.scanRoots'];
        const button = (label: string, command: string) => React.createElement('button',
            { className: 'theia-button', onClick: () => this.commandService.executeCommand(command) }, label);
        const noRoots = roots.length === 0 && this.prefs['corral.extraProjects'].length === 0;
        return React.createElement('div', { className: 'corral-projects-empty', 'data-testid': 'corral-projects-empty' },
            React.createElement('p', undefined, noRoots
                ? 'Choose the folders that hold your projects'
                : `No projects found in ${roots.join(', ')}`),
            button(noRoots ? 'Choose folders…' : 'Change folders…', 'corral.projects.chooseScanRoots'),
            noRoots ? undefined : button('Add project…', 'corral.projects.add'));
    }

    protected override createNodeClassNames(node: TreeNode, props: NodeProps): string[] {
        const classes = super.createNodeClassNames(node, props);
        if (DirNode.is(node) && this.model.hiddenPaths.has(node.uri.path.toString())) {
            classes.push('corral-project-hidden');
        }
        if (DirNode.is(node) && this.model.missingPaths.has(node.uri.path.toString())) {
            classes.push('corral-project-missing');
        }
        if (this.changes.isLive(this.pathOf(node))) {
            classes.push('corral-live');
        }
        return classes;
    }

    protected pathOf(node: TreeNode): string {
        return FileStatNode.is(node) ? node.uri.path.toString() : '';
    }

    // The + button of every directory row; CSS shows it on hover and keyboard focus.
    protected override renderTailDecorations(node: TreeNode, props: NodeProps): React.ReactNode {
        const decorations = super.renderTailDecorations(node, props);
        const marks = this.renderChangeMark(node);
        if (!DirNode.is(node)) {
            return React.createElement(React.Fragment, undefined, decorations, marks);
        }
        const label = this.labelProvider.getName(node.uri);
        const path = node.uri.path.toString();
        const flag = this.model.missingPaths.has(path)
            ? React.createElement('span', { className: 'corral-project-flag', 'data-testid': 'corral-project-flag' }, 'missing')
            : this.model.hiddenPaths.has(path)
                ? React.createElement('span', { className: 'corral-project-flag codicon codicon-eye-closed', title: 'Hidden', 'data-testid': 'corral-project-flag' })
                : undefined;
        return React.createElement(React.Fragment, undefined, decorations, flag, marks,
            React.createElement('button', {
                className: 'corral-new-tab codicon codicon-add',
                title: 'New herdr tab here (⌥⌘T)',
                'aria-label': `New herdr tab in ${label}`,
                disabled: this.model.missingPaths.has(node.uri.path.toString()),
                'data-testid': 'corral-new-tab',
                onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    this.commandService.executeCommand(NEW_TAB_COMMAND_ID, node.uri);
                }
            }));
    }

    // Spec 09 C12: the letter of a changed file, or the number of changed files under a project.
    protected renderChangeMark(node: TreeNode): React.ReactNode {
        const path = this.pathOf(node);
        const file = this.changes.fileFor(path);
        if (file) {
            return React.createElement('span', { className: `corral-change-letter corral-change-${file.kind}` }, file.letter);
        }
        const group = this.changes.groupFor(path);
        return group ? React.createElement('span', { className: 'corral-change-count' }, group.files.length) : undefined;
    }
}
