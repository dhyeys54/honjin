import { abbreviateHome, shouldRunFirstRun } from './first-run';

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
