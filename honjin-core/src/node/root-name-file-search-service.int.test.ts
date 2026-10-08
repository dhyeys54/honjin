import { ILogger } from '@theia/core';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { RawProcessFactory } from '@theia/process/lib/node';
import { join, resolve } from 'path';
import { RootNameFileSearchService } from './root-name-file-search-service';

// @vscode/ripgrep is ESM, which this CommonJS jest setup cannot load; resolve the real binary the way it does.
jest.mock('@vscode/ripgrep', () => ({
    rgPath: require.resolve(`@vscode/ripgrep-${process.platform}-${process.arch}/bin/${process.platform === 'win32' ? 'rg.exe' : 'rg'}`)
}));

const projects = resolve(__dirname, '../../../e2e/fixtures/projects');
const rootUris = ['alpha', 'beta'].map(name => FileUri.create(join(projects, name)).toString());
const service = new RootNameFileSearchService({ error: () => undefined } as unknown as ILogger, undefined as unknown as RawProcessFactory);
const find = (pattern: string) => service.find(pattern, { rootUris, limit: 200 });

describe('RootNameFileSearchService', () => {
    it('matches the project name together with the file name', async () => {
        expect(await find('beta readme')).toEqual([FileUri.create(join(projects, 'beta/README.md')).toString()]);
    });

    it('still finds a file by name alone, as a real file URI', async () => {
        expect(await find('index')).toEqual([FileUri.create(join(projects, 'alpha/src/index.ts')).toString()]);
    });

    it('keeps the project name from matching files of the other project', async () => {
        expect(await find('alpha readme')).toEqual([]);
    });
});
