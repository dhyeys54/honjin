import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ExecFileFn } from './herdr-cli';
import { HerdrBinaryResolver } from './herdr-binary';

function exe(dir: string, name = 'herdr'): string {
    mkdirSync(dir, { recursive: true });
    const p = join(dir, name);
    writeFileSync(p, '#!/bin/sh\n');
    chmodSync(p, 0o755);
    return p;
}
const tmp = () => mkdtempSync(join(tmpdir(), 'corral-bin-'));

function shellFake(stdout: string, exitCode = 0): { exec: ExecFileFn; calls: { file: string; args: string[]; timeoutMs: number }[] } {
    const calls: { file: string; args: string[]; timeoutMs: number }[] = [];
    return { calls, exec: async (file, args, o) => { calls.push({ file, args, timeoutMs: o.timeoutMs }); return { stdout, stderr: '', exitCode }; } };
}

describe('HerdrBinaryResolver', () => {
    it('1: an absolute configured path to an executable wins', async () => {
        const abs = exe(tmp(), 'my-herdr');
        const other = exe(tmp());
        const r = new HerdrBinaryResolver({ pathEnv: join(other, '..'), candidates: [other], shell: '/bin/zsh', execFileFn: shellFake('').exec });
        expect(await r.resolve(abs)).toBe(abs);
    });

    it('2: otherwise looks the configured name up on PATH', async () => {
        const dir = tmp();
        const bin = exe(dir);
        const r = new HerdrBinaryResolver({ pathEnv: `/nonexistent:${dir}`, candidates: [], shell: '/bin/zsh', execFileFn: shellFake('').exec });
        expect(await r.resolve('herdr')).toBe(bin);
    });

    it('3: then tries the candidate locations in order', async () => {
        const first = exe(tmp());
        const second = exe(tmp());
        const r = new HerdrBinaryResolver({ pathEnv: '', candidates: ['/nope/herdr', first, second], shell: '/bin/zsh', execFileFn: shellFake('').exec });
        expect(await r.resolve('herdr')).toBe(first);
    });

    it('4: finally asks a login shell with a fixed script and a 3s timeout', async () => {
        const found = exe(tmp());
        const sh = shellFake(found + '\n');
        const r = new HerdrBinaryResolver({ pathEnv: '', candidates: [], shell: '/bin/zsh', execFileFn: sh.exec });
        expect(await r.resolve('herdr')).toBe(found);
        expect(sh.calls).toEqual([{ file: '/bin/zsh', args: ['-lc', 'command -v herdr'], timeoutMs: 3000 }]);
    });

    it('returns undefined when nothing is found, and ignores a shell answer that is not executable', async () => {
        const r = new HerdrBinaryResolver({ pathEnv: '', candidates: [], shell: '/bin/zsh', execFileFn: shellFake('/no/such/herdr\n').exec });
        expect(await r.resolve('herdr')).toBeUndefined();
    });

    it('caches per configured value', async () => {
        const sh = shellFake('');
        const dir = tmp();
        const bin = exe(dir);
        const r = new HerdrBinaryResolver({ pathEnv: dir, candidates: [], shell: '/bin/zsh', execFileFn: sh.exec });
        expect(await r.resolve('herdr')).toBe(bin);
        expect(await r.resolve('herdr')).toBe(bin);
        expect(await r.resolve('other-name')).toBeUndefined();
        expect(await r.resolve('other-name')).toBeUndefined();
        expect(sh.calls).toHaveLength(1); // the second miss came from the cache
    });
});
