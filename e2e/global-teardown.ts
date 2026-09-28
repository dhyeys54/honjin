import { execFile } from 'child_process';
import { promisify } from 'util';

// Belt and braces: globalSetup's returned teardown already stops the session; this
// covers a setup that failed half way. Name-guarded so `default` can never be hit.
export default async function globalTeardown(): Promise<void> {
    const session = process.env.CORRAL_E2E_SESSION;
    if (!session || !/^corral-test-e2e-/.test(session)) {
        return;
    }
    const run = promisify(execFile);
    await run('herdr', ['--session', session, 'server', 'stop']).catch(() => undefined);
    await run('herdr', ['session', 'delete', session]).catch(() => undefined);
}
