import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { HonjinPreferenceKeys, honjinPreferenceSchema } from './preferences-schema';

const expected: Record<string, { type: string; default: unknown }> = {
    'honjin.scanRoots': { type: 'array', default: [] },
    'honjin.extraProjects': { type: 'array', default: [] },
    'honjin.hiddenProjects': { type: 'array', default: [] },
    'honjin.agentCommands': { type: 'object', default: { claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' } },
    'honjin.projectOverrides': { type: 'object', default: {} },
    'honjin.herdr.path': { type: 'string', default: 'herdr' },
    'honjin.herdr.session': { type: 'string', default: '' },
    'honjin.firstRunCompleted': { type: 'boolean', default: false },
    'honjin.resourceMonitor.enabled': { type: 'boolean', default: true },
    'honjin.resourceMonitor.warningPercent': { type: 'number', default: 50 },
    'honjin.resourceMonitor.dangerPercent': { type: 'number', default: 75 },
    'honjin.resourceMonitor.intervalSeconds': { type: 'number', default: 5 },
    'honjin.agents.intervalSeconds': { type: 'number', default: 3 },
    'honjin.updates.check': { type: 'boolean', default: true }
};

describe('honjin preference schema', () => {
    it('declares exactly the keys of spec 05', () => {
        expect(Object.keys(honjinPreferenceSchema.properties).sort()).toEqual(Object.keys(expected).sort());
    });

    for (const [key, want] of Object.entries(expected)) {
        it(`${key} has type ${want.type} and its default`, () => {
            const prop = honjinPreferenceSchema.properties[key];
            expect(prop.type).toBe(want.type);
            expect(prop.default).toEqual(want.default);
        });

        it(`${key} is application (user) scope only`, () => {
            expect(honjinPreferenceSchema.properties[key].scope).toBe(PreferenceScope.User);
        });
    }

    it('list preferences hold strings', () => {
        for (const key of ['honjin.scanRoots', 'honjin.extraProjects', 'honjin.hiddenProjects']) {
            expect(honjinPreferenceSchema.properties[key].items).toEqual({ type: 'string' });
        }
    });

    it('resource monitor numbers carry the ranges of spec 10 R12', () => {
        const p = honjinPreferenceSchema.properties;
        for (const key of ['honjin.resourceMonitor.warningPercent', 'honjin.resourceMonitor.dangerPercent']) {
            expect([p[key].minimum, p[key].maximum]).toEqual([1, 100]);
        }
        expect(p['honjin.resourceMonitor.intervalSeconds'].minimum).toBe(1);
    });

    it('the agents interval is at least one second (spec 12 A13)', () => {
        expect(honjinPreferenceSchema.properties['honjin.agents.intervalSeconds'].minimum).toBe(1);
    });

    it('exposes a typed key constant for every property', () => {
        expect(Object.values(HonjinPreferenceKeys).sort()).toEqual(Object.keys(expected).sort());
    });
});
