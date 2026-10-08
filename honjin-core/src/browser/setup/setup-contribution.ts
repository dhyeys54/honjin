import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { SETUP_ID, SetupWidget } from './setup-widget';
import { SetupService } from './setup-service';

export const SetupCommand: Command = { id: 'honjin.setup.open', label: 'Honjin: Set Up Prerequisites' };

/** Spec 13 S7: opens Setup at start when something required is missing, and on demand. */
@injectable()
export class SetupContribution extends AbstractViewContribution<SetupWidget> implements FrontendApplicationContribution {

    @inject(SetupService) protected readonly setup: SetupService;

    constructor() {
        super({ widgetId: SETUP_ID, widgetName: 'Set Up Honjin', defaultWidgetOptions: { area: 'main' } });
    }

    onDidInitializeLayout(): void {
        // Not awaited: running every `--version` would hold up the rest of startup.
        this.setup.check().then(async state => {
            if (state !== 'ready') {
                await this.openView({ activate: true });
            }
        }).catch(() => {
            // The backend could not run the check; the + flow and the herdr overlay still report what's missing.
        });
    }

    override registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SetupCommand, {
            execute: async () => {
                await this.openView({ activate: true, reveal: true });
                await this.setup.check();
            }
        });
    }
}
