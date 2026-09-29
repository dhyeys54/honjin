import { pickChange } from './scm-change';

const group = (id: string, ...uris: string[]) => ({ id, resources: uris.map(sourceUri => ({ sourceUri, id })) });

describe('pickChange', () => {
    it('finds the change for a file', () => {
        expect(pickChange([group('workingTree', 'file:///p/a.ts', 'file:///p/b.ts')], 'file:///p/b.ts')?.sourceUri).toBe('file:///p/b.ts');
    });

    it('returns undefined for an unchanged file', () => {
        expect(pickChange([group('workingTree', 'file:///p/a.ts')], 'file:///p/c.ts')).toBeUndefined();
    });

    it('prefers the working-tree change over the staged one, since it is newer', () => {
        const groups = [group('index', 'file:///p/a.ts'), group('workingTree', 'file:///p/a.ts')];
        expect(pickChange(groups, 'file:///p/a.ts')?.id).toBe('workingTree');
    });

    it('falls back to the staged change', () => {
        expect(pickChange([group('index', 'file:///p/a.ts')], 'file:///p/a.ts')?.id).toBe('index');
    });
});
