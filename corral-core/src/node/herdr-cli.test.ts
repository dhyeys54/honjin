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

describe('HerdrCli listing calls (spec 10)', () => {
    it('listWorkspaces maps workspace_id and label', async () => {
        const { exec, calls } = fake(ok({ workspaces: [{ workspace_id: 'w1', label: 'a' }, { workspace_id: 'w2', label: 'b c' }] }));
        expect(await new HerdrCli({ binary: 'h' }, exec).listWorkspaces()).toEqual([
            { workspaceId: 'w1', label: 'a' }, { workspaceId: 'w2', label: 'b c' }
        ]);
        expect(calls[0].args).toEqual(['workspace', 'list']);
    });

    it('listPanes maps pane_id and workspace_id', async () => {
        const { exec, calls } = fake(ok({ panes: [{ pane_id: 'w1:p1', workspace_id: 'w1', tab_id: 'w1:t1' }] }));
        expect(await new HerdrCli({ binary: 'h' }, exec).listPanes()).toEqual([{ paneId: 'w1:p1', workspaceId: 'w1' }]);
        expect(calls[0].args).toEqual(['pane', 'list']);
    });

    it('paneShellPid returns shell_pid, or undefined when it is missing', async () => {
        const { exec, calls } = fake(ok({ process_info: { shell_pid: 41889, pane_id: 'w1:p1' } }), ok({ process_info: { pane_id: 'w1:p2' } }));
        const cli = new HerdrCli({ binary: 'h' }, exec);
        expect(await cli.paneShellPid('w1:p1')).toBe(41889);
        expect(calls[0].args).toEqual(['pane', 'process-info', '--pane', 'w1:p1']);
        expect(await cli.paneShellPid('w1:p2')).toBeUndefined();
    });

    it('every listing call is prefixed with --session', async () => {
        const { exec, calls } = fake(ok({ workspaces: [] }), ok({ panes: [] }), ok({ process_info: {} }));
        const cli = new HerdrCli({ binary: 'h', session: 's' }, exec);
        await cli.listWorkspaces();
        await cli.listPanes();
        await cli.paneShellPid('w1:p1');
        expect(calls.map(c => c.args.slice(0, 2))).toEqual([['--session', 's'], ['--session', 's'], ['--session', 's']]);
    });
});

describe('HerdrCli agents', () => {
    const entry = {
        agent: 'claude', agent_status: 'idle', cwd: '/Users/u/designer', pane_id: 'w5:p1', tab_id: 'w5:t1',
        terminal_title_stripped: 'Commit and push changes', workspace_id: 'w5', focused: false, revision: 3
    };
    const list = (agents: object[]) => ok({ agents, type: 'agent_list' });
    const cli = (...replies: Reply[]) => { const f = fake(...replies); return { ...f, cli: new HerdrCli({ binary: 'h' }, f.exec) }; };

    it('listAgents runs agent list and maps the captured entry', async () => {
        const { cli: c, calls } = cli(list([entry]));
        expect(await c.listAgents()).toEqual([{ paneId: 'w5:p1', workspaceId: 'w5', kind: 'claude', status: 'idle', cwd: '/Users/u/designer', title: 'Commit and push changes' }]);
        expect(calls[0].args).toEqual(['agent', 'list']);
    });

    it('a missing title becomes an empty string', async () => {
        expect((await cli(list([{ ...entry, terminal_title_stripped: undefined }])).cli.listAgents())[0].title).toBe('');
    });

    it('cwd falls back to foreground_cwd, then to an empty string', async () => {
        const out = await cli(list([{ ...entry, cwd: '', foreground_cwd: '/f' }, { ...entry, pane_id: 'w5:p2', cwd: undefined }])).cli.listAgents();
        expect(out.map(a => a.cwd)).toEqual(['/f', '']);
    });

    it('an empty agent becomes kind agent, an unknown status becomes unknown, a missing workspace_id becomes empty', async () => {
        const [a] = await cli(list([{ ...entry, agent: '', agent_status: 'weird', workspace_id: undefined }])).cli.listAgents();
        expect(a).toMatchObject({ kind: 'agent', status: 'unknown', workspaceId: '' });
    });

    it('skips an entry without a pane_id, and a missing agents array is an empty list', async () => {
        expect(await cli(list([{ ...entry, pane_id: undefined }, entry])).cli.listAgents()).toHaveLength(1);
        expect(await cli(ok({ type: 'agent_list' })).cli.listAgents()).toEqual([]);
    });

    it('focusAgent runs agent focus <pane> and resolves undefined', async () => {
        const { cli: c, calls } = cli(ok({ agent: { pane_id: 'w5:p1' } }));
        expect(await c.focusAgent('w5:p1')).toBeUndefined();
        expect(calls[0].args).toEqual(['agent', 'focus', 'w5:p1']);
    });

    it('both commands are prefixed with --session', async () => {
        const { exec, calls } = fake(list([]), ok({}));
        const c = new HerdrCli({ binary: 'h', session: 's' }, exec);
        await c.listAgents();
        await c.focusAgent('w1:p1');
        expect(calls.map(x => x.args)).toEqual([['--session', 's', 'agent', 'list'], ['--session', 's', 'agent', 'focus', 'w1:p1']]);
    });

    it('error codes pass through', async () => {
        const err = (code: string) => ({ exitCode: 1, stderr: JSON.stringify({ error: { code, message: 'm' } }) });
        await expect(cli(err('agent_not_found')).cli.focusAgent('w9:p9')).rejects.toMatchObject({ code: 'agent_not_found' });
        await expect(cli(err('server_not_running')).cli.listAgents()).rejects.toMatchObject({ code: 'server_not_running' });
        await expect(cli({ exitCode: 2, stderr: 'error: unrecognized subcommand' }).cli.listAgents()).rejects.toMatchObject({ code: 'cli_error' });
    });
});
