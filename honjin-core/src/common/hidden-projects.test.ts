import { withHidden } from './hidden-projects';

describe('withHidden', () => {
    it('adds a path once', () => {
        expect(withHidden(['/a'], '/b', true)).toEqual(['/a', '/b']);
        expect(withHidden(['/a', '/b'], '/b', true)).toEqual(['/a', '/b']);
    });
    it('removes a path and leaves the others', () => {
        expect(withHidden(['/a', '/b'], '/a', false)).toEqual(['/b']);
        expect(withHidden(['/a'], '/x', false)).toEqual(['/a']);
    });
});
