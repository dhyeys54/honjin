import { withOverride, resolveStartupCommand } from './startup-command';

const projects = ['/w/app', '/w/app/packages/inner', '/w/other'];

describe('resolveStartupCommand', () => {
    it('uses the owning project override on an exact match', () => {
        expect(resolveStartupCommand('/w/app', projects, { '/w/app': { startupCommand: 'codex' } })).toBe('codex');
    });

    it('uses the override for a nested folder', () => {
        expect(resolveStartupCommand('/w/app/src', projects, { '/w/app': { startupCommand: 'codex' } })).toBe('codex');
    });

    it('does not apply /w/app override to /w/application', () => {
        expect(resolveStartupCommand('/w/application', projects, { '/w/app': { startupCommand: 'codex' } })).toBeUndefined();
    });

    it('honours an empty-string override (plain shell)', () => {
        expect(resolveStartupCommand('/w/app', projects, { '/w/app': { startupCommand: '' } })).toBe('');
    });

    it('returns undefined (the agent picker) when there is no override', () => {
        expect(resolveStartupCommand('/w/other/x', projects, { '/w/app': { startupCommand: 'codex' } })).toBeUndefined();
        expect(resolveStartupCommand('/w/other', projects, { '/w/other': {} })).toBeUndefined();
    });

    it('lets the longest nested project win, without inheriting the outer override', () => {
        const overrides = { '/w/app': { startupCommand: 'outer' } };
        expect(resolveStartupCommand('/w/app/packages/inner/x', projects, overrides)).toBeUndefined();
        expect(resolveStartupCommand('/w/app/packages/inner/x', projects, { ...overrides, '/w/app/packages/inner': { startupCommand: 'inner' } })).toBe('inner');
    });

    it('returns undefined when no project owns the folder', () => {
        expect(resolveStartupCommand('/elsewhere', projects, { '/w/app': { startupCommand: 'codex' } })).toBeUndefined();
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
