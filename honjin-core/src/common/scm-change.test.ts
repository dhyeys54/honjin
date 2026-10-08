import { pickChanges } from './scm-change';

const group = (id: string, ...uris: string[]) => ({ id, resources: uris.map(sourceUri => ({ sourceUri, id })) });

describe('pickChanges', () => {
    it('finds the change for each file, and none for an unchanged one', () => {
        const picked = pickChanges([group('workingTree', 'file:///p/a.ts', 'file:///p/b.ts')]);
        expect(picked.get('file:///p/b.ts')?.sourceUri).toBe('file:///p/b.ts');
        expect(picked.get('file:///p/c.ts')).toBeUndefined();
    });

    it('prefers the working-tree change over the staged one, since it is newer', () => {
        const groups = [group('index', 'file:///p/a.ts'), group('workingTree', 'file:///p/a.ts')];
        expect(pickChanges(groups).get('file:///p/a.ts')?.id).toBe('workingTree');
    });

    it('falls back to the staged change', () => {
        expect(pickChanges([group('index', 'file:///p/a.ts')]).get('file:///p/a.ts')?.id).toBe('index');
    });
});
