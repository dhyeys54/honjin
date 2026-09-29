import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { ConfirmDialog, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { abbreviateHome, shouldRunFirstRun } from '../common/first-run';
import { FolderPicker } from './folder-picker';
import { CorralPreferences } from './corral-preferences';

export const ChooseScanRootsCommand: Command = { id: 'corral.projects.chooseScanRoots', label: 'Corral: Choose Project Folders…' };

@injectable()
export class FirstRunContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(CorralPreferences) protected readonly prefs: CorralPreferences;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(FolderPicker) protected readonly picker: FolderPicker;

    async onDidInitializeLayout(): Promise<void> {
        await this.prefs.ready;
        if (!shouldRunFirstRun({
            firstRunCompleted: this.prefs['corral.firstRunCompleted'],
            scanRoots: this.prefs['corral.scanRoots'],
            extraProjects: this.prefs['corral.extraProjects']
        })) {
            return;
        }
        const chosen = await this.pickFolders();
        if (chosen.length) {
            await this.preferenceService.set('corral.scanRoots', chosen, PreferenceScope.User);
        }
        // Cancel also completes first run; the Projects view's empty state offers the picker again.
        await this.preferenceService.set('corral.firstRunCompleted', true, PreferenceScope.User);
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
            await this.preferenceService.set('corral.scanRoots', chosen, PreferenceScope.User);
        }
    }

    /** Folder paths with `~` abbreviated; empty when the dialog was cancelled. */
    protected async pickFolders(): Promise<string[]> {
        const uris = await this.picker.pick('Choose the folders that hold your projects');
        const home = await this.picker.home();
        return uris.map(u => abbreviateHome(u.path.fsPath(), home));
    }
}
