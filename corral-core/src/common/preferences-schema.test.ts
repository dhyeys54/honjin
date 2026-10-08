import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { CorralPreferenceKeys, corralPreferenceSchema } from './preferences-schema';

const expected: Record<string, { type: string; default: unknown }> = {
    'corral.scanRoots': { type: 'array', default: [] },
    'corral.extraProjects': { type: 'array', default: [] },
    'corral.hiddenProjects': { type: 'array', default: [] },
    'corral.agentCommands': { type: 'object', default: { claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' } },
    'corral.projectOverrides': { type: 'object', default: {} },
    'corral.herdr.path': { type: 'string', default: 'herdr' },
    'corral.herdr.session': { type: 'string', default: '' },
    'corral.firstRunCompleted': { type: 'boolean', default: false },
    'corral.resourceMonitor.enabled': { type: 'boolean', default: true },
    'corral.resourceMonitor.warningPercent': { type: 'number', default: 50 },
    'corral.resourceMonitor.dangerPercent': { type: 'number', default: 75 },
    'corral.resourceMonitor.intervalSeconds': { type: 'number', default: 5 },
    'corral.agents.intervalSeconds': { type: 'number', default: 3 }
};

describe('corral preference schema', () => {
    it('declares exactly the keys of spec 05', () => {
        expect(Object.keys(corralPreferenceSchema.properties).sort()).toEqual(Object.keys(expected).sort());
    });

    for (const [key, want] of Object.entries(expected)) {
        it(`${key} has type ${want.type} and its default`, () => {
            const prop = corralPreferenceSchema.properties[key];
            expect(prop.type).toBe(want.type);
            expect(prop.default).toEqual(want.default);
        });

        it(`${key} is application (user) scope only`, () => {
            expect(corralPreferenceSchema.properties[key].scope).toBe(PreferenceScope.User);
        });
    }

    it('list preferences hold strings', () => {
        for (const key of ['corral.scanRoots', 'corral.extraProjects', 'corral.hiddenProjects']) {
            expect(corralPreferenceSchema.properties[key].items).toEqual({ type: 'string' });
        }
    });

    it('resource monitor numbers carry the ranges of spec 10 R12', () => {
        const p = corralPreferenceSchema.properties;
        for (const key of ['corral.resourceMonitor.warningPercent', 'corral.resourceMonitor.dangerPercent']) {
            expect([p[key].minimum, p[key].maximum]).toEqual([1, 100]);
        }
        expect(p['corral.resourceMonitor.intervalSeconds'].minimum).toBe(1);
    });

    it('the agents interval is at least one second (spec 12 A13)', () => {
        expect(corralPreferenceSchema.properties['corral.agents.intervalSeconds'].minimum).toBe(1);
    });

    it('exposes a typed key constant for every property', () => {
        expect(Object.values(CorralPreferenceKeys).sort()).toEqual(Object.keys(expected).sort());
    });
});
