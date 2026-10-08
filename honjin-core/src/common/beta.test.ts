import { compareVersions, isNewRelease, issueBody, issueUrl } from './beta';

describe('compareVersions (spec 13 S12)', () => {
    it.each([
        ['0.1.0-beta.2', '0.1.0-beta.1', 1],
        ['0.1.0', '0.1.0-beta.9', 1],
        ['0.1.0-beta.10', '0.1.0-beta.9', 1],
        ['0.2.0', '0.1.10', 1],
        ['0.1.0-beta.1', '0.1.0', -1],
        ['v0.1.0-beta.1', '0.1.0-beta.1', 0],
        ['1.0.0', '1.0.0', 0]
    ])('%s vs %s is %d', (a, b, expected) => {
        expect(Math.sign(compareVersions(a, b))).toBe(expected);
    });
});

describe('issueBody / issueUrl (S11)', () => {
    const env = {
        honjin: '0.1.0-beta.1', macos: '15.6', arch: 'arm64',
        tools: [
            { id: 'herdr', found: true, path: '/Users/someone/.local/bin/herdr', version: 'herdr 0.9.1' },
            { id: 'claude', found: true, path: '/Users/someone/.local/bin/claude', version: '2.1.211 (Claude Code)' },
            { id: 'codex', found: false, version: '' },
            { id: 'git', found: true, version: 'git version 2.50.1' }
        ]
    };

    it('lists versions and leaves out paths', () => {
        const body = issueBody(env);
        for (const v of ['0.1.0-beta.1', '15.6', 'arm64', 'herdr 0.9.1', '2.1.211 (Claude Code)']) {
            expect(body).toContain(v);
        }
        expect(body).not.toContain('/Users');
        expect(body).not.toContain('codex');
        expect(body).not.toContain('git version'); // S11: herdr and the agents only
    });

    it('builds the prefilled bug URL', () => {
        const url = new URL(issueUrl('a b&c'));
        expect(url.origin + url.pathname).toBe('https://github.com/dhyeys54/honjin/issues/new');
        expect(url.searchParams.get('template')).toBe('bug.yml');
        expect(url.searchParams.get('body')).toBe('a b&c');
    });
});

describe('isNewRelease (S12)', () => {
    it('announces a newer tag once', () => {
        const announced = new Set<string>();
        expect(isNewRelease('v0.1.0-beta.2', '0.1.0-beta.1', announced)).toBe(true);
        announced.add('v0.1.0-beta.2');
        expect(isNewRelease('v0.1.0-beta.2', '0.1.0-beta.1', announced)).toBe(false);
    });

    it('ignores the running version, an older one, and no answer', () => {
        expect(isNewRelease('v0.1.0-beta.1', '0.1.0-beta.1', new Set())).toBe(false);
        expect(isNewRelease('v0.0.9', '0.1.0-beta.1', new Set())).toBe(false);
        expect(isNewRelease(undefined, '0.1.0-beta.1', new Set())).toBe(false);
    });
});
