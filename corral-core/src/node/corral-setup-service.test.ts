import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ExecFileFn } from './herdr-cli';
import { CorralSetupServiceImpl, SetupEnv } from './corral-setup-service';

function exe(dir: string, name: string): string {
    mkdirSync(dir, { recursive: true });
    const p = join(dir, name);
    writeFileSync(p, '#!/bin/sh\n');
    chmodSync(p, 0o755);
    return p;
}

type Reply = { stdout?: string; exitCode?: number } | Error;
function fake(replies: Record<string, Reply>): { exec: ExecFileFn; calls: string[] } {
    const calls: string[] = [];
    const exec: ExecFileFn = async (file, args) => {
        const key = [file, ...args].join(' ');
        calls.push(key);
        const r = replies[key];
        if (r instanceof Error) {
            throw r;
        }
        return { stdout: r?.stdout ?? '', stderr: '', exitCode: r?.exitCode ?? 0 };
    };
    return { exec, calls };
}

describe('CorralSetupService.check (spec 13 S2, S4)', () => {
    it('reports each catalog entry in order, with path and first version line when found and the install command when not', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'corral-setup-'));
        const claude = exe(dir, 'claude');
        exe(dir, 'brew');
        const { exec } = fake({
            [`${claude} --version`]: { stdout: '\n2.1.211 (Claude Code)\nextra\n' },
            '/fake/herdr --version': { stdout: 'herdr 0.9.1\n' }
        });
        const service = new CorralSetupServiceImpl({ pathEnv: dir, execFileFn: exec }, async () => '/fake/herdr');

        const result = await service.check();
        expect(result.map(s => s.id)).toEqual(['herdr', 'claude', 'codex', 'gemini', 'opencode', 'git']);
        expect(result[0]).toEqual({ id: 'herdr', found: true, path: '/fake/herdr', version: 'herdr 0.9.1' });
        expect(result[1]).toEqual({ id: 'claude', found: true, path: claude, version: '2.1.211 (Claude Code)' });
        expect(result[2]).toEqual({ id: 'codex', found: false, version: '', install: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh' });
        expect(result[3]).toMatchObject({ id: 'gemini', found: false, install: 'brew install gemini-cli' });
    });

    it('gives an empty version when --version fails or times out', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'corral-setup-'));
        const codex = exe(dir, 'codex');
        const { exec } = fake({ [`${codex} --version`]: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) });
        const result = await new CorralSetupServiceImpl({ pathEnv: dir, execFileFn: exec }, async () => undefined).check();
        expect(result.find(s => s.id === 'codex')).toEqual({ id: 'codex', found: true, path: codex, version: '' });
        expect(result[0]).toMatchObject({ id: 'herdr', found: false, install: 'curl -fsSL https://herdr.dev/install.sh | sh' });
    });

    it('treats the /usr/bin/git stub as missing until the command line tools exist, without running it', async () => {
        const { exec, calls } = fake({ '/usr/bin/xcode-select -p': { exitCode: 2 } });
        const service = new CorralSetupServiceImpl({ pathEnv: '/usr/bin', execFileFn: exec }, async () => undefined);
        expect((await service.check()).find(s => s.id === 'git')).toEqual({ id: 'git', found: false, version: '', install: 'xcode-select --install' });
        expect(calls).not.toContain('/usr/bin/git --version');
    });

    it('only searches PATH when no fallbacks are given (the E2E setup)', async () => {
        const home = mkdtempSync(join(tmpdir(), 'corral-home-'));
        exe(join(home, '.opencode/bin'), 'opencode');
        const { exec } = fake({});
        const withFallbacks = new CorralSetupServiceImpl({ pathEnv: '', execFileFn: exec, fallbacks: { dirs: [], home } }, async () => undefined);
        const pathOnly = new CorralSetupServiceImpl({ pathEnv: '', execFileFn: exec }, async () => undefined);
        expect((await withFallbacks.check()).find(s => s.id === 'opencode')?.found).toBe(true);
        expect((await pathOnly.check()).find(s => s.id === 'opencode')?.found).toBe(false);
    });
});

describe('CorralSetupService.latestRelease (spec 13 S12)', () => {
    const service = (fetchFn: NonNullable<SetupEnv['fetchFn']>) =>
        new CorralSetupServiceImpl({ pathEnv: '', execFileFn: fake({}).exec, fetchFn }, async () => undefined);
    const reply = (status: number, body: unknown) => async () => ({ ok: status === 200, status, json: async () => body });

    it('returns the latest tag and its page, asking GitHub with no credentials', async () => {
        const calls: [string, RequestInit | undefined][] = [];
        const s = service(async (url, init) => {
            calls.push([url, init]);
            return reply(200, { tag_name: 'v0.1.0-beta.2', html_url: 'https://github.com/dhyeys54/corral/releases/tag/v0.1.0-beta.2' })();
        });
        expect(await s.latestRelease()).toEqual({ tag: 'v0.1.0-beta.2', url: 'https://github.com/dhyeys54/corral/releases/tag/v0.1.0-beta.2' });
        expect(calls[0][0]).toBe('https://api.github.com/repos/dhyeys54/corral/releases/latest');
        expect(calls[0][1]?.credentials).toBe('omit');
    });

    it('returns undefined on 404, a network error or a body without a tag', async () => {
        expect(await service(reply(404, { message: 'Not Found' })).latestRelease()).toBeUndefined();
        expect(await service(async () => { throw new Error('offline'); }).latestRelease()).toBeUndefined();
        expect(await service(reply(200, { nope: 1 })).latestRelease()).toBeUndefined();
        expect(await service(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })).latestRelease()).toBeUndefined();
    });
});

describe('CorralSetupService.platform (spec 13 S11)', () => {
    it('reads the macOS version from sw_vers and the chip from the process', async () => {
        const { exec } = fake({ '/usr/bin/sw_vers -productVersion': { stdout: '15.6\n' } });
        const s = new CorralSetupServiceImpl({ pathEnv: '', execFileFn: exec }, async () => undefined);
        expect(await s.platform()).toEqual({ macos: '15.6', arch: process.arch });
    });
});
