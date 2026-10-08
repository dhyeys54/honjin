import { mostRecentLast, needsMove, placementFor } from './placement';

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

describe('mostRecentLast', () => {
    it('moves the current editor to the end, so a new file opens beside the one in use', () => {
        expect(mostRecentLast(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
    });
    it('keeps creation order when there is no current editor or it is not open', () => {
        expect(mostRecentLast(['a', 'b'], undefined)).toEqual(['a', 'b']);
        expect(mostRecentLast(['a', 'b'], 'gone')).toEqual(['a', 'b']);
    });
});
