import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { assertTestSession, startHerdr } from './herdr-harness';

const run = promisify(execFile);

async function sessionNames(): Promise<string[]> {
    const { stdout } = await run('herdr', ['session', 'list']);
    return stdout.split('\n').slice(1).map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
}

let installed = true;
try {
    execFileSync('herdr', ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('herdr test harness', () => {
    it('starts a corral-test-* session with a running server, and stop() removes it', async () => {
        const h = await startHerdr();
        expect(h.session).toMatch(/^corral-test-/);
        const { stdout } = await run('herdr', ['--session', h.session, 'status', 'server', '--json']);
        expect(JSON.parse(stdout).running).toBe(true);
        expect(await sessionNames()).toContain(h.session);
        await h.stop();
        expect(await sessionNames()).not.toContain(h.session);
    });

    it('refuses non-test sessions', () => {
        expect(() => assertTestSession('default')).toThrow();
        expect(() => assertTestSession('corral-test-x')).not.toThrow();
    });

    it('uses a fixed session name and reuses a running server', async () => {
        const a = await startHerdr({ session: 'corral-test-fixed' });
        expect(a.session).toBe('corral-test-fixed');
        const b = await startHerdr({ session: 'corral-test-fixed' });
        expect(b.session).toBe('corral-test-fixed');
        await b.stop();
        await a.stop(); // already gone: must not throw
        expect(await sessionNames()).not.toContain('corral-test-fixed');
    });
});
