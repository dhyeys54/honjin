import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, CommandService, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { FileUri } from '@theia/core/lib/common/file-uri';
import URI from '@theia/core/lib/common/uri';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { ExpandableTreeNode, OpenerService, SelectableTreeNode, WidgetManager, open } from '@theia/core/lib/browser';
import { colors } from '../../common/design-tokens';
import { ProjectsContribution } from '../projects/projects-contribution';
import { ProjectsActions } from '../projects/projects-actions-contribution';
import { CHANGES_CONTEXT_MENU, CHANGES_VIEW_ID, ChangesWidget } from './changes-widget';
import { ChangesFileNode, ChangesProjectNode, isFileNode, isProjectNode } from './changes-tree';

export const ChangesCommands = {
    OPEN_FILE: { id: 'corral.changes.openFile', label: 'Open File' } as Command,
    REVEAL: { id: 'corral.changes.reveal', label: 'Reveal in Projects' } as Command,
    COPY_PATH: { id: 'corral.changes.copyPath', label: 'Copy Path' } as Command,
    SHOW_CHANGES: { id: 'corral.changes.showChanges', label: 'Show Changes' } as Command
};

const colorId = (kind: string) => `corral.changes.${kind}`;
const definitions: [string, string, string][] = [
    ['modified', colors.warning, 'A file with uncommitted edits in the Changes view.'],
    ['added', colors.info, 'A new or untracked file in the Changes view.'],
    ['deleted', colors.danger, 'A deleted file in the Changes view.'],
    ['conflict', colors.danger, 'A file with merge conflicts in the Changes view.'],
    ['live', colors.accent, 'The dot on a file written in the last 30 seconds.']
];

/** Spec 09 C10 and C13: the read-only context menus and the change colours. */
@injectable()
export class ChangesContribution implements CommandContribution, MenuContribution, ColorContribution {

    @inject(WidgetManager) protected readonly widgets: WidgetManager;
    @inject(OpenerService) protected readonly openers: OpenerService;
    @inject(ClipboardService) protected readonly clipboard: ClipboardService;
    @inject(ProjectsContribution) protected readonly projectsView: ProjectsContribution;
    @inject(CommandService) protected readonly commands: CommandService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ChangesCommands.OPEN_FILE, {
            execute: () => open(this.openers, this.fileUri()!), isVisible: () => !!this.selectedFile()
        });
        commands.registerCommand(ChangesCommands.REVEAL, {
            execute: () => this.reveal(), isVisible: () => !!this.selectedFile()
        });
        commands.registerCommand(ChangesCommands.COPY_PATH, {
            execute: () => this.clipboard.writeText(this.selectedFile()!.change.path), isVisible: () => !!this.selectedFile()
        });
        commands.registerCommand(ChangesCommands.SHOW_CHANGES, {
            execute: () => this.showChanges(), isVisible: () => !!this.selectedProject()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const FILE = [...CHANGES_CONTEXT_MENU, '1_file'];
        menus.registerMenuAction(FILE, { commandId: ChangesCommands.OPEN_FILE.id, order: 'a' });
        menus.registerMenuAction(FILE, { commandId: ChangesCommands.REVEAL.id, order: 'b' });
        menus.registerMenuAction(FILE, { commandId: ChangesCommands.COPY_PATH.id, order: 'c' });
        menus.registerMenuAction([...CHANGES_CONTEXT_MENU, '2_project'], { commandId: ChangesCommands.SHOW_CHANGES.id });
    }

    registerColors(registry: ColorRegistry): void {
        registry.register(...definitions.map(([kind, hex, description]) => ({
            id: colorId(kind), defaults: { dark: hex, light: hex, hcDark: hex, hcLight: hex }, description
        })));
    }

    protected widget(): ChangesWidget | undefined {
        return this.widgets.tryGetWidget<ChangesWidget>(CHANGES_VIEW_ID);
    }

    protected selectedFile(): ChangesFileNode | undefined {
        const node = this.widget()?.model.selectedNodes[0];
        return isFileNode(node) ? node : undefined;
    }

    protected selectedProject(): ChangesProjectNode | undefined {
        const node = this.widget()?.model.selectedNodes[0];
        return isProjectNode(node) ? node : undefined;
    }

    protected fileUri(): URI | undefined {
        const file = this.selectedFile();
        return file && FileUri.create(file.change.path);
    }

    /** Expands each folder from the project down to the file in the Projects tree, then selects the file. */
    protected async reveal(): Promise<void> {
        const uri = this.fileUri();
        const projects = await this.projectsView.widget;
        if (!uri) {
            return;
        }
        await this.projectsView.openView({ activate: true, reveal: true });
        const model = projects.model;
        const chain: URI[] = [];
        for (let u = uri; !u.path.isRoot; u = u.parent) {
            chain.unshift(u);
        }
        for (const step of chain) {
            const node = [...model.getNodesByUri(step)][0];
            if (node && ExpandableTreeNode.is(node) && !node.expanded && step !== uri) {
                await model.expandNode(node);
            } else if (node && step === uri && SelectableTreeNode.is(node)) {
                model.selectNode(node);
            }
        }
    }

    protected async showChanges(): Promise<void> {
        const project = this.selectedProject();
        if (project) {
            await this.commands.executeCommand(ProjectsActions.SHOW_CHANGES.id, FileUri.create(project.change.project));
        }
    }
}
