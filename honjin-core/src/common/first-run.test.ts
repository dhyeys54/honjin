import { abbreviateHome, shouldRunFirstRun, showPlusHint } from './first-run';

describe('shouldRunFirstRun', () => {
    const base = { firstRunCompleted: false, scanRoots: [], extraProjects: [] };
    it('runs on a fresh profile', () => expect(shouldRunFirstRun(base)).toBe(true));
    it('does not run once completed', () => expect(shouldRunFirstRun({ ...base, firstRunCompleted: true })).toBe(false));
    it('does not run when scan roots exist', () => expect(shouldRunFirstRun({ ...base, scanRoots: ['~/p'] })).toBe(false));
    it('does not run when extra projects exist', () => expect(shouldRunFirstRun({ ...base, extraProjects: ['/x'] })).toBe(false));
});

describe('abbreviateHome', () => {
    it('abbreviates the home directory itself', () => expect(abbreviateHome('/Users/a', '/Users/a')).toBe('~'));
    it('abbreviates paths below home', () => expect(abbreviateHome('/Users/a/p', '/Users/a')).toBe('~/p'));
    it('leaves lookalike siblings alone', () => expect(abbreviateHome('/Users/ab/p', '/Users/a')).toBe('/Users/ab/p'));
    it('leaves other paths alone', () => expect(abbreviateHome('/opt/p', '/Users/a')).toBe('/opt/p'));
});

describe('showPlusHint (spec 13 S7)', () => {
    it('shows once setup turned ready after a wait', () => expect(showPlusHint({ waited: true, firstRun: false, ready: true })).toBe(true));
    it('shows after a first run with setup ready', () => expect(showPlusHint({ waited: false, firstRun: true, ready: true })).toBe(true));
    it('stays quiet on an ordinary start', () => expect(showPlusHint({ waited: false, firstRun: false, ready: true })).toBe(false));
    it('stays quiet after Continue anyway: + has nothing to start yet', () => {
        expect(showPlusHint({ waited: true, firstRun: true, ready: false })).toBe(false);
    });
});
