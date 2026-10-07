import {
    AgentInfo, AgentList, AgentsPoller, AgentStatus, ProjectRef, Seen, agentLocation, agentRows, agentsIntervalMs, badgeTooltip, formatAge, needsYou,
    toAgentStatus, trackSince
} from './agents';

const a = (paneId: string, status: AgentStatus, extra: Partial<AgentInfo> = {}): AgentInfo =>
    ({ paneId, workspaceId: 'w1', kind: 'claude', status, cwd: '/x', title: '', ...extra });

describe('A1 toAgentStatus', () => {
    it('keeps the five statuses', () => {
        for (const s of ['idle', 'working', 'blocked', 'done', 'unknown']) {
            expect(toAgentStatus(s)).toBe(s);
        }
    });

    it('turns anything else into unknown', () => {
        for (const v of ['weird', 'Blocked', undefined, 3, null]) {
            expect(toAgentStatus(v)).toBe('unknown');
        }
    });
});

describe('A4 trackSince', () => {
    const prev = new Map<string, Seen>([
        ['p1', { kind: 'claude', status: 'working', since: 100 }],
        ['p2', { kind: 'claude', status: 'idle', since: 200 }],
        ['p3', { kind: 'claude', status: 'idle', since: 300 }],
        ['p6', { kind: 'claude', status: 'idle', since: 600 }]
    ]);
    const agents = [a('p1', 'working'), a('p2', 'blocked'), a('p3', 'idle', { kind: 'codex' }), a('p4', 'idle')];

    it('keeps since while status and kind are unchanged, resets it otherwise, drops missing panes', () => {
        const next = trackSince(prev, agents, 10_000);
        expect(next.get('p1')?.since).toBe(100);
        expect(next.get('p2')).toEqual({ kind: 'claude', status: 'blocked', since: 10_000 });
        expect(next.get('p3')).toEqual({ kind: 'codex', status: 'idle', since: 10_000 });
        expect(next.get('p4')?.since).toBe(10_000);
        expect(next.has('p6')).toBe(false);
    });

    it('returns a new map and leaves prev alone', () => {
        const copy = new Map(prev);
        const next = trackSince(prev, agents, 10_000);
        expect(next).not.toBe(prev);
        expect(prev).toEqual(copy);
    });

    it('restarts the age of a pane that went away and came back', () => {
        const gone = trackSince(prev, [], 1);
        expect(trackSince(gone, [a('p1', 'working')], 2).get('p1')?.since).toBe(2);
    });
});

describe('A2 agentLocation', () => {
    const projects: ProjectRef[] = [
        { path: '/p/app-a', name: 'app-a' },
        { path: '/p/app-a/nested', name: 'nested' },
        { path: '/w/x/app', name: 'app — x' }
    ];
    const cases: [cwd: string, project: string | undefined, location: string][] = [
        ['/p/app-a', '/p/app-a', 'app-a'],
        ['/p/app-a/', '/p/app-a', 'app-a'],
        ['/p/app-a/src/x', '/p/app-a', 'app-a/src/x'],
        ['/p/app-a/nested/lib', '/p/app-a/nested', 'nested/lib'],
        ['/p/app-ab', undefined, 'p/app-ab'],
        ['/w/x/app', '/w/x/app', 'app — x'],
        ['/q/other/deep', undefined, 'other/deep'],
        ['/top', undefined, 'top'],
        ['/', undefined, '/'],
        ['', undefined, '?']
    ];
    it.each(cases)('%j', (cwd, project, location) => {
        expect(agentLocation(cwd, projects)).toEqual({ project, location });
    });
});

describe('A3 agentRows', () => {
    it('orders by status rank', () => {
        const agents = ['idle', 'working', 'done', 'blocked', 'unknown'].map((s, i) => a('abcde'[i], s as AgentStatus));
        expect(agentRows(agents, new Map(), []).map(r => r.status)).toEqual(['blocked', 'done', 'working', 'unknown', 'idle']);
    });

    it('puts the agent that has waited longest first', () => {
        const seen = new Map<string, Seen>([['p1', { kind: 'claude', status: 'blocked', since: 5 }], ['p2', { kind: 'claude', status: 'blocked', since: 2 }]]);
        expect(agentRows([a('p1', 'blocked'), a('p2', 'blocked')], seen, []).map(r => r.paneId)).toEqual(['p2', 'p1']);
    });

    it('breaks ties by pane id with localeCompare', () => {
        const ids = (agents: AgentInfo[]) => agentRows(agents, new Map(), []).map(r => r.paneId);
        expect(ids([a('w1:p2', 'idle'), a('w1:p10', 'idle')])).toEqual(['w1:p10', 'w1:p2']);
        expect(ids([a('w2:p1', 'idle'), a('w1:p1', 'idle')])).toEqual(['w1:p1', 'w2:p1']);
    });

    it('copies since from the map (0 when unseen) and adds project and location', () => {
        const seen = new Map<string, Seen>([['p1', { kind: 'claude', status: 'idle', since: 77 }]]);
        const rows = agentRows([a('p1', 'idle', { cwd: '/p/app-a/src' }), a('p2', 'idle', { cwd: '/q/z' })], seen, [{ path: '/p/app-a', name: 'app-a' }]);
        const row = (id: string) => rows.find(r => r.paneId === id);
        expect(row('p1')).toMatchObject({ paneId: 'p1', since: 77, project: '/p/app-a', location: 'app-a/src' });
        expect(row('p2')).toMatchObject({ paneId: 'p2', since: 0, location: 'q/z' });
        expect(row('p2')?.project).toBeUndefined();
    });
});

describe('A7 needsYou and badgeTooltip', () => {
    it('counts blocked and done', () => {
        expect(needsYou(['blocked', 'blocked', 'done', 'working', 'idle', 'unknown'].map((s, i) => a(`p${i}`, s as AgentStatus)))).toBe(3);
        expect(needsYou([])).toBe(0);
    });

    it('says agent or agents', () => {
        expect(badgeTooltip(1)).toBe('1 agent needs you');
        expect(badgeTooltip(2)).toBe('2 agents need you');
    });
});

describe('A5 formatAge', () => {
    const cases: [number, string][] = [[-5000, '0s'], [0, '0s'], [999, '0s'], [59_999, '59s'], [60_000, '1m'], [3_599_999, '59m'], [3_600_000, '1h'], [26 * 3_600_000, '26h']];
    it.each(cases)('%d ms', (ms, text) => {
        expect(formatAge(ms)).toBe(text);
    });
});

describe('A13 agentsIntervalMs', () => {
    const cases: [unknown, number][] = [[3, 3000], [2.5, 2500], [1, 1000], [0, 1000], [-4, 1000], [undefined, 3000], ['5', 3000], [NaN, 3000], [Infinity, 3000]];
    it.each(cases)('%j', (value, ms) => {
        expect(agentsIntervalMs(value)).toBe(ms);
    });
});

describe('A6 AgentsPoller', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const L = (n: number): AgentList => ({ running: true, agents: [a(`p${n}`, 'idle')] });

    function setup(interval: () => number = () => 1000) {
        const pending: { resolve: (l: AgentList) => void; reject: (e: unknown) => void }[] = [];
        const list = jest.fn(() => new Promise<AgentList>((resolve, reject) => { pending.push({ resolve, reject }); }));
        const onResult = jest.fn();
        const onError = jest.fn();
        const poller = new AgentsPoller(list, interval, onResult, onError);
        return { poller, list, pending, onResult, onError };
    }
    const flush = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

    it('calls at once and again exactly one interval after the response', async () => {
        const { poller, list, pending, onResult } = setup();
        poller.start();
        expect(list).toHaveBeenCalledTimes(1);
        pending[0].resolve(L(1));
        await flush();
        expect(onResult).toHaveBeenCalledWith(L(1));
        await flush(999);
        expect(list).toHaveBeenCalledTimes(1);
        await flush(1);
        expect(list).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('never overlaps: a call that does not settle blocks the next', async () => {
        const { poller, list } = setup();
        poller.start();
        await flush(10_000);
        expect(list).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    it('sends a rejection to onError and carries on', async () => {
        const { poller, list, pending, onResult, onError } = setup();
        poller.start();
        pending[0].reject(new Error('boom'));
        await flush();
        expect(onError).toHaveBeenCalledWith(new Error('boom'));
        expect(onResult).not.toHaveBeenCalled();
        await flush(1000);
        expect(list).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('sends an exception from onResult to onError and carries on', async () => {
        const { poller, list, pending, onResult, onError } = setup();
        onResult.mockImplementation(() => { throw new Error('bad render'); });
        poller.start();
        pending[0].resolve(L(1));
        await flush();
        expect(onError).toHaveBeenCalledWith(new Error('bad render'));
        await flush(1000);
        expect(list).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('reads the interval each time it schedules', async () => {
        const intervals = [1000, 5000];
        const { poller, list, pending } = setup(() => intervals.shift() ?? 5000);
        poller.start();
        pending[0].resolve(L(1));
        await flush(1000);
        expect(list).toHaveBeenCalledTimes(2);
        pending[1].resolve(L(2));
        await flush(4999);
        expect(list).toHaveBeenCalledTimes(2);
        await flush(1);
        expect(list).toHaveBeenCalledTimes(3);
        poller.stop();
    });

    it('refresh() while waiting polls at once and leaves one chain', async () => {
        const { poller, list, pending } = setup();
        poller.start();
        pending[0].resolve(L(1));
        await flush(500);
        poller.refresh();
        expect(list).toHaveBeenCalledTimes(2);
        pending[1].resolve(L(2));
        await flush(1000);
        expect(list).toHaveBeenCalledTimes(3);
        poller.stop();
    });

    it('refresh() while in flight drops the stale response and leaves one chain', async () => {
        const { poller, list, pending, onResult } = setup();
        poller.start();
        poller.refresh();
        expect(list).toHaveBeenCalledTimes(2);
        pending[1].resolve(L(2));
        await flush();
        pending[0].resolve(L(1));
        await flush();
        expect(onResult).toHaveBeenCalledTimes(1);
        expect(onResult).toHaveBeenCalledWith(L(2));
        await flush(1000);
        expect(list).toHaveBeenCalledTimes(3);
        poller.stop();
    });

    it('stop() drops an in-flight response and makes no more calls', async () => {
        const { poller, list, pending, onResult, onError } = setup();
        poller.start();
        poller.stop();
        pending[0].resolve(L(1));
        await flush(10_000);
        expect(onResult).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(list).toHaveBeenCalledTimes(1);
    });

    it('stop() while waiting makes no more calls', async () => {
        const { poller, list, pending } = setup();
        poller.start();
        pending[0].resolve(L(1));
        await flush(500);
        poller.stop();
        await flush(10_000);
        expect(list).toHaveBeenCalledTimes(1);
    });

    it('start() twice calls once; refresh() and stop() before start() do nothing', async () => {
        const { poller, list } = setup();
        poller.refresh();
        poller.stop();
        expect(list).not.toHaveBeenCalled();
        poller.start();
        poller.start();
        expect(list).toHaveBeenCalledTimes(1);
        poller.stop();
    });
});
