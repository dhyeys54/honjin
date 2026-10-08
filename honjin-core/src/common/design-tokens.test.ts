import { readFileSync } from 'fs';
import { join } from 'path';
import { colors } from './design-tokens';

describe('design tokens', () => {
    it('equal the colors block of DESIGN.md', () => {
        const md = readFileSync(join(__dirname, '../../../DESIGN.md'), 'utf8');
        const block = md.split('\ncolors:\n')[1].split(/\n\S/)[0];
        const parsed: Record<string, string> = {};
        for (const line of block.split('\n')) {
            const m = /^ {2}([\w-]+): "(#[0-9a-fA-F]{6})"/.exec(line);
            if (m) {
                parsed[m[1]] = m[2].toLowerCase();
            }
        }
        expect(colors).toEqual(parsed);
    });
});
