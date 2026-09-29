import { diffRoots } from './roots-diff';

describe('diffRoots', () => {
    it('lists what to add and what to remove', () => {
        expect(diffRoots(['/a', '/b'], ['/b', '/c'])).toEqual({ add: ['/c'], remove: ['/a'] });
    });
    it('is a no-op when the sets are equal, whatever the order', () => {
        expect(diffRoots(['/a', '/b'], ['/b', '/a'])).toEqual({ add: [], remove: [] });
    });
    it('adds everything to an empty workspace', () => {
        expect(diffRoots([], ['/b', '/a'])).toEqual({ add: ['/b', '/a'], remove: [] });
    });
    it('ignores trailing slashes', () => {
        expect(diffRoots(['/a/'], ['/a'])).toEqual({ add: [], remove: [] });
    });
});
