import { execFile, execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { HerdrHarness, startHerdr } from './herdr-harness';

const run = promisify(execFile);

let installed = true;
try {
    execFileSync('herdr', ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('HerdrCli against a real headless herdr', () => {
    let h: HerdrHarness;
    let root: string;
    let sub: string;

    beforeAll(async () => {
        h = await startHerdr();
        // realpath: macOS tmpdir is a symlink and herdr reports resolved cwds.
        root = join(realpathSync(mkdtempSync(join(tmpdir(), 'corral-int-'))), 'my project');
        sub = join(root, 'src');
        mkdirSync(sub, { recursive: true });
    });
    afterAll(() => h?.stop());

    const herdr = (...args: string[]) => run('herdr', ['--session', h.session, ...args]).then(r => r.stdout);

    it('reports the server as running', async () => {
        expect(await h.cli.status()).toMatchObject({ running: true });
    });

    it('creates a workspace in a folder with a space, and gets it back', async () => {
        const ws = await h.cli.createWorkspace(root, 'my project');
        expect(ws.workspaceId).toBeTruthy();
        expect(await h.cli.getWorkspace(ws.workspaceId)).toEqual({ workspaceId: ws.workspaceId, label: 'my project' });

        const tab = await h.cli.createTab(ws.workspaceId, sub, 'src');
        expect(tab.paneId).toBeTruthy();
        const panes = JSON.parse(await herdr('pane', 'list')).result.panes as { pane_id: string; cwd: string }[];
        expect(panes.find(p => p.pane_id === tab.paneId)?.cwd).toBe(sub);

        await h.cli.focusWorkspace(ws.workspaceId);
        await h.cli.runInPane(tab.paneId, 'echo corral-ok');
        await expect(async () => {
            expect(await herdr('pane', 'read', tab.paneId)).toContain('corral-ok');
        }).toEventuallyPass();
    });

    it('returns undefined for an unknown workspace', async () => {
        expect(await h.cli.getWorkspace('w999')).toBeUndefined();
    });
});

// Shell output arrives asynchronously; poll instead of sleeping a fixed time.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest { interface Matchers<R> { toEventuallyPass(): Promise<R> } }
}
expect.extend({
    async toEventuallyPass(fn: () => Promise<void>) {
        let last: unknown;
        for (let i = 0; i < 50; i++) {
            try {
                await fn();
                return { pass: true, message: () => 'passed' };
            } catch (e) {
                last = e;
                await new Promise(r => setTimeout(r, 100));
            }
        }
        return { pass: false, message: () => `never passed: ${last}` };
    }
});
