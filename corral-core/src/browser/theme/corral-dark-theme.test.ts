import * as theme from './corral-dark-color-theme.json';
import { colors } from '../../common/design-tokens';

const groups = ['editor', 'sideBar', 'activityBar', 'tab', 'panel', 'terminal', 'list', 'focusBorder', 'button', 'input', 'statusBar', 'titleBar'];
const ansi = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
const tokenValues = new Set<string>(Object.values(colors));
// A token value, optionally followed by a two-hex-digit alpha.
const isToken = (c: string) => tokenValues.has(c.slice(0, 7).toLowerCase()) && (c.length === 7 || (c.length === 9 && /^[0-9a-f]{2}$/i.test(c.slice(7))));

describe('Corral Dark theme', () => {
    it.each(groups)('defines the %s colours', group => {
        expect(Object.keys(theme.colors).some(k => k === group || k.startsWith(group + '.') || k.startsWith(group + 'Cursor'))).toBe(true);
    });
    it('defines all 16 ANSI colours', () => {
        for (const n of ansi) {
            expect(theme.colors).toHaveProperty(['terminal.ansi' + n]);
            expect(theme.colors).toHaveProperty(['terminal.ansiBright' + n]);
        }
    });
    it('uses only DESIGN.md tokens', () => {
        const all = [...Object.values(theme.colors), ...theme.tokenColors.map(t => t.settings.foreground)];
        expect(all.filter(c => !isToken(c))).toEqual([]);
    });
});
