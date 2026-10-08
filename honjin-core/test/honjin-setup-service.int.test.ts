import { execFileSync } from 'child_process';
import { mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HonjinSetupServiceImpl } from '../src/node/honjin-setup-service';
import { defaultExecFile } from '../src/node/herdr-cli';
import { findBinary } from '../src/node/binary-resolver';

const HERDR = process.env.HERDR_BIN || 'herdr';
let installed = true;
try {
    execFileSync(HERDR, ['--version'], { stdio: 'ignore' });
} catch {
    installed = false;
    console.warn('!!! herdr is not installed: integration tests are SKIPPED !!!');
}

(installed ? describe : describe.skip)('HonjinSetupService against real binaries (spec 13 S2)', () => {
    it('finds real herdr with its version, and reports tools absent from an empty PATH as missing', async () => {
        const empty = realpathSync(mkdtempSync(join(tmpdir(), 'honjin-setup-int-')));
        const resolveHerdr = () => findBinary('herdr', { pathEnv: process.env.PATH ?? '', candidates: [], execFileFn: defaultExecFile });
        const result = await new HonjinSetupServiceImpl({ pathEnv: empty, execFileFn: defaultExecFile }, resolveHerdr).check();

        expect(result[0]).toEqual({ id: 'herdr', found: true, path: expect.stringMatching(/\/herdr$/), version: expect.stringMatching(/^herdr \d+\.\d+/) });
        for (const s of result.slice(1)) {
            expect(s).toMatchObject({ found: false, version: '' });
        }
        expect(result.find(s => s.id === 'claude')?.install).toBe('curl -fsSL https://claude.ai/install.sh | bash');
    });
});
