import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { MaybeArray } from '@theia/core/lib/common';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileUri } from '@theia/core/lib/common/file-uri';

/** Theia's folder dialog (same in browser and Electron), starting in ~/Desktop/projects when it exists. */
@injectable()
export class FolderPicker {

    @inject(FileDialogService) protected readonly dialogs: FileDialogService;
    @inject(FileService) protected readonly files: FileService;
    @inject(EnvVariablesServer) protected readonly env: EnvVariablesServer;

    async home(): Promise<string> {
        return FileUri.fsPath(await this.env.getHomeDirUri());
    }

    /** Chosen folders; empty when the dialog was cancelled. */
    async pick(title: string): Promise<URI[]> {
        const home = await this.home();
        const desktopProjects = new URI().withScheme('file').withPath(home + '/Desktop/projects');
        const start = await this.files.exists(desktopProjects) ? desktopProjects : new URI().withScheme('file').withPath(home);
        const picked: MaybeArray<URI> | undefined = await this.dialogs.showOpenDialog({
            title,
            openLabel: 'Choose',
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: true
        }, await this.files.resolve(start));
        return picked === undefined ? [] : Array.isArray(picked) ? picked : [picked];
    }
}
