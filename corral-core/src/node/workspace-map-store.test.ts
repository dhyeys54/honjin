import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkspaceMapStore } from './workspace-map-store';

const tmp = () => mkdtempSync(join(tmpdir(), 'corral-map-'));

describe('WorkspaceMapStore', () => {
    it('round-trips a mapping through the file', async () => {
        const file = join(tmp(), 'herdr-workspaces.json');
        await new WorkspaceMapStore(file, () => undefined).set('/p/a', 's1', 'w1');
        expect(await new WorkspaceMapStore(file, () => undefined).get('/p/a', 's1')).toBe('w1');
        expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ '/p/a': { workspaceId: 'w1', session: 's1' } });
    });

    it('treats a missing file as empty without warning', async () => {
        const warn = jest.fn();
        expect(await new WorkspaceMapStore(join(tmp(), 'nope.json'), warn).get('/p/a', '')).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
    });

    it('treats a corrupt file as empty, warns, and can still be written', async () => {
        const file = join(tmp(), 'm.json');
        writeFileSync(file, '{not json');
        const warn = jest.fn();
        const store = new WorkspaceMapStore(file, warn);
        expect(await store.get('/p/a', '')).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        await store.set('/p/a', '', 'w2');
        expect(await store.get('/p/a', '')).toBe('w2');
    });

    it('rejects on a read error other than a missing file, so a later write cannot wipe the other entries', async () => {
        const dir = tmp(); // a directory where the file should be: readFile fails with EISDIR, not ENOENT
        const store = new WorkspaceMapStore(dir, () => undefined);
        await expect(store.get('/p/a', '')).rejects.toThrow();
        await expect(store.set('/p/a', '', 'w1')).rejects.toThrow();
    });

    it('writes atomically: no temp files are left behind', async () => {
        const dir = tmp();
        await new WorkspaceMapStore(join(dir, 'm.json'), () => undefined).set('/p/a', '', 'w1');
        expect(readdirSync(dir)).toEqual(['m.json']);
    });

    it('does not reuse an id recorded for another session', async () => {
        const store = new WorkspaceMapStore(join(tmp(), 'm.json'), () => undefined);
        await store.set('/p/a', 'one', 'w1');
        expect(await store.get('/p/a', 'two')).toBeUndefined();
        expect(await store.get('/p/a', 'one')).toBe('w1');
    });

    it('keeps other projects when one is updated', async () => {
        const store = new WorkspaceMapStore(join(tmp(), 'm.json'), () => undefined);
        await store.set('/p/a', '', 'w1');
        await store.set('/p/b', '', 'w2');
        expect(await store.get('/p/a', '')).toBe('w1');
    });

    it('forgets one mapping and keeps the others', async () => {
        const file = join(tmp(), 'm.json');
        const store = new WorkspaceMapStore(file, () => undefined);
        await store.set('/p/a', '', 'w1');
        await store.set('/p/b', '', 'w2');
        await store.delete('/p/a');
        expect(await store.get('/p/a', '')).toBeUndefined();
        expect(await store.get('/p/b', '')).toBe('w2');
        await store.delete('/p/never'); // no-op, no throw
    });

    it('concurrent writes for different projects both persist', async () => {
        const s = new WorkspaceMapStore(join(tmp(), 'm.json'), () => undefined);
        await Promise.all([s.set('/p/a', 'default', 'wa'), s.set('/p/b', 'default', 'wb'), s.delete('/p/c')]);
        expect(await s.get('/p/a', 'default')).toBe('wa');
        expect(await s.get('/p/b', 'default')).toBe('wb');
    });
});
