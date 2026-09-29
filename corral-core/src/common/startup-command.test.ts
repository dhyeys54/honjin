import { withOverride, owningProject, resolveStartupCommand } from './startup-command';

const projects = ['/w/app', '/w/app/packages/inner', '/w/other'];

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

describe('resolveStartupCommand', () => {
    it('uses the owning project override on an exact match', () => {
        expect(resolveStartupCommand('/w/app', projects, 'claude', { '/w/app': { startupCommand: 'codex' } })).toBe('codex');
    });

    it('uses the override for a nested folder', () => {
        expect(resolveStartupCommand('/w/app/src', projects, 'claude', { '/w/app': { startupCommand: 'codex' } })).toBe('codex');
    });

    it('does not apply /w/app override to /w/application', () => {
        expect(resolveStartupCommand('/w/application', projects, 'claude', { '/w/app': { startupCommand: 'codex' } })).toBe('claude');
    });

    it('honours an empty-string override (plain shell)', () => {
        expect(resolveStartupCommand('/w/app', projects, 'claude', { '/w/app': { startupCommand: '' } })).toBe('');
    });

    it('falls back to global when there is no override', () => {
        expect(resolveStartupCommand('/w/other/x', projects, 'claude', { '/w/app': { startupCommand: 'codex' } })).toBe('claude');
        expect(resolveStartupCommand('/w/other', projects, 'claude', { '/w/other': {} })).toBe('claude');
    });

    it('lets the longest nested project win, without inheriting the outer override', () => {
        const overrides = { '/w/app': { startupCommand: 'outer' } };
        expect(resolveStartupCommand('/w/app/packages/inner/x', projects, 'claude', overrides)).toBe('claude');
        expect(resolveStartupCommand('/w/app/packages/inner/x', projects, 'claude', { ...overrides, '/w/app/packages/inner': { startupCommand: 'inner' } })).toBe('inner');
    });

    it('returns global when no project owns the folder', () => {
        expect(resolveStartupCommand('/elsewhere', projects, 'claude', { '/w/app': { startupCommand: 'codex' } })).toBe('claude');
    });
});

describe('withOverride', () => {
    it('sets, keeps an explicit empty string, and drops', () => {
        expect(withOverride({}, '/p/a', 'x')).toEqual({ '/p/a': { startupCommand: 'x' } });
        expect(withOverride({ '/p/a': { startupCommand: 'x' } }, '/p/a', '')).toEqual({ '/p/a': { startupCommand: '' } });
        expect(withOverride({ '/p/a': { startupCommand: 'x' }, '/p/b': { startupCommand: 'y' } }, '/p/a', undefined))
            .toEqual({ '/p/b': { startupCommand: 'y' } });
    });
});
