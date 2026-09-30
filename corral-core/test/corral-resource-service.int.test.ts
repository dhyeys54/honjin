import { execFileSync } from 'child_process';
import { cpus, tmpdir, totalmem } from 'os';
import { CorralResourceServiceImpl } from '../src/node/corral-resource-service';
import { defaultExecFile } from '../src/node/herdr-cli';
import { HerdrHarness, startHerdr } from './herdr-harness';

let installed = true;
try {
    execFileSync('herdr', ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('CorralResourceService against real herdr', () => {
    let h: HerdrHarness;
    afterAll(() => h?.stop());

    it('counts the herdr session and lists its workspace by label', async () => {
        h = await startHerdr();
        await h.cli.createWorkspace(tmpdir(), 'res-int');
        // The pane's shell may not be reported the moment the workspace exists.
        const service = new CorralResourceServiceImpl(async () => h.cli, defaultExecFile, process.pid, cpus().length, totalmem());
        let rows = await service.breakdown();
        for (let i = 0; i < 20 && !rows.some(r => r.label === 'res-int'); i++) {
            await new Promise(r => setTimeout(r, 250));
            rows = await service.breakdown();
        }

        const sample = await service.sample();
        expect(sample.count).toBeGreaterThan(1);
        expect(sample.memBytes).toBeGreaterThan(0);
        expect(rows.find(r => r.label === 'res-int')?.count).toBeGreaterThanOrEqual(1);
        expect(rows.map(r => r.label)).toContain('herdr server');
    });
});
