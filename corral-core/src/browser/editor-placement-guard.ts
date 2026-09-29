import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, FrontendApplicationContribution, Widget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { needsMove, placementFor } from '../common/placement';
import { HERDR_TERMINAL_ID } from './herdr/herdr-terminal-contribution';

/** Keeps editors out of the herdr tab bar. The decision lives in `common/placement.ts`. */
@injectable()
export class EditorPlacementGuard implements FrontendApplicationContribution {

    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(EditorManager) protected readonly editors: EditorManager;

    onStart(): void {
        this.shell.onDidAddWidget(widget => this.guard(widget));
    }

    /** Widget options for a file Corral opens itself; `undefined` lets Theia decide. */
    optionsFor(exclude?: Widget): ApplicationShell.WidgetOptions | undefined {
        const editorWidgets = this.editors.all.filter(w => w !== exclude);
        const herdr = this.herdr();
        const placement = placementFor({ editorIds: editorWidgets.map(w => w.id), herdrId: herdr?.id });
        if (!placement) {
            return undefined;
        }
        const ref = editorWidgets.find(w => w.id === placement.refId) ?? herdr;
        return ref && { area: 'main', mode: placement.mode, ref };
    }

    protected herdr(): Widget | undefined {
        return this.shell.getWidgets('main').find(w => w.id === HERDR_TERMINAL_ID);
    }

    protected async guard(widget: Widget): Promise<void> {
        const herdr = this.herdr();
        if (!herdr || widget.isDisposed) {
            return;
        }
        // The emitter fires while Lumino is still docking the widget, so look at its tab bar a tick later.
        await new Promise(resolve => setTimeout(resolve));
        const bar = this.shell.getTabBarFor(herdr);
        const inHerdrGroup = !!bar && bar.titles.some(t => t.owner === widget);
        if (widget.isDisposed || !needsMove({ widgetId: widget.id, herdrId: herdr.id, inHerdrGroup })) {
            return;
        }
        const options = this.optionsFor(widget);
        if (options) {
            await this.shell.addWidget(widget, options);
            await this.shell.activateWidget(widget.id);
        }
    }
}
