import { ChangeInput, LIVE_MS, changeKind, groupChanges, liveFolders, nextExpiry } from './changes';

const NOW = 100_000;
const none = new Map<string, number>();
const input = (path: string, extra: Partial<ChangeInput> = {}): ChangeInput => ({ path, group: 'workingTree', letter: 'M', ...extra });

describe('changes', () => {
    it('C1: groups follow the roots order and drop paths under no root', () => {
        const groups = groupChanges(['/b', '/a'], [input('/a/x.ts'), input('/b/y.ts'), input('/c/z.ts')], none, NOW);
        expect(groups.map(g => g.project)).toEqual(['/b', '/a']);
        expect(groups.flatMap(g => g.files.map(f => f.path))).toEqual(['/b/y.ts', '/a/x.ts']);
    });

    it('C3: a file belongs to its deepest root, empty roots are omitted, name is the last segment', () => {
        const groups = groupChanges(['/p', '/p/inner', '/q'], [input('/p/inner/x.ts'), input('/p/top.ts')], none, NOW);
        expect(groups.map(g => [g.project, g.name, g.files.map(f => f.path)])).toEqual([
            ['/p', 'p', ['/p/top.ts']],
            ['/p/inner', 'inner', ['/p/inner/x.ts']]
        ]);
    });

    it('C4: the same path in index and workingTree is one row with the workingTree letter', () => {
        const groups = groupChanges(['/p'], [
            input('/p/a.ts', { group: 'index', letter: 'A' }),
            input('/p/a.ts', { group: 'workingTree', letter: 'M' })
        ], none, NOW);
        expect(groups[0].files).toHaveLength(1);
        expect(groups[0].files[0].letter).toBe('M');
    });

    it('C5: files sort by their path relative to the project, without a leading slash', () => {
        const groups = groupChanges(['/p'], [input('/p/b/a.ts'), input('/p/a.ts')], none, NOW);
        expect(groups[0].files.map(f => f.rel)).toEqual(['a.ts', 'b/a.ts']);
    });

    it('C6: changeKind maps letters and strikeThrough', () => {
        expect(['A', 'U'].map(l => changeKind(l))).toEqual(['added', 'added']);
        expect(changeKind('D')).toBe('deleted');
        expect(changeKind('!')).toBe('conflict');
        expect(['M', 'R', 'C', 'T'].map(l => changeKind(l))).toEqual(['modified', 'modified', 'modified', 'modified']);
        expect(changeKind('M', true)).toBe('deleted');
    });

    it('C6: a missing letter is M / modified, strikeThrough gives deleted', () => {
        const groups = groupChanges(['/p'], [
            { path: '/p/a.ts', group: 'workingTree' },
            { path: '/p/b.ts', group: 'workingTree', strikeThrough: true }
        ], none, NOW);
        expect(groups[0].files.map(f => [f.letter, f.kind])).toEqual([['M', 'modified'], ['M', 'deleted']]);
    });

    it('C7: a write 29 999 ms ago is live, 30 000 ms ago is not, and the group is live with it', () => {
        const writes = new Map([['/p/a.ts', NOW - 29_999], ['/p/b.ts', NOW - 30_000]]);
        const [g] = groupChanges(['/p'], [input('/p/a.ts'), input('/p/b.ts'), input('/p/c.ts')], writes, NOW);
        expect(g.files.map(f => f.live)).toEqual([true, false, false]);
        expect(g.live).toBe(true);
        expect(LIVE_MS).toBe(30_000);
    });

    it('C7: a write to an unlisted path adds no row and leaves the group not live', () => {
        const writes = new Map([['/p/ghost.ts', NOW - 1]]);
        const [g] = groupChanges(['/p'], [input('/p/a.ts')], writes, NOW);
        expect(g.files.map(f => f.path)).toEqual(['/p/a.ts']);
        expect(g.live).toBe(false);
    });

    it('liveFolders: every ancestor of a live file up to the project, nothing above', () => {
        const writes = new Map([['/p/src/a/x.ts', NOW - 1]]);
        const groups = groupChanges(['/p'], [input('/p/src/a/x.ts'), input('/p/other/y.ts')], writes, NOW);
        expect(liveFolders(groups)).toEqual(new Set(['/p/src/a', '/p/src', '/p']));
    });

    it('nextExpiry: the smallest write + liveMs after now, else undefined', () => {
        const writes = new Map([['/a', NOW - 10_000], ['/b', NOW - 40_000], ['/c', NOW - 2_000]]);
        expect(nextExpiry(writes, NOW)).toBe(NOW - 10_000 + LIVE_MS);
        expect(nextExpiry(new Map([['/b', NOW - 40_000]]), NOW)).toBeUndefined();
        expect(nextExpiry(none, NOW)).toBeUndefined();
    });
});
