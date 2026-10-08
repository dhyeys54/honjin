import { injectable } from '@theia/core/shared/inversify';
import { RecursivePartial } from '@theia/core/lib/common/types';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { SidePanel, SidePanelHandler } from '@theia/core/lib/browser/shell/side-panel-handler';

/** Spec 02, "Panel transitions": side and bottom panels slide open instead of snapping. */
export const PANEL_ANIMATION_MS = 150;

export const honjinShellOptions: RecursivePartial<ApplicationShell.Options> = {
    leftPanel: { expandDuration: PANEL_ANIMATION_MS },
    rightPanel: { expandDuration: PANEL_ANIMATION_MS },
    bottomPanel: { expandDuration: PANEL_ANIMATION_MS }
};

/** Theia animates expanding a side panel but collapses it in one frame; this slides it shut too. */
@injectable()
export class HonjinSidePanelHandler extends SidePanelHandler {

    override async collapse(): Promise<void> {
        const size = this.getPanelSize();
        const animate = this.applicationStateService.state === 'ready' && !!this.tabBar.currentTitle
            && this.state.expansion === SidePanel.ExpansionState.expanded && !!size;
        if (!animate) {
            return super.collapse();
        }
        this.state.expansion = SidePanel.ExpansionState.collapsing;
        await this.splitPositionHandler.setSidePanelSize(this.container, this.tabBar.node.offsetWidth, {
            side: this.side, duration: this.options.expandDuration, referenceWidget: this.dockPanel
        }).catch(() => undefined);
        this.state.expansion = SidePanel.ExpansionState.expanded;
        await super.collapse();
        // Collapsing records the current width to reopen at; that is now the shrunk one.
        this.state.lastPanelSize = size;
    }
}
