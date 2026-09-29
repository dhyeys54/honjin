import { needsMove, placementFor } from './placement';

describe('placementFor', () => {
    it('splits left of herdr when no editor is open', () => {
        expect(placementFor({ editorIds: [], herdrId: 'herdr' })).toEqual({ mode: 'split-left', refId: 'herdr' });
    });
    it('tabs after the most recent editor', () => {
        expect(placementFor({ editorIds: ['a', 'b'], herdrId: 'herdr' })).toEqual({ mode: 'tab-after', refId: 'b' });
    });
    it('has no target when there is neither editor nor herdr', () => {
        expect(placementFor({ editorIds: [] })).toBeUndefined();
    });
});

describe('needsMove', () => {
    it('moves a foreign widget that landed in the herdr group', () => {
        expect(needsMove({ widgetId: 'editor', herdrId: 'herdr', inHerdrGroup: true })).toBe(true);
    });
    it('leaves herdr itself alone', () => {
        expect(needsMove({ widgetId: 'herdr', herdrId: 'herdr', inHerdrGroup: true })).toBe(false);
    });
    it('leaves widgets elsewhere alone', () => {
        expect(needsMove({ widgetId: 'editor', herdrId: 'herdr', inHerdrGroup: false })).toBe(false);
    });
});
