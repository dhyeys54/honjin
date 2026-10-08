import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readSettings } from './read-settings';

function dirWith(text?: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'honjin-settings-'));
    if (text !== undefined) {
        writeFileSync(join(dir, 'settings.json'), text);
    }
    return dir;
}

describe('readSettings', () => {
    it('reads plain JSON', async () => {
        expect(await readSettings(dirWith('{"honjin.herdr.session":"s"}'))).toEqual({ 'honjin.herdr.session': 's' });
    });

    it('reads JSONC: comments and trailing commas keep the herdr settings', async () => {
        const text = '{\n  // my session\n  "honjin.herdr.session": "work", /* x */\n  "honjin.herdr.path": "http://x//y",\n}\n';
        expect(await readSettings(dirWith(text))).toEqual({ 'honjin.herdr.session': 'work', 'honjin.herdr.path': 'http://x//y' });
    });

    it('gives {} for a missing file, garbage, or a non-object', async () => {
        expect(await readSettings(dirWith())).toEqual({});
        expect(await readSettings(dirWith('{{{'))).toEqual({});
        expect(await readSettings(dirWith('[1]'))).toEqual({});
    });
});
