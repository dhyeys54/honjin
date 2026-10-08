import type { AgentId } from './prerequisites';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import type { PreferenceDataProperty, PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const HonjinPreferenceKeys = {
    scanRoots: 'honjin.scanRoots',
    extraProjects: 'honjin.extraProjects',
    hiddenProjects: 'honjin.hiddenProjects',
    agentCommands: 'honjin.agentCommands',
    projectOverrides: 'honjin.projectOverrides',
    herdrPath: 'honjin.herdr.path',
    herdrSession: 'honjin.herdr.session',
    firstRunCompleted: 'honjin.firstRunCompleted',
    resourceMonitorEnabled: 'honjin.resourceMonitor.enabled',
    resourceMonitorWarningPercent: 'honjin.resourceMonitor.warningPercent',
    resourceMonitorDangerPercent: 'honjin.resourceMonitor.dangerPercent',
    resourceMonitorIntervalSeconds: 'honjin.resourceMonitor.intervalSeconds',
    agentsIntervalSeconds: 'honjin.agents.intervalSeconds',
    updatesCheck: 'honjin.updates.check'
} as const;

export interface ProjectOverride {
    startupCommand?: string;
}

/** Typed view of the settings; keys mirror {@link HonjinPreferenceKeys}. */
export interface HonjinConfiguration {
    'honjin.scanRoots': string[];
    'honjin.extraProjects': string[];
    'honjin.hiddenProjects': string[];
    'honjin.agentCommands': Partial<Record<AgentId, string>>;
    'honjin.projectOverrides': Record<string, ProjectOverride>;
    'honjin.herdr.path': string;
    'honjin.herdr.session': string;
    'honjin.firstRunCompleted': boolean;
    'honjin.resourceMonitor.enabled': boolean;
    'honjin.resourceMonitor.warningPercent': number;
    'honjin.resourceMonitor.dangerPercent': number;
    'honjin.resourceMonitor.intervalSeconds': number;
    'honjin.agents.intervalSeconds': number;
    'honjin.updates.check': boolean;
}

// User scope only: project repos must never be touched by Honjin settings (spec 05).
const scope = PreferenceScope.User;
const stringList = (): PreferenceDataProperty => ({ type: 'array', items: { type: 'string' }, default: [], scope });

export const honjinPreferenceSchema: PreferenceSchema = {
    scope,
    title: 'Honjin',
    properties: {
        'honjin.scanRoots': { ...stringList(), description: 'Folders whose immediate subfolders are projects. "~" is allowed.' },
        'honjin.extraProjects': { ...stringList(), description: 'Projects added by hand.' },
        'honjin.hiddenProjects': { ...stringList(), description: 'Projects left out of the tree and the workspace.' },
        'honjin.agentCommands': {
            type: 'object', scope,
            default: { claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' },
            description: 'The command + types for each agent, so you can add flags (for example "claude --model opus").',
            additionalProperties: { type: 'string' }
        },
        'honjin.projectOverrides': {
            type: 'object', default: {}, scope,
            description: 'Per-project overrides, keyed by project path.',
            additionalProperties: { type: 'object', properties: { startupCommand: { type: 'string' } } }
        },
        'honjin.herdr.path': { type: 'string', default: 'herdr', scope, description: 'herdr binary name or absolute path.' },
        'honjin.herdr.session': { type: 'string', default: '', scope, description: 'herdr session name. Empty means herdr\'s default session.' },
        'honjin.updates.check': {
            type: 'boolean', default: true, scope,
            description: 'Once a day, ask GitHub whether a newer Honjin release exists. This is the only request Honjin makes itself.'
        },
        'honjin.firstRunCompleted': { type: 'boolean', default: false, scope, description: 'Set once the first-run folder picker has been shown.' },
        'honjin.resourceMonitor.enabled': { type: 'boolean', default: true, scope, description: 'Show the memory, CPU and process total of Honjin and its herdr session in the status bar.' },
        'honjin.resourceMonitor.warningPercent': {
            type: 'number', default: 50, minimum: 1, maximum: 100, scope,
            description: 'Share of the machine\'s RAM at which the resource entry turns warning-coloured.'
        },
        'honjin.resourceMonitor.dangerPercent': {
            type: 'number', default: 75, minimum: 1, maximum: 100, scope,
            description: 'Share of the machine\'s RAM at which the resource entry turns danger-coloured and one notification is shown.'
        },
        'honjin.resourceMonitor.intervalSeconds': { type: 'number', default: 5, minimum: 1, scope, description: 'Seconds between resource samples.' },
        'honjin.agents.intervalSeconds': { type: 'number', default: 3, minimum: 1, scope, description: 'Seconds between refreshes of the Agents view.' }
    }
};
