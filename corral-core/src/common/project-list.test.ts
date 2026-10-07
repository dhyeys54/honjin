import { addProblem, addProblems, buildProjectList, ProjectListInput, visibleRoots } from './project-list';

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

    it('leaves out a folder that holds other projects, even hidden ones, so a scan root is never loaded whole', () => {
        const list = buildProjectList(input({ scanned: ['/w/a', '/w/b'], extra: ['/w'], hidden: ['/w/b'], showHidden: true }));
        expect(visibleRoots(list)).toEqual(['/w/a']);
        expect(visibleRoots(buildProjectList(input({ scanned: ['/w/b'], extra: ['/w'], hidden: ['/w/b'], showHidden: true })))).toEqual([]);
    });

    it('does not confuse a sibling that shares a name prefix with a parent', () => {
        const list = buildProjectList(input({ scanned: ['/w/app', '/w/app-two'] }));
        expect(visibleRoots(list)).toEqual(['/w/app', '/w/app-two']);
    });
});

describe('addProblem', () => {
    const list = buildProjectList(input({ scanned: ['/w/a', '/w/b', '/w/c', '/w/d'], hidden: ['/w/d'], showHidden: true }));

    it('accepts an unrelated folder', () => {
        expect(addProblem('/x/new', list)).toBeUndefined();
    });

    it('refuses a folder that holds listed projects, naming a few', () => {
        expect(addProblem('/w/', list)).toBe('w holds 4 listed projects (a, b, c, …). Add a single project folder instead.');
    });

    it('refuses a folder inside a listed project', () => {
        expect(addProblem('/w/a/src', list)).toBe('src is inside the project a.');
    });

    it('refuses a folder that is already listed', () => {
        expect(addProblem('/w/b', list)).toBe('b is already in the list.');
    });
});

describe('addProblems', () => {
    const list = [{ path: '/w/a', name: 'a', hidden: false, missing: false, manual: false }];

    it('accepts independent picks and reports each problem pick', () => {
        expect(addProblems(['/x/new', '/w/a', '/w/a/src'], list)).toEqual({
            ok: ['/x/new'],
            problems: ['a is already in the list.', 'src is inside the project a.']
        });
    });

    it('checks picks against each other: a folder and one inside it are not both added', () => {
        expect(addProblems(['/x', '/x/y'], list)).toEqual({ ok: ['/x'], problems: ['y is inside the project x.'] });
        expect(addProblems(['/x/y', '/x'], list)).toEqual({ ok: ['/x/y'], problems: ['x holds 1 listed projects (y). Add a single project folder instead.'] });
    });
});
