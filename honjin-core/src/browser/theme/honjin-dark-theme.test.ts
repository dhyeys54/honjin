import * as theme from './honjin-dark-color-theme.json';
import { colors } from '../../common/design-tokens';

// One key that must exist per group of spec 06.
const groups = ['editor.background', 'sideBar.background', 'activityBar.background', 'tab.activeBackground', 'panel.background', 'terminal.foreground',
    'list.activeSelectionBackground', 'focusBorder', 'button.background', 'input.background', 'statusBar.background', 'titleBar.activeBackground'];
const ansi = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
const tokenValues = new Set<string>(Object.values(colors));
// A token value, optionally followed by a two-hex-digit alpha.
const isToken = (c: string) => tokenValues.has(c.slice(0, 7).toLowerCase()) && (c.length === 7 || (c.length === 9 && /^[0-9a-f]{2}$/i.test(c.slice(7))));

describe('Honjin Dark theme', () => {
    it.each(groups)('defines %s', key => {
        expect(theme.colors).toHaveProperty([key]);
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
