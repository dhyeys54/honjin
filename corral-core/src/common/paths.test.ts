import { basename, isInside, owningProject, trimSlash } from './paths';

const projects = ['/w/app', '/w/app/packages/inner', '/w/other'];

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

describe('owningProject', () => {
    it('matches the project folder itself', () => {
        expect(owningProject('/w/other', projects)).toBe('/w/other');
    });

    it('matches a nested folder', () => {
        expect(owningProject('/w/other/src/deep', projects)).toBe('/w/other');
    });

    it('only matches at a path boundary', () => {
        expect(owningProject('/w/application', projects)).toBeUndefined();
    });

    it('prefers the longest project when projects are nested', () => {
        expect(owningProject('/w/app/packages/inner/src', projects)).toBe('/w/app/packages/inner');
        expect(owningProject('/w/app/src', projects)).toBe('/w/app');
    });
});

describe('basename', () => {
    it('gives the last segment, ignoring trailing slashes', () => {
        expect(['/a/b', '/a/b/', 'b', '/'].map(basename)).toEqual(['b', 'b', 'b', '']);
    });
});
