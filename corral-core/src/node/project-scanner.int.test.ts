import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanProjects } from './project-scanner';

describe('scanProjects (real directories)', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'corral-scan-')));
    const root = join(base, 'root');
    const elsewhere = join(base, 'elsewhere');
    for (const d of ['alpha', 'beta', '.hidden', 'node_modules', 'with space']) {
        mkdirSync(join(root, d), { recursive: true });
    }
    mkdirSync(join(elsewhere, 'linked'), { recursive: true });
    writeFileSync(join(root, 'a-file.txt'), '');
    symlinkSync(join(root, 'a-file.txt'), join(root, 'file-link'));
    symlinkSync(join(elsewhere, 'linked'), join(root, 'dir-link'));
    symlinkSync(join(root, 'alpha'), join(root, 'alpha-dup'));

    it('lists immediate subdirectories, skipping dot-dirs, node_modules, files and file symlinks', async () => {
        const warn = jest.fn();
        const found = await scanProjects([root], warn);
        expect(found.map(p => p.replace(base, ''))).toEqual(
            ['/elsewhere/linked', '/root/alpha', '/root/beta', '/root/with space']
        );
        expect(warn).not.toHaveBeenCalled();
    });

    it('resolves directory symlinks and removes duplicates', async () => {
        const found = await scanProjects([root, root], () => undefined);
        expect(found).toContain(join(elsewhere, 'linked'));
        expect(found.filter(p => p === join(root, 'alpha'))).toHaveLength(1);
    });

    it('warns once for a missing root and adds nothing', async () => {
        const warn = jest.fn();
        expect(await scanProjects([join(base, 'nope')], warn)).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warns for an unreadable root', async () => {
        const locked = join(base, 'locked');
        mkdirSync(locked);
        chmodSync(locked, 0o000);
        const warn = jest.fn();
        try {
            expect(await scanProjects([locked], warn)).toEqual([]);
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            chmodSync(locked, 0o755);
        }
    });
});
