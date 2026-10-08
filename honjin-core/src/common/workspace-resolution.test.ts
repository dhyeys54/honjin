import { resolveWorkspace } from './workspace-resolution';

describe('resolveWorkspace', () => {
    it('reuses a mapped workspace that still exists', () => {
        expect(resolveWorkspace('w1', true)).toEqual({ kind: 'reuse', workspaceId: 'w1' });
    });

    it('creates when there is no mapping', () => {
        expect(resolveWorkspace(undefined, false)).toEqual({ kind: 'create' });
    });

    it('creates when the mapped workspace no longer exists', () => {
        expect(resolveWorkspace('w1', false)).toEqual({ kind: 'create' });
    });
});
