import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core/lib/common';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';
import { HonjinSetupService } from '../common/protocol';
import { isNewRelease, issueBody, issueUrl } from '../common/beta';
import { HonjinPreferences } from './honjin-preferences';
import { SetupService } from './setup/setup-service';

export const ReportIssueCommand: Command = { id: 'honjin.reportIssue', label: 'Report an Issue' };

const INSTALL_COMMAND = 'curl -fsSL https://raw.githubusercontent.com/dhyeys54/honjin/main/scripts/install.sh | sh';
const FIRST_CHECK_MS = 10_000;
const CHECK_EVERY_MS = 24 * 60 * 60_000;

/** Spec 13 S11 (Report an Issue) and S12 (the daily update check). */
@injectable()
export class BetaContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    @inject(HonjinSetupService) protected readonly backend: HonjinSetupService;
    @inject(SetupService) protected readonly setup: SetupService;
    @inject(ApplicationServer) protected readonly app: ApplicationServer;
    @inject(HonjinPreferences) protected readonly prefs: HonjinPreferences;
    @inject(MessageService) protected readonly messages: MessageService;
    @inject(ClipboardService) protected readonly clipboard: ClipboardService;
    @inject(WindowService) protected readonly windows: WindowService;

    protected readonly announced = new Set<string>();

    onStart(): void {
        setTimeout(() => {
            void this.checkForUpdate();
            setInterval(() => void this.checkForUpdate(), CHECK_EVERY_MS);
        }, FIRST_CHECK_MS);
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ReportIssueCommand, { execute: () => this.reportIssue() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, { commandId: ReportIssueCommand.id, order: 'z' });
    }

    protected async version(): Promise<string> {
        return (await this.app.getApplicationInfo())?.version ?? 'unknown';
    }

    protected async reportIssue(): Promise<void> {
        const [honjin, { macos, arch }, statuses] = await Promise.all([
            this.version(), this.backend.platform(), this.setup.statuses ?? this.setup.check().then(() => this.setup.statuses ?? [])
        ]);
        this.windows.openNewWindow(issueUrl(issueBody({ honjin, macos, arch, tools: statuses })), { external: true });
    }

    protected async checkForUpdate(): Promise<void> {
        await this.prefs.ready;
        if (!this.prefs['honjin.updates.check']) {
            return;
        }
        const latest = await this.backend.latestRelease().catch(() => undefined);
        if (!latest || !isNewRelease(latest.tag, await this.version(), this.announced)) {
            return;
        }
        this.announced.add(latest.tag);
        const choice = await this.messages.info(`Honjin ${latest.tag} is available.`, 'Copy update command', 'Release notes');
        if (choice === 'Copy update command') {
            await this.clipboard.writeText(INSTALL_COMMAND);
        } else if (choice === 'Release notes') {
            this.windows.openNewWindow(latest.url, { external: true });
        }
    }
}
