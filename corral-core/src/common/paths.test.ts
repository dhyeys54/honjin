import { isInside, trimSlash } from './paths';

describe('paths', () => {
    it('trimSlash drops trailing slashes and keeps a bare /', () => {
        expect(trimSlash('/w/a/')).toBe('/w/a');
        expect(trimSlash('/w/a//')).toBe('/w/a');
        expect(trimSlash('/w/a')).toBe('/w/a');
        expect(trimSlash('/')).toBe('/');
        expect(trimSlash('//')).toBe('/');
    });

    it('isInside is true only strictly below a folder, on a path boundary', () => {
        expect(isInside('/w/a/src', '/w/a')).toBe(true);
        expect(isInside('/w/a/src', '/w/a/')).toBe(true);
        expect(isInside('/w/a', '/w/a')).toBe(false);
        expect(isInside('/w/ab', '/w/a')).toBe(false);
        expect(isInside('/w', '/')).toBe(true);
        expect(isInside('/', '/')).toBe(false);
    });
});
