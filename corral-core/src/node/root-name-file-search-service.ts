import { injectable } from '@theia/core/shared/inversify';
import { CancellationToken } from '@theia/core';
import { FileUri } from '@theia/core/lib/common/file-uri';
import URI from '@theia/core/lib/common/uri';
import { FileSearchService } from '@theia/file-search/lib/common/file-search-service';
import { FileSearchServiceImpl } from '@theia/file-search/lib/node/file-search-service-impl';
import { basename, sep } from 'path';

/**
 * Quick Open matches the typed words against each file's path relative to its root, so "corral readme" finds nothing
 * with one root per project. Prefix every candidate with its project folder, as VS Code does in multi-root workspaces.
 * `find` resolves the candidate against the root, and `../<root>/` resolves back to the same file.
 */
@injectable()
export class RootNameFileSearchService extends FileSearchServiceImpl {

    protected override doFind(rootUri: URI, options: FileSearchService.BaseOptions, accept: (candidate: string) => void,
        token: CancellationToken): Promise<void> {
        const prefix = `..${sep}${basename(FileUri.fsPath(rootUri))}${sep}`;
        return super.doFind(rootUri, options, candidate => accept(prefix + candidate), token);
    }
}
