import { ChildProcess, execFile, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { HerdrCli } from '../src/node/herdr-cli';

const run = promisify(execFile);
// Tests only need the CLI on PATH (or HERDR_BIN), not the app's binary resolver.
const HERDR = process.env.HERDR_BIN || 'herdr';

export interface HerdrHarness {
    session: string;
    cli: HerdrCli;
    stop(): Promise<void>;
}

/** Hard guard: the user's live session must never be targeted by tests. */
export function assertTestSession(session: string): void {
    if (!/^honjin-test-/.test(session)) {
        throw new Error(`Refusing to use herdr session '${session}': test sessions must match /^honjin-test-/`);
    }
}

async function isRunning(session: string): Promise<boolean> {
    try {
        const { stdout } = await run(HERDR, ['--session', session, 'status', 'server', '--json']);
        return JSON.parse(stdout).running === true;
    } catch {
        return false;
    }
}

export async function startHerdr(opts: { session?: string } = {}): Promise<HerdrHarness> {
    const session = opts.session ?? `honjin-test-${process.pid}-${randomBytes(2).toString('hex')}`;
    assertTestSession(session);

    let child: ChildProcess | undefined;
    if (!(await isRunning(session))) {
        child = spawn(HERDR, ['--session', session, 'server'], { detached: false, stdio: 'ignore' });
        const deadline = Date.now() + 10_000;
        while (!(await isRunning(session))) {
            if (Date.now() > deadline) {
                child.kill();
                throw new Error(`herdr server for session '${session}' did not start within 10s`);
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }

    let stopped = false;
    const stop = async (): Promise<void> => {
        if (stopped) {
            return;
        }
        stopped = true;
        process.off('exit', onExit);
        await run(HERDR, ['--session', session, 'server', 'stop']).catch(() => undefined);
        await run(HERDR, ['session', 'delete', session]).catch(() => undefined);
        child?.kill();
    };
    // Last-resort cleanup if a test crashes before afterAll: 'exit' handlers must be synchronous.
    const onExit = (): void => {
        child?.kill();
    };
    process.on('exit', onExit);

    return { session, cli: new HerdrCli({ binary: HERDR, session }), stop };
}
