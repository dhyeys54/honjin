import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HerdrError } from '../common/protocol';
import { HonjinHerdrServiceImpl, HerdrClient } from './honjin-herdr-service';
import { WorkspaceMapStore } from './workspace-map-store';

function setup(over: Partial<HerdrClient> = {}) {
    const calls: string[] = [];
    let ws = 0;
    let tabs = 0;
    const known = new Set<string>();
    const cli: HerdrClient = {
        status: async () => ({ running: true, version: '1', protocol: 1 }),
        createWorkspace: async (cwd, label) => {
            await new Promise(r => setTimeout(r, 5)); // widen the race window for the concurrency test
            const id = `w${++ws}`;
            known.add(id);
            calls.push(`createWorkspace ${cwd} ${label}`);
            return { workspaceId: id, tabId: `${id}:t1`, paneId: `${id}:p1` };
        },
        getWorkspace: async id => known.has(id) ? { workspaceId: id, label: 'x' } : undefined,
        focusWorkspace: async id => { calls.push(`focus ${id}`); },
        createTab: async (id, cwd, label) => {
            calls.push(`createTab ${id} ${cwd} ${label}`);
            const n = ++tabs;
            return { tabId: `${id}:t${n + 1}`, paneId: `${id}:p${n + 1}` };
        },
        runInPane: async (pane, cmd) => { calls.push(`run ${pane} ${cmd}`); },
        ...over
    };
    const store = new WorkspaceMapStore(join(mkdtempSync(join(tmpdir(), 'honjin-svc-')), 'm.json'), () => undefined);
    const service = new HonjinHerdrServiceImpl(async () => ({ cli, session: 's' }), store);
    return { service, calls, known, store };
}
const req = (over = {}) => ({ projectPath: '/p/app', folderPath: '/p/app/src', command: 'claude', ...over });

describe('HonjinHerdrServiceImpl.openTab', () => {
    it('throws server_not_running when the server is down', async () => {
        const { service } = setup({ status: async () => ({ running: false, version: null, protocol: null }) });
        await expect(service.openTab(req())).rejects.toMatchObject({ code: 'server_not_running' });
        await expect(service.openTab(req())).rejects.toBeInstanceOf(HerdrError);
    });

    it('first call creates the workspace in the clicked folder and uses its root pane', async () => {
        const { service, calls } = setup();
        const r = await service.openTab(req());
        expect(r).toEqual({ workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1', createdWorkspace: true });
        expect(calls).toEqual(['createWorkspace /p/app/src app', 'focus w1', 'run w1:p1 claude']);
    });

    it('second call reuses the workspace and creates a tab', async () => {
        const { service, calls } = setup();
        await service.openTab(req());
        calls.length = 0;
        const r = await service.openTab(req({ folderPath: '/p/app/lib' }));
        expect(r).toMatchObject({ workspaceId: 'w1', createdWorkspace: false, paneId: 'w1:p2' });
        expect(calls).toEqual(['createTab w1 /p/app/lib lib', 'focus w1', 'run w1:p2 claude']);
    });

    it('an empty command skips runInPane', async () => {
        const { service, calls } = setup();
        await service.openTab(req({ command: '  ' }));
        expect(calls.some(c => c.startsWith('run'))).toBe(false);
    });

    it('two concurrent calls for the same project create exactly one workspace', async () => {
        const { service, calls } = setup();
        await Promise.all([service.openTab(req()), service.openTab(req({ folderPath: '/p/app/lib' }))]);
        expect(calls.filter(c => c.startsWith('createWorkspace'))).toHaveLength(1);
        expect(calls.filter(c => c.startsWith('createTab'))).toHaveLength(1);
    });

    it('recreates a workspace whose mapping went stale', async () => {
        const { service, calls, known } = setup();
        await service.openTab(req());
        known.clear(); // the user closed it in herdr
        calls.length = 0;
        const r = await service.openTab(req());
        expect(r).toMatchObject({ workspaceId: 'w2', createdWorkspace: true });
        expect(calls[0]).toBe('createWorkspace /p/app/src app');
    });

    it('never adopts a herdr workspace it did not create', async () => {
        const { service, calls } = setup({ getWorkspace: async id => ({ workspaceId: id, label: 'app' }) });
        const r = await service.openTab(req());
        expect(r.createdWorkspace).toBe(true); // no mapping, so create even though "app" exists
        expect(calls[0]).toContain('createWorkspace');
    });
});

describe('HonjinHerdrServiceImpl.resolveBinary', () => {
    it('delegates to the resolver', async () => {
        const service = new HonjinHerdrServiceImpl(
            async () => { throw new Error('unused'); }, undefined as never, async () => ({ binary: '/bin/herdr', session: 's' }));
        expect(await service.resolveBinary()).toEqual({ binary: '/bin/herdr', session: 's' });
    });
});

describe('HonjinHerdrServiceImpl.status', () => {
    it('reports running', async () => {
        expect(await setup().service.status()).toEqual({ running: true });
    });
});
