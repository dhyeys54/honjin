import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HonjinProjectServiceImpl, expandHome } from './honjin-project-service';

const home = '/home/u';

describe('expandHome', () => {
    it('expands ~ and ~/x only', () => {
        expect(expandHome('~', home)).toBe(home);
        expect(expandHome('~/dev', home)).toBe('/home/u/dev');
        expect(expandHome('~user/x', home)).toBe('~user/x');
        expect(expandHome('/abs', home)).toBe('/abs');
    });
});

describe('HonjinProjectServiceImpl.list', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'honjin-psvc-')));
    mkdirSync(join(base, 'root', 'p1'), { recursive: true });
    mkdirSync(join(base, 'extra'));
    const service = new HonjinProjectServiceImpl(base);

    it('scans expanded roots and computes missing from extra and hidden', async () => {
        const res = await service.list({
            scanRoots: [join(base, 'root')],
            extra: [join(base, 'extra'), join(base, 'gone-extra')],
            hidden: [join(base, 'gone-hidden'), join(base, 'root', 'p1')]
        });
        expect(res.scanned).toEqual([join(base, 'root', 'p1')]);
        expect(res.missing).toEqual([join(base, 'gone-extra'), join(base, 'gone-hidden')]);
    });

    it('returns one warning per unreadable scan root (spec 03)', async () => {
        const res = await service.list({ scanRoots: [join(base, 'root'), join(base, 'no-such-root')], extra: [], hidden: [] });
        expect(res.scanned).toEqual([join(base, 'root', 'p1')]);
        expect(res.warnings).toHaveLength(1);
        expect(res.warnings[0]).toContain(join(base, 'no-such-root'));
    });

    it('expands ~ using the home dir, but reports missing entries as given', async () => {
        const s = new HonjinProjectServiceImpl(base, base);
        const res = await s.list({ scanRoots: ['~/root'], extra: ['~/extra', '~/nope'], hidden: [] });
        expect(res.scanned).toEqual([join(base, 'root', 'p1')]);
        expect(res.missing).toEqual(['~/nope']);
    });

    it('creates honjin.code-workspace once and never overwrites it', async () => {
        const file = join(base, 'honjin.code-workspace');
        await service.ensureWorkspaceFile();
        expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ folders: [], settings: {} });
        expect(existsSync(file)).toBe(true);
        writeFileSync(file, '{"folders":[{"path":"/x"}]}');
        await service.ensureWorkspaceFile();
        expect(readFileSync(file, 'utf8')).toBe('{"folders":[{"path":"/x"}]}');
    });
});

describe('HonjinProjectServiceImpl.workspaceFile', () => {
    it('creates the managed workspace file and returns its path', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'honjin-ws-'));
        const path = await new HonjinProjectServiceImpl(dir).workspaceFile();
        expect(path).toBe(join(dir, 'honjin.code-workspace'));
        expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ folders: [], settings: {} });
    });
});

describe('HonjinProjectServiceImpl.reveal', () => {
    it('opens the OS file manager on the path with an argument array', async () => {
        const opener = jest.fn().mockResolvedValue(undefined);
        const service = new HonjinProjectServiceImpl('/x', '/h', opener);
        await service.reveal('/p/with space/$x');
        expect(opener).toHaveBeenCalledWith('/p/with space/$x');
    });
});
