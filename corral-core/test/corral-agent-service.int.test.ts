import { execFileSync } from 'child_process';
import { mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CorralAgentServiceImpl } from '../src/node/corral-agent-service';
import { HerdrHarness, startHerdr } from './herdr-harness';

const HERDR = process.env.HERDR_BIN || 'herdr';
let installed = true;
try {
    execFileSync(HERDR, ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('CorralAgentService against real herdr', () => {
    let h: HerdrHarness;
    afterAll(() => h?.stop());

    it('lists a faked agent with the real field mapping, focuses it, and reports not running once the server is gone', async () => {
        h = await startHerdr();
        const service = new CorralAgentServiceImpl(async () => h.cli);
        expect(await service.list()).toEqual({ running: true, agents: [] });

        const dir = realpathSync(mkdtempSync(join(tmpdir(), 'corral-agents-int-')));
        try {
            const { workspaceId, paneId } = await h.cli.createWorkspace(dir, 'agents-int');
            execFileSync(HERDR, ['--session', h.session, 'pane', 'report-agent', '--source', 'corral-int', '--agent', 'claude', '--state', 'blocked', paneId]);
            let agents = (await service.list()).agents;
            for (let i = 0; i < 20 && agents.length === 0; i++) {
                await new Promise(r => setTimeout(r, 250));
                agents = (await service.list()).agents;
            }
            expect(agents).toEqual([{ paneId, workspaceId, kind: 'claude', status: 'blocked', cwd: dir, title: expect.any(String) }]);

            await expect(service.focus(paneId)).resolves.toBeUndefined();
            await expect(service.focus('w99:p99')).rejects.toMatchObject({ code: 'agent_not_found' });

            await h.stop();
            expect(await service.list()).toEqual({ running: false, agents: [] });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
