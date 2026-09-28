import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CorralHerdrServiceImpl } from '../src/node/corral-herdr-service';
import { WorkspaceMapStore } from '../src/node/workspace-map-store';
import { HerdrHarness, startHerdr } from './herdr-harness';

let installed = true;
try {
    execFileSync('herdr', ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('CorralHerdrService against real herdr', () => {
    let h: HerdrHarness;
    afterAll(() => h?.stop());

    it('two openTab calls on one project give 1 workspace and 2 tabs in the right folders', async () => {
        h = await startHerdr();
        const root = join(realpathSync(mkdtempSync(join(tmpdir(), 'corral-svc-int-'))), 'my app');
        const src = join(root, 'src');
        mkdirSync(src, { recursive: true });
        const store = new WorkspaceMapStore(join(root, '..', 'map.json'));
        const service = new CorralHerdrServiceImpl(async () => ({ cli: h.cli, session: h.session }), store);

        const a = await service.openTab({ projectPath: root, folderPath: root, command: '' });
        const b = await service.openTab({ projectPath: root, folderPath: src, command: '' });

        expect(a.createdWorkspace).toBe(true);
        expect(b).toMatchObject({ workspaceId: a.workspaceId, createdWorkspace: false });
        const tabs = JSON.parse(execFileSync('herdr', ['--session', h.session, 'tab', 'list', '--workspace', a.workspaceId], { encoding: 'utf8' }));
        expect(tabs.result.tabs).toHaveLength(2);
        const panes = JSON.parse(execFileSync('herdr', ['--session', h.session, 'pane', 'list', '--workspace', a.workspaceId], { encoding: 'utf8' }));
        expect(panes.result.panes.map((p: { cwd: string }) => p.cwd).sort()).toEqual([root, src].sort());
    });
});
