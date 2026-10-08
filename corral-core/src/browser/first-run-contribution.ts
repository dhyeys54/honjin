import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MessageService } from '@theia/core/lib/common';
import { ConfirmDialog, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { CHOOSE_SCAN_ROOTS_COMMAND_ID } from '../common/command-ids';
import { abbreviateHome, shouldRunFirstRun } from '../common/first-run';
import { FolderPicker } from './folder-picker';
import { SetupService } from './setup/setup-service';
import { CorralPreferences, setCorralPreference } from './corral-preferences';

export const ChooseScanRootsCommand: Command = { id: CHOOSE_SCAN_ROOTS_COMMAND_ID, label: 'Corral: Choose Project Folders…' };

@injectable()
export class FirstRunContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(FolderPicker) protected readonly picker: FolderPicker;
    @inject(SetupService) protected readonly setup: SetupService;
    @inject(MessageService) protected readonly messages: MessageService;

    onDidInitializeLayout(): void {
        // Not awaited: Theia runs these hooks in sequence, and waiting for installs would hold up the rest of startup.
        void this.run();
    }

    /** Spec 13 S7: Setup first, then the folder picker (spec 05), then the + hint. */
    protected async run(): Promise<void> {
        await this.prefs.ready;
        const waited = await this.setup.untilReady().catch(() => false);
        const firstRun = shouldRunFirstRun({
            firstRunCompleted: this.prefs['corral.firstRunCompleted'],
            scanRoots: this.prefs['corral.scanRoots'],
            extraProjects: this.prefs['corral.extraProjects']
        });
        if (firstRun) {
            const chosen = await this.pickFolders();
            if (chosen.length) {
                await setCorralPreference(this.preferenceService, 'corral.scanRoots', chosen);
            }
            // Cancel also completes first run; the Projects view's empty state offers the picker again.
            await setCorralPreference(this.preferenceService, 'corral.firstRunCompleted', true);
        }
        if (waited || firstRun) {
            void this.messages.info('Click + on any folder to start an agent there.');
        }
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ChooseScanRootsCommand, { execute: () => this.chooseScanRoots() });
    }

    protected async chooseScanRoots(): Promise<void> {
        const chosen = await this.pickFolders();
        if (!chosen.length) {
            return;
        }
        const old = this.prefs['corral.scanRoots'];
        const list = (roots: string[]) => roots.length ? roots.join(', ') : '(none)';
        const ok = await new ConfirmDialog({
            title: 'Replace project folders?',
            msg: `Current: ${list(old)}\nNew: ${list(chosen)}`,
            ok: 'Replace'
        }).open();
        if (ok) {
            await setCorralPreference(this.preferenceService, 'corral.scanRoots', chosen);
        }
    }

    /** Folder paths with `~` abbreviated; empty when the dialog was cancelled. */
    protected async pickFolders(): Promise<string[]> {
        const uris = await this.picker.pick('Choose the folders that hold your projects');
        const home = await this.picker.home();
        return uris.map(u => abbreviateHome(u.path.fsPath(), home));
    }
}
