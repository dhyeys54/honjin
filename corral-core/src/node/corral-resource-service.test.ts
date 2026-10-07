import { CorralResourceServiceImpl } from './corral-resource-service';
import { ExecFileFn } from './herdr-cli';

const MiB = 1024 ** 2;
// Corral root 100 → 101, 102. herdr server 200 → shells 201 (pane w1:p1, "alpha") → 202 claude → 203 node, and 211 (w2:p1, "beta").
// 300 is unrelated.
const TREE: [pid: number, ppid: number, rssKb: number, cpu: number][] = [
    [100, 1, 1024, 0], [101, 100, 1024, 0], [102, 100, 1024, 0],
    [200, 1, 1024, 0], [201, 200, 1024, 0], [202, 201, 4096, 0], [203, 202, 1024, 0], [211, 200, 2048, 0],
    [300, 1, 1024, 0]
];
const text = (rows = TREE) => rows.map(([pid, ppid, rss, cpu]) => `${pid} ${ppid} ${rss} ${cpu} cmd${pid}`).join('\n') + '\n';

function setup(opts: { ps?: () => string; exitCode?: number; herdr?: Partial<Herdr>; now?: () => number } = {}) {
    const psCalls: string[][] = [];
    const exec: ExecFileFn = async (file, args) => {
        psCalls.push([file, ...args]);
        return { stdout: (opts.ps ?? text)(), stderr: '', exitCode: opts.exitCode ?? 0 };
    };
    const herdr = fakeHerdr(opts.herdr);
    const service = new CorralResourceServiceImpl(async () => herdr, exec, 100, 10, 1000 * MiB, opts.now);
    return { service, herdr, psCalls };
}

interface Herdr {
    listWorkspaces(): Promise<{ workspaceId: string; label: string }[]>;
    listPanes(): Promise<{ paneId: string; workspaceId: string }[]>;
    paneShellPid(paneId: string): Promise<number | undefined>;
    calls: number;
}
function fakeHerdr(over: Partial<Herdr> = {}): Herdr {
    const h: Herdr = {
        calls: 0,
        listWorkspaces: async () => { h.calls++; return [{ workspaceId: 'w1', label: 'alpha' }, { workspaceId: 'w2', label: 'beta' }]; },
        listPanes: async () => { h.calls++; return [{ paneId: 'w1:p1', workspaceId: 'w1' }, { paneId: 'w2:p1', workspaceId: 'w2' }]; },
        paneShellPid: async id => { h.calls++; return id === 'w1:p1' ? 201 : 211; },
        ...over
    };
    return h;
}

describe('CorralResourceServiceImpl', () => {
    it('R1: sample counts the Corral subtree and the herdr-server subtree, not unrelated processes', async () => {
        const { service, psCalls } = setup();
        const s = await service.sample();
        expect(s.count).toBe(8);
        expect(s.totalMemBytes).toBe(1000 * MiB);
        expect(s.memBytes).toBe((1024 * 3 + 1024 + 1024 + 4096 + 1024 + 2048) * 1024);
        expect(psCalls[0]).toEqual(['ps', '-axo', 'pid=,ppid=,rss=,%cpu=,comm=']);
    });

    it('R2: the server pid is resolved once and again when it disappears from ps', async () => {
        let current = text();
        const { service, herdr } = setup({ ps: () => current });
        await service.sample();
        const after = herdr.calls;
        expect(after).toBeGreaterThan(0);
        await service.sample();
        expect(herdr.calls).toBe(after);

        current = text(TREE.filter(r => r[0] !== 200));
        await service.sample();
        expect(herdr.calls).toBeGreaterThan(after);
    });

    it('R2: when herdr fails, the scope is the Corral subtree and sample() still resolves', async () => {
        const { service } = setup({ herdr: { listPanes: async () => { throw new Error('server_not_running'); } } });
        expect((await service.sample()).count).toBe(3);
    });

    it('R2: a failed herdr lookup is retried at the next sample', async () => {
        let fail = true;
        const { service } = setup({ herdr: { listPanes: async () => { if (fail) { throw new Error('server_not_running'); } return [{ paneId: 'w1:p1', workspaceId: 'w1' }]; } } });
        expect((await service.sample()).count).toBe(3);
        fail = false;
        expect((await service.sample()).count).toBe(8);
    });

    it('R2: breakdown() fills the server-pid cache, so the next sample does not look it up again', async () => {
        const { service, herdr } = setup();
        await service.breakdown();
        const after = herdr.calls;
        expect((await service.sample()).count).toBe(8);
        expect(herdr.calls).toBe(after);
    });

    it('R3: a ps exit code other than 0 rejects', async () => {
        await expect(setup({ exitCode: 1 }).service.sample()).rejects.toThrow();
    });

    it('R6: a process at 97% cpu in samples 300 000 ms apart becomes a runaway', async () => {
        let t = 0;
        const hot = () => text(TREE.map(r => (r[0] === 202 ? [r[0], r[1], r[2], 97] : r) as typeof r));
        const { service } = setup({ ps: hot, now: () => t });
        expect((await service.sample()).runaways).toEqual([]);
        t = 300_000;
        const runaways = (await service.sample()).runaways;
        expect(runaways).toHaveLength(1);
        expect(runaways[0]).toMatchObject({ pid: 202, command: 'cmd202', sinceMs: 300_000 });
    });

    it('R10: breakdown lists Corral, the server, and each workspace, heaviest first', async () => {
        const rows = await setup().service.breakdown();
        expect(rows.map(r => [r.label, r.count])).toEqual([['alpha', 3], ['Corral', 3], ['beta', 1], ['herdr server', 1]]);
        expect(rows[0].memBytes).toBe((1024 + 4096 + 1024) * 1024);
    });

    it('R10: breakdown with herdr failing returns only Corral', async () => {
        const { service } = setup({ herdr: { listWorkspaces: async () => { throw new Error('down'); } } });
        expect((await service.breakdown()).map(r => r.label)).toEqual(['Corral']);
    });
});
