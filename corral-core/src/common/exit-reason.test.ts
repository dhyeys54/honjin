import { exitReason } from './exit-reason';

describe('exitReason', () => {
    it('returns the last non-empty line with escape sequences removed', () => {
        const out = '\x1b[?1049h\x1b[2Jloading\r\n\x1b[31mherdr: server did not become ready within 15s\x1b[0m\r\n\r\n';
        expect(exitReason(out)).toBe('herdr: server did not become ready within 15s');
    });

    it('drops OSC sequences such as window titles', () => {
        expect(exitReason('\x1b]0;herdr\x07boom\n')).toBe('boom');
    });

    it('is undefined when nothing readable was printed', () => {
        expect(exitReason('\x1b[?1049l\r\n  \n')).toBeUndefined();
    });

    it('caps very long lines', () => {
        expect(exitReason('x'.repeat(500))!.length).toBe(200);
    });
});
