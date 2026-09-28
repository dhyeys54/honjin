import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import type { PreferenceDataProperty, PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const CorralPreferenceKeys = {
    scanRoots: 'corral.scanRoots',
    extraProjects: 'corral.extraProjects',
    hiddenProjects: 'corral.hiddenProjects',
    startupCommand: 'corral.startupCommand',
    projectOverrides: 'corral.projectOverrides',
    herdrPath: 'corral.herdr.path',
    herdrSession: 'corral.herdr.session',
    firstRunCompleted: 'corral.firstRunCompleted'
} as const;

export interface ProjectOverride {
    startupCommand?: string;
}

/** Typed view of the settings; keys mirror {@link CorralPreferenceKeys}. */
export interface CorralConfiguration {
    'corral.scanRoots': string[];
    'corral.extraProjects': string[];
    'corral.hiddenProjects': string[];
    'corral.startupCommand': string;
    'corral.projectOverrides': Record<string, ProjectOverride>;
    'corral.herdr.path': string;
    'corral.herdr.session': string;
    'corral.firstRunCompleted': boolean;
}

// User scope only: project repos must never be touched by Corral settings (spec 05).
const scope = PreferenceScope.User;
const stringList = (): PreferenceDataProperty => ({ type: 'array', items: { type: 'string' }, default: [], scope });

export const corralPreferenceSchema: PreferenceSchema = {
    scope,
    title: 'Corral',
    properties: {
        'corral.scanRoots': { ...stringList(), description: 'Folders whose immediate subfolders are projects. "~" is allowed.' },
        'corral.extraProjects': { ...stringList(), description: 'Projects added by hand.' },
        'corral.hiddenProjects': { ...stringList(), description: 'Projects left out of the tree and the workspace.' },
        'corral.startupCommand': {
            type: 'string', default: 'claude', scope,
            description: 'Typed into every new herdr tab. Empty means a plain shell.'
        },
        'corral.projectOverrides': {
            type: 'object', default: {}, scope,
            description: 'Per-project overrides, keyed by project path.',
            additionalProperties: { type: 'object', properties: { startupCommand: { type: 'string' } } }
        },
        'corral.herdr.path': { type: 'string', default: 'herdr', scope, description: 'herdr binary name or absolute path.' },
        'corral.herdr.session': { type: 'string', default: '', scope, description: 'herdr session name. Empty means herdr\'s default session.' },
        'corral.firstRunCompleted': { type: 'boolean', default: false, scope, description: 'Set once the first-run folder picker has been shown.' }
    }
};
