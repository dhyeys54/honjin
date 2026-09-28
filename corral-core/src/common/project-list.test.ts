import { buildProjectList, ProjectListInput, visibleRoots } from './project-list';

const input = (over: Partial<ProjectListInput> = {}): ProjectListInput => ({
    scanned: [], extra: [], hidden: [], showHidden: false, missing: [], ...over
});
const paths = (i: Partial<ProjectListInput>) => buildProjectList(input(i)).map(e => e.path);

describe('buildProjectList', () => {
    it('1: unions scanned and extra after normalising trailing slashes', () => {
        expect(paths({ scanned: ['/w/a/', '/w/b'], extra: ['/w/b/', '/w/c'] })).toEqual(['/w/a', '/w/b', '/w/c']);
    });

    it('2: manual is true iff the path is in extra, even if also scanned', () => {
        const list = buildProjectList(input({ scanned: ['/w/a', '/w/b'], extra: ['/w/b', '/w/c'] }));
        expect(list.map(e => [e.name, e.manual])).toEqual([['a', false], ['b', true], ['c', true]]);
    });

    it('3: leaves hidden projects out unless showHidden, then flags them', () => {
        const base = { scanned: ['/w/a', '/w/b'], hidden: ['/w/b'] };
        expect(paths(base)).toEqual(['/w/a']);
        const shown = buildProjectList(input({ ...base, showHidden: true }));
        expect(shown.map(e => [e.path, e.hidden])).toEqual([['/w/a', false], ['/w/b', true]]);
    });

    it('4: always includes missing projects with missing: true, even hidden ones', () => {
        const list = buildProjectList(input({ extra: ['/w/gone'], hidden: ['/w/gone'], missing: ['/w/gone'] }));
        expect(list).toEqual([{ path: '/w/gone', name: 'gone', hidden: true, missing: true, manual: true }]);
    });

    it('5: name is the last segment; duplicates are shown as "name — parent"', () => {
        const list = buildProjectList(input({ scanned: ['/x/work/api', '/x/home/api', '/x/home/web'] }));
        expect(list.map(e => e.name)).toEqual(['api — home', 'api — work', 'web']);
    });

    it('6: sorts by name case-insensitively, then by path', () => {
        expect(paths({ scanned: ['/w/b', '/w/B2', '/w/a', '/z/a'] })).toEqual(['/w/a', '/z/a', '/w/b', '/w/B2']);
    });

    it('7: never contains duplicate paths', () => {
        expect(paths({ scanned: ['/w/a', '/w/a/'], extra: ['/w/a'] })).toEqual(['/w/a']);
    });
});

describe('visibleRoots', () => {
    it('leaves out hidden and missing entries', () => {
        const list = buildProjectList(input({
            scanned: ['/w/a', '/w/b', '/w/c'], hidden: ['/w/b'], missing: ['/w/c'], showHidden: true
        }));
        expect(visibleRoots(list)).toEqual(['/w/a']);
    });
});
