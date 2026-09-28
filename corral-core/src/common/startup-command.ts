import type { ProjectOverride } from './preferences-schema';

/** The longest project equal to `folderPath` or a path-boundary prefix of it. */
export function owningProject(folderPath: string, projects: string[]): string | undefined {
    let best: string | undefined;
    for (const project of projects) {
        const owns = folderPath === project || folderPath.startsWith(project.endsWith('/') ? project : project + '/');
        if (owns && (best === undefined || project.length > best.length)) {
            best = project;
        }
    }
    return best;
}

export function resolveStartupCommand(
    folderPath: string, projects: string[],
    global: string, overrides: Record<string, ProjectOverride>
): string {
    const project = owningProject(folderPath, projects);
    const override = project === undefined ? undefined : overrides[project]?.startupCommand;
    return typeof override === 'string' ? override : global;
}
