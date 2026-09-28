import { HerdrCli, ExecFileFn } from './herdr-cli';
import { HerdrError } from '../common/protocol';

type Call = { file: string; args: string[] };
type Reply = { stdout?: string; stderr?: string; exitCode?: number } | Error;

function fake(...replies: Reply[]): { exec: ExecFileFn; calls: Call[] } {
    const calls: Call[] = [];
    const queue = [...replies];
    const exec: ExecFileFn = async (file, args) => {
        calls.push({ file, args });
        const r = queue.shift() ?? {};
        if (r instanceof Error) {
            throw r;
        }
        return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.exitCode ?? 0 };
    };
    return { exec, calls };
}
const ok = (result: unknown): Reply => ({ stdout: JSON.stringify({ id: 'x', result }) });
const wsCreated = ok({ workspace: { workspace_id: 'w1', label: 'a' }, tab: { tab_id: 'w1:t1' }, root_pane: { pane_id: 'w1:p1', cwd: '/x' } });
const nasty = '/tmp/it\'s "a" $HOME/dir with space';

describe('HerdrCli argv', () => {
    it('status uses status server --json', async () => {
        const { exec, calls } = fake({ stdout: '{"status":"running","running":true,"version":"0.9.1","protocol":22}' });
        const status = await new HerdrCli({ binary: '/bin/herdr' }, exec).status();
        expect(calls[0]).toEqual({ file: '/bin/herdr', args: ['status', 'server', '--json'] });
        expect(status).toEqual({ running: true, version: '0.9.1', protocol: 22 });
    });

    it('status works when the server is down', async () => {
        const { exec } = fake({ stdout: '{"status":"not_running","running":false,"version":null,"protocol":null}' });
        expect(await new HerdrCli({ binary: 'h' }, exec).status()).toEqual({ running: false, version: null, protocol: null });
    });

    it('createWorkspace passes cwd and label as single argv elements', async () => {
        const { exec, calls } = fake(wsCreated);
        const r = await new HerdrCli({ binary: 'h' }, exec).createWorkspace(nasty, 'my "label"');
        expect(calls[0].args).toEqual(['workspace', 'create', '--cwd', nasty, '--label', 'my "label"', '--no-focus']);
        expect(r).toEqual({ workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1' });
    });

    it('getWorkspace, focusWorkspace, createTab and runInPane build the documented argv', async () => {
        const { exec, calls } = fake(
            ok({ workspace: { workspace_id: 'w1', label: 'a' } }),
            ok({}),
            ok({ tab: { tab_id: 'w1:t2' }, root_pane: { pane_id: 'w1:p2' } }),
            ok({})
        );
        const cli = new HerdrCli({ binary: 'h' }, exec);
        expect(await cli.getWorkspace('w1')).toEqual({ workspaceId: 'w1', label: 'a' });
        await cli.focusWorkspace('w1');
        expect(await cli.createTab('w1', nasty, 'sub')).toEqual({ tabId: 'w1:t2', paneId: 'w1:p2' });
        await cli.runInPane('w1:p2', 'echo "hi $USER"; ls');
        expect(calls.map(c => c.args)).toEqual([
            ['workspace', 'get', 'w1'],
            ['workspace', 'focus', 'w1'],
            ['tab', 'create', '--workspace', 'w1', '--cwd', nasty, '--label', 'sub', '--focus'],
            ['pane', 'run', 'w1:p2', 'echo "hi $USER"; ls']
        ]);
    });

    it('prefixes --session when a session is set, and only then', async () => {
        const a = fake({ stdout: '{"running":false}' });
        await new HerdrCli({ binary: 'h', session: 'corral-test-1' }, a.exec).status();
        expect(a.calls[0].args).toEqual(['--session', 'corral-test-1', 'status', 'server', '--json']);
        const b = fake(ok({}));
        await new HerdrCli({ binary: 'h', session: '' }, b.exec).focusWorkspace('w1');
        expect(b.calls[0].args).toEqual(['workspace', 'focus', 'w1']);
    });
});

describe('HerdrCli empty output', () => {
    it('runInPane accepts empty stdout, but other commands still reject it', async () => {
        const cli = new HerdrCli({ binary: 'h' }, fake({ stdout: '' }, { stdout: '' }).exec);
        await expect(cli.runInPane('w1:p1', 'ls')).resolves.toBeUndefined();
        await expect(cli.status()).rejects.toMatchObject({ code: 'cli_error' });
    });
});

describe('HerdrCli errors', () => {
    const cli = (r: Reply) => new HerdrCli({ binary: 'h' }, fake(r).exec);

    it('maps exit 1 with error JSON on stderr to that code', async () => {
        const err = await cli({ exitCode: 1, stderr: '{"error":{"code":"server_not_running","message":"nope"}}' })
            .focusWorkspace('w1').catch(e => e);
        expect(err).toBeInstanceOf(HerdrError);
        expect(err).toMatchObject({ code: 'server_not_running', message: 'nope', exitCode: 1 });
    });

    it('maps exit 2 to cli_error and keeps stderr', async () => {
        const err = await cli({ exitCode: 2, stderr: 'usage: ...' }).focusWorkspace('w1').catch(e => e);
        expect(err).toMatchObject({ code: 'cli_error', exitCode: 2, stderr: 'usage: ...' });
    });

    it('maps exit 1 with unparseable stderr to cli_error', async () => {
        const err = await cli({ exitCode: 1, stderr: 'boom' }).focusWorkspace('w1').catch(e => e);
        expect(err).toMatchObject({ code: 'cli_error', exitCode: 1 });
    });

    it('maps unparseable stdout on exit 0 to cli_error', async () => {
        const err = await cli({ stdout: 'not json' }).status().catch(e => e);
        expect(err).toMatchObject({ code: 'cli_error' });
    });

    it('maps ENOENT to not_found and a timeout to timeout', async () => {
        const enoent = await cli(Object.assign(new Error('spawn h ENOENT'), { code: 'ENOENT' })).status().catch(e => e);
        expect(enoent).toMatchObject({ code: 'not_found' });
        const slow = await cli(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })).status().catch(e => e);
        expect(slow).toMatchObject({ code: 'timeout' });
    });

    it('getWorkspace returns undefined on workspace_not_found but rethrows other errors', async () => {
        const gone = { exitCode: 1, stderr: '{"error":{"code":"workspace_not_found","message":"w9 not found"}}' };
        expect(await cli(gone).getWorkspace('w9')).toBeUndefined();
        const down = { exitCode: 1, stderr: '{"error":{"code":"server_not_running","message":"x"}}' };
        await expect(cli(down).getWorkspace('w9')).rejects.toMatchObject({ code: 'server_not_running' });
    });
});
