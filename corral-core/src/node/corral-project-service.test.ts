import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CorralProjectServiceImpl, expandHome } from './corral-project-service';

const home = '/home/u';

describe('expandHome', () => {
    it('expands ~ and ~/x only', () => {
        expect(expandHome('~', home)).toBe(home);
        expect(expandHome('~/dev', home)).toBe('/home/u/dev');
        expect(expandHome('~user/x', home)).toBe('~user/x');
        expect(expandHome('/abs', home)).toBe('/abs');
    });
});

describe('CorralProjectServiceImpl.list', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'corral-psvc-')));
    mkdirSync(join(base, 'root', 'p1'), { recursive: true });
    mkdirSync(join(base, 'extra'));
    const service = new CorralProjectServiceImpl(base, () => undefined);

    it('scans expanded roots and computes missing from extra and hidden', async () => {
        const res = await service.list({
            scanRoots: [join(base, 'root')],
            extra: [join(base, 'extra'), join(base, 'gone-extra')],
            hidden: [join(base, 'gone-hidden'), join(base, 'root', 'p1')]
        });
        expect(res.scanned).toEqual([join(base, 'root', 'p1')]);
        expect(res.missing).toEqual([join(base, 'gone-extra'), join(base, 'gone-hidden')]);
    });

    it('expands ~ using the home dir, but reports missing entries as given', async () => {
        const s = new CorralProjectServiceImpl(base, () => undefined, base);
        const res = await s.list({ scanRoots: ['~/root'], extra: ['~/extra', '~/nope'], hidden: [] });
        expect(res.scanned).toEqual([join(base, 'root', 'p1')]);
        expect(res.missing).toEqual(['~/nope']);
    });

    it('creates corral.code-workspace once and never overwrites it', async () => {
        const file = join(base, 'corral.code-workspace');
        await service.ensureWorkspaceFile();
        expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ folders: [], settings: {} });
        expect(existsSync(file)).toBe(true);
        writeFileSync(file, '{"folders":[{"path":"/x"}]}');
        await service.ensureWorkspaceFile();
        expect(readFileSync(file, 'utf8')).toBe('{"folders":[{"path":"/x"}]}');
    });
});

describe('CorralProjectServiceImpl.workspaceFile', () => {
    it('creates the managed workspace file and returns its path', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'corral-ws-'));
        const path = await new CorralProjectServiceImpl(dir, () => undefined).workspaceFile();
        expect(path).toBe(join(dir, 'corral.code-workspace'));
        expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ folders: [], settings: {} });
    });
});
