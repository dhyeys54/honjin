import { herdrClientEnv } from './herdr-client-env';

describe('herdrClientEnv', () => {
    it('sets HOME so herdr finds its socket under ~/.config/herdr', () => {
        expect(herdrClientEnv('/Users/me').HOME).toBe('/Users/me');
    });

    it('passes no HERDR_* keys: herdr reads an empty HERDR_SOCKET_PATH as a socket path and never attaches', () => {
        expect(Object.keys(herdrClientEnv('/Users/me')).filter(k => k.startsWith('HERDR_'))).toEqual([]);
    });

    it('passes no empty values', () => {
        expect(Object.values(herdrClientEnv('/Users/me'))).not.toContain('');
    });
});
