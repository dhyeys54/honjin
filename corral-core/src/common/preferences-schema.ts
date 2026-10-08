import type { AgentId } from './prerequisites';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import type { PreferenceDataProperty, PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const CorralPreferenceKeys = {
    scanRoots: 'corral.scanRoots',
    extraProjects: 'corral.extraProjects',
    hiddenProjects: 'corral.hiddenProjects',
    agentCommands: 'corral.agentCommands',
    projectOverrides: 'corral.projectOverrides',
    herdrPath: 'corral.herdr.path',
    herdrSession: 'corral.herdr.session',
    firstRunCompleted: 'corral.firstRunCompleted',
    resourceMonitorEnabled: 'corral.resourceMonitor.enabled',
    resourceMonitorWarningPercent: 'corral.resourceMonitor.warningPercent',
    resourceMonitorDangerPercent: 'corral.resourceMonitor.dangerPercent',
    resourceMonitorIntervalSeconds: 'corral.resourceMonitor.intervalSeconds',
    agentsIntervalSeconds: 'corral.agents.intervalSeconds'
} as const;

export interface ProjectOverride {
    startupCommand?: string;
}

/** Typed view of the settings; keys mirror {@link CorralPreferenceKeys}. */
export interface CorralConfiguration {
    'corral.scanRoots': string[];
    'corral.extraProjects': string[];
    'corral.hiddenProjects': string[];
    'corral.agentCommands': Partial<Record<AgentId, string>>;
    'corral.projectOverrides': Record<string, ProjectOverride>;
    'corral.herdr.path': string;
    'corral.herdr.session': string;
    'corral.firstRunCompleted': boolean;
    'corral.resourceMonitor.enabled': boolean;
    'corral.resourceMonitor.warningPercent': number;
    'corral.resourceMonitor.dangerPercent': number;
    'corral.resourceMonitor.intervalSeconds': number;
    'corral.agents.intervalSeconds': number;
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
        'corral.agentCommands': {
            type: 'object', scope,
            default: { claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode' },
            description: 'The command + types for each agent, so you can add flags (for example "claude --model opus").',
            additionalProperties: { type: 'string' }
        },
        'corral.projectOverrides': {
            type: 'object', default: {}, scope,
            description: 'Per-project overrides, keyed by project path.',
            additionalProperties: { type: 'object', properties: { startupCommand: { type: 'string' } } }
        },
        'corral.herdr.path': { type: 'string', default: 'herdr', scope, description: 'herdr binary name or absolute path.' },
        'corral.herdr.session': { type: 'string', default: '', scope, description: 'herdr session name. Empty means herdr\'s default session.' },
        'corral.firstRunCompleted': { type: 'boolean', default: false, scope, description: 'Set once the first-run folder picker has been shown.' },
        'corral.resourceMonitor.enabled': { type: 'boolean', default: true, scope, description: 'Show the memory, CPU and process total of Corral and its herdr session in the status bar.' },
        'corral.resourceMonitor.warningPercent': {
            type: 'number', default: 50, minimum: 1, maximum: 100, scope,
            description: 'Share of the machine\'s RAM at which the resource entry turns warning-coloured.'
        },
        'corral.resourceMonitor.dangerPercent': {
            type: 'number', default: 75, minimum: 1, maximum: 100, scope,
            description: 'Share of the machine\'s RAM at which the resource entry turns danger-coloured and one notification is shown.'
        },
        'corral.resourceMonitor.intervalSeconds': { type: 'number', default: 5, minimum: 1, scope, description: 'Seconds between resource samples.' },
        'corral.agents.intervalSeconds': { type: 'number', default: 3, minimum: 1, scope, description: 'Seconds between refreshes of the Agents view.' }
    }
};
