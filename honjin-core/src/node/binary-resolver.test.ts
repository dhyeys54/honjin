import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ExecFileFn } from './herdr-cli';
import { findBinary } from './binary-resolver';

function exe(dir: string, name: string): string {
    mkdirSync(dir, { recursive: true });
    const p = join(dir, name);
    writeFileSync(p, '#!/bin/sh\n');
    chmodSync(p, 0o755);
    return p;
}
const tmp = () => mkdtempSync(join(tmpdir(), 'honjin-find-'));

function shell(stdout: string): { exec: ExecFileFn; calls: string[][] } {
    const calls: string[][] = [];
    return { calls, exec: async (file, args) => { calls.push([file, ...args]); return { stdout, stderr: '', exitCode: 0 }; } };
}

describe('findBinary (spec 13 S2)', () => {
    it('finds the name on PATH first', async () => {
        const dir = tmp();
        const bin = exe(dir, 'codex');
        const other = exe(tmp(), 'codex');
        const sh = shell('');
        expect(await findBinary('codex', { pathEnv: `/nope:${dir}`, candidates: [other], shell: '/bin/zsh', execFileFn: sh.exec })).toBe(bin);
        expect(sh.calls).toEqual([]);
    });

    it('then tries the candidates in order, including installer-specific ones', async () => {
        const extra = exe(join(tmp(), '.opencode/bin'), 'opencode');
        expect(await findBinary('opencode', { pathEnv: '', candidates: ['/nope/opencode', extra], execFileFn: shell('').exec })).toBe(extra);
    });

    it('finally asks the login shell with a fixed script', async () => {
        const found = exe(tmp(), 'gemini');
        const sh = shell(`noise from .zprofile\n${found}\n`);
        expect(await findBinary('gemini', { pathEnv: '', candidates: [], shell: '/bin/zsh', execFileFn: sh.exec })).toBe(found);
        expect(sh.calls).toEqual([['/bin/zsh', '-lc', 'command -v gemini']]);
    });

    it('skips the shell when none is given, and never puts an unsafe name into one', async () => {
        const sh = shell('/bin/ls\n');
        expect(await findBinary('claude', { pathEnv: '', candidates: [], execFileFn: sh.exec })).toBeUndefined();
        expect(await findBinary('x; rm -rf ~', { pathEnv: '', candidates: [], shell: '/bin/zsh', execFileFn: sh.exec })).toBeUndefined();
        expect(sh.calls).toEqual([]);
    });

    it('does not remember a miss', async () => {
        const dir = tmp();
        const opts = { pathEnv: dir, candidates: [], execFileFn: shell('').exec };
        expect(await findBinary('claude', opts)).toBeUndefined();
        const bin = exe(dir, 'claude');
        expect(await findBinary('claude', opts)).toBe(bin);
    });
});
