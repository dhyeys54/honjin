import { owningProject } from './paths';
import type { ProjectOverride } from './preferences-schema';

/** The project's own command, or `undefined` when + should ask which agent to run (spec 13 S9). */
export function resolveStartupCommand(
    folderPath: string, projects: string[], overrides: Record<string, ProjectOverride>
): string | undefined {
    const project = owningProject(folderPath, projects);
    const override = project === undefined ? undefined : overrides[project]?.startupCommand;
    return typeof override === 'string' ? override : undefined;
}

/** `projectOverrides` after setting one project's command (`undefined` drops the override, `''` is a plain shell). */
export function withOverride(
    overrides: Record<string, ProjectOverride>, project: string, command: string | undefined
): Record<string, ProjectOverride> {
    const next = { ...overrides };
    delete next[project];
    return command === undefined ? next : { ...next, [project]: { ...overrides[project], startupCommand: command } };
}
