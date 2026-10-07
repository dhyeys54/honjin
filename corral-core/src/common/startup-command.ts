import { owningProject } from './paths';
import type { ProjectOverride } from './preferences-schema';

export function resolveStartupCommand(
    folderPath: string, projects: string[],
    global: string, overrides: Record<string, ProjectOverride>
): string {
    const project = owningProject(folderPath, projects);
    const override = project === undefined ? undefined : overrides[project]?.startupCommand;
    return typeof override === 'string' ? override : global;
}

/** `projectOverrides` after setting one project's command (`undefined` drops the override, `''` is a plain shell). */
export function withOverride(
    overrides: Record<string, ProjectOverride>, project: string, command: string | undefined
): Record<string, ProjectOverride> {
    const next = { ...overrides };
    delete next[project];
    return command === undefined ? next : { ...next, [project]: { ...overrides[project], startupCommand: command } };
}
